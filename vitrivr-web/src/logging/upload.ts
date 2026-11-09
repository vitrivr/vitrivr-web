import type {DeliveryConfig, StoredBatch} from "./deliveryTypes.ts";

/** Group durable envelopes without changing their IDs or individual contents. */
export async function uploadBatches(batches: StoredBatch[], config: DeliveryConfig, fetcher: typeof fetch = fetch): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
        const response = await fetcher(`${config.baseUrl.replace(/\/$/, "")}/batches/bulk`, {
            method: "POST", credentials: config.credentials, headers: {"Content-Type": "application/json"},
            body: `{"format":"vitrivr-interaction-batches","version":1,"batches":[${batches.map(batch => batch.body).join(",")}]}`,
            signal: controller.signal,
        });
        if (response.status === 404 || response.status === 405) return false; // Older collectors.
        if (response.status !== 200 && response.status !== 201) throw new Error(`Log upload returned HTTP ${response.status}. Local logs were retained.`);
        const ack = await response.json() as {batchIds?: unknown; accepted?: boolean};
        const ids = ack.batchIds;
        if (ack.accepted !== true || !Array.isArray(ids) || ids.length !== batches.length ||
            new Set(ids).size !== batches.length || batches.some(batch => !ids.includes(batch.batchId))) {
            throw new Error("Log server did not acknowledge every batch. Local logs were retained.");
        }
        return true;
    } finally { clearTimeout(timer); }
}

/** A matching acknowledgement is mandatory: HTTP success alone cannot delete local logs. */
export async function uploadBatch(batch: StoredBatch, config: DeliveryConfig, fetcher: typeof fetch = fetch): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
        const response = await fetcher(`${config.baseUrl.replace(/\/$/, "")}/batches`, {
            method: "POST", credentials: config.credentials, headers: {"Content-Type": "application/json"},
            body: batch.body, signal: controller.signal,
        });
        if (response.status !== 200 && response.status !== 201) throw new Error(`Log upload returned HTTP ${response.status}. Local logs were retained.`);
        const ack = await response.json() as {batchId?: string; accepted?: boolean};
        if (ack.batchId !== batch.batchId || ack.accepted !== true) throw new Error("Log server did not acknowledge this batch. Local logs were retained.");
    } finally { clearTimeout(timer); }
}
