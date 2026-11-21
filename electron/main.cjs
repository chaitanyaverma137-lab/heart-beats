const { app, BrowserWindow, dialog, ipcMain, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { autoUpdater } = require("electron-updater");

let mainWindow;
let miniWindow;

let updateCheckStarted = false;
function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("updates:status", status);
}
function showUpdateNotification(title, body) {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body });
    notification.on("click", () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); } });
    notification.show();
  }
}
function setupAutoUpdates() {
  if (!app.isPackaged || updateCheckStarted) return;
  updateCheckStarted = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus({ state: "checking", message: "Checking for updates…" }));
  autoUpdater.on("update-available", info => {
    const version = info.version || "new version";
    sendUpdateStatus({ state: "available", version, message: `Version ${version} is available. Downloading in the background…` });
    showUpdateNotification("Heart Beats update available", `Version ${version} is downloading in the background.`);
  });
  autoUpdater.on("update-not-available", info => sendUpdateStatus({ state: "current", version: info.version || app.getVersion(), message: "You're using the latest version." }));
  autoUpdater.on("download-progress", progress => sendUpdateStatus({ state: "downloading", percent: Math.round(progress.percent || 0), message: `Downloading update… ${Math.round(progress.percent || 0)}%` }));
  autoUpdater.on("update-downloaded", info => {
    const version = info.version || "new version";
    sendUpdateStatus({ state: "downloaded", version, message: `Version ${version} is ready. Restart to install it.` });
    showUpdateNotification("Heart Beats is ready to update", "Restart Heart Beats to install the latest version.");
  });
  autoUpdater.on("error", error => {
    console.error("Auto-update error:", error);
    sendUpdateStatus({ state: "error", message: "Update check failed. Please try again later." });
  });
  setTimeout(() => autoUpdater.checkForUpdates().catch(error => console.error("Update check failed:", error)), 5000);
  setInterval(() => autoUpdater.checkForUpdates().catch(error => console.error("Update check failed:", error)), 6 * 60 * 60 * 1000);
}


