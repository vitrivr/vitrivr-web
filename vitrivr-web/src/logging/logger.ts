import {uuid} from "../utils/uuid.ts";
import {sanitize} from "./sanitize.ts";
import {safeUrl} from "./sanitize.ts";
import type {EventStore, InteractionEvent, LogContext, LoggingPreferences, LoggingStatus} from "./types.ts";

export const defaultLoggingPreferences: LoggingPreferences = {enabled: true, operatorId: "", taskId: ""};

export function eventCategory(action: string): string {
    if (/^(query\.(filters|blocks)|qa\.form|feedback\.selection|ui\.(editing_started|change|beforeinput|input|key|composition|selection))/.test(action)) return "Query formulation";
    if (/^(query\.|qa\.|api\.engine|api\.descriptor)/.test(action)) return "Query submission";
    if (/^(navigation\.|ui\.click|ui\.submit)/.test(action)) return "Traversing";
    if (/^(results\.|result\.|media\.|video\.|ui\.scroll)/.test(action)) return "Browsing";
    if (/^submission\./.test(action)) return "Answer submission";
    return "Other";
}

export class InteractionLogger {
    readonly pageId = uuid();
    private started = performance.now();
    private sequence = 0;
    private queue: InteractionEvent[] = [];
    private inFlight: InteractionEvent[] = [];
    private timer: ReturnType<typeof setTimeout> | undefined;
    private flushing: Promise<void> | null = null;
    private listeners = new Set<() => void>();
    private snapshots = new Map<string, string>();
    private context: LogContext = {operatorId: "anonymous", dresUsername: null, taskId: null, taskName: null, evaluationId: null, schema: "", frontendView: "", route: ""};
    private status: LoggingStatus;
    private store: EventStore;
    private savePreferences?: (preferences: LoggingPreferences) => void;

    constructor(store: EventStore, sessionId = uuid(), preferences: Partial<LoggingPreferences> = {}, savePreferences?: (preferences: LoggingPreferences) => void) {
        this.store = store;
        this.savePreferences = savePreferences;
        this.status = {...defaultLoggingPreferences, ...preferences, sessionId, eventCount: 0, pendingCount: 0, lastSavedAt: null, storageError: null};
        store.subscribe?.(() => {
            const status = store.getSnapshot?.();
            if (status) this.notify({storageError: status.storageError, captureError: status.captureError, lastSavedAt: status.lastSavedAt});
        });
    }

    getSnapshot = (): LoggingStatus => this.status;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private notify(patch: Partial<LoggingStatus> = {}) {
        this.status = {...this.status, ...patch, pendingCount: this.store.capture ? this.store.getSnapshot?.().pendingEvents ?? 0 : this.queue.length + this.inFlight.length};
        for (const listener of this.listeners) { try { listener(); } catch { /* Observers must not affect logging. */ } }
    }

    getContext(): LogContext {
        return {...this.context, operatorId: this.status.operatorId || this.context.operatorId,
            taskId: this.status.taskId || this.context.taskId};
    }
    setContext(patch: Partial<LogContext>) { this.context = {...this.context, ...patch, ...(patch.route ? {route: safeUrl(patch.route)} : {})}; }

    configure(patch: Partial<LoggingPreferences>) {
        if (patch.enabled === false && this.status.enabled) this.record("logging.disabled");
        const previous = this.status;
        this.notify(patch);
        const {enabled, operatorId, taskId} = this.status;
        try { this.savePreferences?.({enabled, operatorId, taskId}); } catch { /* Capturing must work without localStorage. */ }
        if (!previous.enabled && enabled) { this.snapshots.clear(); this.record("logging.enabled"); }
        this.record("logging.preferences", {enabled, operatorId, taskId});
        void this.flush();
    }

