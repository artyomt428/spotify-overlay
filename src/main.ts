import "dotenv/config";
import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "path";
import * as spotify from "./spotify";

let overlayWindow: BrowserWindow | null = null;

function createOverlayWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 340,
    height: 120,
    x: width - 360,
    y: 20,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // держим оверлей поверх всего, включая полноэкранные окна на macOS
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  overlayWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(() => {
  createOverlayWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createOverlayWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});


ipcMain.handle("spotify:login", async () => spotify.Login());
ipcMain.handle("spotify:isLoggedIn", () => spotify.isLoggedIn());
ipcMain.handle("spotify:getNowPlaying", () => spotify.getNowPlaying());
ipcMain.handle("spotify:play", () => spotify.play());
ipcMain.handle("spotify:pause", () => spotify.pause());
ipcMain.handle("spotify:next", () => spotify.next());
ipcMain.handle("spotify:previous", () => spotify.previous());
ipcMain.handle("spotify:shuffle", () => spotify.shuffle());
ipcMain.handle("spotify:getVolume", () => spotify.GetVolume());
ipcMain.handle("spotify:setvolume", (_event, volume:number) =>
  spotify.setVolume(volume),
);
ipcMain.handle("spotify:TrackSaved", () => spotify.TrackSaved());
ipcMain.handle("spotify:savetrack", () => spotify.saveSong());

ipcMain.on("app:quit", () => app.quit());
