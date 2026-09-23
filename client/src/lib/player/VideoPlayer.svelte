<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { fade, scale } from "svelte/transition";
    import Hls from "hls.js";
    import "media-captions/styles/captions.css";
    import "media-captions/styles/regions.css";
    import { CaptionsRenderer, parseResponse } from "media-captions";
    import { videoPlayerState } from "./videoPlayer.svelte";
    import {
        updateMediaSessionMetadata,
        updateMediaSessionPlaybackState,
        updateMediaSessionPosition,
        setupMediaSessionActionHandlers,
    } from "./mediaSession";
    import { AnilyNative, isNative } from "../native/anilyNative";
    import { apiBaseUrl } from "../context.svelte";
    import IconButton from "../IconButton.svelte";
    import SegmentedControl from "../SegmentedControl.svelte";

    // Icons
    import CheckIcon from "phosphor-svelte/lib/CheckIcon";
    import PlayIcon from "phosphor-svelte/lib/PlayIcon";
    import PauseIcon from "phosphor-svelte/lib/PauseIcon";
    import ArrowsInIcon from "phosphor-svelte/lib/ArrowsInIcon";
    import ArrowsOutIcon from "phosphor-svelte/lib/ArrowsOutIcon";
    import XIcon from "phosphor-svelte/lib/XIcon";
    import CaretDownIcon from "phosphor-svelte/lib/CaretDownIcon";
    import CaretRightIcon from "phosphor-svelte/lib/CaretRightIcon";
    import ArrowClockwiseIcon from "phosphor-svelte/lib/ArrowClockwiseIcon";
    import ArrowCounterClockwiseIcon from "phosphor-svelte/lib/ArrowCounterClockwiseIcon";
    import SpeakerHighIcon from "phosphor-svelte/lib/SpeakerHighIcon";
    import SpeakerLowIcon from "phosphor-svelte/lib/SpeakerLowIcon";
    import SpeakerSlashIcon from "phosphor-svelte/lib/SpeakerSlashIcon";
    import SunIcon from "phosphor-svelte/lib/SunIcon";
    import FastForwardIcon from "phosphor-svelte/lib/FastForwardIcon";
    import RewindIcon from "phosphor-svelte/lib/RewindIcon";
    import SkipForwardIcon from "phosphor-svelte/lib/SkipForwardIcon";
    import SkipBackIcon from "phosphor-svelte/lib/SkipBackIcon";
    import ClosedCaptioningIcon from "phosphor-svelte/lib/ClosedCaptioningIcon";
    import PictureInPictureIcon from "phosphor-svelte/lib/PictureInPictureIcon";

    // References
    let videoEl: HTMLVideoElement | null = $state(null);
    let containerEl: HTMLElement | null = $state(null);
    let captionsOverlayEl: HTMLElement | null = $state(null);
    let captionsRenderer: CaptionsRenderer | null = null;
    let currentSubtitleAbortController: AbortController | null = null;
    let overlayStyle = $state<string>("position: absolute; inset: 0;");
    let hlsInstance: Hls | null = null;
    let wakeLockSentinel: any = null;

    // Controls visibility & auto-hide timer
    let areControlsVisible = $state(true);
    let controlsTimer: any = null;
    let isScrubbing = $state(false);
    let scrubPreviewTime = $state<number | null>(null);
    let scrubPreviewPercent = $state<number>(0);

    // Active menus
    let isSubtitleMenuOpen = $state(false);

    // Gestures HUD
    type GestureType = "seek" | "volume" | "brightness" | null;
    let activeGesture = $state<GestureType>(null);
    let gestureSeekTarget = $state<number>(0);
    let gestureSeekDelta = $state<number>(0);
    let gestureHudTimer: any = null;

    // Double-tap animations
    let showDoubleTapLeft = $state(false);
    let showDoubleTapRight = $state(false);

    // Keep elements registered in state store
    $effect(() => {
        if (videoEl || containerEl) {
            videoPlayerState.registerElements(videoEl, containerEl);
        }
    });

    // Format seconds to mm:ss or hh:mm:ss
    const formatTime = (seconds: number): string => {
        if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
        }
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    const restartControlsTimer = () => {
        if (videoPlayerState.mode !== "expanded") return;
        areControlsVisible = true;
        if (controlsTimer) clearTimeout(controlsTimer);
        if (!videoPlayerState.isPlaying || isScrubbing || isSubtitleMenuOpen) {
            return;
        }
        controlsTimer = setTimeout(() => {
            if (videoPlayerState.isPlaying && !isScrubbing && !isSubtitleMenuOpen) {
                areControlsVisible = false;
            }
        }, 3500);
    };

    // Direct playback controllers (ensures 100% reliable execution)
    const togglePlay = () => {
        const v = videoEl || videoPlayerState.getVideo();
        if (!v) return;
        if (v.paused) {
            v.play().catch(() => {});
        } else {
            v.pause();
        }
        restartControlsTimer();
    };

    const seek = (time: number) => {
        const v = videoEl || videoPlayerState.getVideo();
        if (!v) return;
        const dur = v.duration || videoPlayerState.duration || Infinity;
        const clamped = Math.max(0, Math.min(dur, time));
        v.currentTime = clamped;
        videoPlayerState.currentTime = clamped;
        if (captionsRenderer) {
            captionsRenderer.currentTime = clamped;
        }
        restartControlsTimer();
    };

    const seekRelative = (offset: number) => {
        const v = videoEl || videoPlayerState.getVideo();
        if (!v) return;
        seek(v.currentTime + offset);
    };

    const toggleMute = () => {
        const v = videoEl || videoPlayerState.getVideo();
        const next = !videoPlayerState.muted;
        videoPlayerState.muted = next;
        if (v) v.muted = next;
        restartControlsTimer();
    };

    const setVolume = (val: number) => {
        videoPlayerState.setVolume(val);
        const v = videoEl || videoPlayerState.getVideo();
        if (v) v.volume = videoPlayerState.volume;
        restartControlsTimer();
    };

    const setSubtitle = (index: number) => {
        videoPlayerState.setSubtitle(index);
        isSubtitleMenuOpen = false;
        restartControlsTimer();
    };

    const toggleFullscreen = async () => {
        const target = containerEl || videoEl || videoPlayerState.getContainer() || videoPlayerState.getVideo();
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
        restartControlsTimer();
    };

    const enterPip = async () => {
        await videoPlayerState.enterPip();
        restartControlsTimer();
    };

    // Wake Lock management
    const requestWakeLock = async () => {
        if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
            try {
                wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
            } catch {}
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockSentinel) {
            try {
                await wakeLockSentinel.release();
            } catch {}
            wakeLockSentinel = null;
        }
    };

    // Attach HLS or direct MP4 stream to videoEl
    const loadStream = (sourceUrl: string, container?: "hls" | "mp4") => {
        if (!videoEl) return;

        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        const isHls = container === "hls" || sourceUrl.includes(".m3u8");

        if (isHls && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                maxBufferLength: 30,
                maxMaxBufferLength: 60,
                renderTextTracksNatively: false,
            });
            hls.subtitleDisplay = false;
            hls.attachMedia(videoEl);
            hls.on(Hls.Events.MEDIA_ATTACHED, () => {
                hls.loadSource(sourceUrl);
            });
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoEl?.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (_event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            break;
                    }
                }
            });
            hlsInstance = hls;
        } else if (isHls && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
            videoEl.src = sourceUrl;
            videoEl.play().catch(() => {});
        } else {
            videoEl.src = sourceUrl;
            videoEl.play().catch(() => {});
        }
    };

    // Watch for stream changes
    $effect(() => {
        const stream = videoPlayerState.streamSource;
        if (stream?.streamUrl && videoEl) {
            loadStream(stream.streamUrl, stream.container);
        }
    });

    // Watch playback volume & mute changes
    $effect(() => {
        if (videoEl) {
            videoEl.volume = videoPlayerState.volume;
            videoEl.muted = videoPlayerState.muted;
        }
    });

    // Update MediaSession when active episode changes
    $effect(() => {
        const ep = videoPlayerState.activeEpisode;
        if (ep) {
            const title = ep.titleNative || ep.titleEnglish || ep.titleRomanji || `Episode ${ep.number}`;
            updateMediaSessionMetadata({
                title,
                artist: videoPlayerState.animeName || "Anily",
                album: `Episode ${ep.number}`,
                artworkUrl: ep.thumbnailUrl || undefined,
            });
        }
    });

    // Responsive WebVTT subtitle overlay positioning matching the active video rect
    const updateOverlayRect = () => {
        if (!containerEl || !captionsOverlayEl) return;
        const cw = containerEl.clientWidth;
        const ch = containerEl.clientHeight;
        const vw = videoEl?.videoWidth || 0;
        const vh = videoEl?.videoHeight || 0;

        if (!vw || !vh || !cw || !ch) {
            overlayStyle = "position: absolute; top: 0px; left: 0px; width: 100%; height: 100%;";
            return;
        }

        const containerRatio = cw / ch;
        const videoRatio = vw / vh;
        let width = cw;
        let height = ch;
        let top = 0;
        let left = 0;

        if (videoRatio > containerRatio) {
            width = cw;
            height = width / videoRatio;
            top = (ch - height) / 2;
        } else {
            height = ch;
            width = height * videoRatio;
            left = (cw - width) / 2;
        }

        overlayStyle = `position: absolute; top: ${Math.round(top)}px; left: ${Math.round(left)}px; width: ${Math.round(width)}px; height: ${Math.round(height)}px;`;
    };

    const resolveSubUrl = (rawUrl: string): string => {
        if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("blob:")) {
            return rawUrl;
        }
        const base = apiBaseUrl.current ? apiBaseUrl.current.origin : (typeof window !== "undefined" ? window.location.origin : "");
        return new URL(rawUrl, base).toString();
    };

    const loadActiveSubtitle = async () => {
        if (!captionsRenderer) return;

        const stream = videoPlayerState.streamSource;
        const subIdx = videoPlayerState.selectedSubtitleIndex;

        if (!stream?.subtitles || subIdx < 0 || subIdx >= stream.subtitles.length) {
            captionsRenderer.reset();
            return;
        }

        const sub = stream.subtitles[subIdx];
        if (!sub?.url) {
            captionsRenderer.reset();
            return;
        }

        if (currentSubtitleAbortController) {
            currentSubtitleAbortController.abort();
        }
        const ac = new AbortController();
        currentSubtitleAbortController = ac;

        try {
            const fullUrl = resolveSubUrl(sub.url);
            const res = await fetch(fullUrl, { signal: ac.signal });
            if (!res.ok) {
                console.warn("Failed to load subtitle track:", res.statusText);
                captionsRenderer.reset();
                return;
            }

            const parsed = await parseResponse(res);
            if (ac.signal.aborted) return;

            captionsRenderer.changeTrack({
                cues: parsed.cues,
                regions: parsed.regions,
            });

            if (videoEl) {
                captionsRenderer.currentTime = videoEl.currentTime;
            }
        } catch (err: any) {
            if (err.name !== "AbortError") {
                console.warn("Error parsing subtitles:", err);
                captionsRenderer?.reset();
            }
        }
    };

    const captionsOverlayAction = (node: HTMLElement) => {
        captionsOverlayEl = node;
        captionsRenderer = new CaptionsRenderer(node);
        updateOverlayRect();
        loadActiveSubtitle();

        return {
            destroy() {
                if (currentSubtitleAbortController) {
                    currentSubtitleAbortController.abort();
                    currentSubtitleAbortController = null;
                }
                if (captionsRenderer) {
                    captionsRenderer.destroy();
                    captionsRenderer = null;
                }
                captionsOverlayEl = null;
            },
        };
    };

    $effect(() => {
        const _ = videoPlayerState.selectedSubtitleIndex;
        const _s = videoPlayerState.streamSource;
        if (captionsRenderer) {
            loadActiveSubtitle();
        }
    });

    $effect(() => {
        const _ = videoPlayerState.subtitleSize;
        if (captionsRenderer) {
            captionsRenderer.update(true);
        }
    });

    // MediaSession action registration
    onMount(() => {
        videoPlayerState.registerElements(videoEl, containerEl);

        const unbindMediaSession = setupMediaSessionActionHandlers({
            onPlay: () => togglePlay(),
            onPause: () => togglePlay(),
            onSeekBackward: (offset) => seekRelative(-offset),
            onSeekForward: (offset) => seekRelative(offset),
            onSeekTo: (time) => seek(time),
            onPreviousTrack: () => videoPlayerState.playPreviousEpisode(),
            onNextTrack: () => videoPlayerState.playNextEpisode(),
        });

        const onPipChanged = (e: Event) => {
            const detail = (e as CustomEvent)?.detail;
            videoPlayerState.inNativePip = Boolean(detail?.inPip);
        };
        window.addEventListener("anily:pip-changed", onPipChanged);

        const onWinResize = () => updateOverlayRect();
        window.addEventListener("resize", onWinResize);

        return () => {
            unbindMediaSession();
            window.removeEventListener("anily:pip-changed", onPipChanged);
            window.removeEventListener("resize", onWinResize);
            releaseWakeLock();
            if (currentSubtitleAbortController) {
                currentSubtitleAbortController.abort();
                currentSubtitleAbortController = null;
            }
            if (captionsRenderer) {
                captionsRenderer.destroy();
                captionsRenderer = null;
            }
            if (hlsInstance) {
                hlsInstance.destroy();
                hlsInstance = null;
            }
        };
    });

    // Video Event Handlers
    const handlePlay = () => {
        videoPlayerState.isPlaying = true;
        updateMediaSessionPlaybackState("playing");
        requestWakeLock();
        restartControlsTimer();
    };

    const handlePause = () => {
        videoPlayerState.isPlaying = false;
        updateMediaSessionPlaybackState("paused");
        releaseWakeLock();
        areControlsVisible = true;
    };

    const handleTimeUpdate = () => {
        if (!videoEl) return;
        const current = videoEl.currentTime;
        const dur = videoEl.duration || 0;
        if (captionsRenderer) {
            captionsRenderer.currentTime = current;
        }
        videoPlayerState.onTimeUpdate(current, dur);
        updateMediaSessionPosition(current, dur, videoPlayerState.playbackRate);

        if (videoEl.buffered.length > 0) {
            videoPlayerState.buffered = videoEl.buffered.end(videoEl.buffered.length - 1);
        }
    };

    const handleWaiting = () => {
        videoPlayerState.isBuffering = true;
    };

    const handlePlaying = () => {
        videoPlayerState.isBuffering = false;
    };

    // Desktop Click Surface Handlers
    let lastSurfaceClickTime = 0;
    const onSurfaceClick = (e: MouseEvent) => {
        if (e.target !== e.currentTarget && (e.target as HTMLElement).closest("button, input, .menu-relative, .scrubber-wrapper")) {
            return;
        }

        const now = Date.now();
        if (now - lastSurfaceClickTime < 300) {
            // Double click: toggle fullscreen
            toggleFullscreen();
            lastSurfaceClickTime = 0;
        } else {
            lastSurfaceClickTime = now;
            setTimeout(() => {
                if (Date.now() - lastSurfaceClickTime >= 290 && lastSurfaceClickTime > 0) {
                    togglePlay();
                    lastSurfaceClickTime = 0;
                }
            }, 300);
        }
    };

    // Touch & Swipe Gestures
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchInitialVideoTime = 0;
    let touchInitialVolume = 0;
    let touchInitialBrightness = 1;
    let isTouchActive = false;
    let lastTapTimestamp = 0;
    let lastTapX = 0;

    const onTouchStart = (e: TouchEvent) => {
        if (videoPlayerState.mode !== "expanded" || e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        touchInitialVideoTime = videoEl?.currentTime ?? 0;
        touchInitialVolume = videoPlayerState.volume;
        touchInitialBrightness = videoPlayerState.brightness;
        isTouchActive = true;
        activeGesture = null;
    };

    const onTouchMove = (e: TouchEvent) => {
        if (!isTouchActive || e.touches.length !== 1 || !containerEl) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        const rect = containerEl.getBoundingClientRect();

        if (!activeGesture) {
            if (Math.hypot(dx, dy) > 16) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    activeGesture = "seek";
                } else {
                    activeGesture = touchStartX < rect.left + rect.width * 0.5 ? "brightness" : "volume";
                }
            }
        }

        if (activeGesture === "seek") {
            const dragRatio = dx / rect.width;
            gestureSeekDelta = Math.round(dragRatio * 90);
            const target = Math.max(0, Math.min(videoPlayerState.duration || 9999, touchInitialVideoTime + gestureSeekDelta));
            gestureSeekTarget = target;
        } else if (activeGesture === "brightness") {
            const deltaBrightness = -dy / (rect.height * 0.65);
            const nextBrightness = Math.max(0.05, Math.min(1.0, touchInitialBrightness + deltaBrightness));
            videoPlayerState.setBrightness(nextBrightness);
        } else if (activeGesture === "volume") {
            const deltaVolume = -dy / (rect.height * 0.65);
            const nextVolume = Math.max(0, Math.min(1.0, touchInitialVolume + deltaVolume));
            setVolume(nextVolume);
        }
    };

    const onTouchEnd = (e: TouchEvent) => {
        if (!isTouchActive) return;
        isTouchActive = false;

        if (activeGesture === "seek") {
            seek(gestureSeekTarget);
            if (gestureHudTimer) clearTimeout(gestureHudTimer);
            gestureHudTimer = setTimeout(() => {
                activeGesture = null;
            }, 600);
            return;
        }

        if (activeGesture === "brightness" || activeGesture === "volume") {
            if (gestureHudTimer) clearTimeout(gestureHudTimer);
            gestureHudTimer = setTimeout(() => {
                activeGesture = null;
            }, 600);
            return;
        }

        // Single tap or double tap on touch
        const now = Date.now();
        const touchTimeDiff = now - touchStartTime;
        if (touchTimeDiff < 280) {
            const rect = containerEl?.getBoundingClientRect();
            const tapX = touchStartX - (rect?.left || 0);
            const width = rect?.width || 300;

            if (now - lastTapTimestamp < 320 && Math.abs(tapX - lastTapX) < 100) {
                if (tapX < width * 0.35) {
                    seekRelative(-10);
                    showDoubleTapLeft = true;
                    setTimeout(() => (showDoubleTapLeft = false), 650);
                } else if (tapX > width * 0.65) {
                    seekRelative(10);
                    showDoubleTapRight = true;
                    setTimeout(() => (showDoubleTapRight = false), 650);
                } else {
                    togglePlay();
                }
                lastTapTimestamp = 0;
            } else {
                lastTapTimestamp = now;
                lastTapX = tapX;
                setTimeout(() => {
                    if (Date.now() - lastTapTimestamp >= 310 && lastTapTimestamp > 0) {
                        areControlsVisible = !areControlsVisible;
                        if (areControlsVisible) restartControlsTimer();
                        lastTapTimestamp = 0;
                    }
                }, 320);
            }
        }
    };

    const calculateScrubTime = (e: MouseEvent | TouchEvent, scrubBar: HTMLElement): number => {
        const rect = scrubBar.getBoundingClientRect();
        if (rect.width <= 0) return 0;
        let clientX: number | undefined;
        if ("touches" in e) {
            const touch = e.touches[0] || e.changedTouches?.[0];
            clientX = touch?.clientX;
        } else {
            clientX = (e as MouseEvent).clientX;
        }
        if (clientX === undefined || Number.isNaN(clientX)) {
            return scrubPreviewTime ?? videoPlayerState.currentTime;
        }
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return ratio * (videoPlayerState.duration || 0);
    };

    const onScrubStart = (e: MouseEvent | TouchEvent) => {
        e.stopPropagation();
        isScrubbing = true;
        const scrubBar = (e.currentTarget as HTMLElement);
        const target = calculateScrubTime(e, scrubBar);
        scrubPreviewTime = target;
        scrubPreviewPercent = (target / (videoPlayerState.duration || 1)) * 100;
        restartControlsTimer();

        const onScrubMove = (moveEvent: MouseEvent | TouchEvent) => {
            if (!isScrubbing) return;
            const t = calculateScrubTime(moveEvent, scrubBar);
            scrubPreviewTime = t;
            scrubPreviewPercent = (t / (videoPlayerState.duration || 1)) * 100;
        };

        const onScrubEnd = (endEvent: MouseEvent | TouchEvent) => {
            if (!isScrubbing) return;
            isScrubbing = false;
            const finalTime = calculateScrubTime(endEvent, scrubBar);
            seek(finalTime);
            scrubPreviewTime = null;
            restartControlsTimer();
            window.removeEventListener("mousemove", onScrubMove);
            window.removeEventListener("touchmove", onScrubMove);
            window.removeEventListener("mouseup", onScrubEnd);
            window.removeEventListener("touchend", onScrubEnd);
        };

        window.addEventListener("mousemove", onScrubMove);
        window.addEventListener("touchmove", onScrubMove);
        window.addEventListener("mouseup", onScrubEnd);
        window.addEventListener("touchend", onScrubEnd);
    };

    // Keyboard Shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
        if (videoPlayerState.mode !== "expanded") return;
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        switch (e.key) {
            case " ":
            case "k":
            case "K":
                e.preventDefault();
                togglePlay();
                break;
            case "ArrowLeft":
                e.preventDefault();
                seekRelative(-5);
                break;
            case "ArrowRight":
                e.preventDefault();
                seekRelative(5);
                break;
            case "j":
            case "J":
                e.preventDefault();
                seekRelative(-10);
                break;
            case "l":
            case "L":
                e.preventDefault();
                seekRelative(10);
                break;
            case "ArrowUp":
                e.preventDefault();
                setVolume(videoPlayerState.volume + 0.05);
                break;
            case "ArrowDown":
                e.preventDefault();
                setVolume(videoPlayerState.volume - 0.05);
                break;
            case "f":
            case "F":
                e.preventDefault();
                toggleFullscreen();
                break;
            case "m":
            case "M":
                e.preventDefault();
                toggleMute();
                break;
            case "n":
            case "N":
                e.preventDefault();
                videoPlayerState.playNextEpisode();
                break;
            case "p":
            case "P":
                e.preventDefault();
                videoPlayerState.playPreviousEpisode();
                break;
            case "i":
            case "I":
                e.preventDefault();
                videoPlayerState.minimize();
                break;
            case "Escape":
                if (!document.fullscreenElement) {
                    videoPlayerState.minimize();
                }
                break;
        }
    };

    const isNearEnd = $derived(
        videoPlayerState.duration > 60 &&
        videoPlayerState.duration - videoPlayerState.currentTime <= 35 &&
        videoPlayerState.hasNextEpisode
    );

    const playedPercent = $derived(
        videoPlayerState.duration > 0
            ? (videoPlayerState.currentTime / videoPlayerState.duration) * 100
            : 0
    );

    const bufferedPercent = $derived(
        videoPlayerState.duration > 0
            ? (videoPlayerState.buffered / videoPlayerState.duration) * 100
            : 0
    );
