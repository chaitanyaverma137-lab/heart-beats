const { app, BrowserWindow, dialog, ipcMain, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const { autoUpdater } = require("electron-updater");
const { parseFile } = require("music-metadata");

let mainWindow;

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


app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 680,
    backgroundColor: "#09090d", title: "Heart Beats",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false }
  });
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  ipcMain.handle("app:version", () => app.getVersion());

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
