import {videoQaIdFromPath} from "../lib/videoQa.ts";

export type SubmissionKind = "text" | "item" | "temporal" | "unknown";

/** DRES task types use display names, e.g. "Visual Question Answering". */
export type SubmissionTask = {name?: string; taskGroup?: string; taskType?: string; type?: string; submissionOptions?: string[]};

export function submissionKindFromTask(task: SubmissionTask | null | undefined): SubmissionKind {
    if (task?.submissionOptions?.includes("TEXTUAL_SUBMISSION")) return "text";
    if (task?.submissionOptions?.some(option => option === "ITEM_SUBMISSION" || option === "TEMPORAL_SUBMISSION")) return "item";
    const type = task?.taskType ?? task?.type;
    if (!type) return "unknown";
    const normalized = type.toLowerCase().replace(/[_-]+/g, " ").trim();
    if (/question\s*answer|\btext(?:ual)?\s+(?:answer|submission)\b|^(?:text|textual)$|\b(?:vqa|qa|kqa|avqa)\b|\bq\s*&\s*a\b/.test(normalized)) return "text";
    return "item";
}

/** CASTLE identifies recordings by day, camera and hour; VBS uses the filename stem. */
export function submissionMediaName(path: string, view = "VBS"): string {
    if (view === "CASTLE") {
        const recordingId = videoQaIdFromPath(path);
        if (recordingId) return recordingId;
        const canonicalId = path.trim().replace(/\.mp4$/i, "");
        if (/^day[1-9]\d*_[A-Za-z0-9]+_\d{2}$/.test(canonicalId)) return canonicalId;
        throw new Error("Cannot identify the CASTLE recording for DRES. Its day, person or room, and hour are required.");
    }
    let value = path;
    try { if (/^https?:\/\//i.test(path)) value = new URL(path).pathname; } catch { /* Use the supplied path. */ }
    return value.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "";
}

/** A rejection from the configured DRES filter overrides guesses based on task names. */
export function requiresTextAnswer(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const response = (error as {response?: {data?: {description?: unknown}}}).response;
    const description = response?.data?.description;
    return typeof description === "string" && /does not include textual information|(?:requires?|expects?) (?:a )?(?:text|textual) (?:answer|submission|information)/i.test(description);
}

export function taskFingerprint(task: SubmissionTask): string {
    return JSON.stringify([task.name, task.taskGroup, task.taskType ?? task.type]);
}
