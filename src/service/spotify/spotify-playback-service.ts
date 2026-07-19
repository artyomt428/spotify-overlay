import type { NowPlaying } from "../../types";
import type { SpotifyClient } from "./spotify-client";
import type { SpotifyLibraryService } from "./spotify-library-service";
import type {
  SpotifyPlaybackResponse,
} from "./spotify-playback-types";

export class SpotifyPlaybackService {
  constructor(
    private readonly client: SpotifyClient,
    private readonly library: SpotifyLibraryService,
  ) {}

  async getNowPlaying(): Promise<NowPlaying | null> {
    const playback =
      await this.client.request<SpotifyPlaybackResponse>(
        "/me/player/currently-playing",
      );

    if (!playback?.item) {
      return null;
    }

    const track = playback.item;

    let saved = false;

    try {
      saved = await this.library.isTrackSaved(track.id);
    } catch (error) {
      console.warn("Cannot load saved state:", error);
    }

    return {
      trackId: track.id,
      trackName: track.name,
      artistName: track.artists
        .map((artist) => artist.name)
        .join(", "),
      albumArtUrl: track.album?.images?.[0]?.url ?? null,
      isPlaying: playback.is_playing,
      progressMs: playback.progress_ms ?? 0,
      durationMs: track.duration_ms,
      saved,
    };
  }

  play(): Promise<void> {
    return this.playerAction("PUT", "play");
  }

  pause(): Promise<void> {
    return this.playerAction("PUT", "pause");
  }

  next(): Promise<void> {
    return this.playerAction("POST", "next");
  }

  previous(): Promise<void> {
    return this.playerAction("POST", "previous");
  }

  async getVolume(): Promise<{ volumePercent: number }> {
    const playback =
      await this.client.request<SpotifyPlaybackResponse>(
        "/me/player",
      );

    if (!playback) {
      throw new Error("No active device");
    }

    return {
      volumePercent: playback.device?.volume_percent ?? 0,
    };
  }

  async setVolume(volumePercent: number): Promise<void> {
    if (!Number.isFinite(volumePercent)) {
      throw new TypeError("Volume must be a finite number");
    }

    const safeVolume = Math.max(
      0,
      Math.min(100, Math.round(volumePercent)),
    );

    await this.client.request(
      `/me/player/volume?volume_percent=${safeVolume}`,
      { method: "PUT" },
    );
  }

  async toggleShuffle(): Promise<{ enabled: boolean }> {
    const playback = await this.client.request<SpotifyPlaybackResponse>(
      "/me/player",
    );

    if (!playback) {
      throw new Error("No active device");
    }

    const enabled = !playback.shuffle_state;

    await this.client.request(
      `/me/player/shuffle?state=${enabled}`,
      { method: "PUT" },
    );

    return { enabled };
  }

  private async playerAction(
    method: "PUT" | "POST",
    path: "play" | "pause" | "next" | "previous",
  ): Promise<void> {
    await this.client.request(`/me/player/${path}`, { method });
  }
}
