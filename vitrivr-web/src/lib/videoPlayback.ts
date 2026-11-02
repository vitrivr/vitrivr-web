export type PlaybackHls = {
    loadSource: (src: string) => void;
    attachMedia: (video: HTMLVideoElement) => void;
    onFatalError: (listener: () => void) => void;
    destroy: () => void;
};
export type PlaybackOptions = {
    src: string;
    fallbackSrc?: string;
    startTime?: number;
    preload?: "none" | "metadata" | "auto";
    autoPlay?: boolean;
    preferFile?: boolean;
    createHls?: () => PlaybackHls | null;
    onFailure?: (message: string) => void;
    timeoutMs?: number;
};

const unavailableHls = new Map<string, number>();
const CACHE_MS = 60_000;
export function isHlsSource(src: string): boolean { return /\.m3u8(?:$|[?#])/i.test(src); }

/** One HLS attempt, then one original-file attempt; never cycle back to a failed stream. */
export function attachVideoPlayback(video: HTMLVideoElement, options: PlaybackOptions): () => void {
    let disposed = false;
    let hls: PlaybackHls | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let mode: "primary" | "fallback" | "failed" = "primary";
    let targetTime = options.startTime ?? 0;
    let resume = !!options.autoPlay;
    let metadataLoaded = false;
    let lastProgressTime = video.currentTime;
    const timeoutMs = options.timeoutMs ?? 8000;
    const fallback = options.fallbackSrc && options.fallbackSrc !== options.src ? options.fallbackSrc : "";
    const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
    const stopHls = () => { const previous = hls; hls = null; previous?.destroy(); };
    const rememberFailure = () => {
        if (unavailableHls.size >= 256) unavailableHls.delete(unavailableHls.keys().next().value!);
        unavailableHls.set(options.src, Date.now() + CACHE_MS);
    };
    const fail = () => {
        if (disposed || mode === "failed") return;
        if (mode === "primary" && fallback) {
            if (isHlsSource(options.src)) rememberFailure();
            if (metadataLoaded && Number.isFinite(video.currentTime)) targetTime = video.currentTime;
            resume = resume || !video.paused;
            mode = "fallback";
            clearTimer(); stopHls();
            metadataLoaded = false;
            video.src = fallback;
            video.load();
            armTimer();
        } else {
            mode = "failed"; clearTimer(); stopHls();
            options.onFailure?.("The video could not be loaded. Neither the stream nor the original file is available.");
        }
    };
    function armTimer() {
        if (timer !== undefined) return;
        if (!disposed && mode === "primary" && isHlsSource(options.src) && options.preload !== "none") timer = setTimeout(fail, timeoutMs);
    }
    const metadata = () => {
        if (disposed || mode === "failed") return;
        metadataLoaded = true;
        if (Number.isFinite(targetTime) && targetTime > 0) {
            try { video.currentTime = Number.isFinite(video.duration) ? Math.min(targetTime, Math.max(0, video.duration - 0.01)) : targetTime; }
            catch { /* Some browsers defer seeking until enough data has arrived. */ }
        }
        if (!isHlsSource(options.src) || mode === "fallback") clearTimer();
        if (resume) { void video.play().catch(() => {}); resume = false; }
    };
    const ready = () => { if (!disposed) clearTimer(); };
    const progress = () => {
        if (video.readyState >= 2 && video.currentTime !== lastProgressTime) {
            lastProgressTime = video.currentTime;
            ready();
        }
    };
    const stalled = () => {
        if (!disposed && mode === "primary" && isHlsSource(options.src) && (!video.paused || video.readyState < 2)) armTimer();
    };
    const listeners = {error: fail, loadedmetadata: metadata, loadeddata: ready, canplay: ready, playing: ready, timeupdate: progress, waiting: stalled, stalled};
    for (const [name, listener] of Object.entries(listeners)) video.addEventListener(name, listener);
    const hlsSource = isHlsSource(options.src);
    const cachedFailure = (unavailableHls.get(options.src) ?? 0) > Date.now();
    if ((!options.src || (hlsSource && (cachedFailure || options.preferFile))) && fallback) {
        mode = "fallback"; video.src = fallback;
        if (options.preload !== "none") { video.load(); armTimer(); }
    } else if (!options.src) fail();
    else if (!hlsSource || video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = options.src;
        if (options.preload !== "none") { video.load(); armTimer(); }
    } else {
        try { hls = options.createHls?.() ?? null; } catch { hls = null; }
        if (hls) {
            hls.onFatalError(() => { if (!disposed && mode === "primary") fail(); });
            const client = hls;
            try { client.loadSource(options.src); if (mode === "primary") client.attachMedia(video); armTimer(); }
            catch { fail(); }
        } else if (fallback) {
            // Preview cards need no HLS instance: their posters stay lazy and the
            // file can load natively if playback is requested.
            mode = "fallback"; video.src = fallback;
            if (options.preload !== "none") { video.load(); armTimer(); }
        } else fail();
    }
    return () => {
        disposed = true; clearTimer();
        for (const [name, listener] of Object.entries(listeners)) video.removeEventListener(name, listener);
        stopHls(); video.removeAttribute("src"); video.load();
    };
}
