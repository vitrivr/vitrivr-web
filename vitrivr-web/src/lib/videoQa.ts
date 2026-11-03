export const VIDEO_QA_SCHEMA = "castle";
// The service allows three minutes; leave a little time for the engine response.
export const VIDEO_QA_TIMEOUT_MS = 190_000;

export type VideoQaDayFilter = {days: string[]; time_start?: string; time_end?: string};
export type VideoQaSelection = {
    videoIds?: string[];
    cameras?: string[];
    timeStart?: string;
    timeEnd?: string;
    additionalFilters?: VideoQaDayFilter[];
};

const unique = (values: readonly string[] = []) => [...new Set(values.map(value => value.trim()).filter(Boolean))];

/** CASTLE QA IDs address whole hourly recordings, not segment or source UUIDs. */
export function videoQaIdFromPath(path: string): string | undefined {
    let normalized = path.trim().replace(/\\/g, "/");
    if (/^https?:\/\//i.test(normalized)) {
        try { normalized = new URL(normalized).pathname; } catch { return undefined; }
    }
    const match = normalized.match(/(?:^|\/)(day[1-9]\d*)\/([^/]+)\/video\/(\d{1,2})\.[^/]+$/i);
    if (!match || Number(match[3]) > 23) return undefined;
    let camera: string;
    try { camera = decodeURIComponent(match[2]).normalize("NFD").replace(/\p{M}/gu, ""); }
    catch { return undefined; }
    if (!/^[A-Za-z0-9]+$/.test(camera)) return undefined;
    return `${match[1].toLowerCase()}_${camera}_${match[3].padStart(2, "0")}`;
}

function scopeTime(value?: string): string | undefined {
    if (!value?.trim()) return undefined;
    const match = value.trim().match(/^day([1-9]\d*):(\d{1,2})$/);
    if (!match || Number(match[2]) > 23) throw new Error("Use dayN:HH for the time range, for example day1:10.");
    return `day${match[1]}:${match[2].padStart(2, "0")}`;
}

export function buildVideoQaQuery(question: string, selection: VideoQaSelection, maxFrames = 8) {
    if (!question.trim()) throw new Error("Enter a question for Video QA.");
    if (!Number.isInteger(maxFrames) || maxFrames < 1 || maxFrames > 128) throw new Error("Frames per video must be a whole number between 1 and 128.");
    const videoIds = unique(selection.videoIds);
    if (videoIds.some(id => !/^day[1-9]\d*_[A-Za-z0-9]+_([01]\d|2[0-3])$/.test(id))) throw new Error("Video IDs must use dayN_Camera_HH, for example day2_Bjorn_11.");
    const cameras = unique(selection.cameras?.map(camera => camera.normalize("NFD").replace(/\p{M}/gu, "")));
    const timeStart = scopeTime(selection.timeStart);
    const timeEnd = scopeTime(selection.timeEnd);
    const order = (time: string) => { const [day, hour] = time.split(":"); return Number(day.slice(3)) * 24 + Number(hour); };
    if (timeStart && timeEnd && order(timeEnd) <= order(timeStart)) throw new Error("The end of the time range must follow the start.");
    const filters = selection.additionalFilters?.map(filter => {
        const days = unique(filter.days);
        if (!days.length || days.some(day => !/^day[1-9]\d*$/.test(day))) throw new Error("Each day filter needs at least one day in dayN format.");
        const start = filter.time_start?.trim() || undefined;
        const end = filter.time_end?.trim() || undefined;
        if ([start, end].some(time => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error("Day filter times must use HH:MM.");
        if (start && end && end <= start) throw new Error("The end of a day filter must follow its start.");
        return {days, ...(start ? {time_start: start} : {}), ...(end ? {time_end: end} : {})};
    }) ?? [];
    if (!videoIds.length && !cameras.length && !timeStart && !timeEnd && !filters.length) throw new Error("Select at least one video, camera, time range or day filter.");
    const parameters: Record<string, string> = {media: JSON.stringify({type: "frames", max_frames_per_video: maxFrames})};
    if (videoIds.length) parameters.video_id = JSON.stringify(videoIds);
    // Video IDs take priority; do not send an ignored camera selection.
    else if (cameras.length) parameters.camera_filter = JSON.stringify(cameras);
    if (timeStart) parameters.time_start = timeStart;
    if (timeEnd) parameters.time_end = timeEnd;
    if (filters.length) parameters.additional_filters = JSON.stringify(filters);
    return {inputs: {question: {type: "TEXT" as const, data: question.trim()}}, operations: {
        answer: {field: "videoqa", inputs: {text: "question"}, parameters},
    }, output: "answer"};
}

type VideoQaResponse = {retrievables?: {properties?: Record<string, unknown>}[]};
export function readVideoQaAnswer(response: VideoQaResponse): string {
    const answer = response?.retrievables?.[0]?.properties?.["qa.answer"];
    if (typeof answer !== "string" || !answer.trim()) throw new Error("The Video QA service returned no answer.");
    return answer;
}

export function videoQaErrorMessage(error: unknown): string {
    if (error && typeof error === "object" && "body" in error) {
        const body = error.body;
        if (typeof body === "string" && body.trim()) return body;
        if (body && typeof body === "object") {
            for (const key of ["message", "description", "error"]) {
                const value = (body as Record<string, unknown>)[key];
                if (typeof value === "string" && value.trim()) return value;
            }
        }
    }
    return error instanceof Error ? error.message : String(error);
}

type QaRequest = PromiseLike<VideoQaResponse> & {cancel: () => void};
export function executeVideoQa(
    execute: (query: ReturnType<typeof buildVideoQaQuery>) => QaRequest,
    query: ReturnType<typeof buildVideoQaQuery>, signal: AbortSignal, timeoutMs = VIDEO_QA_TIMEOUT_MS,
): Promise<string> {
    if (signal.aborted) return Promise.reject(new DOMException("Video QA cancelled.", "AbortError"));
    return new Promise((resolve, reject) => {
        const request = execute(query);
        let finished = false;
        const finish = (action: () => void) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            action();
        };
        const abort = () => { finish(() => reject(new DOMException("Video QA cancelled.", "AbortError"))); request.cancel(); };
        const timer = setTimeout(() => {
            finish(() => reject(new Error("Video QA timed out after three minutes. Please try a smaller selection or fewer frames.")));
            request.cancel();
        }, timeoutMs);
        signal.addEventListener("abort", abort, {once: true});
        Promise.resolve(request).then(response => {
            try { const answer = readVideoQaAnswer(response); finish(() => resolve(answer)); }
            catch (error) { finish(() => reject(error)); }
        }, error => finish(() => reject(error)));
        if (signal.aborted) abort();
    });
}
