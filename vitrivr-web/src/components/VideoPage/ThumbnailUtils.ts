import {requestCLIPVector} from "../../lib/pythonDescriptorServer.ts";
import {uuid} from "../../utils/uuid.ts";

type PovKind = "person" | "room";

/**
 * This type slightly differs from a ResultItem, but essentially serves the same purpose. The only difference is that
 * with the hourly videos are not vitrivr results, but "bare" videos. Thus, the thumbnails and the clip vectors need
 * to be generated.
 */
export type HourlyVideo = {
    id: string;
    name: string;
    url: string;
    kind: PovKind;
    seekTime: number;
    thumbnail?: string;
    CLIPVector?: number[];
};

export type ParsedVideoUrl = {
    origin: string;
    day: string;
    person: string;
    filename: string;
};

/**
 * Function that parses the URL of the video to extract the day, person and filename from the path.
 * Mainly used for displaying the videos from the same time, date but different person.
 * @param url
 */
export function parseVideoURL(url: string): ParsedVideoUrl | null {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        // TODO: adjust this to the actual schema of the filename. not all filenames contain "videos"
        // the expected format is like this: http://10.34.64.212:8080/videos/day4/Luca/video/08.mp4
        const match = parsed.pathname.match(/^\/videos\/([^/]+)\/([^/]+)\/video\/([^/]+)$/);
        if (!match) return null;
        return {
            origin: parsed.origin,
            day: match[1],
            person: match[2],
            filename: match[3],
        };
    } catch {
        return null;
    }
}

/**
 * Checks whether a video exists for the url.
 */
const availabilityCache = new Map<string, {exists: boolean; expires: number}>();

export async function videoExists(url: string, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) return false;
    const cached = availabilityCache.get(url);
    if (cached && cached.expires > Date.now()) return cached.exists;

    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, {once: true});
    const timeout = setTimeout(abort, 3000);
    let exists: boolean | undefined;
    try {
        // Avoid downloading/decoding video metadata when the server supports HEAD.
        const response = await fetch(url, {method: "HEAD", signal: controller.signal});
        if (response.ok) exists = true;
        else if (response.status === 404 || response.status === 410) exists = false;
    } catch { /* Servers without HEAD/CORS support fall back to media metadata. */ }
    finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", abort);
    }
    if (signal?.aborted) return false;
    exists ??= await videoMetadataExists(url, signal);
    if (!signal?.aborted) {
        if (availabilityCache.size >= 128) availabilityCache.delete(availabilityCache.keys().next().value!);
        availabilityCache.set(url, {exists, expires: Date.now() + (exists ? 300_000 : 15_000)});
    }
    return exists;
}

function videoMetadataExists(url: string, signal?: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        let finished = false;
        const abort = () => finish(false);
        const timeout = setTimeout(abort, 5000);
        function finish(exists: boolean) {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            signal?.removeEventListener("abort", abort);
            video.onloadedmetadata = null;
            video.onerror = null;
            video.removeAttribute("src");
            video.load();
            resolve(exists);
        }
        if (signal?.aborted) { finish(false); return; }
        signal?.addEventListener("abort", abort, {once: true});
        video.preload = "metadata";
        video.onloadedmetadata = () => finish(true);
        video.onerror = () => finish(false);
        video.src = url;
    });
}

export async function generateThumbnailAndClip(video: HourlyVideo): Promise<HourlyVideo | undefined> {
    try {
        const thumbnail = await generateVideoThumbnail(video.url, video.seekTime);
        if (!thumbnail) {
            console.warn("Could not generate thumbnail for:", video.url);
            return undefined;
        }
        const CLIPVector = await requestCLIPVector(thumbnail);
        console.log(thumbnail, CLIPVector);
        return {...video, thumbnail, CLIPVector,};
    } catch (error) {
        console.error("Failed to generate thumbnail / CLIP vector:", video.url, error);
        return undefined;
    }
}

/**
 * Runs async checks with a concurrency limit s.t. we don't fire too many requests at the video server.
 */
export async function filterExistingVideos(videos: HourlyVideo[], concurrency = 4): Promise<HourlyVideo[]> {
    const existing = new Set<string>();
    let index = 0;

    async function worker() {
        while (true) {
            const currentIndex = index++;

            if (currentIndex >= videos.length) {
                return;
            }

            const video = videos[currentIndex];

            if (await videoExists(video.url)) {
                existing.add(video.url);
            }
        }
    }
    await Promise.all(Array.from({length: Math.min(concurrency, videos.length),}, () => worker()));
    return videos.filter((video) =>
        existing.has(video.url)
    );
}

/**
 * Generates a UUID and converts it into a string.
 */
