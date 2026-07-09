import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import { app, shell } from "electron";
import { TokenSet, NowPlaying } from "./types";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "";
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI ?? "http://127.0.0.1:8888/callback";
const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-library-read",
  "user-library-modify",
].join(" ");

let tokens: TokenSet | null = null;

function getTokenPath(): string {
  return path.join(app.getPath("userData"), "spotify-tokens.json");
}

function loadTokens(): TokenSet | null {
  if (tokens) return tokens;

  try {
    tokens = JSON.parse(fs.readFileSync(getTokenPath(), "utf8")) as TokenSet;
    return tokens;
  } catch {
    return null;
  }
}

function saveTokens(nextTokens: TokenSet): void {
  tokens = nextTokens;
  fs.writeFileSync(getTokenPath(), JSON.stringify(nextTokens), "utf8");
}

function hasRequiredScopes(tokenSet: TokenSet): boolean {
  if (!tokenSet.scope) return false;
  const grantedScopes = new Set((tokenSet.scope ?? "").split(" ").filter(Boolean));
  return SCOPES.split(" ").every((scope) => grantedScopes.has(scope));
}

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export async function login(): Promise<{ ok: boolean; error?: string }> {
  if (!CLIENT_ID) {
    return { ok: false, error: "SPOTIFY_CLIENT_ID не задан в .env" };
  }

  const { verifier, challenge } = generatePkcePair();
  const state = base64url(crypto.randomBytes(16));

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);

  const redirectUrl = new URL(REDIRECT_URI);
  const port = Number(redirectUrl.port || 8888);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const reqUrl = new URL(req.url, REDIRECT_URI);
      if (reqUrl.pathname !== redirectUrl.pathname) {
        res.writeHead(404).end();
        return;
      }

      const returnedState = reqUrl.searchParams.get("state");
      const returnedCode = reqUrl.searchParams.get("code");
      const err = reqUrl.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (err || !returnedCode || returnedState !== state) {
        res.end("<h2>Ошибка авторизации. Можно закрыть окно.</h2>");
        clearTimeout(timeout);
        server.close();
        reject(new Error(err ?? "state mismatch"));
        return;
      }

      res.end("<h2>Готово! Можно закрыть окно и вернуться в приложение.</h2>");
      clearTimeout(timeout);
      server.close();
      resolve(returnedCode);
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timeout excepted"));
    }, 120_000);

    server.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    server.listen(port, "127.0.0.1", async () => {
      try {
        await shell.openExternal(authUrl.toString());
      } catch (error) {
        clearTimeout(timeout);
        server.close();
        reject(error);
      }
    });
  });

  

  try {
    await exchangeCodeForToken(code, verifier);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // помогаем eslint не жаловаться на shell.openExternal без await выше по коду
  async function exchangeCodeForToken(code: string, verifier: string): Promise<void> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: verifier,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    const json = await res.json();
    saveTokens({
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + json.expires_in * 1000,
      scope: json.scope,
    });
  }
}

async function refreshAccessToken(): Promise<void> {
  loadTokens();
  if (!tokens?.refreshToken) throw new Error("Нет refresh token, нужен повторный login()");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    client_id: CLIENT_ID,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const json = await res.json();
  saveTokens({
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? tokens.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope ?? tokens.scope,
  });
}

async function ensureValidToken(): Promise<string> {
  loadTokens();
  if (!tokens) throw new Error("Не авторизован");
  if (!hasRequiredScopes(tokens)) throw new Error("Spotify token is missing required scopes, login again");
  if (Date.now() > tokens.expiresAt - 30_000) {
    await refreshAccessToken();
  }
  return tokens!.accessToken;
}

export function isLoggedIn(): boolean {
  const tokenSet = loadTokens();
  return tokenSet !== null && hasRequiredScopes(tokenSet);
}

export async function getNowPlaying(): Promise<NowPlaying | null> {
  const accessToken = await ensureValidToken();

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
  const accessToken = await ensureValidToken();
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

  const accessToken = await ensureValidToken();
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
  
  const access_token = await ensureValidToken();
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

  const access_token = await ensureValidToken();
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
  
  const access_token = await ensureValidToken();

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
  const accessToken = await ensureValidToken();
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
