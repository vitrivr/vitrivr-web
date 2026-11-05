import {useState, useSyncExternalStore} from "react";
import {interactionLogger as logger} from "./index.ts";
import {downloadLog, serializeLog} from "./export.ts";

/** Self-contained controls: preferences apply immediately, independently of search settings. */
export default function LoggingPanel() {
    const status = useSyncExternalStore(logger.subscribe, logger.getSnapshot);
    const [format, setFormat] = useState<"json" | "jsonl" | "rivals">("json");
    const [allSessions, setAllSessions] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    async function exportLogs(bufferedOnly = false) {
        setExporting(true);
        setError("");
        logger.record("logging.export_requested", {format, allSessions, bufferedOnly});
        try {
            const events = await logger.readEvents(allSessions, bufferedOnly);
            downloadLog(serializeLog(events, format), format);
        } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
        finally { setExporting(false); }
    }
    return <details className="fs-section" open>
        <summary>Interaction logging</summary>
        <label className="fs-check"><input type="checkbox" checked={status.enabled} onChange={event => logger.configure({enabled: event.target.checked})}/>Record interactions</label>
        <p className="fs-note">Logs save automatically in this browser. Download a file for archiving or analysis. These controls apply immediately.</p>
        <div className="fs-grid">
            <label className="fs-field">Operator ID (optional override)
                <input defaultValue={status.operatorId} onBlur={event => logger.configure({operatorId: event.target.value.trim()})} placeholder="Uses the signed-in username"/>
            </label>
            <label className="fs-field">Task ID (optional override)
                <input defaultValue={status.taskId} onBlur={event => logger.configure({taskId: event.target.value.trim()})} placeholder="Use the DRES task UUID when available"/>
            </label>
            <label className="fs-field">Export format
                <select value={format} onChange={event => setFormat(event.target.value as typeof format)}>
                    <option value="json">Full JSON</option><option value="jsonl">JSON Lines</option><option value="rivals">RIVALS</option>
                </select>
            </label>
            <label className="fs-field">Export scope
                <select value={allSessions ? "all" : "session"} onChange={event => setAllSessions(event.target.value === "all")}>
                    <option value="session">Current session (including reloads)</option><option value="all">All saved sessions</option>
                </select>
            </label>
        </div>
        <p className="fs-note">{status.eventCount.toLocaleString()} events captured on this page · {status.pendingCount.toLocaleString()} awaiting save{status.lastSavedAt ? ` · Last saved ${new Date(status.lastSavedAt).toLocaleTimeString()}` : ""}</p>
        {status.storageError && <div className="fs-error" role="alert">Browser storage: {status.storageError} Unsaved events are kept in memory; keep this page open until exported.</div>}
        <div className="row-between">
            <button type="button" className="btn" disabled={exporting} onClick={() => void exportLogs()}>{exporting ? "Exporting…" : "Download logs"}</button>
            {status.storageError && <button type="button" className="btn" disabled={exporting} onClick={() => void exportLogs(true)}>Download unsaved events</button>}
        </div>
        {error && <p className="fs-error" role="alert">{error}</p>}
    </details>;
}
