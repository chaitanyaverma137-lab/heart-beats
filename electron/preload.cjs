const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("echo", {
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: (callback) => { const handler = (_event, status) => callback(status); ipcRenderer.on("updates:status", handler); return () => ipcRenderer.removeListener("updates:status", handler); },
  pickAudio: () => ipcRenderer.invoke("audio:pick"),
  pickLyrics: () => ipcRenderer.invoke("lyrics:pick"),
  findLyrics: (track) => ipcRenderer.invoke("lyrics:search", track),
  exitPlayerFullscreen: () => ipcRenderer.send("player:exit-fullscreen")
});