</script>

<svelte:window onkeydown={onKeyDown} />

{#if videoPlayerState.mode !== "hidden"}
    <!-- Outer Player Container -->
    <div
        bind:this={containerEl}
        class="video-player-container"
        class:is-expanded={videoPlayerState.mode === "expanded"}
        class:is-minimized={videoPlayerState.mode === "minimized"}
        class:in-pip={videoPlayerState.inNativePip}
        class:controls-hidden={!areControlsVisible && videoPlayerState.isPlaying}
        onmousemove={restartControlsTimer}
        ontouchstart={onTouchStart}
        ontouchmove={onTouchMove}
        ontouchend={onTouchEnd}
        ontouchcancel={onTouchEnd}
        role="region"
        aria-label="Media Player"
    >
        <!-- The HTML5 Video Element -->
        <video
            bind:this={videoEl}
            class="video-element"
            style="filter: brightness({videoPlayerState.brightness});"
            playsinline
            crossorigin="anonymous"
            onplay={handlePlay}
            onpause={handlePause}
            ontimeupdate={handleTimeUpdate}
            onwaiting={handleWaiting}
            onplaying={handlePlaying}
            onloadedmetadata={updateOverlayRect}
            onresize={updateOverlayRect}
            onseeking={() => {
                if (videoEl && captionsRenderer) captionsRenderer.currentTime = videoEl.currentTime;
            }}
            onseeked={() => {
                if (videoEl && captionsRenderer) captionsRenderer.currentTime = videoEl.currentTime;
            }}
        ></video>

        <!-- Media Captions Overlay (spec-compliant 2D coordinates & completely transparent background) -->
        <div
            use:captionsOverlayAction
            class="media-captions-overlay"
            class:controls-visible={areControlsVisible || !videoPlayerState.isPlaying}
            class:size-small={videoPlayerState.subtitleSize === "small"}
            class:size-medium={videoPlayerState.subtitleSize === "medium"}
            class:size-large={videoPlayerState.subtitleSize === "large"}
            style={overlayStyle}
        ></div>

        <!-- ══════════════════════════════════════════════════════════════════════ -->
        <!-- EXPANDED MODE PRESENTATION                                            -->
        <!-- ══════════════════════════════════════════════════════════════════════ -->
        {#if videoPlayerState.mode === "expanded" && !videoPlayerState.inNativePip}
            <!-- Transparent Desktop Click Surface to Toggle Play/Pause -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="video-click-surface" onclick={onSurfaceClick}></div>

            <!-- Dark Vignette / Scrim -->
            <div
                class="controls-scrim"
                class:visible={areControlsVisible || !videoPlayerState.isPlaying}
            ></div>

            <!-- Double Tap Ripple Indicators -->
            {#if showDoubleTapLeft}
                <div class="double-tap-ripple left" transition:scale={{ duration: 250, start: 0.8 }}>
                    <RewindIcon size={36} weight="fill" />
                    <span>-10s</span>
                </div>
            {/if}
            {#if showDoubleTapRight}
                <div class="double-tap-ripple right" transition:scale={{ duration: 250, start: 0.8 }}>
                    <FastForwardIcon size={36} weight="fill" />
                    <span>+10s</span>
                </div>
            {/if}

            <!-- Gesture HUD Feedback Badges -->
            {#if activeGesture === "seek"}
                <div class="gesture-hud seek-hud" transition:fade={{ duration: 150 }}>
                    {#if gestureSeekDelta >= 0}
                        <FastForwardIcon size={28} weight="fill" />
                        <span>+{gestureSeekDelta}s</span>
                    {:else}
                        <RewindIcon size={28} weight="fill" />
                        <span>{gestureSeekDelta}s</span>
                    {/if}
                    <div class="hud-times">
                        <span class="hud-target">{formatTime(gestureSeekTarget)}</span>
                        <span class="hud-dur">/ {formatTime(videoPlayerState.duration)}</span>
                    </div>
                </div>
            {:else if activeGesture === "brightness"}
                <div class="gesture-hud vertical-hud left-side" transition:fade={{ duration: 150 }}>
                    <SunIcon size={24} weight="fill" />
                    <div class="hud-bar-track">
                        <div class="hud-bar-fill" style="height: {videoPlayerState.brightness * 100}%"></div>
                    </div>
                    <span>{Math.round(videoPlayerState.brightness * 100)}%</span>
                </div>
            {:else if activeGesture === "volume"}
                <div class="gesture-hud vertical-hud right-side" transition:fade={{ duration: 150 }}>
                    {#if videoPlayerState.volume === 0 || videoPlayerState.muted}
                        <SpeakerSlashIcon size={24} weight="fill" />
                    {:else if videoPlayerState.volume < 0.5}
                        <SpeakerLowIcon size={24} weight="fill" />
                    {:else}
                        <SpeakerHighIcon size={24} weight="fill" />
                    {/if}
                    <div class="hud-bar-track">
                        <div class="hud-bar-fill" style="height: {videoPlayerState.volume * 100}%"></div>
                    </div>
                    <span>{Math.round(videoPlayerState.volume * 100)}%</span>
                </div>
            {/if}

            <!-- Center Buffering Spinner -->
            {#if videoPlayerState.isBuffering}
                <div class="buffering-spinner-container" transition:fade={{ duration: 150 }}>
                    <span class="loading-spinner"></span>
                </div>
            {/if}

            <!-- Next Episode Prompt when nearing end -->
            {#if isNearEnd && areControlsVisible}
                <div class="next-prompt-container" transition:fade={{ duration: 200 }}>
                    <button
                        type="button"
                        class="next-prompt-btn"
                        onclick={() => videoPlayerState.playNextEpisode()}
                    >
                        <span>Next: Episode {videoPlayerState.nextEpisodeData?.number}</span>
                        <CaretRightIcon size={18} weight="bold" />
                    </button>
                </div>
            {/if}

            <!-- ── Top Header Bar ────────────────────────────────────────── -->
            <div
                class="player-topbar"
                class:visible={areControlsVisible || !videoPlayerState.isPlaying}
            >
                <div class="topbar-left">
                    <IconButton
                        size="player"
                        variant="standard"
                        shape="circle"
                        Icon={CaretDownIcon}
                        onclick={() => videoPlayerState.minimize()}
                        title="Minimize player (I / Esc)"
                        ariaLabel="Minimize player"
                    />
                    <div class="meta-titles">
                        <span class="meta-anime">{videoPlayerState.animeName}</span>
                        <span class="meta-episode">
                            Episode {videoPlayerState.activeEpisode?.number}
                            {#if videoPlayerState.activeEpisode?.titleNative || videoPlayerState.activeEpisode?.titleEnglish}
                                · {videoPlayerState.activeEpisode?.titleNative || videoPlayerState.activeEpisode?.titleEnglish}
                            {/if}
                        </span>
                    </div>
                </div>

                <div class="topbar-right">
                    <!-- Close -->
                    <IconButton
                        size="player"
                        variant="standard"
                        shape="circle"
                        Icon={XIcon}
                        onclick={() => videoPlayerState.close()}
                        title="Close player (Esc)"
                        ariaLabel="Close player"
                    />
                </div>
            </div>

            <!-- ── Bottom Controls Bar ───────────────────────────────────── -->
            <div
                class="player-bottombar"
                class:visible={areControlsVisible || !videoPlayerState.isPlaying}
            >
                <!-- Material 3 Scrubber Bar -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <div
                    class="scrubber-wrapper"
                    class:is-scrubbing={isScrubbing}
                    tabindex="0"
                    role="slider"
                    aria-label="Video timeline scrubber"
                    aria-valuemin="0"
                    aria-valuemax={Math.round(videoPlayerState.duration)}
                    aria-valuenow={Math.round(videoPlayerState.currentTime)}
                    aria-valuetext="{formatTime(videoPlayerState.currentTime)} of {formatTime(videoPlayerState.duration)}"
                    onmousedown={onScrubStart}
                    ontouchstart={onScrubStart}
                    onkeydown={(e) => {
                        if (e.key === "ArrowLeft") {
                            e.preventDefault();
                            seekRelative(-5);
                        } else if (e.key === "ArrowRight") {
                            e.preventDefault();
                            seekRelative(5);
                        }
                    }}
                >
                    <div class="scrub-track-bg"></div>
                    <div class="scrub-track-buffer" style="width: {bufferedPercent}%"></div>
                    <div
                        class="scrub-track-fill"
                        style="width: {isScrubbing ? scrubPreviewPercent : playedPercent}%"
                    ></div>
                    <div
                        class="scrub-thumb"
                        style="left: {isScrubbing ? scrubPreviewPercent : playedPercent}%"
                    ></div>

                    {#if isScrubbing && scrubPreviewTime !== null}
                        <div class="scrub-preview-pill" style="left: {scrubPreviewPercent}%">
                            {formatTime(scrubPreviewTime)}
                        </div>
                    {/if}
                </div>

                <!-- Controls Buttons Row -->
                <div class="controls-row">
                    <div class="controls-left">
                        <IconButton
                            size="player"
                            variant="standard"
                            shape="circle"
                            Icon={videoPlayerState.isPlaying ? PauseIcon : PlayIcon}
                            weight="fill"
                            onclick={togglePlay}
                            title={videoPlayerState.isPlaying ? "Pause (Space / K)" : "Play (Space / K)"}
                            ariaLabel={videoPlayerState.isPlaying ? "Pause" : "Play"}
                        />

                        <IconButton
                            size="player"
                            variant="standard"
                            shape="circle"
                            Icon={ArrowCounterClockwiseIcon}
                            onclick={() => seekRelative(-10)}
                            title="Rewind 10s (J / Left Arrow)"
                            ariaLabel="Rewind 10 seconds"
                        />

                        <IconButton
                            size="player"
                            variant="standard"
                            shape="circle"
                            Icon={ArrowClockwiseIcon}
                            onclick={() => seekRelative(10)}
                            title="Fast Forward 10s (L / Right Arrow)"
                            ariaLabel="Fast forward 10 seconds"
                        />

                        {#if videoPlayerState.hasNextEpisode}
                            <IconButton
                                size="player"
                                variant="standard"
                                shape="circle"
                                Icon={SkipForwardIcon}
                                onclick={() => videoPlayerState.playNextEpisode()}
                                title="Next Episode (N)"
                                ariaLabel="Next episode"
                            />
                        {/if}

                        <!-- Volume Control Group -->
                        <div class="volume-group">
                            <IconButton
                                size="player"
                                variant="standard"
                                shape="circle"
                                Icon={videoPlayerState.muted || videoPlayerState.volume === 0
                                    ? SpeakerSlashIcon
                                    : videoPlayerState.volume < 0.5
                                      ? SpeakerLowIcon
                                      : SpeakerHighIcon}
                                onclick={toggleMute}
                                title={videoPlayerState.muted ? "Unmute (M)" : `Mute (${Math.round(videoPlayerState.volume * 100)}%) (M)`}
                                ariaLabel={videoPlayerState.muted ? "Unmute" : "Mute"}
                            />
                            <div class="volume-slider-wrapper">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.02"
                                    class="volume-slider"
                                    aria-label="Volume slider"
                                    value={videoPlayerState.muted ? 0 : videoPlayerState.volume}
                                    oninput={(e) => setVolume(parseFloat((e.target as HTMLInputElement).value))}
                                />
                            </div>
                        </div>

                        <!-- Time display -->
                        <span class="time-display" aria-label="Playback time">
                            {formatTime(videoPlayerState.currentTime)} <span class="time-sep">/</span> {formatTime(videoPlayerState.duration)}
                        </span>
                    </div>

                    <div class="controls-right">
                        <!-- Subtitles Menu -->
                        {#if videoPlayerState.streamSource?.subtitles && videoPlayerState.streamSource.subtitles.length > 0}
                            <div class="menu-relative">
                                <IconButton
                                    size="player"
                                    variant="standard"
                                    shape="circle"
                                    Icon={ClosedCaptioningIcon}
                                    active={videoPlayerState.selectedSubtitleIndex >= 0}
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        isSubtitleMenuOpen = !isSubtitleMenuOpen;
                                    }}
                                    title="Closed Captions (C)"
                                    ariaLabel={videoPlayerState.selectedSubtitleIndex >= 0 ? "Closed captions active" : "Closed captions"}
                                />
                                {#if isSubtitleMenuOpen}
                                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                    <div
                                        class="m3-popup-menu"
                                        transition:fade={{ duration: 120 }}
                                        onclick={(e) => e.stopPropagation()}
                                        role="dialog"
                                        aria-label="Subtitle settings"
                                    >
                                        <div class="menu-section-header">Subtitles</div>
                                        <div class="menu-options-list" role="menu">
                                            <button
                                                type="button"
                                                class="menu-option"
                                                class:selected={videoPlayerState.selectedSubtitleIndex === -1}
                                                onclick={() => setSubtitle(-1)}
                                                role="menuitemradio"
                                                aria-checked={videoPlayerState.selectedSubtitleIndex === -1}
                                            >
                                                <span class="option-label">Off</span>
                                                {#if videoPlayerState.selectedSubtitleIndex === -1}
                                                    <CheckIcon size={18} weight="bold" class="option-check" />
                                                {/if}
                                            </button>
                                            {#each videoPlayerState.streamSource.subtitles as sub, idx}
                                                <button
                                                    type="button"
                                                    class="menu-option"
                                                    class:selected={videoPlayerState.selectedSubtitleIndex === idx}
                                                    onclick={() => setSubtitle(idx)}
                                                    role="menuitemradio"
                                                    aria-checked={videoPlayerState.selectedSubtitleIndex === idx}
                                                >
                                                    <span class="option-label">{sub.label}</span>
                                                    {#if videoPlayerState.selectedSubtitleIndex === idx}
                                                        <CheckIcon size={18} weight="bold" class="option-check" />
                                                    {/if}
                                                </button>
                                            {/each}
                                        </div>

                                        <div class="menu-divider" role="separator"></div>

                                        <div class="menu-section-header">Size</div>
                                        <div class="size-segmented-wrapper">
                                            <SegmentedControl
                                                variant="connected"
                                                ariaLabel="Subtitle size"
                                                value={videoPlayerState.subtitleSize}
                                                onchange={(val) => videoPlayerState.setSubtitleSize(val)}
                                                items={[
                                                    { value: "small", label: "Small" },
                                                    { value: "medium", label: "Medium" },
                                                    { value: "large", label: "Large" }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- Picture in Picture -->
                        <IconButton
                            size="player"
                            variant="standard"
                            shape="circle"
                            Icon={PictureInPictureIcon}
                            onclick={enterPip}
                            title="Picture in Picture (P)"
                            ariaLabel="Picture in Picture"
                        />

                        <!-- Fullscreen -->
                        <IconButton
                            size="player"
                            variant="standard"
                            shape="circle"
                            Icon={document.fullscreenElement ? ArrowsInIcon : ArrowsOutIcon}
                            onclick={toggleFullscreen}
                            title="Fullscreen (F)"
                            ariaLabel="Fullscreen"
                        />
                    </div>
                </div>
            </div>
        {/if}

        <!-- ══════════════════════════════════════════════════════════════════════ -->
        <!-- MINIMIZED (PICTURE-IN-APP) PRESENTATION                               -->
        <!-- ══════════════════════════════════════════════════════════════════════ -->
        {#if videoPlayerState.mode === "minimized"}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="mini-player-overlay" onclick={() => videoPlayerState.expand()}>
                <div class="mini-info">
                    <span class="mini-title">{videoPlayerState.animeName}</span>
                    <span class="mini-sub">EP {videoPlayerState.activeEpisode?.number}</span>
                </div>
                <div class="mini-actions" onclick={(e) => e.stopPropagation()}>
                    <IconButton
                        Icon={videoPlayerState.isPlaying ? PauseIcon : PlayIcon}
                        weight="fill"
                        onclick={togglePlay}
                        title={videoPlayerState.isPlaying ? "Pause" : "Play"}
                        ariaLabel={videoPlayerState.isPlaying ? "Pause" : "Play"}
                    />
                    <IconButton
                        Icon={ArrowsOutIcon}
                        onclick={() => videoPlayerState.expand()}
                        title="Expand"
                        ariaLabel="Expand"
                    />
                    <IconButton
                        Icon={XIcon}
                        onclick={() => videoPlayerState.close()}
                        title="Close"
                        ariaLabel="Close"
                    />
                </div>
                <!-- Mini Bottom Progress Bar -->
                <div class="mini-progress-bar">
                    <div class="mini-progress-fill" style="width: {playedPercent}%"></div>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style lang="scss">
    .video-player-container {
        position: fixed;
        background: #000000;
        overflow: hidden;
        user-select: none;
        box-sizing: border-box;

        &.is-expanded {
            inset: 0;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;

            &.controls-hidden {
                cursor: none;
            }
        }

        &.is-minimized {
            right: 24px;
            bottom: 24px;
            width: 340px;
            height: 192px;
            border-radius: 14px;
            z-index: 950;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.12);
            transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
            cursor: pointer;

            @media (max-width: 768px) {
                right: 12px;
                bottom: calc(76px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
                width: calc(100vw - 24px);
                height: 84px;
            }
        }

        &.in-pip {
            inset: 0;
            width: 100vw;
            height: 100vh;
            z-index: 1000;
        }
    }

    .video-element {
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
    }

    .video-click-surface {
        position: absolute;
        inset: 0;
        z-index: 5;
        cursor: pointer;
    }

    .controls-scrim {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s cubic-bezier(0.2, 0, 0, 1);
        z-index: 10;
        background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.85) 0%,
            rgba(0, 0, 0, 0.72) 14%,
            rgba(0, 0, 0, 0.48) 28%,
            rgba(0, 0, 0, 0.22) 42%,
            rgba(0, 0, 0, 0) 55%,
            rgba(0, 0, 0, 0) 65%,
            rgba(0, 0, 0, 0.22) 78%,
            rgba(0, 0, 0, 0.52) 88%,
            rgba(0, 0, 0, 0.82) 95%,
            rgba(0, 0, 0, 0.92) 100%
        );

        &.visible {
            opacity: 1;
        }
    }

    /* ── Top Bar ─────────────────────────────────────────────────────────── */
    .player-topbar {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        padding-top: calc(16px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)));
        padding-left: calc(20px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
        padding-right: calc(20px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));
        display: flex;
        align-items: center;
        justify-content: space-between;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s cubic-bezier(0.2, 0, 0, 1);
        z-index: 20;

        &.visible {
            opacity: 1;
            pointer-events: auto;
        }

        .topbar-left {
            display: flex;
            align-items: center;
            gap: 16px;
            min-width: 0;

            .meta-titles {
                display: flex;
                flex-direction: column;
                gap: 2px;
                min-width: 0;

                .meta-anime {
                    font-size: 16px;
                    font-weight: 600;
                    line-height: 1.25;
                    color: #ffffff;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .meta-episode {
                    font-size: 13px;
                    font-weight: 400;
                    line-height: 1.3;
                    color: rgba(255, 255, 255, 0.72);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            }
        }

        .topbar-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
    }

    .menu-relative {
        position: relative;
    }

    .m3-popup-menu {
        position: absolute;
        bottom: calc(100% + 14px);
        right: 0;
        background: var(--m3-surface-container-high, #201b17);
        border: 1px solid var(--m3-outline-variant, rgba(255, 255, 255, 0.12));
        border-radius: 16px;
        padding: 12px;
        box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.65),
            0 2px 8px rgba(0, 0, 0, 0.4);
        display: flex;
        flex-direction: column;
        min-width: 230px;
        max-width: 320px;
        z-index: 30;
        user-select: none;

        .menu-section-header {
            padding: 4px 10px 8px 10px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: var(--m3-on-surface-variant, #a8a29e);
        }

        .menu-options-list {
            display: flex;
            flex-direction: column;
            gap: 2px;
            max-height: 220px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.2) transparent;

            &::-webkit-scrollbar {
                width: 4px;
            }
            &::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
            }
        }

        .menu-option {
            background: transparent;
            border: none;
            border-radius: 10px;
            color: var(--m3-on-surface, #e7e1de);
            min-height: 44px;
            padding: 10px 12px;
            font-size: 14px;
            font-weight: 500;
            text-align: left;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            transition:
                background 0.15s ease,
                color 0.15s ease;

            .option-label {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex: 1;
            }

            :global(.option-check) {
                color: var(--color-accent, #ffd52c);
                flex-shrink: 0;
            }

            &:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
            }

            &:focus-visible {
                outline: 2px solid var(--color-accent, #ffd52c);
                outline-offset: -2px;
            }

            &.selected {
                background: rgba(255, 213, 44, 0.14);
                color: var(--color-accent, #ffd52c);
                font-weight: 600;

                &:hover {
                    background: rgba(255, 213, 44, 0.2);
                }
            }
        }

        .menu-divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.12);
            margin: 10px 4px;
            border: none;
        }

        .size-segmented-wrapper {
            display: flex;
            width: 100%;
            padding: 2px 2px 4px 2px;

            :global(.segmented-control) {
                display: flex;
                width: 100%;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            :global(.segment-item) {
                flex: 1;
                height: 38px;
                font-size: 13px;
                font-weight: 500;
                justify-content: center;
                text-align: center;
                padding: 0 8px;
                border-color: rgba(255, 255, 255, 0.1);

                &:focus-visible {
                    outline: 2px solid var(--color-accent, #ffd52c);
                    outline-offset: -2px;
                    z-index: 1;
                }

                &.active-accent {
                    background: rgba(255, 213, 44, 0.18);
                    color: var(--color-accent, #ffd52c);
                    font-weight: 600;
                }
            }
        }
    }

    /* ── Bottom Bar & Scrubber ───────────────────────────────────────────── */
    .player-bottombar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding-bottom: calc(16px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)));
        padding-left: calc(20px + var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
        padding-right: calc(20px + var(--safe-area-inset-right, env(safe-area-inset-right, 0px)));
        display: flex;
        flex-direction: column;
        gap: 6px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s cubic-bezier(0.2, 0, 0, 1);
        z-index: 20;

        &.visible {
            opacity: 1;
            pointer-events: auto;
        }

        .scrubber-wrapper {
            position: relative;
            height: 32px;
            display: flex;
            align-items: center;
            cursor: pointer;
            outline: none;

            &:focus-visible {
                .scrub-track-bg {
                    box-shadow: 0 0 0 2px var(--color-accent, #ffd52c);
                }
            }

            .scrub-track-bg {
                position: absolute;
                left: 0;
                right: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.25);
                border-radius: 3px;
                transition: height 0.15s ease, background 0.15s ease;
            }

            .scrub-track-buffer {
                position: absolute;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.45);
                border-radius: 3px;
                transition: height 0.15s ease;
            }

            .scrub-track-fill {
                position: absolute;
                left: 0;
                height: 3px;
                background: var(--color-accent, #ffd52c);
                border-radius: 3px;
                transition: height 0.15s ease;
            }

            .scrub-thumb {
                position: absolute;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: var(--color-accent, #ffd52c);
                transform: translate(-50%, 0) scale(0.4);
                opacity: 0;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
                transition: transform 0.15s ease, opacity 0.15s ease;
            }

            &:hover,
            &.is-scrubbing {
                .scrub-track-bg,
                .scrub-track-buffer,
                .scrub-track-fill {
                    height: 6px;
                }
                .scrub-thumb {
                    opacity: 1;
                    transform: translate(-50%, 0) scale(1);
                }
            }

            .scrub-preview-pill {
                position: absolute;
                bottom: 30px;
                transform: translateX(-50%);
                background: #1e1b18;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 11px;
                font-weight: 600;
                color: #fff;
                white-space: nowrap;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
            }
        }

        .controls-row {
            display: flex;
            align-items: center;
            justify-content: space-between;

            .controls-left {
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .controls-right {
                display: flex;
                align-items: center;
                gap: 6px;
            }
        }
    }

    .volume-group {
        display: flex;
        align-items: center;
        gap: 2px;

        .volume-slider-wrapper {
            display: flex;
            align-items: center;
            width: 72px;
            padding: 0 4px;

            @media (hover: none) or (max-width: 768px) {
                display: none;
            }

            .volume-slider {
                width: 100%;
                height: 4px;
                accent-color: var(--color-accent, #ffd52c);
                cursor: pointer;
                outline: none;
                background: rgba(255, 255, 255, 0.25);
                border-radius: 2px;

                &:focus-visible {
                    outline: 2px solid var(--color-accent, #ffd52c);
                    outline-offset: 2px;
                }
            }
        }
    }

    .time-display {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.88);
        margin-left: 8px;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;

        .time-sep {
            color: rgba(255, 255, 255, 0.45);
            margin: 0 2px;
        }
    }

    /* ── Gestures HUD ────────────────────────────────────────────────────── */
    .gesture-hud {
        position: absolute;
        background: rgba(18, 16, 14, 0.88);
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65);
        border-radius: 12px;
        color: #ffffff;
        z-index: 40;
        pointer-events: none;
        display: flex;
        align-items: center;

        &.seek-hud {
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 14px 22px;
            flex-direction: column;
            gap: 6px;
            font-size: 20px;
            font-weight: 700;

            .hud-times {
                display: flex;
                align-items: baseline;
                gap: 4px;
                font-size: 13px;
                font-weight: 500;

                .hud-target {
                    color: #ffd52c;
                }
                .hud-dur {
                    color: rgba(255, 255, 255, 0.6);
                }
            }
        }

        &.vertical-hud {
            top: 50%;
            transform: translateY(-50%);
            width: 44px;
            height: 160px;
            flex-direction: column;
            justify-content: space-between;
            padding: 12px 6px;
            font-size: 11px;
            font-weight: 700;

            &.left-side {
                left: 28px;
            }
            &.right-side {
                right: 28px;
            }

            .hud-bar-track {
                width: 5px;
                flex: 1;
                margin: 8px 0;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 3px;
                position: relative;
                overflow: hidden;

                .hud-bar-fill {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: #ffd52c;
                    border-radius: 3px;
                }
            }
        }
    }

    /* Double Tap Ripple */
    .double-tap-ripple {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        color: #fff;
        font-size: 14px;
        font-weight: 700;
        pointer-events: none;
        z-index: 35;

        &.left {
            left: 12%;
        }
        &.right {
            right: 12%;
        }
    }

    /* Buffering Spinner */
    .buffering-spinner-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 25;

        .loading-spinner {
            display: inline-block;
            width: 52px;
            height: 52px;
            border: 4px solid rgba(255, 255, 255, 0.2);
            border-top-color: #ffd52c;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Next Episode Prompt */
    .next-prompt-container {
        position: absolute;
        bottom: 84px;
        right: 24px;
        z-index: 25;

        .next-prompt-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 10px 18px;
            border-radius: 24px;
            background: #ffd52c;
            border: none;
            color: #1a160d;
            font-size: 13px;
            font-weight: 700;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
            cursor: pointer;
            transition: transform 0.15s ease;

            &:hover {
                transform: scale(1.04);
            }
        }
    }

    /* ── Minimized Overlay ───────────────────────────────────────────────── */
    .mini-player-overlay {
        position: absolute;
        inset: 0;
        background: rgba(18, 16, 14, 0.7);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        z-index: 10;
        opacity: 0;
        transition: opacity 0.2s ease;

        &:hover {
            opacity: 1;
        }

        @media (max-width: 768px) {
            opacity: 1;
            background: rgba(18, 16, 14, 0.8);
        }

        .mini-info {
            display: flex;
            flex-direction: column;
            min-width: 0;
            padding-right: 12px;

            .mini-title {
                font-size: 13px;
                font-weight: 600;
                color: #fff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .mini-sub {
                font-size: 11px;
                color: #ffd52c;
                font-weight: 700;
            }
        }

        .mini-actions {
            display: flex;
            align-items: center;
            gap: 2px;
            flex-shrink: 0;
        }

        .mini-progress-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: rgba(255, 255, 255, 0.2);

            .mini-progress-fill {
                height: 100%;
                background: #ffd52c;
            }
        }
    }

    /* ── Subtitle Styling via media-captions ───────────────────────────── */
    .media-captions-overlay {
        position: absolute;
        pointer-events: none;
        user-select: none;
        z-index: 6;
        contain: layout size;
        box-sizing: border-box;
        margin: 0 !important;
        padding: 0 2% 28px 2%;
        transition: padding 0.2s cubic-bezier(0.2, 0, 0, 1);

        --cue-bg-color: transparent !important;
        --cue-color: #ffffff;
        --cue-font-size: clamp(16px, calc(var(--overlay-height) / 100 * 4.4), 32px);
        --cue-line-height: 1.35;
        --cue-padding-x: 0px;
        --cue-padding-y: 0px;

        &.size-small {
            --cue-font-size: clamp(13px, calc(var(--overlay-height) / 100 * 3.3), 24px);
        }

        &.size-medium {
            --cue-font-size: clamp(16px, calc(var(--overlay-height) / 100 * 4.4), 32px);
        }

        &.size-large {
            --cue-font-size: clamp(20px, calc(var(--overlay-height) / 100 * 5.8), 44px);
        }

        &.controls-visible {
            padding: 0 2% 84px 2%;
        }

        :global([part='cue']) {
            background-color: transparent !important;
            background: transparent !important;
            color: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif !important;
            font-weight: 700 !important;
            text-rendering: optimizeLegibility !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-shadow:
                -1.5px -1.5px 0 #000000,
                 1.5px -1.5px 0 #000000,
                -1.5px  1.5px 0 #000000,
                 1.5px  1.5px 0 #000000,
                -2px 0 0 #000000,
                 2px 0 0 #000000,
                 0 -2px 0 #000000,
                 0  2px 0 #000000,
                -1px 0 0 #000000,
                 1px 0 0 #000000,
                 0 -1px 0 #000000,
                 0  1px 0 #000000,
                 0 2px 4px rgba(0, 0, 0, 0.95) !important;
            letter-spacing: 0.3px;
        }

        :global([part='cue'] *) {
            background-color: transparent !important;
            background: transparent !important;
            color: inherit;
            text-shadow: inherit;
        }
    }

    .video-player-container.is-minimized .media-captions-overlay {
        display: none !important;
    }
</style>
