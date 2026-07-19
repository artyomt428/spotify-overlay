export interface SpotifyArtistResponse {
  name: string;
}

export interface SpotifyImageResponse {
  url: string;
}

export interface SpotifyTrackResponse {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtistResponse[];
  album?: {
    images?: SpotifyImageResponse[];
  };
}

export interface SpotifyPlaybackResponse {
  is_playing: boolean;
  progress_ms: number | null;
  shuffle_state?: boolean;
  item: SpotifyTrackResponse | null;
  device?: {
    volume_percent: number | null;
  };
}
