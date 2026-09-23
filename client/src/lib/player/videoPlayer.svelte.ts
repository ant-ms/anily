import { AnilyNative, isNative } from "../native/anilyNative";
import { syncQueue } from "../sync/syncQueue.svelte";
import { sidebarDataRefreshSeed, apiBaseUrl } from "../context.svelte";
import { getStoredLanguagePreference } from "../../types/Media";
import type EpisodeData from "../../types/Episode";

export type SubtitleSize = "small" | "medium" | "large";

export type PlayerDisplayMode = "expanded" | "minimized" | "hidden";

export interface SubtitleTrackInfo {
  label: string;
  language?: string;
  url: string;
  default?: boolean;
}

export interface StreamPayload {
  streamUrl: string;
  container?: "hls" | "mp4";
  subtitles?: SubtitleTrackInfo[];
  isLocal?: boolean;
}

class VideoPlayerState {
  // Presentation mode
  mode = $state<PlayerDisplayMode>("hidden");

  // Metadata
  animeName = $state<string>("");
  animeId = $state<number | null>(null);
  activeEpisode = $state<EpisodeData | null>(null);
  playlist = $state<EpisodeData[]>([]);

  // Stream data
  streamSource = $state<StreamPayload | null>(null);

  // Playback metrics
  isPlaying = $state<boolean>(false);
  currentTime = $state<number>(0);
  duration = $state<number>(0);
  buffered = $state<number>(0);
  volume = $state<number>(1);
  muted = $state<boolean>(false);
  playbackRate = $state<number>(1);
  isBuffering = $state<boolean>(false);
  selectedSubtitleIndex = $state<number>(-1);
  subtitleSize = $state<SubtitleSize>("medium");
  brightness = $state<number>(1);
  inNativePip = $state<boolean>(false);

  // Auto-watch threshold flag
  private markedAsWatchedThisSession = false;

