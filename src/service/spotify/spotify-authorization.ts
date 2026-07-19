import {  shell } from "electron";
import * as crypto from "node:crypto";
import * as http from "node:http";
import type { TokenSet } from "../../types";

import { TokenStore } from "./token-store";

export class SpotifyAuthService {
    constructor(
        private readonly tokenstore: TokenStore,
        private readonly clientId: string,
        private readonly redirectUri: string,
        private readonly scopes: string,
    ) {}

    private base64Url(input: Buffer): string {
        return input
        .toString("base64")
        .replaceAll(/\+/g, "-")
        .replaceAll(/\//g, "_")
        .replace(/=+$/, "");

    }

    private generatePkcePair(): {
        verifier: string;
        challenge: string;
    } {
        const verifier =  this.base64Url(crypto.randomBytes(32));

        const challenge = this.base64Url(
            crypto.createHash("sha256").update(verifier).digest(),
        );
        return {verifier, challenge}
    }
    private async exchangeCodeForToken(code: string, verifier: string): Promise<void> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: verifier,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    const json = await res.json();
    this.tokenstore.saveTokens({
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + json.expires_in * 1000,
      scope: json.scope,
    });
  }

    private async refreshAccessToken(): Promise<TokenSet> {
        const tokens = this.tokenstore.loadTokens();

        if (!tokens?.refreshToken) {
            throw new Error(
                "Refresh token отсутствует. " +
                "Необходим повторный вход.",
                );
        }
        
        const body = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token:
                tokens.refreshToken,
            client_id: this.clientId,
        });

        const res = await fetch(
         "https://accounts.spotify.com/api/token",
         {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded",
            },
            body,   
         },   
        );

        if(!res.ok)
            throw new Error(
                `Token refresh failed: ${res.status}`,
            );

        const json = await res.json();

        const nextTokens: TokenSet = {
            accessToken: json.access_token,

            refreshToken:
                json.refresh_token
                ?? tokens.refreshToken,
            
            expiresAt:
                Date.now() + json.expires_in * 1000,

            scope:
            json.scope
            ?? tokens.scope,
        };

        this.tokenstore.saveTokens(nextTokens);

        return nextTokens;
        }

    hasRequiredScopes(tokenSet: TokenSet): boolean {
        if (!tokenSet.scope) return false;
        const grantedScopes = new Set((tokenSet.scope ?? "").split(" ").filter(Boolean));
        return this.scopes.split(" ").every((scope) => grantedScopes.has(scope));
    }

    async ensureValidToken(): Promise<string> {
         let tokens = this.tokenstore.loadTokens();     

        if (!tokens) {
            throw new Error(
            "Пользователь не авторизован",
            );
        }

        if (!this.hasRequiredScopes(tokens)) {
            throw new Error(
            "Токен не содержит необходимых " +
            "Spotify scopes. Выполните вход повторно.",
            );
        }

        const shouldRefresh =
            Date.now()
            >= tokens.expiresAt - 30_000;

        if (shouldRefresh) {
            tokens =
            await this.refreshAccessToken();
        }

        return tokens.accessToken;
        }
        

    async login(): Promise<{
        ok: boolean;
        error?: string;
    }> {
         if (!this.clientId) {
    return { ok: false, error: "SPOTIFY_CLIENT_ID не задан в .env" };
        }

  const { verifier, challenge } = this.generatePkcePair();
  const state = this.base64Url(crypto.randomBytes(16));

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", this.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri",this.redirectUri);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("scope", this.scopes);
  authUrl.searchParams.set("state", state);

  const redirectUrl = new URL(this.redirectUri);
  const port = Number(redirectUrl.port || 8888);

  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;
      const reqUrl = new URL(req.url, this.redirectUri);
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
    await this.exchangeCodeForToken(code, verifier);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  
}
   
}
