import type {HourlyVideo} from "./ThumbnailUtils.ts";

type PreviewDependencies = {
    exists: (url: string, signal: AbortSignal) => Promise<boolean>;
    thumbnail: (url: string, time: number, signal: AbortSignal) => Promise<string | undefined>;
};

/** Publish each available POV and its preview independently, with bounded video decoding. */
export async function loadPovPreviews(
    candidates: HourlyVideo[],
    signal: AbortSignal,
    onUpdate: (video: HourlyVideo) => void,
    dependencies: PreviewDependencies,
    concurrency = 4,
): Promise<void> {
    const limit = Math.max(1, concurrency);
    let index = 0;
    let decoding = 0;
    const waiting: Array<() => void> = [];
    const previews: Promise<void>[] = [];

    async function loadThumbnail(video: HourlyVideo) {
        if (decoding >= limit) await new Promise<void>(resolve => waiting.push(resolve));
        else decoding++;
        try {
            if (signal.aborted) return;
            const thumbnail = await dependencies.thumbnail(video.url, video.seekTime, signal);
            if (thumbnail && !signal.aborted) onUpdate({...video, thumbnail});
        } catch {
            // Keep a playable card even if frame capture fails (for example, CORS).
        } finally {
            const next = waiting.shift();
            if (next) next();
            else decoding--;
        }
    }

    async function worker() {
        while (!signal.aborted) {
            const video = candidates[index++];
            if (!video) return;
            try {
                if (!await dependencies.exists(video.url, signal) || signal.aborted) continue;
                onUpdate(video);
                // Availability checks continue while the separate decoder queue runs.
                previews.push(loadThumbnail(video));
            } catch {
                // One unavailable video must not prevent the remaining POVs from loading.
            }
        }
    }
    await Promise.all(Array.from({length: Math.min(limit, candidates.length)}, worker));
    await Promise.all(previews);
}
