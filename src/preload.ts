import { contextBridge, ipcRenderer } from "electron";
import type { SpotifyOverlayAPI } from "./types";

const api: SpotifyOverlayAPI = {
  login: () => ipcRenderer.invoke("spotify:login"),
  isLoggedIn: () => ipcRenderer.invoke("spotify:isLoggedIn"),
  getNowPlaying: () => ipcRenderer.invoke("spotify:getNowPlaying"),
  play: () => ipcRenderer.invoke("spotify:play"),
  pause: () => ipcRenderer.invoke("spotify:pause"),
  next: () => ipcRenderer.invoke("spotify:next"),
  previous: () => ipcRenderer.invoke("spotify:previous"),
  quit: () => ipcRenderer.send("app:quit"),
  shuffle: () => ipcRenderer.invoke("spotify:shuffle"),
  getVolume: () => ipcRenderer.invoke("spotify:getVolume"),
  setVolume: (volume: number) => ipcRenderer.invoke("spotify:setvolume", volume),
  TrackSaved: () => ipcRenderer.invoke("spotify:TrackSaved"),
  SaveTrack: () => ipcRenderer.invoke("spotify:savetrack"),
};

contextBridge.exposeInMainWorld("spotifyOverlay", api);
