const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const os = require("os");
const fs = require("fs");

// ✨ GPU 충돌 방지
app.disableHardwareAcceleration();

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 현재 실행 파일이 있는 디렉토리 기준 저장
ipcMain.handle("save-file", async (event, filename, content) => {
  try {
    const savePath = path.join(process.cwd(), filename); // 현재 경로에 저장
    fs.writeFileSync(savePath, content, "utf-8");
    return savePath;
  } catch (e) {
    return null;
  }
});

let flaskProcess = null;

ipcMain.on("window-minimize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.on("window-maximize", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
});

ipcMain.on("window-close", () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

function createWindow() {
  // const win = new BrowserWindow({
  //   width: 800,
  //   height: 600,
  //   webPreferences: {
  //     preload: path.join(__dirname, "preload.js"),
  //     contextIsolation: true,
  //   },
  // });

  const win = new BrowserWindow({
    width: 800,
    height: 900,
    frame: false,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  win.loadFile(path.join(__dirname, "../frontend/dist/index.html")); //실제 배포 시
  // win.loadFile(path.join(__dirname, "http://localhost:5173")); // 개발 핫리로드 작동 시
}

app.whenReady().then(() => {
  // 가상환경의 Python 경로 설정
  const backendPath = path.join(__dirname, "../backend");
  const scriptPath = path.join(backendPath, "app.py");

  // OS에 따라 가상환경의 python 경로 다르게 설정
  const venvPython =
    os.platform() === "win32"
      ? path.join(backendPath, "venv", "Scripts", "python.exe") // Windows
      : path.join(backendPath, "venv", "bin", "python"); // macOS/Linux

  // Flask 서버 실행
  flaskProcess = spawn(venvPython, [scriptPath]);

  flaskProcess.stdout.on("data", (data) => {
    console.log(`Flask: ${data}`);
  });

  flaskProcess.stderr.on("data", (data) => {
    const text = data.toString();
    if (text.includes("Traceback") || text.includes("Error")) {
      console.error(`[Flask ERROR] ${text}`);
    } else {
      console.log(`[Flask ACCESS LOG] : `, JSON.stringify(text, 2, null)); // ← 여기로 보냄
    }
  });
  flaskProcess.on("error", (err) => {
    console.error("Failed to start Flask process:", err);
  });

  createWindow();
});

app.on("will-quit", () => {
  if (flaskProcess) flaskProcess.kill();
});
