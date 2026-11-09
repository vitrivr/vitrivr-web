import type {InteractionEvent} from "./types.ts";

export function rivalsExport(events: InteractionEvent[]) {
    const categories = new Map<string, Set<string>>();
    const Logs: Record<string, unknown[]> = Object.create(null);
    for (const event of events) {
        const leaves = categories.get(event.category) ?? new Set<string>();
        leaves.add(event.action); categories.set(event.category, leaves);
        const user = event.context.operatorId;
        (Logs[user] ??= []).push({timestamp: event.timestamp, action: event.action,
            frameRank: event.frameRank ?? null, videoRank: event.videoRank ?? null,
            metadata: {eventId: event.id, sessionId: event.sessionId, pageId: event.pageId, sequence: event.sequence,
                elapsedMs: event.elapsedMs, ...event.context, data: event.data}});
    }
    return {interaction_logs: [{Name: "vitrivr-web", Hierarchy: [...categories].map(([Name, actions]) => ({Name, Visualize: true,
        Children: [...actions].sort().map(Name => ({Name, Visualize: false, Children: []}))})), Logs}]};
}

export function serializeLog(events: InteractionEvent[], format: "json" | "jsonl" | "rivals"): string {
    if (format === "jsonl") return events.map(event => JSON.stringify(event)).join("\n") + (events.length ? "\n" : "");
    return JSON.stringify(format === "rivals" ? rivalsExport(events) : {format: "vitrivr-interaction-log", version: 1,
        exportedAt: new Date().toISOString(), sessions: [...new Set(events.map(event => event.sessionId))], events}, null, 2);
}

export function downloadLog(contents: string, format: "json" | "jsonl" | "rivals") {
    const blob = new Blob([contents], {type: format === "jsonl" ? "application/x-ndjson" : "application/json"});
    downloadBlob(blob, format);
}

export function downloadBlob(blob: Blob, format: "json" | "jsonl" | "rivals") {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vitrivr-${format}-${new Date().toISOString().replace(/[:.]/g, "-")}.${format === "jsonl" ? "jsonl" : "json"}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
