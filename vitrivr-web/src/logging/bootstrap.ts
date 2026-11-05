import {interactionLogger} from "./index.ts";
import {installDomLogging} from "./dom.ts";

let cleanup: (() => void) | undefined;
export function startInteractionLogging() {
    if (cleanup) return;
    interactionLogger.record("session.started", {userAgent: navigator.userAgent, language: navigator.language,
        timeOrigin: performance.timeOrigin, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: {width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio},
        viewport: {width: window.innerWidth, height: window.innerHeight},
        capture: {profile: "research", text: "one editing-start event per period; submitted queries captured in full",
            pointerMovement: "disabled", scroll: "every native scroll event", playback: "actions and completed seeks; no progress updates",
            visibility: "viewport intersection"}});
    interactionLogger.record("config.snapshot", Object.fromEntries([
        "MODE", "BASE_URL", "VITE_VITRIVR_BASE_URL", "VITE_MEDIA_ORIGIN", "VITE_MEDIA_SUBPATH", "VITE_MEDIA_PATH_ORIGIN",
        "VITE_MEDIA_PATH_PREFIX", "VITE_MEDIA_SEGMENT", "VITE_THUMBNAIL_ORIGIN", "VITE_DRES_BASE_URL",
        "VITE_PYTHON_DESCRIPTOR_SERVER", "VITE_DESCRIPTOR_API_BASE", "VITE_MEDIA_CAPTURE_PROXY",
    ].map(key => [key, import.meta.env[key] ?? null])));
    cleanup = installDomLogging();
}

if (import.meta.hot) import.meta.hot.dispose(() => { cleanup?.(); cleanup = undefined; });
