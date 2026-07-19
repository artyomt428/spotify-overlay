import { contextBridge, ipcRenderer } from "electron";
import type {
  SpotifyOverlayAPI,
  SpotifyRendererApi,
  SpotifyServiceApi,
} from "./types";

/*
 * A sandboxed Electron preload cannot import local runtime modules. Keep this
 * small protocol table self-contained; `satisfies` keeps it synchronized with
 * SpotifyServiceApi at compile time.
 */
const IPC_CHANNELS = {
  spotifyInvoke: "spotify:invoke",
  appQuit: "app:quit",
  setPlaylistExpanded: "window:setPlaylistExpanded",
  playlistVisibility: "window:playlistVisibility",
} as const;

const SPOTIFY_METHODS = {
  login: true,
  isLoggedIn: true,
  getNowPlaying: true,
  play: true,
  pause: true,
  next: true,
  previous: true,
  toggleShuffle: true,
  getVolume: true,
  setVolume: true,
  setTrackSaved: true,
} as const satisfies Record<keyof SpotifyServiceApi, true>;

type SpotifyMethod = keyof typeof SPOTIFY_METHODS;

function createSpotifyRendererApi(): SpotifyRendererApi {
  const methods = Object.keys(SPOTIFY_METHODS) as SpotifyMethod[];
  const entries = methods.map((method) => [
    method,
    (...args: unknown[]) => ipcRenderer.invoke(
      IPC_CHANNELS.spotifyInvoke,
      method,
      args,
    ),
  ] as const);

  return Object.fromEntries(entries) as SpotifyRendererApi;
}

const api: SpotifyOverlayAPI = {
  ...createSpotifyRendererApi(),

  quit: () => ipcRenderer.send(IPC_CHANNELS.appQuit),

  setPlaylistExpanded: (expanded) => {
    ipcRenderer.send(IPC_CHANNELS.setPlaylistExpanded, expanded);
  },

  onPlaylistVisibilityChanged: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      visible: boolean,
    ) => callback(visible);

    ipcRenderer.on(IPC_CHANNELS.playlistVisibility, listener);
    return () => ipcRenderer.removeListener(
      IPC_CHANNELS.playlistVisibility,
      listener,
    );
  },
};

contextBridge.exposeInMainWorld("spotifyOverlay", api);
