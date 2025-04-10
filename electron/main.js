const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

let flaskProcess = null;

// ✨ GPU 충돌 방지
app.disableHardwareAcceleration();

// ✅ 폴더 선택
ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// ✅ 파일 저장 (.hidx 등)
ipcMain.handle("save-file", async (event, filename, content) => {
  try {
    const savePath = path.join(process.cwd(), filename); // 또는 dialog로 경로 받아도 됨
    fs.writeFileSync(savePath, content, "utf-8");
    return savePath;
  } catch (e) {
    console.error("❌ 파일 저장 실패:", e);
    return null;
  }
});

// ✅ ZIP 저장
ipcMain.handle("save-zip-file", async (event, defaultName, buffer) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "ZIP 파일 저장",
      defaultPath: defaultName,
      filters: [{ name: "ZIP Files", extensions: ["zip"] }],
    });

    if (canceled || !filePath) return null;

    fs.writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
  } catch (err) {
    console.error("❌ ZIP 저장 실패:", err);
    return null;
  }
});

// ✅ 창 제어
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

// ✅ 창 생성
function createWindow() {
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

  // 개발용
  // win.loadURL("http://localhost:5173");

  // 배포용
  win.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
}

// ✅ Flask 서버 실행 및 Electron 앱 초기화
app.whenReady().then(() => {
  const backendPath = path.join(__dirname, "../backend");
  const scriptPath = path.join(backendPath, "app.py");

  const venvPython =
    os.platform() === "win32"
      ? path.join(backendPath, "venv", "Scripts", "python.exe")
      : path.join(backendPath, "venv", "bin", "python");

  flaskProcess = spawn(venvPython, [scriptPath]);

  flaskProcess.stdout.on("data", (data) => {
    console.log(`Flask: ${data}`);
  });

  flaskProcess.stderr.on("data", (data) => {
    const text = data.toString();
    if (text.includes("Traceback") || text.includes("Error")) {
      console.error(`[Flask ERROR] ${text}`);
    } else {
      console.log(`[Flask ACCESS LOG] : `, text.trim());
    }
  });

  flaskProcess.on("error", (err) => {
    console.error("❌ Flask 프로세스 실행 실패:", err);
  });

  createWindow();
});

app.on("will-quit", () => {
  if (flaskProcess) flaskProcess.kill();
});
