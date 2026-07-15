import * as path from "node:path";
import { app } from "electron";
import {  NowPlaying } from "./types";
import {  SpotifyAuthService } from "./service/spotify/spotify-authorization"
import { FileTokenStorage } from "./service/spotify/token-file-storage"


const envPath = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), '.env')
  : path.join(__dirname, '..', '.env');

const tokenstorage = path.join(app.getPath("userData"), "spotify-tokens.json");

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:8888/callback";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-library-read",
  "user-library-modify",
].join(" ");

const tokens = new FileTokenStorage(tokenstorage, SCOPES);

const AuthService = new SpotifyAuthService(tokens, CLIENT_ID, REDIRECT_URI, SCOPES) 

export async function Login() {

  AuthService.login();

}

export function isLoggedIn(): boolean {
  const tokenSet = tokens.loadTokens();
  return tokenSet !== null && AuthService.hasRequiredScopes(tokenSet);
}


export async function getNowPlaying(): Promise<NowPlaying | null> {
  const accessToken = await AuthService.ensureValidToken();

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 204) return null; // ничего не играет
  if (!res.ok) throw new Error(`getNowPlaying failed: ${res.status}`);

  const json = await res.json();
  if (!json?.item) return null;
  const trackId = json.item.id;
  const trackUri = json.item.uri ?? `spotify:track:${trackId}`;
  let saved = false;

  try {
    ({ saved } = await TrackSaved(trackUri));
  } catch (error) {
    console.warn("Could not load saved track status:", error);
  }

  return {
    isPlaying: json.is_playing,
    trackName: json.item.name,
    trackId,
    artistName: (json.item.artists ?? []).map((a: { name: string }) => a.name).join(", "),
    albumArtUrl: json.item.album?.images?.[0]?.url ?? null,
    progressMs: json.progress_ms ?? 0,
    durationMs: json.item.duration_ms ?? 0,
    savedsong: saved,
  };
}

async function playerAction(method: "PUT" | "POST", path: string): Promise<void> {
  const accessToken = await AuthService.ensureValidToken();;
  const res = await fetch(`https://api.spotify.com/v1/me/player/${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 204 No Content — успех; 403/404 — например нет активного устройства
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    throw new Error(
      retryAfter
        ? `Spotify rate limit. Try again in ${retryAfter}s`
        : "Spotify rate limit. Try again later",
    );
  }

  if (!res.ok && res.status !== 204) {
    throw new Error(`Player action ${path} failed: ${res.status}`);
  }
}

export async function GetVolume(): Promise<{volumepercent: number}> {

  const accessToken = await AuthService.ensureValidToken();;
  const stateResponse = await fetch(
   "https://api.spotify.com/v1/me/player",
   {
    headers: {Authorization: `Bearer ${accessToken}`},
   }
  );

    if (stateResponse.status === 204) {
    throw new Error("No active device");
  }

  if (!stateResponse.ok) {
    throw new Error(`Get playback state failed: ${stateResponse.status}`);
  }

  const playback = await stateResponse.json();

  return { 
    volumepercent: playback.device?.volume_percent ?? 0,
  };

}

export async function TrackSaved(trackId?: string): Promise<{saved: boolean}> {
  
  const access_token = await AuthService.ensureValidToken();;
  const currentTrackId = trackId ?? (await getNowPlaying())?.trackId;

  if (!currentTrackId) {
    return { saved: false };
  }

  const trackUri = currentTrackId.startsWith("spotify:")
    ? currentTrackId
    : `spotify:track:${currentTrackId}`;

  const response = await fetch(
    `https://api.spotify.com/v1/me/library/contains?uris=${encodeURIComponent(trackUri)}`,
    {
      headers: { Authorization: `Bearer ${access_token}` },
    },
  );

  if (response.status === 403) {
    console.warn("Spotify saved track status is forbidden. Treating track as not saved.");
    return { saved: false };
  }

  if (!response.ok) {
    throw new Error(`Saved track status error: ${response.status} ${await response.text()}`);
  }

  const [saved] = (await response.json()) as boolean[];
  return { saved };

}

export async function saveSong(): Promise<{saved: boolean}> {

  const access_token = await AuthService.ensureValidToken();
  const trackinfo = await getNowPlaying();

  if (!trackinfo) {
    return { saved: false };
  }

  const saved = !trackinfo.savedsong;
  const method = saved ? "PUT" : "DELETE";
  const trackUri = `spotify:track:${trackinfo.trackId}`;

  const response = await fetch(
    `https://api.spotify.com/v1/me/library?uris=${encodeURIComponent(trackUri)}`,
    {
      
      method: method,
      headers: { Authorization: `Bearer ${access_token}` },
    },
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Save track error: ${response.status} ${await response.text()}`);
  }

  return { saved };
}

export async function setVolume(volume:number): Promise<void> {
  
  const access_token = await AuthService.ensureValidToken();

  const safeVolume = Math.max(0, Math.min(100, Math.round(volume)));

  const response = await fetch(
    `https://api.spotify.com/v1/me/player/volume?volume_percent=${safeVolume}`,
    {
      method: "PUT",
      headers: {Authorization: `Bearer ${access_token}`},
    },
  );

  if (response.status === 204) {
    throw new Error("No active device");
  };

  if (!response.ok) {
    throw new Error(`Set volume error: ${response.status}`);
  };

}

export async function shuffle(): Promise<{ enabled: boolean }> {
  const accessToken = await AuthService.ensureValidToken();
  const stateResponse = await fetch(
    "https://api.spotify.com/v1/me/player",
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (stateResponse.status === 204) {
    throw new Error("No active device");
  }

  if (!stateResponse.ok) {
    throw new Error(`Get playback state failed: ${stateResponse.status}`);
  }

  const playback = await stateResponse.json();
  const enabled = !playback.shuffle_state;

  const shuffleResponse = await fetch(
    `https://api.spotify.com/v1/me/player/shuffle?state=${enabled}`,
    {
      method: "PUT",
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );

  if (!shuffleResponse.ok) {
    throw new Error('Ur mother is dead');
  }

  return { enabled };
}

export const play = () => playerAction("PUT", "play");
export const pause = () => playerAction("PUT", "pause");
export const next = () => playerAction("POST", "next");
export const previous = () => playerAction("POST", "previous");
