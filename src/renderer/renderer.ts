const POLL_INTERVAL_MS = 2000;

const loginScreen = document.getElementById("login-screen") as HTMLDivElement;
const nowPlayingScreen = document.getElementById("now-playing-screen") as HTMLDivElement;
const loginBtn = document.getElementById("login-btn") as HTMLButtonElement;
const albumArtEl = document.getElementById("album-art") as HTMLImageElement;
const trackNameEl = document.getElementById("track-name") as HTMLDivElement;
const artistNameEl = document.getElementById("artist-name") as HTMLDivElement;
const playPauseBtn = document.getElementById("play-pause-btn") as HTMLButtonElement;
const prevBtn = document.getElementById("prev-btn") as HTMLButtonElement;
const nextBtn = document.getElementById("next-btn") as HTMLButtonElement;
const shuffleBtn = document.getElementById("shuffle-btn") as HTMLButtonElement;
const progressBarEl = document.getElementById("progress-bar") as HTMLDivElement;
const volumelevel = document.getElementById("soundlev-bar") as HTMLInputElement;
const songSaved = document.getElementById("save-track") as HTMLButtonElement;
const playlistBtn = document.getElementById("playlist-btn") as HTMLButtonElement;
const currentPlaylist = document.getElementById("current-playlist") as HTMLInputElement;

let pollTimer: number | null = null;
let lastKnownIsPlaying = false;
let lastKnownSaved = false;
let currentTrackId: string | null = null;
let playbackActionInFlight = false;
let saveActionInFlight = false;
let refreshInFlight = false;

let playlistExpanded = false;

function setPlaylistPopover(open: boolean): void {
  playlistExpanded = open;
  playlistBtn.setAttribute("aria-expanded", String(open));
  playlistBtn.classList.toggle("active", open);
  window.spotifyOverlay.setPlaylistExpanded(open);
}

playlistBtn.setAttribute("aria-expanded", "false");
playlistBtn.addEventListener("click", () => setPlaylistPopover(!playlistExpanded));
window.spotifyOverlay.onPlaylistVisibilityChanged((visible) => {
  playlistExpanded = visible;
  playlistBtn.setAttribute("aria-expanded", String(visible));
  playlistBtn.classList.toggle("active", visible);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setPlaylistPopover(false);
});

function updateVolumeSlider(value: number): void {
  volumelevel.style.setProperty("--volume-percent", `${value}%`);
}

async function refreshVolumeLevel(): Promise<void> {
  try {
    const { volumePercent } = await window.spotifyOverlay.getVolume();
    volumelevel.value = String(volumePercent);
    updateVolumeSlider(volumePercent);
  } catch (error) {
    console.error("refreshVolumeLevel error:", error);
  }
}

function showScreen(loggedIn: boolean): void {
  loginScreen.style.display = loggedIn ? "none" : "flex";
  nowPlayingScreen.style.display = loggedIn ? "flex" : "none";
}

function setSavedState(saved: boolean): void {
  lastKnownSaved = saved;
  songSaved.textContent = saved ? "♥" : "♡";
}

async function refreshNowPlaying(): Promise<void> {
  if (refreshInFlight) return;
  refreshInFlight = true;

  try {
    const track = await window.spotifyOverlay.getNowPlaying();
    if (!track) {
      currentTrackId = null;
      trackNameEl.textContent = "Ничего не играет";
      artistNameEl.textContent = "";
      albumArtEl.style.visibility = "hidden";
      progressBarEl.style.width = "0%";
      songSaved.disabled = true;
      
      return;
    }

    currentTrackId = track.trackId;
    songSaved.disabled = saveActionInFlight;
    albumArtEl.style.visibility = "visible";
    albumArtEl.src = track.albumArtUrl ?? "";
    trackNameEl.textContent = track.trackName;
    artistNameEl.textContent = track.artistName;
    lastKnownIsPlaying = track.isPlaying;
    setSavedState(track.saved);
    playPauseBtn.textContent = track.isPlaying ? "⏸" : "▶";
    const pct = track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0;
    progressBarEl.style.width = `${pct}%`;
  } catch (e) {
    console.error("refreshNowPlaying error:", e);
  } finally {
    refreshInFlight = false;
  }
}

