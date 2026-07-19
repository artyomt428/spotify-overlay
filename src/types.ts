export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope?: string;
}

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export interface NowPlaying {
  isPlaying: boolean;
  trackName: string;
  trackId: string;
  artistName: string;
  albumArtUrl: string | null;
  progressMs: number;
  durationMs: number;
  saved: boolean;
}

export interface VolumeState {
  volumePercent: number;
}

/** Methods implemented in the Electron main process. */
export interface SpotifyServiceApi {
  login(): Promise<LoginResult>;
  isLoggedIn(): boolean;
  getNowPlaying(): Promise<NowPlaying | null>;
  play(): Promise<void>;
  pause(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  toggleShuffle(): Promise<{ enabled: boolean }>;
  getVolume(): Promise<VolumeState>;
  setVolume(volumePercent: number): Promise<void>;
  setTrackSaved(trackId: string, saved: boolean): Promise<{ saved: boolean }>;
}

type AsyncRendererMethod<T> = T extends (...args: infer Args) => infer Result
  ? (...args: Args) => Promise<Awaited<Result>>
  : never;

/** The same methods as SpotifyServiceApi, transported asynchronously over IPC. */
export type SpotifyRendererApi = {
  [Method in keyof SpotifyServiceApi]: AsyncRendererMethod<SpotifyServiceApi[Method]>;
};

export interface OverlayWindowApi {
  quit(): void;
  setPlaylistExpanded(expanded: boolean): void;
  onPlaylistVisibilityChanged(callback: (visible: boolean) => void): () => void;
}

export type SpotifyOverlayAPI = SpotifyRendererApi & OverlayWindowApi;
