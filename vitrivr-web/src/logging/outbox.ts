import type {StoredBatch} from "./deliveryTypes.ts";
export type OutboxStats = {pendingBatches: number; pendingEvents: number; pendingBytes: number};
const empty: OutboxStats = {pendingBatches: 0, pendingEvents: 0, pendingBytes: 0};
export interface BatchOutbox {
    stats(): Promise<OutboxStats>;
    put(batch: StoredBatch, maxBytes: number): Promise<void>;
    first(): Promise<StoredBatch | undefined>;
    oldest?(limit: number, maxBytes: number): Promise<StoredBatch[]>;
    remove(batchId: string): Promise<void>;
    visit(consume: (batch: StoredBatch) => void): Promise<void>;
}

/** Optional server-backed mode: retain only unacknowledged batches in worker RAM. */
export class MemoryOutbox implements BatchOutbox {
    private batches = new Map<string, StoredBatch>();
    private bytes = 0;
    private events = 0;
    async stats(): Promise<OutboxStats> {
        return {pendingBatches: this.batches.size, pendingEvents: this.events, pendingBytes: this.bytes};
    }
    async put(batch: StoredBatch, maxBytes: number) {
        if (this.batches.has(batch.batchId)) return;
        if (this.bytes + batch.bytes > maxBytes) throw new Error("Worker memory buffer is full. Restore backend uploads or download pending logs.");
        this.batches.set(batch.batchId, batch);
        this.bytes += batch.bytes; this.events += batch.eventCount;
    }
    async first() { return this.batches.values().next().value; }
    async oldest(limit: number, maxBytes: number) {
        const selected: StoredBatch[] = [];
        let bytes = 0;
        for (const batch of this.batches.values()) {
            if (selected.length && (selected.length >= limit || bytes + batch.bytes > maxBytes)) break;
            selected.push(batch); bytes += batch.bytes;
        }
        return selected;
    }
    async remove(batchId: string) {
        const batch = this.batches.get(batchId);
        if (!batch) return;
        this.batches.delete(batchId); this.bytes -= batch.bytes; this.events -= batch.eventCount;
    }
    async visit(consume: (batch: StoredBatch) => void) { for (const batch of this.batches.values()) consume(batch); }
}

/** Separate from the old log archive; all counters and batch mutations commit atomically. */
export class IndexedDbOutbox implements BatchOutbox {
    private database: Promise<IDBDatabase> | null = null;
    private write(db: IDBDatabase): IDBTransaction {
        try { return db.transaction(["batches", "meta"], "readwrite", {durability: "strict"}); }
        catch (error) {
            // Older browsers can reject transaction options. Preserve their
            // normal commit semantics instead of disabling logging entirely.
            if (!(error instanceof TypeError)) throw error;
            return db.transaction(["batches", "meta"], "readwrite");
        }
    }
    private open(): Promise<IDBDatabase> {
        if (!this.database) this.database = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("vitrivr-interaction-outbox", 1);
            request.onupgradeneeded = () => {
                const batches = request.result.createObjectStore("batches", {keyPath: "batchId"});
                batches.createIndex("createdAt", "createdAt");
                request.result.createObjectStore("meta");
            };
            request.onsuccess = () => {
                request.result.onversionchange = () => { request.result.close(); this.database = null; };
                resolve(request.result);
            };
            request.onerror = () => reject(request.error ?? new Error("Cannot open the log outbox."));
            request.onblocked = () => reject(new Error("Log outbox is blocked by another tab."));
        }).catch(error => { this.database = null; throw error; });
        return this.database;
    }
    async stats(): Promise<OutboxStats> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("meta", "readonly");
            const request = tx.objectStore("meta").get("stats");
            request.onsuccess = () => resolve(request.result ?? {...empty});
            request.onerror = () => reject(request.error);
        });
    }
    async put(batch: StoredBatch, maxBytes: number): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.write(db);
            const batches = tx.objectStore("batches");
            const meta = tx.objectStore("meta");
            let error: Error | null = null;
            const existing = batches.getKey(batch.batchId);
            existing.onsuccess = () => {
                if (existing.result !== undefined) return;
                const request = meta.get("stats");
                request.onsuccess = () => {
                    const stats: OutboxStats = request.result ?? {...empty};
                    if (stats.pendingBytes + batch.bytes > maxBytes) {
                        error = new Error("Local log outbox is full. Restore uploads or download local logs before continuing recording.");
                        tx.abort(); return;
                    }
                    batches.put(batch);
                    meta.put({pendingBatches: stats.pendingBatches + 1, pendingEvents: stats.pendingEvents + batch.eventCount,
                        pendingBytes: stats.pendingBytes + batch.bytes}, "stats");
                };
            };
            tx.oncomplete = () => resolve();
            tx.onerror = tx.onabort = () => reject(error ?? tx.error ?? new Error("Cannot save the log batch."));
        });
    }
    async first(): Promise<StoredBatch | undefined> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const request = db.transaction("batches", "readonly").objectStore("batches").index("createdAt").openCursor();
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }
    async oldest(limit: number, maxBytes: number): Promise<StoredBatch[]> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("batches", "readonly");
            const request = tx.objectStore("batches").index("createdAt").openCursor();
            const selected: StoredBatch[] = [];
            let bytes = 0;
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return;
                const batch = cursor.value as StoredBatch;
                if (selected.length && (selected.length >= limit || bytes + batch.bytes > maxBytes)) return;
                selected.push(batch); bytes += batch.bytes;
                cursor.continue();
            };
            tx.oncomplete = () => resolve(selected);
            tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Cannot read pending log batches."));
        });
    }
    async remove(batchId: string): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = this.write(db);
            const batches = tx.objectStore("batches");
            const meta = tx.objectStore("meta");
            const request = batches.get(batchId);
            request.onsuccess = () => {
                const batch: StoredBatch | undefined = request.result;
                if (!batch) return;
                const count = meta.get("stats");
                count.onsuccess = () => {
                    const stats: OutboxStats = count.result ?? {...empty};
                    batches.delete(batchId);
                    meta.put({pendingBatches: Math.max(0, stats.pendingBatches - 1), pendingEvents: Math.max(0, stats.pendingEvents - batch.eventCount),
                        pendingBytes: Math.max(0, stats.pendingBytes - batch.bytes)}, "stats");
                };
            };
            tx.oncomplete = () => resolve();
            tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Cannot acknowledge the log batch."));
        });
    }
    async visit(consume: (batch: StoredBatch) => void): Promise<void> {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("batches", "readonly");
            const request = tx.objectStore("batches").index("createdAt").openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) { try { consume(cursor.value); cursor.continue(); } catch (error) { tx.abort(); reject(error); } }
            };
            tx.oncomplete = () => resolve();
            tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Cannot read the log outbox."));
        });
    }
}
