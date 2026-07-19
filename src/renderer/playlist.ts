const closeButton = document.getElementById("playlist-close") as HTMLButtonElement;

function closePlaylistWindow(): void {
  window.spotifyOverlay.setPlaylistExpanded(false);
}

closeButton.addEventListener("click", closePlaylistWindow);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePlaylistWindow();
});