    record(action: string, data: unknown = null, options: {context?: LogContext; frameRank?: number; videoRank?: number; snapshotKey?: string} = {}): string | null {
        if (!this.status.enabled) return null;
        try {
            const event: InteractionEvent = {version: 1, id: uuid(), sessionId: this.status.sessionId, pageId: this.pageId,
                sequence: ++this.sequence, timestamp: Date.now(), elapsedMs: performance.now() - this.started,
                action, category: eventCategory(action), context: {...(options.context ?? this.getContext())}, data: this.store.capture ? data : sanitize(data),
                ...(options.frameRank === undefined ? {} : {frameRank: options.frameRank}),
                ...(options.videoRank === undefined ? {} : {videoRank: options.videoRank})};
            if (this.store.capture) {
                this.store.capture(event, options.snapshotKey);
                this.status = {...this.status, eventCount: this.status.eventCount + 1};
                return event.id;
            }
            this.queue.push(event);
            this.status = {...this.status, eventCount: this.status.eventCount + 1};
            if (!this.timer) this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, this.status.storageError ? 10_000 : 250);
            return event.id;
        } catch { return null; }
    }

    /** De-duplicate React StrictMode/redundant state notifications, without sampling user events. */
    snapshot(action: string, data: unknown, key = action) {
        if (!this.status.enabled) return;
        if (this.store.capture) { this.record(action, data, {snapshotKey: key}); return; }
        try {
            const value = sanitize(data);
            const serialized = JSON.stringify(value);
            if (this.snapshots.get(key) === serialized) return;
            this.snapshots.set(key, serialized);
            this.record(action, value);
        } catch { /* An unserializable value must never break the application. */ }
    }

    begin(action: string, data: unknown) {
        const context = this.getContext();
        const requestId = uuid();
        const started = performance.now();
        this.record(`${action}.request`, {requestId, ...((data && typeof data === "object") ? data : {data})}, {context});
        let finished = false;
        return (outcome: "response" | "error" | "cancelled", response: unknown) => {
            if (finished) return;
            finished = true;
            this.record(`${action}.${outcome}`, {requestId, durationMs: performance.now() - started, response: outcome === "error" ? sanitize(response) : response}, {context});
        };
    }

    async flush(): Promise<void> {
        if (this.store.capture) {
            try { await this.store.flush?.(); } catch (error) { this.notify({storageError: error instanceof Error ? error.message : String(error)}); }
            return;
        }
        if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
        if (this.flushing) return this.flushing;
        this.flushing = (async () => {
            while (this.queue.length) {
                const batch = this.queue.splice(0, 64);
                this.inFlight = batch;
                try {
                    await this.store.append(batch);
                    this.inFlight = [];
                    this.notify({storageError: null, lastSavedAt: Date.now()});
                } catch (error) {
                    this.queue.unshift(...batch);
                    this.inFlight = [];
                    this.notify({storageError: error instanceof Error ? error.message : String(error)});
                    return;
                }
            }
        })();
        try { await this.flushing; } finally { this.flushing = null; }
    }

    async readEvents(allSessions = false, bufferedOnly = false): Promise<InteractionEvent[]> {
        if (bufferedOnly) return [...this.inFlight, ...this.queue].filter(event => allSessions || event.sessionId === this.status.sessionId);
        await this.flush();
        let saved: InteractionEvent[];
        try { saved = await this.store.read(allSessions ? undefined : this.status.sessionId); }
        catch (error) {
            this.notify({storageError: error instanceof Error ? error.message : String(error)});
            // Do not silently produce a partial export when saved events cannot be read.
            throw new Error("Saved logs could not be read. Keep this page open and retry exporting.");
        }
        const events = new Map(saved.map(event => [event.id, event]));
        for (const event of [...this.inFlight, ...this.queue]) if (allSessions || event.sessionId === this.status.sessionId) events.set(event.id, event);
        return [...events.values()].sort((a, b) => a.timestamp - b.timestamp || a.pageId.localeCompare(b.pageId) || a.sequence - b.sequence);
    }
}
