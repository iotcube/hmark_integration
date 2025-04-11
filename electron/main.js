const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");

// ✨ GPU 충돌 방지
app.disableHardwareAcceleration();

// 📁 폴더 선택
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// 📄 파일 저장
ipcMain.handle("save-file", async (event, filename, content) => {
  try {
    const savePath = path.resolve(process.cwd(), filename); // 절대경로 보장
    fs.writeFileSync(savePath, content, "utf-8");
    return savePath;
  } catch (e) {
    console.error("파일 저장 실패:", e);
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
    webPreferences: {
      preload: path.resolve(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  // 🔐 배포 모드: 한글 경로 대응 안전 로딩
  const indexPath = path.resolve(__dirname, "../frontend/dist/index.html");
  const indexURL = pathToFileURL(indexPath).href;
  win.loadURL(indexURL);

  // 개발 서버용: 필요 시
  // win.loadURL("http://localhost:5173");
}

// 🐍 Flask 백엔드 실행
let flaskProcess = null;

app.whenReady().then(() => {
  const backendPath = path.resolve(__dirname, "../backend");
  const scriptPath = path.resolve(backendPath, "app.py");

  const venvPython =
    os.platform() === "win32"
      ? path.resolve(backendPath, "venv/Scripts/python.exe")
      : path.resolve(backendPath, "venv/bin/python");

  flaskProcess = spawn(venvPython, [scriptPath]);

  flaskProcess.stdout.on("data", (data) => {
    console.log(`Flask: ${data}`);
  });

  flaskProcess.stderr.on("data", (data) => {
    const text = data.toString();
    if (text.includes("Traceback") || text.includes("Error")) {
      console.error(`[Flask ERROR] ${text}`);
    } else {
      console.log(`[Flask LOG]`, text);
    }
  });

  flaskProcess.on("error", (err) => {
    console.error("Flask 실행 실패:", err);
  });

  createWindow();
});

app.on("will-quit", () => {
  if (flaskProcess) flaskProcess.kill();
});
