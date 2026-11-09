export type LogContext = {
    operatorId: string;
    dresUsername?: string | null;
    taskId: string | null;
    taskName: string | null;
    evaluationId: string | null;
    schema: string;
    frontendView: string;
    route: string;
};

export type InteractionEvent = {
    version: 1;
    id: string;
    sessionId: string;
    pageId: string;
    sequence: number;
    timestamp: number;
    elapsedMs: number;
    action: string;
    category: string;
    context: LogContext;
    data: unknown;
    frameRank?: number;
    videoRank?: number;
};

export type LoggingPreferences = {enabled: boolean; operatorId: string; taskId: string};
export type LoggingStatus = LoggingPreferences & {
    sessionId: string;
    eventCount: number;
    pendingCount: number;
    lastSavedAt: number | null;
    storageError: string | null;
    captureError?: string | null;
};

/** Replace the sink to add server, worker or file persistence without changing capture adapters. */
export interface EventStore {
    capture?(event: InteractionEvent, snapshotKey?: string): void;
    flush?(): Promise<void>;
    subscribe?(listener: () => void): () => void;
    getSnapshot?(): {pendingEvents: number; storageError: string | null; captureError: string | null; lastSavedAt: number | null};
    append(events: InteractionEvent[]): Promise<void>;
    read(sessionId?: string): Promise<InteractionEvent[]>;
}
