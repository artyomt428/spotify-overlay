import "dotenv/config";
import { app, BrowserWindow, ipcMain, screen } from "electron";
import * as path from "path";
import { IPC_CHANNELS } from "./ipc-contract";
import { spotifyService } from "./spotify";
import { registerSpotifyIpc } from "./spotify-ipc";

let overlayWindow: BrowserWindow | null = null;
let playlistWindow: BrowserWindow | null = null;
const COLLAPSED_HEIGHT = 120;
const PLAYLIST_PANEL_HEIGHT = 112;

registerSpotifyIpc(spotifyService);

function createOverlayWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 340,
    height: COLLAPSED_HEIGHT,
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


ipcMain.on(IPC_CHANNELS.setPlaylistExpanded, (_event, expanded: boolean) => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  if (!expanded) {
    playlistWindow?.close();
    playlistWindow = null;
    overlayWindow.webContents.send(IPC_CHANNELS.playlistVisibility, false);
    return;
  }

  if (playlistWindow && !playlistWindow.isDestroyed()) {
    playlistWindow.showInactive();
    overlayWindow.webContents.send(IPC_CHANNELS.playlistVisibility, true);
    return;
  }

  const bounds = overlayWindow.getBounds();
  playlistWindow = new BrowserWindow({
    width: bounds.width,
    height: PLAYLIST_PANEL_HEIGHT,
    x: bounds.x,
    y: bounds.y + COLLAPSED_HEIGHT + 6,
    parent: overlayWindow,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  playlistWindow.setAlwaysOnTop(true, "screen-saver");
  playlistWindow.loadFile(path.join(__dirname, "..", "renderer", "playlist.html"));
  playlistWindow.once("ready-to-show", () => {
    playlistWindow?.showInactive();
    overlayWindow?.webContents.send(IPC_CHANNELS.playlistVisibility, true);
  });
  playlistWindow.once("closed", () => {
    playlistWindow = null;
    overlayWindow?.webContents.send(IPC_CHANNELS.playlistVisibility, false);
  });
});

ipcMain.on(IPC_CHANNELS.appQuit, () => app.quit());
