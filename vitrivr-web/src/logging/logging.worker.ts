import {LogDelivery} from "./delivery.ts";
import {IndexedDbOutbox, MemoryOutbox} from "./outbox.ts";
import {IndexedDbEventStore} from "./store.ts";
import {serializeLog} from "./export.ts";
import {collectSessionEvents} from "./sessionExport.ts";
import type {InteractionEvent} from "./types.ts";
import type {DeliveryStatus, WorkerCommand, WorkerReply} from "./deliveryTypes.ts";

const worker = globalThis as unknown as {onmessage: ((event: MessageEvent<WorkerCommand>) => void) | null; postMessage: (message: WorkerReply) => void};
let delivery: LogDelivery | undefined;
let ready: Promise<void> = Promise.resolve();
let memoryOnly = false;
let config: Extract<WorkerCommand, {type: "init"}>["config"];
let statusTimer: ReturnType<typeof setTimeout> | undefined;
let pendingStatus: DeliveryStatus | undefined;
function reportStatus(status: DeliveryStatus) {
    pendingStatus = status;
    const send = () => {
        if (statusTimer) clearTimeout(statusTimer);
        statusTimer = undefined;
        if (pendingStatus) worker.postMessage({type: "status", status: pendingStatus});
        pendingStatus = undefined;
    };
    if (status.captureError || status.storageError || status.uploadError) send();
    else if (!statusTimer) statusTimer = setTimeout(send, 250);
}
async function localEvents(sessionId?: string): Promise<InteractionEvent[]> {
    if (memoryOnly) return delivery!.read(sessionId);
    const old = await new IndexedDbEventStore().read(sessionId);
    const current = await delivery!.read(sessionId);
    return [...new Map([...old, ...current].map(event => [event.id, event])).values()]
        .sort((a, b) => a.timestamp - b.timestamp || a.pageId.localeCompare(b.pageId) || a.sequence - b.sequence);
}
worker.onmessage = ({data}) => {
    if (data.type === "init") {
        config = data.config;
        memoryOnly = data.config.bufferMode === "memory";
        delivery = new LogDelivery(memoryOnly ? new MemoryOutbox() : new IndexedDbOutbox(), data.config, reportStatus);
        ready = delivery.start();
        // Keep a rejected startup observable without creating an unhandled rejection.
        void ready.catch(() => {});
    }
    void (async () => {
        await ready;
        if (!delivery) throw new Error("Logging worker is not ready.");
        let value: unknown;
        switch (data.type) {
            case "capture":
                delivery.capture(data.event, data.snapshotKey);
                if (!memoryOnly) await delivery.flush();
                break;
            case "captureBatch":
                for (const event of data.events) delivery.capture(event);
                // Acknowledge capture only after its disk transaction commits.
                // Persistence remains in the worker, never in an input handler.
                if (!memoryOnly) await delivery.flush();
                break;
            case "flush": await delivery.flush(); break;
            case "retry": await delivery.retry(); break;
            case "read": value = await localEvents(data.sessionId); break;
            case "export": value = new Blob([serializeLog(await localEvents(data.sessionId), data.format)], {type: data.format === "jsonl" ? "application/x-ndjson" : "application/json"}); break;
            case "exportSession": {
                const {events, ...summary} = await collectSessionEvents(data.sessionId, await localEvents(data.sessionId), config);
                value = {...summary, eventCount: events.length,
                    blob: new Blob([serializeLog(events, data.format)], {type: data.format === "jsonl" ? "application/x-ndjson" : "application/json"})};
                break;
            }
        }
        worker.postMessage({type: "reply", id: data.id, value});
    })().catch(error => worker.postMessage({type: "reply", id: data.id, error: error instanceof Error ? error.message : String(error)}));
};
setInterval(() => { if (delivery) { delivery.report(); void ready.then(async () => { await delivery!.flush(); void delivery!.pump(); }).catch(() => {}); } }, 1000);
setInterval(() => { if (delivery) void ready.then(() => delivery!.pump()).catch(() => {}); }, 3000);