function startPolling(): void {
  if (pollTimer !== null) return;
  void refreshNowPlaying();
  void refreshVolumeLevel();
  pollTimer = window.setInterval(refreshNowPlaying, POLL_INTERVAL_MS);
}

function setPlaybackControlsDisabled(disabled: boolean): void {
  playPauseBtn.disabled = disabled;
  prevBtn.disabled = disabled;
  nextBtn.disabled = disabled;
}

async function runPlaybackAction(action: () => Promise<void>): Promise<void> {
  if (playbackActionInFlight) return;

  playbackActionInFlight = true;
  setPlaybackControlsDisabled(true);

  try {
    await action();
  } catch (error) {
    console.error("Playback action error:", error);
  } finally {
    playbackActionInFlight = false;
    setPlaybackControlsDisabled(false);
  }
}



loginBtn.addEventListener("click", async () => {
  loginBtn.disabled = true;
  loginBtn.textContent = "Открываю браузер...";
  try {
    const result = await window.spotifyOverlay.login();
    if (result.ok) {
      showScreen(true);
      startPolling();
      return;
    }

    loginBtn.textContent = `Ошибка: ${result.error ?? "неизвестно"}`;
  } catch (error) {
    console.error("Login error:", error);
    loginBtn.textContent = `Ошибка: ${(error as Error).message}`;
  } finally {
    loginBtn.disabled = false;
  }
});

volumelevel.addEventListener("change", (event) => {

  const input = event.currentTarget as HTMLInputElement;
  const volume = Number(input.value);

  updateVolumeSlider(volume);
  void window.spotifyOverlay.setVolume(volume);

});

updateVolumeSlider(Number(volumelevel.value));

playPauseBtn.addEventListener("click", () => {
  void runPlaybackAction(async () => {
    if (lastKnownIsPlaying) {
      await window.spotifyOverlay.pause();
    } else {
      await window.spotifyOverlay.play();
    }
    await refreshNowPlaying();
  });
});

songSaved.addEventListener("click", () => {
  if (saveActionInFlight || currentTrackId === null) return;

  const targetTrackId = currentTrackId;
  const previousSaved = lastKnownSaved;
  const desiredSaved = !previousSaved;

  saveActionInFlight = true;
  setSavedState(desiredSaved);
  songSaved.disabled = true;

  void window.spotifyOverlay.setTrackSaved(targetTrackId, desiredSaved)
    .then(({ saved }) => {
      if (currentTrackId === targetTrackId) {
        setSavedState(saved);
      }
    })
    .catch((error) => {
      console.error("Save track error:", error);
      if (currentTrackId === targetTrackId) {
        setSavedState(previousSaved);
      }
    })
    .finally(() => {
      saveActionInFlight = false;
      songSaved.disabled = currentTrackId === null;
    });
});

prevBtn.addEventListener("click", () => {
  void runPlaybackAction(async () => {
    await window.spotifyOverlay.previous();
    setTimeout(refreshNowPlaying, 100);
  });
});

nextBtn.addEventListener("click", () => {
  void runPlaybackAction(async () => {
    await window.spotifyOverlay.next();
    setTimeout(refreshNowPlaying, 100);
  });
});

shuffleBtn.addEventListener("click", async () => {
  shuffleBtn.disabled = true;

  try {
    const { enabled } = await window.spotifyOverlay.toggleShuffle();
  
    shuffleBtn.classList.toggle("active", enabled);
    shuffleBtn.setAttribute("aria-pressed", String(enabled));

  }
  catch (error) {
    console.error("Shuffle error:", error);
  }
  finally {
    shuffleBtn.disabled = false;
  }
});

(async () => {
  const loggedIn = await window.spotifyOverlay.isLoggedIn();
  showScreen(loggedIn);
  if (loggedIn) startPolling();
})();
console.log("Рендерер успешно загружен и работает!");
