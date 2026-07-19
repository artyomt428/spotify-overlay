import * as path from "node:path";
import { app } from "electron";
import { SpotifyAuthService } from "./service/spotify/spotify-authorization";
import { SpotifyClient } from "./service/spotify/spotify-client";
import { SpotifyLibraryService } from "./service/spotify/spotify-library-service";
import { SpotifyPlaybackService } from "./service/spotify/spotify-playback-service";
import { FileTokenStorage } from "./service/spotify/token-file-storage";
import type { SpotifyServiceApi } from "./types";

const clientId = process.env.SPOTIFY_CLIENT_ID ?? "";
const redirectUri = process.env.SPOTIFY_REDIRECT_URI
  ?? "http://127.0.0.1:8888/callback";
const scopes = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-library-read",
  "user-library-modify",
].join(" ");

const tokenPath = path.join(app.getPath("userData"), "spotify-tokens.json");
const tokenStorage = new FileTokenStorage(tokenPath);
const authService = new SpotifyAuthService(
  tokenStorage,
  clientId,
  redirectUri,
  scopes,
);
const spotifyClient = new SpotifyClient(authService);
const libraryService = new SpotifyLibraryService(spotifyClient);
const playbackService = new SpotifyPlaybackService(
  spotifyClient,
  libraryService,
);

/**
 * Main-process facade. To add a command, extend SpotifyServiceApi, allow it in
 * preload's method table and implement it here. Main needs no new IPC handler.
 */
export const spotifyService: SpotifyServiceApi = {
  login: async () => {
    try {
      return await authService.login();
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  isLoggedIn: () => {
    const tokens = tokenStorage.loadTokens();
    return tokens !== null && authService.hasRequiredScopes(tokens);
  },

  getNowPlaying: () => playbackService.getNowPlaying(),
  play: () => playbackService.play(),
  pause: () => playbackService.pause(),
  next: () => playbackService.next(),
  previous: () => playbackService.previous(),
  toggleShuffle: () => playbackService.toggleShuffle(),
  getVolume: () => playbackService.getVolume(),
  setVolume: (volumePercent) => playbackService.setVolume(volumePercent),
  setTrackSaved: (trackId, saved) => libraryService.setSavedState(trackId, saved),
};
