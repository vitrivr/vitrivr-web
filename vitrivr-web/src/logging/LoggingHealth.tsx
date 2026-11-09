import {useSyncExternalStore} from "react";
import {loggingDelivery} from "./index.ts";
import {initialDeliveryStatus} from "./deliveryTypes.ts";
import "./LoggingPanel.css";
const emptySubscribe = () => () => {};
const emptyStatus = () => initialDeliveryStatus;
export default function LoggingHealth() {
    const status = useSyncExternalStore(loggingDelivery?.subscribe ?? emptySubscribe, loggingDelivery?.getSnapshot ?? emptyStatus);
    const error = status.captureError || status.storageError || (status.bufferMode === "memory" ? status.uploadError : null);
    if (!error) return null;
    return <aside className="logging-health" role="alert"><strong>Interaction logging needs attention.</strong> {error} {status.bufferMode === "memory" ? "Pending events are only in memory. Keep this tab open until uploads recover, or download pending logs in Settings." : "Open Settings → Interaction logging to download local logs or retry."}</aside>;
}
