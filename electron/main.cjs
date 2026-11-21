const { app, BrowserWindow, dialog, ipcMain, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { autoUpdater } = require("electron-updater");
const { parseFile } = require("music-metadata");

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
    width: 900, height: 176, minWidth: 620, minHeight: 150, maxHeight: 220,
    title: "Heart Beats · Floating Player", frame: false, resizable: true,
    alwaysOnTop: true, skipTaskbar: true, transparent: false,
    backgroundColor: "#171016",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#120e13;color:#fff;font:16px 'Segoe UI',Arial}
  body{padding:7px;background:transparent}.pill{height:100%;width:100%;position:relative;display:flex;align-items:center;gap:24px;padding:16px 28px;border-radius:100px;overflow:hidden;border:2px solid #ffffff55;background:linear-gradient(110deg,#251a1c,#130f12 76%);box-shadow:0 12px 34px #0009,inset 0 1px #ffffff22}
  .backdrop{position:absolute;inset:-35px;background-position:center;background-size:cover;filter:blur(26px) saturate(1.5);opacity:.48;transform:scale(1.15)}.shade{position:absolute;inset:0;background:linear-gradient(90deg,#140f12a8,#100d11d9 70%)}
  .drag{position:absolute;inset:0;-webkit-app-region:drag;z-index:1}.cover{position:relative;z-index:2;width:112px;height:112px;flex:none;border-radius:50%;border:5px solid #ffffffd9;box-shadow:0 0 0 5px #ffffff33;object-fit:cover;background:linear-gradient(135deg,#a855f7,#39223e);cursor:pointer;-webkit-app-region:no-drag}
  .meta{position:relative;z-index:2;min-width:0;flex:1;cursor:pointer;-webkit-app-region:no-drag}.title{font-size:25px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.artist{font-size:19px;color:#d0c5c9;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.state{font-size:10px;color:#c7a9b5;margin-top:6px;letter-spacing:1.2px;text-transform:uppercase}
  .controls{position:relative;z-index:2;display:flex;align-items:center;gap:20px;-webkit-app-region:no-drag}.controls button{width:64px;height:64px;border-radius:50%;background:transparent;color:#fff;display:grid;place-items:center;font-size:30px;cursor:pointer}.controls button.play{width:92px;height:92px;background:#fff;color:#090909;font-size:38px}.controls button:hover{background:#ffffff22}.controls button.play:hover{background:#eee}
  .progress{position:absolute;z-index:3;bottom:0;left:8%;right:8%;height:3px;background:#ffffff40;border-radius:8px;overflow:hidden}.bar{height:100%;width:0;background:#fff}.close{position:absolute;z-index:4;right:22px;top:10px;background:#0005;border:0;color:#ffffffa8;border-radius:50%;width:22px;height:22px;font-size:16px;cursor:pointer;-webkit-app-region:no-drag}
  @media(max-width:700px){.pill{gap:12px;padding:10px 14px}.cover{width:76px;height:76px}.title{font-size:17px}.artist{font-size:13px}.controls{gap:4px}.controls button{width:42px;height:48px;font-size:22px}.controls button.play{width:62px;height:62px;font-size:28px}}
  </style></head><body><div class="pill"><div class="backdrop" id="backdrop"></div><div class="shade"></div><div class="drag"></div><img class="cover" id="cover" alt="Album artwork" onclick="window.hbMini.expand()"><div class="meta" onclick="window.hbMini.expand()"><div class="title" id="title">Nothing playing</div><div class="artist" id="artist">Your music library</div><div class="state" id="state">Heart Beats</div></div><div class="controls"><button onclick="window.hbMini.previous()" title="Previous">|◀</button><button class="play" id="play" onclick="window.hbMini.toggle()">▶</button><button onclick="window.hbMini.next()" title="Next">▶|</button></div><button class="close" onclick="window.hbMini.close()" title="Close">×</button><div class="progress"><div class="bar" id="bar"></div></div></div>
  <script>const fmt=n=>Math.floor((n||0)/60)+':'+String(Math.floor((n||0)%60)).padStart(2,'0');window.hbMini.onState(s=>{document.getElementById('title').textContent=s.title||'Nothing playing';document.getElementById('artist').textContent=s.artist||'Heart Beats library';document.getElementById('state').textContent=s.playing?'NOW PLAYING · '+fmt(s.time)+' / '+fmt(s.duration):'PAUSED';document.getElementById('play').textContent=s.playing?'Ⅱ':'▶';document.getElementById('bar').style.width=(s.duration?100*s.time/s.duration:0)+'%';const c=document.getElementById('cover'),b=document.getElementById('backdrop');if(s.artwork){c.src=s.artwork;b.style.backgroundImage='url("'+s.artwork+'")'}else{c.removeAttribute('src');c.style.background='linear-gradient(135deg,#a855f7,#39223e)';b.style.backgroundImage='none'}});</script></body></html>`;
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
    return Promise.all(result.filePaths.map(async file => {
      const name = path.basename(file, path.extname(file));
      let artist = "Unknown artist", artwork = "", metadataTitle = "";
      try {
        const metadata = await parseFile(file, { skipCovers: false });
        metadataTitle = metadata.common.title || "";
        artist = metadata.common.artist || metadata.common.albumartist || artist;
        const picture = metadata.common.picture?.[0];
        if (picture?.data) artwork = `data:${picture.format || "image/jpeg"};base64,${picture.data.toString("base64")}`;
      } catch (error) { console.warn("Could not read audio tags:", file, error.message); }
      return { name: metadataTitle || name, artist, artwork, path: file, url: pathToFileURL(file).href, size: fs.statSync(file).size };
    }));
  });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
