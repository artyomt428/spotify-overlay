const API_URL = "https://api.spotify.com/v1";

export interface SpotifyAccessTokenProvider {
  ensureValidToken(): Promise<string>;
}

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

export class SpotifyClient {
  constructor(
    private readonly auth: SpotifyAccessTokenProvider,
  ) {}

  async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T | null> {
    const accessToken = await this.auth.ensureValidToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 204) {
      return null;
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfter === null ? undefined : Number(retryAfter);

      throw new SpotifyApiError(
        retryAfter
          ? `Spotify rate limit: retry in ${retryAfter}s`
          : "Spotify rate limit",
        response.status,
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
      );
    }

    if (!response.ok) {
      const body = await response.text();

      throw new SpotifyApiError(
        `Spotify request failed: ${response.status}${body ? ` ${body}` : ""}`,
        response.status,
      );
    }

    const body = await response.text();
    return body.trim() ? JSON.parse(body) as T : null;
  }
}
