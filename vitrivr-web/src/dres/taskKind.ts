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

/** Match the viewer's DRES item identifier, rather than sending a filesystem path. */
export function submissionMediaName(path: string): string {
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
