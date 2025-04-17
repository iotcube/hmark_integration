const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");

// ✨ GPU 충돌 방지
app.disableHardwareAcceleration();

// 📝 로그 파일 설정
const logFilePath = path.join(app.getPath("userData"), "hmark-log.txt");
function logToFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFilePath, `[${timestamp}] ${message}\n`);
}

// 📁 폴더 선택
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// 리스타트
ipcMain.on("restart-app", () => {
  if (flaskProcess) {
    flaskProcess.kill(); // 🔥 Flask 먼저 종료
  }
  app.relaunch();
  app.exit(0);
});

// 📄 파일 저장
ipcMain.handle("save-file", async (event, filename, content) => {
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

// ZIP 저장
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

// 🔧 창 조작 이벤트
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
  if (win) win.close();
});

// 🪟 브라우저 윈도우 생성
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

  // 개발용
  // win.loadURL("http://localhost:5173");
}

// 🐍 Flask 백엔드 실행
let flaskProcess = null;

app.whenReady().then(() => {
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

  // 파일 존재 여부 체크
  if (!fs.existsSync(flaskExePath)) {
    const msg = "❌ flask_server 실행파일이 존재하지 않습니다.";
    console.error(msg);
    logToFile(msg);
  }

  flaskProcess = spawn(flaskExePath, [], {
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

  createWindow();
});

app.on("will-quit", () => {
  if (flaskProcess) flaskProcess.kill();
});
