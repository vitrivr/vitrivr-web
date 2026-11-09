import type {DeliveryConfig} from "./deliveryTypes.ts";
import type {InteractionEvent} from "./types.ts";

export type SessionExport = {blob: Blob; eventCount: number; localEventCount: number; serverEventCount: number; warning: string | null};

/** Snapshot local events BEFORE fetching the server. An upload/removal between
 * these steps is covered by one or both snapshots; deduplicate by stable ID. */
export async function collectSessionEvents(sessionId: string, local: InteractionEvent[], config: DeliveryConfig, fetcher: typeof fetch = fetch) {
    const events = new Map(local.filter(event => event.sessionId === sessionId).map(event => [event.id, event]));
    const localEventCount = events.size;
    let serverEventCount = 0;
    let warning: string | null = null;
    if (config.baseUrl) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60_000);
        try {
            let response: Response;
            try {
                response = await fetcher(`${config.baseUrl.replace(/\/$/, "")}/sessions/${encodeURIComponent(sessionId)}/export?format=jsonl`, {
                    credentials: config.credentials, signal: controller.signal, headers: {Accept: "application/x-ndjson"}, cache: "no-store",
                });
            } catch {
                throw new Error("Cannot reach the log server. Your local logs remain saved. Use Download local logs for a local-only copy, or retry this session download when the server is reachable.");
            }
            if (response.status === 404) {
                const detail = await response.json().catch(() => null) as {error?: string} | null;
                if (detail?.error !== "Session not found.") throw new Error("The logging export endpoint was not found. Check the backend URL and deployed collector version. Local logs were retained.");
                if (!events.size) throw new Error("No events for this session were found locally or on the server. Check that recording is enabled and that you are using the original browser tab/session.");
                warning = "This session has not reached the server yet. The download contains its locally retained events; uploads will continue automatically.";
            } else {
                if (!response.ok) throw new Error(`Session download returned HTTP ${response.status}. Local logs were retained; no incomplete combined download was created.`);
                let rows: unknown[];
                try { rows = (await response.text()).split("\n").filter(line => line.trim()).map(line => JSON.parse(line)); }
                catch { throw new Error("The server export was interrupted or invalid. Local logs were retained. Retry the session download."); }
                const count = response.headers.get("X-Log-Event-Count");
                if (count !== null && (!/^\d+$/.test(count) || Number(count) !== rows.length)) {
                    throw new Error("The server export was incomplete (event count mismatch). Local logs were retained. Retry the session download.");
                }
                const seen = new Set<string>();
                for (const row of rows) {
                    const event = row as InteractionEvent | null;
                    if (!event || typeof event !== "object" || typeof event.id !== "string" || !event.id || event.sessionId !== sessionId ||
                        event.version !== 1 || typeof event.action !== "string" || typeof event.pageId !== "string" ||
                        !Number.isFinite(event.timestamp) || !Number.isInteger(event.sequence) || !event.context || typeof event.context.operatorId !== "string" ||
                        !("data" in event) || seen.has(event.id)) {
                        throw new Error("The server returned invalid, duplicate, or mismatched session events. Local logs were retained.");
                    }
                    seen.add(event.id); events.set(event.id, event);
                }
                serverEventCount = rows.length;
            }
        } finally { clearTimeout(timer); }
    }
    if (!events.size) throw new Error("No recorded events were found for this session.");
    return {events: [...events.values()].sort((a, b) => a.timestamp - b.timestamp || a.pageId.localeCompare(b.pageId) || a.sequence - b.sequence),
        localEventCount, serverEventCount, warning};
}
