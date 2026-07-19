interface Window {
  spotifyOverlay: {
    login: () => Promise<{ ok: boolean; error?: string }>;
    isLoggedIn: () => Promise<boolean>;
    getNowPlaying: () => Promise<{
      isPlaying: boolean;
      trackName: string;
      artistName: string;
      albumArtUrl: string | null;
      progressMs: number;
      durationMs: number;
      volumepercent: number;
      savedsong: boolean;
    } | null>;
    play: () => Promise<void>;
    pause: () => Promise<void>;
    next: () => Promise<void>;
    previous: () => Promise<void>;
    shuffle: () => Promise<{enabled: boolean}>;
    getVolume: () => Promise<{volumepercent: number}>;
    setVolume: (volume: number) => Promise<void>;
    quit: () => void;
    TrackSaved: () => Promise<{saved: boolean}>;
    SaveTrack: () => Promise<{saved: boolean}>;
    setPlaylistExpanded: (expanded: boolean) => void;
    onPlaylistVisibilityChanged: (callback: (visible: boolean) => void) => () => void;
  };
}