function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) { miniWindow.show(); miniWindow.focus(); return; }
  miniWindow = new BrowserWindow({
    width: 390, height: 174, minWidth: 340, minHeight: 160,
    title: "Heart Beats · Floating Player", frame: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true, transparent: false,
    backgroundColor: "#100d17",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,#17121e,#0d0c12);color:#f8f4fc;font:13px 'Segoe UI',Arial;border:1px solid #64447c;border-radius:16px;overflow:hidden}
  .shell{padding:13px 15px 12px}.drag{height:27px;position:absolute;top:0;left:0;right:0;-webkit-app-region:drag}.top{position:relative;z-index:2;pointer-events:none}.top button{pointer-events:auto;-webkit-app-region:no-drag}
  .top{display:flex;align-items:center;justify-content:space-between;height:20px;color:#b98bdb;font-size:9px;font-weight:700;letter-spacing:1.8px}
  .close{background:transparent;color:#9b90a6;border:0;font-size:20px;cursor:pointer;line-height:18px}
  .row{display:flex;align-items:center;gap:12px;margin-top:8px;cursor:pointer}
  .art{width:62px;height:62px;flex:none;border-radius:11px;background:linear-gradient(135deg,#a45bd0,#35234b);display:grid;place-items:center;font-size:29px;box-shadow:0 5px 20px #0008}
  .meta{min-width:0;flex:1}.title{font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sub{font-size:10px;color:#9d93a6;margin-top:5px}
  .controls{display:flex;align-items:center;gap:12px;margin-top:12px}.controls button{width:30px;height:28px;border:0;border-radius:9px;background:#282131;color:#eee;display:grid;place-items:center;cursor:pointer;font-size:15px}
  .controls .play{width:36px;height:34px;border-radius:50%;background:#e8d9f5;color:#25162e;font-size:17px}
  .progress{height:3px;background:#3a3042;border-radius:9px;margin-top:10px;overflow:hidden}.bar{height:100%;width:0;background:#c17ce9}
  .time{display:flex;justify-content:space-between;font-size:9px;color:#92879b;margin-top:4px}
  .expand-hint{font-size:9px;color:#897b94;margin-left:auto}
  </style></head><body><div class="drag"></div><div class="shell">
  <div class="top"><span>HEART BEATS · FLOATING PLAYER</span><button class="close" onclick="window.hbMini.close()">×</button></div>
  <div class="row" onclick="window.hbMini.expand()"><div class="art">♫</div><div class="meta"><div class="title" id="title">Nothing playing</div><div class="sub" id="state">Your music, always within reach</div><div class="expand-hint">Click artwork or title for full player ↗</div></div></div>
  <div class="controls"><button onclick="window.hbMini.previous()">|◀</button><button class="play" id="play" onclick="window.hbMini.toggle()">▶</button><button onclick="window.hbMini.next()">▶|</button><span style="flex:1"></span><span id="elapsed" style="font-size:9px;color:#9b90a5">0:00</span></div>
  <div class="progress"><div class="bar" id="bar"></div></div><div class="time"><span>HEART BEATS</span><span id="total">0:00</span></div></div>
  <script>const fmt=n=>Math.floor((n||0)/60)+':'+String(Math.floor((n||0)%60)).padStart(2,'0');window.hbMini.onState(s=>{document.getElementById('title').textContent=s.title||'Nothing playing';document.getElementById('state').textContent=s.playing?'Now playing':'Paused';document.getElementById('play').textContent=s.playing?'Ⅱ':'▶';document.getElementById('bar').style.width=(s.duration?100*s.time/s.duration:0)+'%';document.getElementById('elapsed').textContent=fmt(s.time);document.getElementById('total').textContent=fmt(s.duration)});</script></body></html>`;
  miniWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  miniWindow.on("closed", () => { miniWindow = null; });
}

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 680,
    backgroundColor: "#09090d", title: "Heart Beats",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  ipcMain.handle("updates:check", async () => {
    if (!app.isPackaged) {
      const status = { state: "dev", message: "Update checks are available in the installed version." };
      sendUpdateStatus(status);
      return status;
    }
    try { await autoUpdater.checkForUpdates(); return { state: "checking", message: "Checking for updates…" }; }
    catch (error) { console.error(error); return { state: "error", message: "Could not check for updates." }; }
  });
  ipcMain.handle("updates:install", () => { autoUpdater.quitAndInstall(true, true); });

  ipcMain.handle("lyrics:pick", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile"], filters: [{ name: "LRC Lyrics", extensions: ["lrc"] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    return { name: path.basename(result.filePaths[0]), content: fs.readFileSync(result.filePaths[0], "utf8") };
  });
  ipcMain.handle("lyrics:search", async (_event, { title, artist }) => {
    try {
      const params = new URLSearchParams({ track_name: String(title || "") });
      if (artist) params.set("artist_name", String(artist));
      const response = await fetch("https://lrclib.net/api/search?" + params.toString(), { headers: { "User-Agent": "HeartBeatsDesktop/0.8.0 (music player)" } });
      if (!response.ok) return null;
      const results = await response.json();
      const data = Array.isArray(results) ? (results.find(item => item.syncedLyrics) || results[0]) : results;
      if (!data || (!data.syncedLyrics && !data.plainLyrics)) return null;
      return { syncedLyrics: data.syncedLyrics || "", plainLyrics: data.plainLyrics || "", source: "LRCLIB" };
    } catch (error) { console.error("Lyrics lookup failed:", error); return null; }
  });
  ipcMain.handle("mini:open", () => { createMiniWindow(); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("mini:request-state"); });
  ipcMain.on("mini:expand", () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); mainWindow.setFullScreen(true); mainWindow.webContents.send("mini:expand"); } });
  ipcMain.on("player:exit-fullscreen", () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(false); });
  ipcMain.on("mini:control", (_event, action) => mainWindow?.webContents.send("mini:control", action));
  ipcMain.on("mini:state", (_event, state) => { if (miniWindow && !miniWindow.isDestroyed()) miniWindow.webContents.send("mini:state", state); });
  ipcMain.on("mini:close", () => miniWindow?.close());
  setupAutoUpdates();

  ipcMain.handle("audio:pick", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openFile", "multiSelections"], filters: [{ name: "Audio", extensions: ["mp3","wav","flac","m4a","aac","ogg","opus","wma"] }] });
    if (result.canceled) return [];
    return result.filePaths.map(file => ({ name: path.basename(file, path.extname(file)), path: file, url: pathToFileURL(file).href, size: fs.statSync(file).size }));
  });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
