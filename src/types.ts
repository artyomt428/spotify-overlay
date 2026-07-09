export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
  scope?: string;
}

export interface NowPlaying {
  isPlaying: boolean;
  trackName: string;
  trackId: string;
  artistName: string;
  albumArtUrl: string | null;
  progressMs: number;
  durationMs: number;
  savedsong: boolean;
}
export interface VolumeState {
  volume: number | null;
  supported: boolean;
}
export interface SpotifyOverlayAPI {
  login: () => Promise<{ ok: boolean; error?: string }>;
  isLoggedIn: () => Promise<boolean>;
  getNowPlaying: () => Promise<NowPlaying | null>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  shuffle: () => Promise<{enabled: boolean}>;
  getVolume: () => Promise<{volumepercent: number}>;
  setVolume: (Volume: number) => Promise<void>;
  quit: () => void;
  TrackSaved: () => Promise<{saved: boolean}>;
  SaveTrack: () => Promise<{saved: boolean}>;
}
