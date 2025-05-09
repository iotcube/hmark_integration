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

let flaskProcess = null;
let flaskKilled = false;

function safeKillFlask(reason = "") {
  if (flaskKilled || !flaskProcess) return;
  flaskKilled = true;

  logToFile(`Flask 종료 시도 (${reason})`);

  if (process.platform === "win32") {
    exec("taskkill /IM flask_server.exe /F", (error) => {
      if (error) {
        logToFile(`Flask 종료 실패 (Windows): ${error.message}`);
      } else {
        logToFile("Flask 종료 완료 (Windows)");
      }
    });
  } else {
    flaskProcess.kill();
    logToFile("Flask 종료 완료 (Unix)");
  }
}

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

// Flask 실행
app.whenReady().then(async () => {
  const isDev = !app.isPackaged;

  const backendPath = isDev
    ? path.resolve(__dirname, "../backend/dist")
    : path.join(process.resourcesPath, "backend/dist");

  const flaskExePath = path.join(
    backendPath,
    os.platform() === "win32" ? "flask_server.exe" : "flask_server"
  );

  console.log("실행할 Flask 경로:", flaskExePath);
  console.log("실행 디렉토리:", backendPath);
  logToFile(`실행할 Flask 경로: ${flaskExePath}`);
  logToFile(`실행 디렉토리: ${backendPath}`);

  if (!fs.existsSync(flaskExePath)) {
    const msg = "flask_server 실행파일이 존재하지 않습니다.";
    console.error(msg);
    logToFile(msg);
    return;
  }

  try {
    const flaskPort = await findAvailablePort(5000, 5100);
    global.sharedFlaskPort = flaskPort;
    logToFile(`Flask 실행 포트: ${flaskPort}`);

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
      logToFile(`Flask 실행 실패: ${err.message}`);
    });

    flaskProcess.on("exit", (code, signal) => {
      console.log(`[Flask 종료됨] code: ${code}, signal: ${signal}`);
      logToFile(` Flask 종료됨 - code: ${code}, signal: ${signal}`);
    });
  } catch (err) {
    console.error("포트 탐색 실패:", err);
    logToFile(`포트 탐색 실패: ${err.message}`);
    return;
  }

  createWindow();
});

// 종료 이벤트 처리
app.on("before-quit", () => safeKillFlask("before-quit"));
app.on("will-quit", () => safeKillFlask("will-quit"));
process.on("SIGINT", () => safeKillFlask("SIGINT"));
process.on("SIGTERM", () => safeKillFlask("SIGTERM"));

// 창 컨트롤
ipcMain.on("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    safeKillFlask("window-close");
    win.close();
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
ipcMain.on("restart-app", () => {
  safeKillFlask("restart-app");
  app.relaunch();
  app.exit(0);
});

// 폴더 선택
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  return result.canceled ? null : result.filePaths[0];
});

// 파일 저장 핸들러
ipcMain.handle("save-file", async (event, filename, content) => {
  try {
    const savePath = path.resolve(process.cwd(), filename);
    fs.writeFileSync(savePath, content, "utf-8");
    return savePath;
  } catch (err) {
    console.error("파일 저장 중 오류 발생:", err);
    logToFile(`파일 저장 실패: ${err.message}`);
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
    logToFile(`ZIP 저장 실패: ${e.message}`);
    return null;
  }
});
