/** Short display label only; retain the full source path for playback and submission. */
export function resultName(path: string): string {
    let name = path.trim().replace(/\\/g, "/");
    if (/^https?:\/\//i.test(name)) {
        try { name = new URL(name).pathname; } catch { /* Fall back to the supplied path. */ }
    }
    return name.split("/").filter(Boolean).at(-1) ?? path;
}
