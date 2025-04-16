const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  saveFile: (filename, content) =>
    ipcRenderer.invoke("save-file", filename, content),
  saveZipFile: (defaultName, buffer) =>
    ipcRenderer.invoke("save-zip-file", defaultName, buffer),
  restartApp: () => ipcRenderer.send("restart-app"),
});
