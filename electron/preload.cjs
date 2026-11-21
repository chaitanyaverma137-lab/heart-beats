const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("echo", {
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: (callback) => { const handler = (_event, status) => callback(status); ipcRenderer.on("updates:status", handler); return () => ipcRenderer.removeListener("updates:status", handler); },
  pickAudio: () => ipcRenderer.invoke("audio:pick"),
  pickLyrics: () => ipcRenderer.invoke("lyrics:pick"),
  findLyrics: (track) => ipcRenderer.invoke("lyrics:search", track),
  openMini: () => ipcRenderer.invoke("mini:open"),
  miniControl: (action) => ipcRenderer.send("mini:control", action),
  miniState: (state) => ipcRenderer.send("mini:state", state),
  closeMini: () => ipcRenderer.send("mini:close"),
  exitPlayerFullscreen: () => ipcRenderer.send("player:exit-fullscreen"),
  onMiniExpand: (callback) => { const handler = () => callback(); ipcRenderer.on("mini:expand", handler); return () => ipcRenderer.removeListener("mini:expand", handler); },
  onMiniStateRequest: (callback) => { const handler = () => callback(); ipcRenderer.on("mini:request-state", handler); return () => ipcRenderer.removeListener("mini:request-state", handler); },
  onMiniControl: (callback) => { const handler = (_event, action) => callback(action); ipcRenderer.on("mini:control", handler); return () => ipcRenderer.removeListener("mini:control", handler); },
  onMiniState: (callback) => { const handler = (_event, state) => callback(state); ipcRenderer.on("mini:state", handler); return () => ipcRenderer.removeListener("mini:state", handler); }
});
contextBridge.exposeInMainWorld("hbMini", {
  toggle: () => ipcRenderer.send("mini:control", "toggle"),
  previous: () => ipcRenderer.send("mini:control", "previous"),
  next: () => ipcRenderer.send("mini:control", "next"),
  close: () => ipcRenderer.send("mini:close"),
  expand: () => ipcRenderer.send("mini:expand"),
  onState: (callback) => ipcRenderer.on("mini:state", (_event, state) => callback(state))
});
