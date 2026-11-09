import type {InteractionEvent} from "./types.ts";
export type DeliveryConfig = {baseUrl: string; credentials: RequestCredentials; maxBytes: number; bufferMode?: "indexeddb" | "memory"; configurationError?: string};
export type LogBatch = {format: "vitrivr-interaction-batch"; version: 1; batchId: string; createdAt: number; events: InteractionEvent[]};
export type StoredBatch = {batchId: string; createdAt: number; bytes: number; eventCount: number; body: string};
export type DeliveryStatus = {mode: "local" | "upload"; bufferMode: "indexeddb" | "memory"; pendingBatches: number; pendingEvents: number; pendingBytes: number;
    lastUploadedAt: number | null; lastSavedAt: number | null; uploadError: string | null; storageError: string | null; captureError: string | null};
export const initialDeliveryStatus: DeliveryStatus = {mode: "local", bufferMode: "indexeddb", pendingBatches: 0, pendingEvents: 0, pendingBytes: 0,
    lastUploadedAt: null, lastSavedAt: null, uploadError: null, storageError: null, captureError: null};
export type WorkerCommand = {id: number} & (
    {type: "init"; config: DeliveryConfig} | {type: "capture"; event: InteractionEvent; snapshotKey?: string} |
    {type: "captureBatch"; events: InteractionEvent[]} |
    {type: "flush"} | {type: "retry"} | {type: "read"; sessionId?: string} |
    {type: "export"; sessionId?: string; format: "json" | "jsonl" | "rivals"});
export type WorkerReply = {type: "status"; status: DeliveryStatus} | {type: "reply"; id: number; value?: unknown; error?: string};
