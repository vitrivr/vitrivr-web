import type {EventStore, InteractionEvent} from "./types.ts";

/** Separate, append-only database; recording never blocks retrieval on a storage transaction. */
export class IndexedDbEventStore implements EventStore {
    private database: Promise<IDBDatabase> | null = null;

    private open(): Promise<IDBDatabase> {
        if (!this.database) {
            this.database = new Promise<IDBDatabase>((resolve, reject) => {
                if (typeof indexedDB === "undefined") { reject(new Error("Browser log storage is unavailable.")); return; }
                const request = indexedDB.open("vitrivr-interaction-logs", 1);
                request.onupgradeneeded = () => {
                    const store = request.result.createObjectStore("events", {keyPath: "id"});
                    store.createIndex("sessionId", "sessionId");
                    store.createIndex("timestamp", "timestamp");
                };
                request.onsuccess = () => {
                    const database = request.result;
                    database.onversionchange = () => { database.close(); this.database = null; };
                    resolve(database);
                };
                request.onerror = () => reject(request.error ?? new Error("Could not open log storage."));
                request.onblocked = () => reject(new Error("Log storage is blocked by another browser tab."));
            }).catch(error => { this.database = null; throw error; });
        }
        return this.database;
    }

    async append(events: InteractionEvent[]): Promise<void> {
        if (!events.length) return;
        const database = await this.open();
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction("events", "readwrite");
            for (const event of events) transaction.objectStore("events").put(event);
            transaction.oncomplete = () => resolve();
            transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error("Could not save interaction logs."));
        });
    }

    async read(sessionId?: string): Promise<InteractionEvent[]> {
        const database = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = database.transaction("events", "readonly");
            const store = transaction.objectStore("events");
            const request = sessionId ? store.index("sessionId").getAll(sessionId) : store.getAll();
            request.onsuccess = () => resolve(request.result as InteractionEvent[]);
            request.onerror = () => reject(request.error ?? new Error("Could not read saved logs."));
        });
    }
}

export class MemoryEventStore implements EventStore {
    private events = new Map<string, InteractionEvent>();
    async append(events: InteractionEvent[]) { for (const event of events) this.events.set(event.id, event); }
    async read(sessionId?: string) { return [...this.events.values()].filter(event => !sessionId || event.sessionId === sessionId); }
}
