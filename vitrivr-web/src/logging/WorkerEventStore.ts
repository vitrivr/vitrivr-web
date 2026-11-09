import {sanitize} from "./sanitize.ts";
import {initialDeliveryStatus, type DeliveryConfig, type DeliveryStatus, type WorkerCommand, type WorkerReply} from "./deliveryTypes.ts";
import type {EventStore, InteractionEvent} from "./types.ts";

type Command = WorkerCommand extends infer T ? T extends WorkerCommand ? Omit<T, "id"> : never : never;
export class WorkerEventStore implements EventStore {
    private worker: Worker | null = null;
    private status: DeliveryStatus = {...initialDeliveryStatus};
    private localError: string | null = null;
    private listeners = new Set<() => void>();
    private sequence = 0;
    private buffered: InteractionEvent[] = [];
    private batchTimer: ReturnType<typeof setTimeout> | undefined;
    private pending = new Map<number, {resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>}>();
    readonly config: DeliveryConfig;
    constructor(config: DeliveryConfig) {
        this.config = config;
        if (config.configurationError) { this.fail(config.configurationError); return; }
        try {
            this.worker = new Worker(new URL("./logging.worker.ts", import.meta.url), {type: "module"});
            this.worker.onmessage = ({data}: MessageEvent<WorkerReply>) => {
                if (data.type === "status") { this.update(data.status); return; }
                const request = this.pending.get(data.id);
                if (!request) return;
                this.pending.delete(data.id); clearTimeout(request.timer);
                if (data.error) request.reject(new Error(data.error)); else request.resolve(data.value);
            };
            this.worker.onerror = () => this.fail("Logging worker stopped. Recording is paused; reload after downloading any available logs.");
            this.worker.onmessageerror = () => this.fail("Logging worker communication failed. Recording is paused.");
            void this.request({type: "init", config}).catch(error => this.fail(error.message));
        } catch (error) { this.fail(error instanceof Error ? error.message : String(error)); }
    }
    getSnapshot = () => this.status;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private update(patch: Partial<DeliveryStatus>) { if (this.localError && !patch.captureError) patch = {...patch, captureError: this.localError}; this.status = {...this.status, ...patch}; for (const listener of this.listeners) listener(); }
    private fail(message: string) {
        this.localError = message;
        this.update({captureError: message});
        for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
        this.pending.clear();
    }
    private request(command: Command): Promise<unknown> {
        if (!this.worker) return Promise.reject(new Error(this.status.captureError ?? "Logging worker is unavailable."));
        const id = ++this.sequence;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error("Logging worker timed out. Check logging status before continuing."));
            }, command.type === "export" || command.type === "read" ? 120_000 : 30_000);
            this.pending.set(id, {resolve, reject, timer});
            try { this.worker!.postMessage({...command, id}); }
            catch (error) {
                // Error objects/custom API errors can contain non-cloneable properties.
                // Only this exceptional path falls back to sanitisation on the UI thread.
                try {
                    if (command.type === "capture") this.worker!.postMessage({...command, event: sanitize(command.event), id});
                    else if (command.type === "captureBatch") this.worker!.postMessage({...command, events: sanitize(command.events), id});
                    else throw error;
                } catch (fallback) {
                    clearTimeout(timer); this.pending.delete(id);
                    reject(fallback instanceof Error ? fallback : new Error(String(fallback)));
                }
            }
        });
    }
    capture(event: InteractionEvent, snapshotKey?: string): void {
        if (this.status.captureError) throw new Error(this.status.captureError);
        if (this.pending.size >= 256) { this.fail("Recording paused: the worker cannot keep up. Some subsequent interactions are not recorded. Retry logging after reducing load."); throw new Error(this.status.captureError!); }
        // These DOM payloads contain owned primitive snapshots, never live API responses.
        // Preserve every event and its original timestamp; reduce messages, not events.
        if (!snapshotKey && /^(ui\.|media\.|result\.)/.test(event.action)) {
            this.buffered.push(event);
            if (this.buffered.length >= 128) this.sendBuffered();
            else if (!this.batchTimer) this.batchTimer = setTimeout(() => this.sendBuffered(), 16);
            return;
        }
        this.sendBuffered();
        // postMessage snapshots data immediately; no mutable response references are retained here.
        void this.request({type: "capture", event, snapshotKey}).catch(error => this.fail(error.message));
    }
    private sendBuffered() {
        if (this.batchTimer) clearTimeout(this.batchTimer);
        this.batchTimer = undefined;
        if (!this.buffered.length) return;
        const events = this.buffered;
        this.buffered = [];
        void this.request({type: "captureBatch", events}).catch(error => this.fail(error.message));
    }
    async append(events: InteractionEvent[]) { for (const event of events) this.capture(event); await this.flush(); }
    async flush() { this.sendBuffered(); await this.request({type: "flush"}); }
    async read(sessionId?: string) { this.sendBuffered(); return await this.request({type: "read", sessionId}) as InteractionEvent[]; }
    async exportBlob(sessionId: string | undefined, format: "json" | "jsonl" | "rivals") { this.sendBuffered(); return await this.request({type: "export", sessionId, format}) as Blob; }
    async retry() {
        await this.request({type: "retry"});
        this.localError = null;
        this.update({captureError: null});
    }
    dispose() { if (this.batchTimer) clearTimeout(this.batchTimer); this.batchTimer = undefined; this.buffered = []; this.worker?.terminate(); this.worker = null; this.fail("Logging worker was restarted."); }
}

export function deliveryConfig(): DeliveryConfig {
    const configured = (import.meta.env?.VITE_LOGGING_BASE_URL ?? "").trim().replace(/\/$/, "");
    const bufferMode = (import.meta.env?.VITE_LOGGING_BUFFER_MODE ?? "indexeddb").trim();
    const config: DeliveryConfig = {baseUrl: "", bufferMode: bufferMode === "memory" ? "memory" : "indexeddb", credentials: import.meta.env?.VITE_LOGGING_CREDENTIALS === "include" ? "include" : "same-origin", maxBytes: 128 * 1024 * 1024};
    try {
        if (!["memory", "indexeddb"].includes(bufferMode)) throw new Error("VITE_LOGGING_BUFFER_MODE must be memory or indexeddb.");
        if (bufferMode === "memory" && !configured) throw new Error("Memory-only logging requires VITE_LOGGING_BASE_URL. Configure the backend or use indexeddb buffering.");
        if (!configured) return config;
        const parsed = new URL(configured, window.location.origin);
        if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("VITE_LOGGING_BASE_URL must be an HTTP(S) base URL without credentials, query or fragment.");
        return {...config, baseUrl: parsed.toString().replace(/\/$/, "")};
    } catch (error) { return {...config, configurationError: error instanceof Error ? error.message : String(error)}; }
}
