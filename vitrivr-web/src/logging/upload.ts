import type {DeliveryConfig, StoredBatch} from "./deliveryTypes.ts";

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
