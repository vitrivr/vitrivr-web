import {interactionLogger} from "./index.ts";
import {installDomLogging} from "./dom.ts";

let cleanup: (() => void) | undefined;
export function startInteractionLogging() {
    if (cleanup) return;
    interactionLogger.record("session.started", {userAgent: navigator.userAgent, language: navigator.language,
        timeOrigin: performance.timeOrigin, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: {width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio},
        viewport: {width: window.innerWidth, height: window.innerHeight},
        capture: {profile: "research-full-v2", text: "individual keydown/up, input drafts, composition and selection; private fields excluded",
            pointerMovement: "every dispatched pointer event", scroll: "every dispatched scroll event", playback: "actions, seeking and timeupdate",
            transport: "DOM events batched up to 128 events or 16ms; no event sampling",
            visibility: "viewport intersection"}});
    interactionLogger.record("config.snapshot", Object.fromEntries([
        "MODE", "BASE_URL", "VITE_VITRIVR_BASE_URL", "VITE_MEDIA_ORIGIN", "VITE_MEDIA_SUBPATH", "VITE_MEDIA_PATH_ORIGIN",
        "VITE_MEDIA_PATH_PREFIX", "VITE_MEDIA_SEGMENT", "VITE_THUMBNAIL_ORIGIN", "VITE_DRES_BASE_URL",
        "VITE_PYTHON_DESCRIPTOR_SERVER", "VITE_DESCRIPTOR_API_BASE", "VITE_MEDIA_CAPTURE_PROXY",
        "VITE_LOGGING_BASE_URL", "VITE_LOGGING_BUFFER_MODE",
    ].map(key => [key, import.meta.env[key] ?? null])));
    cleanup = installDomLogging();
}

if (import.meta.hot) import.meta.hot.dispose(() => { cleanup?.(); cleanup = undefined; });
