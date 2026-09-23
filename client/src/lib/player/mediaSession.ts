/**
 * Web & Android MediaSession API integration.
 * Connects HTML5 video playback to Android lockscreen, notification shade, and desktop media keys.
 */

export interface MediaSessionMeta {
  title: string;
  artist: string;
  album: string;
  artworkUrl?: string;
}

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onSeekTo?: (time: number) => void;
  onSeekBackward?: (offset: number) => void;
  onSeekForward?: (offset: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
}

export function updateMediaSessionMetadata(meta: MediaSessionMeta): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

  const artwork: MediaImage[] = [];
  if (meta.artworkUrl) {
    artwork.push(
      { src: meta.artworkUrl, sizes: "96x96", type: "image/jpeg" },
      { src: meta.artworkUrl, sizes: "128x128", type: "image/jpeg" },
      { src: meta.artworkUrl, sizes: "192x192", type: "image/jpeg" },
      { src: meta.artworkUrl, sizes: "256x256", type: "image/jpeg" },
      { src: meta.artworkUrl, sizes: "512x512", type: "image/jpeg" },
    );
  }

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      artwork,
    });
  } catch (err) {
    console.warn("Failed to set MediaMetadata:", err);
  }
}

export function updateMediaSessionPlaybackState(state: "playing" | "paused" | "none"): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {}
}

export function updateMediaSessionPosition(position: number, duration: number, playbackRate = 1): void {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator) ||
    typeof navigator.mediaSession.setPositionState !== "function"
  ) {
    return;
  }

  if (Number.isFinite(duration) && duration > 0 && Number.isFinite(position) && position >= 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: Math.max(0.1, playbackRate),
        position: Math.min(Math.max(0, position), duration),
      });
    } catch {}
  }
}

export function setupMediaSessionActionHandlers(handlers: MediaSessionHandlers): () => void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
    return () => {};
  }

  const actions: Array<{ action: MediaSessionAction; handler?: (details: MediaSessionActionDetails) => void }> = [
    {
      action: "play",
      handler: () => handlers.onPlay?.(),
    },
    {
      action: "pause",
      handler: () => handlers.onPause?.(),
    },
    {
      action: "seekbackward",
      handler: (details) => handlers.onSeekBackward?.(details.seekOffset || 10),
    },
    {
      action: "seekforward",
      handler: (details) => handlers.onSeekForward?.(details.seekOffset || 10),
    },
    {
      action: "seekto",
      handler: (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          handlers.onSeekTo?.(details.seekTime);
        }
      },
    },
    {
      action: "previoustrack",
      handler: handlers.onPreviousTrack ? () => handlers.onPreviousTrack?.() : undefined,
    },
    {
      action: "nexttrack",
      handler: handlers.onNextTrack ? () => handlers.onNextTrack?.() : undefined,
    },
  ];

  for (const { action, handler } of actions) {
    try {
      if (handler) {
        navigator.mediaSession.setActionHandler(action, handler);
      } else {
        navigator.mediaSession.setActionHandler(action, null);
      }
    } catch {}
  }

  return () => {
    for (const { action } of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {}
    }
  };
}
