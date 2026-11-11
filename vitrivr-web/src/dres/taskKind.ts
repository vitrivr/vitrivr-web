import {videoQaIdFromPath} from "../lib/videoQa.ts";

import defaults from "../config/frontendSettings.json" with {type: "json"};
import {formatDresName, type DresNaming} from "./naming.ts";

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

/** Format DRES names from CASTLE recording identifiers or VBS filename stems. */
export function submissionMediaName(path: string, view = "VBS", naming: DresNaming = defaults.dresNaming[view === "CASTLE" ? "CASTLE" : "VBS"]): string {
    if (view === "CASTLE") {
        const recordingId = videoQaIdFromPath(path) ?? path.trim().split(/[\\/]/).pop() ?? "";
        const match = recordingId.match(/^day_?([1-9]\d*)_([A-Za-z0-9]+)_(\d{2})(?:\.webm)?(?:\.mp4)?$/i);
        if (match) return formatDresName(naming, {
            day: match[1], camera: match[2], hour: match[3], stem: `Day_${match[1]}_${match[2]}_${match[3]}`,
        });
        throw new Error("Cannot identify the CASTLE recording for DRES. Its day, person or room, and hour are required.");
    }
    let value = path;
    try { if (/^https?:\/\//i.test(path)) value = new URL(path).pathname; } catch { /* Use the supplied path. */ }
    const stem = value.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") ?? "";
    return formatDresName(naming, {stem});
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
