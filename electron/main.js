const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const net = require("net");
const { spawn, exec } = require("child_process");
const { pathToFileURL } = require("url");

app.disableHardwareAcceleration();

const logFilePath = path.join(app.getPath("userData"), "hmark-log.txt");
function logToFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
}

ipcMain.on("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    forceKillFlask();
    win.close();
  }
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.on("restart-app", () => {
  if (flaskProcess) flaskProcess.kill();
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("save-hatbom-file", async (event, filename, content) => {
  try {
    const savePath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(savePath, content, "utf-8");
    return savePath;
  } catch (e) {
    console.error("파일 저장 실패:", e);
    logToFile(`❌ 파일 저장 실패: ${e.message}`);
    return null;
  }
});

ipcMain.handle("save-vuddy-file", async (event, filename, content) => {
  try {
    const savePath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(savePath, content, "utf-8");
    return savePath;
  } catch (e) {
    console.error("파일 저장 실패:", e);
    logToFile(`❌ 파일 저장 실패: ${e.message}`);
    return null;
  }
});

ipcMain.handle("save-zip-file", async (event, defaultName, buffer) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (canceled || !filePath) return null;
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (e) {
    console.error("ZIP 저장 실패:", e);
    logToFile(`❌ ZIP 저장 실패: ${e.message}`);
    return null;
  }
});

// 파일 저장 핸들러 등록
ipcMain.handle("save-file", async (event, filename, content) => {
  try {
    const savePath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(savePath, content, "utf-8");
    return savePath;
  } catch (err) {
    console.error("파일 저장 중 오류 발생:", err);
    throw err;
  }
});

ipcMain.on("window-minimize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});
ipcMain.on("window-maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (flaskProcess) {
      flaskProcess.kill();
      logToFile("Flask 프로세스 종료됨 (윈도우 닫힘)");
    }
    win.close();
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 700,
    height: 900,
    frame: false,
    hasShadow: false,
    resizable: false,
    icon: path.resolve(__dirname, "../public/icons/icon.ico"),
    webPreferences: {
      preload: path.resolve(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  const indexPath = path.resolve(__dirname, "../frontend/dist/index.html");
  const indexURL = pathToFileURL(indexPath).href;
  win.loadURL(indexURL);

  // win.webContents.openDevTools();
}

let flaskProcess = null;

function findAvailablePort(start = 5000, end = 5100) {
  return new Promise((resolve, reject) => {
    let port = start;

    const check = () => {
      if (port > end) return reject(new Error("사용 가능한 포트 없음"));

      const server = net.createServer();
      server.once("error", () => {
        port++;
        check();
      });
      server.once("listening", () => {
        server.close(() => resolve(port));
      });
      server.listen(port, "127.0.0.1");
    };

    check();
  });
}

function forceKillFlask() {
  if (process.platform === "win32") {
    exec("taskkill /IM flask_server.exe /F", (error, stdout, stderr) => {
      if (error) {
        logToFile(`❌ Flask 강제종료 실패: ${error.message}`);
      } else {
        logToFile(`🛑 Flask 강제종료 성공`);
      }
    });
  } else {
    if (flaskProcess) flaskProcess.kill();
  }
}

app.whenReady().then(async () => {
  const isDev = !app.isPackaged;

  const backendPath = isDev
    ? path.resolve(__dirname, "../backend/dist")
    : path.join(process.resourcesPath, "backend/dist");

  const flaskExePath = path.join(
    backendPath,
    os.platform() === "win32" ? "flask_server.exe" : "flask_server"
  );

  console.log("🚀 실행할 Flask 경로:", flaskExePath);
  console.log("📁 실행 디렉토리:", backendPath);
  logToFile(`🚀 실행할 Flask 경로: ${flaskExePath}`);
  logToFile(`📁 실행 디렉토리: ${backendPath}`);

  if (!fs.existsSync(flaskExePath)) {
    const msg = "❌ flask_server 실행파일이 존재하지 않습니다.";
    console.error(msg);
    logToFile(msg);
    return;
  }

  try {
    const flaskPort = await findAvailablePort(5000, 5100);
    global.sharedFlaskPort = flaskPort;
    logToFile(`✅ Flask 실행 포트: ${flaskPort}`);

    flaskProcess = spawn(flaskExePath, ["--port", flaskPort.toString()], {
      cwd: backendPath,
    });

    flaskProcess.stdout.on("data", (data) => {
      const text = data.toString();
      console.log(`Flask: ${text}`);
      logToFile(`Flask stdout: ${text}`);
    });

    flaskProcess.stderr.on("data", (data) => {
      const text = data.toString();
      if (text.includes("Traceback") || text.includes("Error")) {
        console.error(`[Flask ERROR] ${text}`);
        logToFile(`[Flask ERROR] ${text}`);
      } else {
        console.log(`[Flask LOG] ${text}`);
        logToFile(`[Flask LOG] ${text}`);
      }
    });

    flaskProcess.on("error", (err) => {
      console.error("Flask 실행 실패:", err);
      logToFile(`❌ Flask 실행 실패: ${err.message}`);
    });

    flaskProcess.on("exit", (code, signal) => {
      console.log(`[Flask 종료됨] code: ${code}, signal: ${signal}`);
      logToFile(`❗ Flask 종료됨 - code: ${code}, signal: ${signal}`);
    });
  } catch (err) {
    console.error("포트 탐색 실패:", err);
    logToFile(`❌ 포트 탐색 실패: ${err.message}`);
    return;
  }

  createWindow();
});

app.on("will-quit", () => {
  if (flaskProcess) flaskProcess.kill();
});

app.on("before-quit", () => {
  forceKillFlask();
});
