import {useState, useSyncExternalStore} from "react";
import {interactionLogger as logger, loggingDelivery} from "./index.ts";
import {downloadLog, downloadBlob, serializeLog} from "./export.ts";

import {initialDeliveryStatus} from "./deliveryTypes.ts";
import "./LoggingPanel.css";
const emptySubscribe = () => () => {};
const emptyStatus = () => initialDeliveryStatus;

/** Self-contained controls: preferences apply immediately, independently of search settings. */
export default function LoggingPanel() {
    const delivery = useSyncExternalStore(loggingDelivery?.subscribe ?? emptySubscribe, loggingDelivery?.getSnapshot ?? emptyStatus);
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
            await logger.flush();
            if (loggingDelivery && !bufferedOnly) downloadBlob(await loggingDelivery.exportBlob(allSessions ? undefined : status.sessionId, format), format);
            else {
                const events = await logger.readEvents(allSessions, bufferedOnly);
                downloadLog(serializeLog(events, format), format);
            }
        } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
        finally { setExporting(false); }
    }
    return <details className="fs-section" open>
        <summary>Interaction logging</summary>
        <label className="fs-check"><input type="checkbox" checked={status.enabled} onChange={event => logger.configure({enabled: event.target.checked})}/>Record interactions</label>
        <p className="fs-note">Log processing runs in a background worker. {delivery.bufferMode === "memory" ? "The backend stores the archive. Only pending uploads stay in worker memory; closing or reloading this tab loses pending events." : delivery.mode === "upload" ? "Batches upload automatically; confirmed batches are removed from this browser." : "Local recording only: backend uploads are not configured yet."}</p>
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
        <p className="fs-note">{delivery.pendingBatches.toLocaleString()} pending batches · {delivery.pendingEvents.toLocaleString()} pending events · {(delivery.pendingBytes / 1048576).toFixed(1)} / 128 MiB{delivery.bufferMode === "memory" ? " in worker memory" : " on local disk"}{delivery.lastUploadedAt ? ` · Last uploaded ${new Date(delivery.lastUploadedAt).toLocaleTimeString()}` : ""}</p>
        {delivery.uploadError && <p className="fs-error" role="alert">{delivery.uploadError} Retrying automatically; unacknowledged logs remain {delivery.bufferMode === "memory" ? "in memory until this tab closes" : "on local disk"}.</p>}
        {delivery.captureError && <p className="fs-error" role="alert">{delivery.captureError}</p>}
        <p className="fs-note">{status.eventCount.toLocaleString()} events sent to the recorder on this page · {status.pendingCount.toLocaleString()} pending{status.lastSavedAt ? ` · Last ${delivery.bufferMode === "memory" ? "buffered" : "saved"} ${new Date(status.lastSavedAt).toLocaleTimeString()}` : ""}</p>
        {status.storageError && <div className="fs-error" role="alert">Browser storage: {status.storageError} Keep this page open and download local logs before reloading.</div>}
        <div className="row-between">
            <button type="button" className="btn" disabled={exporting} onClick={() => void exportLogs()}>{exporting ? "Exporting…" : delivery.bufferMode === "memory" ? "Download pending logs" : "Download local logs"}</button>
            {loggingDelivery && <button type="button" className="btn" onClick={() => { void loggingDelivery?.retry().catch(err => setError(err instanceof Error ? err.message : String(err))); }}>Retry logging / upload</button>}

        </div>
        {loggingDelivery?.config.baseUrl && <a className="btn" href={`${loggingDelivery.config.baseUrl}/sessions/${encodeURIComponent(status.sessionId)}/export?format=${format}`} download>Download server session</a>}
        <p className="fs-note">{delivery.bufferMode === "memory" ? "Pending downloads contain this worker’s unacknowledged events only. Use the server download for archived events. Pending uploads do not survive closing or reloading the tab." : "Local downloads contain retained batches and older browser archives. Already uploaded batches must be downloaded from the server. Unsaved buffered events can be lost if the page closes; uploads resume from saved batches after reload."}</p>
        {error && <p className="fs-error" role="alert">{error}</p>}
    </details>;
}
