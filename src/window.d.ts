import type { SpotifyOverlayAPI } from "./types";

declare global {
  interface Window {
    spotifyOverlay: SpotifyOverlayAPI;
  }
}

export {};