  // Registered elements
  private videoEl: HTMLVideoElement | null = null;
  private containerEl: HTMLElement | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const savedVol = localStorage.getItem("anily_player_volume");
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          if (!Number.isNaN(parsed)) this.volume = Math.max(0, Math.min(1, parsed));
        }
      } catch {}

      try {
        const savedSize = localStorage.getItem("anily_subtitle_size") as SubtitleSize | null;
        if (savedSize === "small" || savedSize === "medium" || savedSize === "large") {
          this.subtitleSize = savedSize;
        }
      } catch {}
    }
  }

  public setSubtitleSize(size: SubtitleSize) {
    this.subtitleSize = size;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("anily_subtitle_size", size);
      } catch {}
    }
  }

  public registerElements(video: HTMLVideoElement | null, container: HTMLElement | null) {
    this.videoEl = video;
    this.containerEl = container;
    if (video) {
      video.volume = this.volume;
      video.muted = this.muted;
      video.playbackRate = this.playbackRate;
    }
  }

  public getVideo(): HTMLVideoElement | null {
    if (this.videoEl && typeof document !== "undefined" && document.body.contains(this.videoEl)) {
      return this.videoEl;
    }
    if (typeof document !== "undefined") {
      const el = document.querySelector("video.video-element") as HTMLVideoElement | null;
      if (el) {
        this.videoEl = el;
        return el;
      }
    }
    return null;
  }

  public getContainer(): HTMLElement | null {
    if (this.containerEl && typeof document !== "undefined" && document.body.contains(this.containerEl)) {
      return this.containerEl;
    }
    if (typeof document !== "undefined") {
      const el = document.querySelector(".video-player-container") as HTMLElement | null;
      if (el) {
        this.containerEl = el;
        return el;
      }
    }
    return null;
  }

  public async playOnlineEpisode(
    episode: EpisodeData,
    animeName: string,
    animeId: number | undefined,
    playlist: EpisodeData[],
    streamData: StreamPayload,
  ) {
    this.activeEpisode = episode;
    this.animeName = animeName;
    this.animeId = animeId ?? null;
    this.playlist = playlist;
    this.streamSource = streamData;
    this.markedAsWatchedThisSession = Boolean(episode.watched);
    this.currentTime = 0;
    this.duration = 0;
    this.buffered = 0;
    this.isBuffering = true;
    this.mode = "expanded";

    // Auto select default subtitle if available
    if (streamData.subtitles && streamData.subtitles.length > 0) {
      const defIdx = streamData.subtitles.findIndex((s) => s.default);
      if (defIdx >= 0) {
        this.selectedSubtitleIndex = defIdx;
      } else {
        const enIdx = streamData.subtitles.findIndex(
          (s) =>
            (s.language || "").toLowerCase().startsWith("en") ||
            (s.label || "").toLowerCase().includes("english"),
        );
        this.selectedSubtitleIndex = enIdx >= 0 ? enIdx : 0;
      }
    } else {
      this.selectedSubtitleIndex = -1;
    }

    if (isNative) {
      try {
        await AnilyNative.setAutoPip({ enabled: true });
      } catch {}
    }
  }

  public async playOfflineEpisode(
    episode: EpisodeData,
    animeName: string,
    animeId: number | undefined,
    playlist: EpisodeData[],
    localUrl: string,
  ) {
    await this.playOnlineEpisode(episode, animeName, animeId, playlist, {
      streamUrl: localUrl,
      container: "mp4",
      isLocal: true,
      subtitles: [],
    });
  }

  public expand() {
    this.mode = "expanded";
  }

  public minimize() {
    this.mode = "minimized";
  }

  public async close() {
    this.mode = "hidden";
    const v = this.getVideo();
    if (v) {
      v.pause();
    }
    this.isPlaying = false;
    this.activeEpisode = null;
    this.streamSource = null;

    if (isNative) {
      try {
        await AnilyNative.setAutoPip({ enabled: false });
        await AnilyNative.setBrightness({ brightness: -1.0 });
      } catch {}
    }
  }

  public togglePlay() {
    const v = this.getVideo();
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }

  public play() {
    const v = this.getVideo();
    if (v && v.paused) {
      v.play().catch(() => {});
    }
  }

  public pause() {
    const v = this.getVideo();
    if (v && !v.paused) {
      v.pause();
    }
  }

  public seek(targetSeconds: number) {
    const v = this.getVideo();
    if (!v) return;
    const clamped = Math.max(0, Math.min(this.duration || v.duration || Infinity, targetSeconds));
    v.currentTime = clamped;
    this.currentTime = clamped;
  }

  public seekRelative(offsetSeconds: number) {
    const v = this.getVideo();
    if (!v) return;
    this.seek(v.currentTime + offsetSeconds);
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    const v = this.getVideo();
    if (v) {
      v.volume = clamped;
      v.muted = clamped === 0;
    }
    this.muted = clamped === 0;
    try {
      localStorage.setItem("anily_player_volume", String(clamped));
    } catch {}
  }

  public toggleMute() {
    const v = this.getVideo();
    this.muted = !this.muted;
    if (v) {
      v.muted = this.muted;
    }
  }

  public async setBrightness(level: number) {
    const clamped = Math.max(0.05, Math.min(1.0, level));
    this.brightness = clamped;
    if (isNative) {
      try {
        await AnilyNative.setBrightness({ brightness: clamped });
      } catch {}
    }
  }

  public setSubtitle(index: number) {
    this.selectedSubtitleIndex = index;
    const v = this.getVideo();
    if (v && v.textTracks) {
      for (let i = 0; i < v.textTracks.length; i++) {
        v.textTracks[i].mode = i === index ? "showing" : "disabled";
      }
    }
  }

  public async enterPip() {
    if (isNative) {
      try {
        const res = await AnilyNative.enterPip();
        if (res.success) return;
      } catch {}
    }

    const v = this.getVideo();
    if (v && document.pictureInPictureEnabled && !v.disablePictureInPicture) {
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await v.requestPictureInPicture();
        }
      } catch (err) {
        console.warn("HTML5 PiP failed:", err);
      }
    }
  }

  public async toggleFullscreen() {
    const target = this.getContainer() || this.getVideo();
    if (!target) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
    }
  }

  public get hasNextEpisode(): boolean {
    if (!this.activeEpisode || this.playlist.length === 0) return false;
    const idx = this.playlist.findIndex((e) => e.id === this.activeEpisode?.id);
    return idx >= 0 && idx < this.playlist.length - 1;
  }

  public get hasPreviousEpisode(): boolean {
    if (!this.activeEpisode || this.playlist.length === 0) return false;
    const idx = this.playlist.findIndex((e) => e.id === this.activeEpisode?.id);
    return idx > 0;
  }

  public get nextEpisodeData(): EpisodeData | null {
    if (!this.hasNextEpisode) return null;
    const idx = this.playlist.findIndex((e) => e.id === this.activeEpisode?.id);
    return this.playlist[idx + 1] ?? null;
  }

  public get previousEpisodeData(): EpisodeData | null {
    if (!this.hasPreviousEpisode) return null;
    const idx = this.playlist.findIndex((e) => e.id === this.activeEpisode?.id);
    return this.playlist[idx - 1] ?? null;
  }

  public async resolveAndPlayEpisode(episode: EpisodeData) {
    if (!apiBaseUrl.current) return;
    this.isBuffering = true;
    try {
      const srvRes = await fetch(new URL(`/api/stream/services/${episode.id}`, apiBaseUrl.current).toString(), {
        credentials: "include",
      });
      if (!srvRes.ok) throw new Error("Failed to fetch services");
      const srvData = await srvRes.json();
      const services = Array.isArray(srvData.services) ? srvData.services : [];
      if (services.length === 0) throw new Error("No streaming services found");

      const prefLang = getStoredLanguagePreference();
      const best = services.find((s: any) => s.language === prefLang) || services[0];
      const params = new URLSearchParams({
        providerId: best.providerId,
        identifier: best.identifier,
        language: best.language,
        server: best.serverId,
      });

      const playRes = await fetch(new URL(`/api/stream/play/${episode.id}?${params.toString()}`, apiBaseUrl.current).toString(), {
        credentials: "include",
      });
      if (!playRes.ok) throw new Error("Failed to resolve play stream");
      const playData = await playRes.json();

      await this.playOnlineEpisode(
        episode,
        this.animeName,
        this.animeId ?? undefined,
        this.playlist,
        playData,
      );
    } catch (err) {
      console.error("Failed to load episode stream:", err);
    } finally {
      this.isBuffering = false;
    }
  }

  public async playNextEpisode() {
    if (this.nextEpisodeData) {
      await this.resolveAndPlayEpisode(this.nextEpisodeData);
    }
  }

  public async playPreviousEpisode() {
    if (this.previousEpisodeData) {
      await this.resolveAndPlayEpisode(this.previousEpisodeData);
    }
  }

  public onTimeUpdate(currentTime: number, duration: number) {
    this.currentTime = currentTime;
    this.duration = duration;

    // Auto mark watched when passing 85% progress
    if (
      !this.markedAsWatchedThisSession &&
      this.activeEpisode &&
      duration > 60 &&
      currentTime / duration >= 0.85
    ) {
      this.markedAsWatchedThisSession = true;
      this.activeEpisode.watched = true;
      syncQueue.recordWatchStatus(this.activeEpisode.id, true).then(() => {
        sidebarDataRefreshSeed.set((sidebarDataRefreshSeed.current ?? 0) + 1);
      });
    }
  }
}

export const videoPlayerState = new VideoPlayerState();
