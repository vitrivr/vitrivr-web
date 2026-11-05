import {InteractionLogger, defaultLoggingPreferences} from "./logger.ts";
import {IndexedDbEventStore} from "./store.ts";
import {uuid} from "../utils/uuid.ts";
import type {LoggingPreferences} from "./types.ts";

const preferencesKey = "vitrivr_logging_preferences_v1";
function preferences(): LoggingPreferences {
    if (typeof window === "undefined") return {...defaultLoggingPreferences};
    try {
        const saved = JSON.parse(localStorage.getItem(preferencesKey) ?? "{}");
        return {enabled: typeof saved.enabled === "boolean" ? saved.enabled : true,
            operatorId: typeof saved.operatorId === "string" ? saved.operatorId : "",
            taskId: typeof saved.taskId === "string" ? saved.taskId : ""};
    } catch { return {...defaultLoggingPreferences}; }
}
function sessionId(): string {
    if (typeof window === "undefined") return uuid();
    try {
        const key = "vitrivr_logging_session_v1";
        const saved = sessionStorage.getItem(key);
        if (saved) return saved;
        const id = uuid(); sessionStorage.setItem(key, id); return id;
    } catch { return uuid(); }
}

export const interactionLogger = new InteractionLogger(new IndexedDbEventStore(), sessionId(), preferences(), value => localStorage.setItem(preferencesKey, JSON.stringify(value)));
interactionLogger.setContext({operatorId: `anonymous-${interactionLogger.getSnapshot().sessionId}`});
