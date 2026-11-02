import type {FrontendView} from "../../config/frontendSettings.ts";

/** Short display label only; retain the full source path for playback and submission. */
export function resultName(path: string, view: FrontendView = "VBS"): string {
    let name = path.trim().replace(/\\/g, "/");
    if (/^https?:\/\//i.test(name)) {
        try { name = new URL(name).pathname; } catch { /* Fall back to the supplied path. */ }
    }
    const parts = name.split("/").filter(Boolean);
    const filename = parts.at(-1) ?? path;
    if (view === "CASTLE") {
        const dayIndex = parts.findIndex(part => /^day\d+$/i.test(part));
        if (dayIndex >= 0 && dayIndex + 2 < parts.length) {
            return `${parts[dayIndex + 1]} · ${parts[dayIndex]} · ${filename}`;
        }
    }
    return filename;
}
