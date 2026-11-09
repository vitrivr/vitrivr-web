import {useEffect, useSyncExternalStore} from "react";
import {interactionLogger} from "./index.ts";

export function useLoggingEnabled() {
    return useSyncExternalStore(interactionLogger.subscribe, () => interactionLogger.getSnapshot().enabled);
}

/** Callers memoize their projection so playback/hover updates do not resend it. */
export function useInteractionSnapshot(action: string, value: unknown) {
    const enabled = useLoggingEnabled();
    useEffect(() => { interactionLogger.snapshot(action, value); }, [action, value, enabled]);
}