export const uuidFromUuidV4 = () => {
    const newUuid = uuid()
    return newUuid.toString();
}

/**
 * Generates the video thumbnails from a given URL and seektime.
 * @param url string
 * @param seekTime
 */
const thumbnailCache = new Map<string, string>();

export async function generateVideoThumbnail(url: string, seekTime: number, signal?: AbortSignal): Promise<string | undefined> {
    if (signal?.aborted) return undefined;
    const key = `${url}@${seekTime}`;
    const cached = thumbnailCache.get(key);
    if (cached) return cached;
    const thumbnail = await captureVideoThumbnail(url, seekTime, signal);
    if (thumbnail && !signal?.aborted) {
        if (thumbnailCache.size >= 48) thumbnailCache.delete(thumbnailCache.keys().next().value!);
        thumbnailCache.set(key, thumbnail);
    }
    return thumbnail;
}

function captureVideoThumbnail(url: string, seekTime: number, signal?: AbortSignal): Promise<string | undefined> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        const canvas = document.createElement("canvas");
        let finished = false;

        const timeout = window.setTimeout(() => {
            console.warn("Thumbnail generation timed out:", url);
            finish(undefined);
        }, 10_000);

        const abort = () => finish(undefined);
        if (signal?.aborted) { finish(undefined); return; }
        signal?.addEventListener("abort", abort, {once: true});

        function cleanup() {
            signal?.removeEventListener("abort", abort);
            window.clearTimeout(timeout);
            video.onloadedmetadata = null;
            video.onloadeddata = null;
            video.onseeked = null;
            video.onerror = null;
            video.removeAttribute("src");
            video.load();
        }

        function finish(thumbnail: string | undefined) {
            if (finished) return;
            finished = true;
            cleanup();
            resolve(thumbnail);
        }

        function captureFrame() {
            try {
                if (!video.videoWidth || !video.videoHeight) {
                    console.warn("Video has no dimensions:", url, video.videoWidth, video.videoHeight);
                    finish(undefined);
                    return;
                }

                const maxWidth = 480;
                const scale = Math.min(1, maxWidth / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale);
                canvas.height = Math.round(video.videoHeight * scale);
                const context = canvas.getContext("2d");

                if (!context) {
                    console.error("Could not create canvas context");
                    finish(undefined);
                    return;
                }

                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
                console.log("Thumbnail generated:", url);
                finish(thumbnail);
            } catch (error) {
                console.error("Thumbnail capture failed:", url, error);
                finish(undefined);
            }
        }

        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        try {
            if (new URL(url).origin !== window.location.origin) {
                video.crossOrigin = "anonymous";
            }
        } catch (error) {
            console.error("Invalid video URL:", url, error);
        }

        video.onerror = () => {
            console.error("Thumbnail video failed:", url, video.error);
            finish(undefined);
        };

        video.onloadedmetadata = () => {
            console.log("Metadata loaded:", url, "duration:", video.duration, "size:", video.videoWidth, "x", video.videoHeight);

            if (
                Number.isFinite(video.duration) &&
                video.duration > 0
            ) {
                const targetTime = Math.min(seekTime, Math.max(0, video.duration - 0.1));
                console.log("Seeking thumbnail to:", targetTime);
                if (targetTime <= 0.01) {
                    video.onloadeddata = captureFrame;
                    video.preload = "auto";
                    if (video.readyState >= 2) captureFrame();
                } else {
                    video.currentTime = targetTime;
                }
            } else {
                video.onloadeddata = captureFrame;
                video.preload = "auto";
                if (video.readyState >= 2) captureFrame();
            }
        };

        video.onseeked = () => {
            console.log("Thumbnail seek completed:", url, video.currentTime);
            captureFrame();
        };

        video.src = url;
        video.load();
    });
}

/**
 * This generates CLIP vector and the thumbnail for the POV data. This is necessary because it is not a vitrivr result.
 * It does this by requesting the CLIP vectors at the vitrivr descriptor server and the thumbnails are cut from the
 * video itself.
 * @param videos
 * @param concurrency
 */
export async function generatePOVData(videos: HourlyVideo[], concurrency = 2): Promise<HourlyVideo[]> {
    const results: HourlyVideo[] = [];
    let index = 0;
    async function worker() {
        while (true) {
            const currentIndex = index++;

            if (currentIndex >= videos.length) {
                return;
            }
            const result = await generateThumbnailAndClip(videos[currentIndex]);
            if (result) {
                results.push(result);
            }
        }
    }

    await Promise.all(
        Array.from(
            {
                length: Math.min(
                    concurrency,
                    videos.length
                ),
            },
            () => worker()
        )
    );

    return results;
}