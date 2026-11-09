import {uuid} from "../utils/uuid.ts";
import {sanitize} from "./sanitize.ts";
import {uploadBatch, uploadBatches} from "./upload.ts";
import {initialDeliveryStatus, type DeliveryConfig, type DeliveryStatus, type LogBatch, type StoredBatch} from "./deliveryTypes.ts";
import type {BatchOutbox} from "./outbox.ts";
import type {InteractionEvent} from "./types.ts";

const encoder = new TextEncoder();
const batchBytes = 512 * 1024;
const memoryBytes = 16 * 1024 * 1024;

/** Runs in the worker. Batches are durable before upload, and immutable across retries. */
export class LogDelivery {
    status: DeliveryStatus = {...initialDeliveryStatus};
    private queue: {event: InteractionEvent; bytes: number}[] = [];
    private queueBytes = 0;
    private snapshots = new Map<string, string>();
    private saving: Promise<void> | null = null;
    private uploading: Promise<void> | null = null;
    private retryAt = 0;
    private failures = 0;
    private bulkSupported = true;
    constructor(privateOutbox: BatchOutbox, privateConfig: DeliveryConfig, privateChanged: (status: DeliveryStatus) => void,
        privateFetcher: typeof fetch = fetch) {
        this.outbox = privateOutbox; this.config = privateConfig; this.changed = privateChanged; this.fetcher = privateFetcher;
        this.status.mode = privateConfig.baseUrl ? "upload" : "local";
        this.status.bufferMode = privateConfig.bufferMode ?? "indexeddb";
        if (this.status.bufferMode === "memory" && !privateConfig.baseUrl) throw new Error("Memory-only logging requires a backend URL.");
    }
    private outbox: BatchOutbox;
    private config: DeliveryConfig;
    private changed: (status: DeliveryStatus) => void;
    private fetcher: typeof fetch;
    private emit() { this.changed({...this.status, pendingEvents: this.status.pendingEvents + this.queue.length, pendingBytes: this.status.pendingBytes + this.queueBytes}); }
    async start() { Object.assign(this.status, await this.outbox.stats()); this.emit(); }
    capture(event: InteractionEvent, snapshotKey?: string) {
        if (this.status.captureError) throw new Error(this.status.captureError);
        if (event.action === "logging.enabled") this.snapshots.clear();
        const prepared = {...event, data: sanitize(event.data)};
        const serialized = snapshotKey ? JSON.stringify(prepared.data) : "";
        if (snapshotKey && this.snapshots.get(snapshotKey) === serialized) return;
        const bytes = encoder.encode(JSON.stringify(prepared)).byteLength;
        if (bytes > this.config.maxBytes || (this.queue.length > 0 && this.queueBytes + bytes > memoryBytes)) {
            this.status.captureError = "Recording paused: the logging buffer reached its limit. Some subsequent interactions are not recorded. Restore uploads and retry logging.";
            this.emit(); throw new Error(this.status.captureError);
        }
        if (snapshotKey) this.snapshots.set(snapshotKey, serialized);
        this.queue.push({event: prepared, bytes}); this.queueBytes += bytes;
    }
    async flush(): Promise<void> {
        if (this.saving) return this.saving;
        this.saving = this.save();
        try { await this.saving; } finally { this.saving = null; }
    }
    private async save() {
        while (this.queue.length) {
            let length = 0, bytes = 0;
            for (const queued of this.queue) {
                if (length && (bytes + queued.bytes > batchBytes || length >= 128)) break;
                length++; bytes += queued.bytes;
            }
            const events = this.queue.slice(0, length).map(item => item.event);
            const envelope: LogBatch = {format: "vitrivr-interaction-batch", version: 1, batchId: uuid(), createdAt: Date.now(), events};
            const body = JSON.stringify(envelope);
            const batch: StoredBatch = {batchId: envelope.batchId, createdAt: envelope.createdAt, bytes: encoder.encode(body).byteLength, eventCount: events.length, body};
            try {
                await this.outbox.put(batch, this.config.maxBytes);
                this.queue.splice(0, length); this.queueBytes -= bytes;
                Object.assign(this.status, await this.outbox.stats(), {lastSavedAt: Date.now(), storageError: null});
                this.emit();
            } catch (error) {
                this.status.storageError = error instanceof Error ? error.message : String(error);
                this.status.captureError = "Recording paused because local logs could not be saved. Some subsequent interactions are not recorded. Restore uploads or download local logs, then retry.";
                this.emit(); throw error;
            }
        }
    }
    async pump(): Promise<void> {
        if (!this.config.baseUrl || Date.now() < this.retryAt) return;
        if (this.uploading) return this.uploading;
        this.uploading = this.send();
        try { await this.uploading; } finally { this.uploading = null; }
    }
    private async send() {
        try {
            for (;;) {
                let batches: StoredBatch[];
                if (this.outbox.oldest) batches = await this.outbox.oldest(this.bulkSupported ? 16 : 1, batchBytes);
                else { const first = await this.outbox.first(); batches = first ? [first] : []; }
                if (!batches.length) break;
                if (batches.length > 1 && this.bulkSupported) {
                    this.bulkSupported = await uploadBatches(batches, this.config, this.fetcher);
                    if (!this.bulkSupported) continue;
                } else await uploadBatch(batches[0], this.config, this.fetcher);
                for (const batch of batches) await this.outbox.remove(batch.batchId);
                this.failures = 0; this.retryAt = 0;
                Object.assign(this.status, await this.outbox.stats(), {lastUploadedAt: Date.now(), uploadError: null});
                this.emit();
            }
        } catch (error) {
            this.failures++;
            this.retryAt = Date.now() + Math.min(60_000, 3000 * 2 ** Math.min(this.failures - 1, 5)) + Math.random() * 1000;
            this.status.uploadError = error instanceof Error ? error.message : String(error);
            this.emit();
        }
    }
    async retry() {
        this.retryAt = 0;
        await this.pump();
        await this.flush();
        this.status.captureError = null; this.status.storageError = null;
        this.emit();
    }
    async read(sessionId?: string): Promise<InteractionEvent[]> {
        // Export retained data even if storage is full; buffered events remain available.
        try { await this.flush(); } catch { /* Include unsaved events below. */ }
        const events = new Map<string, InteractionEvent>();
        await this.outbox.visit(batch => {
            const envelope = JSON.parse(batch.body) as LogBatch;
            for (const event of envelope.events) if (!sessionId || event.sessionId === sessionId) events.set(event.id, event);
        });
        for (const {event} of this.queue) if (!sessionId || event.sessionId === sessionId) events.set(event.id, event);
        return [...events.values()];
    }
    report() { this.emit(); }
}
