import type {FrontendView} from "../config/frontendSettings.ts";

export type MediaConfiguration = {
    videoBase: string;
    hlsBase: string;
    thumbnailBase: string;
    mediaPathPrefix: string;
};

function joinBase(origin: string, path: string): string {
    if (/^https?:\/\//i.test(path)) return path.replace(/\/+$/, "");
    return `${origin.replace(/\/+$/, "")}/${path.replace(/^\/+|\/+$/g, "")}`.replace(/\/+$/, "");
}

/** Supports both the established CASTLE variables and VBS's origin/subpath pair. */
export function mediaConfiguration(env: Record<string, string | undefined> = import.meta.env ?? {}): MediaConfiguration {
    const origin = (env.VITE_MEDIA_ORIGIN ?? "").trim();
    const subpath = (env.VITE_MEDIA_SUBPATH ?? "").trim();
    return {
        videoBase: (env.VITE_MEDIA_PATH_ORIGIN?.trim() || (origin || subpath ? joinBase(origin, subpath) : "")),
        hlsBase: (env.VITE_MEDIA_SEGMENT ?? "").trim().replace(/\/+$/, ""),
        thumbnailBase: (env.VITE_THUMBNAIL_ORIGIN ?? "").trim().replace(/\/+$/, ""),
        mediaPathPrefix: (env.VITE_MEDIA_PATH_PREFIX ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, ""),
    };
}

export function hlsMediaUrl(parentId: string, config = mediaConfiguration()): string {
    const id = parentId.trim();
    return config.hlsBase && id ? `${config.hlsBase}/${encodeURIComponent(id)}/master.m3u8` : "";
}

export function thumbnailMediaUrl(id: string, view: FrontendView, config = mediaConfiguration()): string {
    const clean = id.trim();
    if (!config.thumbnailBase || !clean) return "";
    const shard = view === "VBS" ? `${encodeURIComponent(clean.slice(0, 2))}/` : "";
    return `${config.thumbnailBase}/${shard}${encodeURIComponent(clean)}.jpg`;
}

function decodeSegment(segment: string): string {
    try { return decodeURIComponent(segment); } catch { return segment; }
}

/** Filesystem paths are mapped below the configured public video root exactly once. */
export function directVideoUrl(path: string | undefined, view: FrontendView = "CASTLE", config = mediaConfiguration()): string {
    if (!path?.trim()) return "";
    const clean = path.trim().replace(/\\/g, "/");
    if (/^https?:\/\//i.test(clean)) return clean;
    if (!config.videoBase) return "";
    let relative = clean;
    if (config.mediaPathPrefix && relative.startsWith(`${config.mediaPathPrefix}/`)) {
        relative = relative.slice(config.mediaPathPrefix.length + 1);
    } else {
        let publicPath: string;
        try { publicPath = new URL(config.videoBase, "https://media.invalid").pathname.replace(/\/+$/, ""); }
        catch { return ""; }
        const publicRelative = publicPath.replace(/^\/+/, "");
        if (publicPath && relative.startsWith(`${publicPath}/`)) relative = relative.slice(publicPath.length + 1);
        else if (publicRelative && relative.startsWith(`${publicRelative}/`)) relative = relative.slice(publicRelative.length + 1);
        else if (view === "VBS" && (/^\//.test(relative) || /^[a-z]:\//i.test(relative))) {
            const directory = publicPath.split("/").filter(Boolean).at(-1);
            const marker = directory ? `/${directory}/` : "";
            const index = marker ? relative.lastIndexOf(marker) : -1;
            relative = index >= 0 ? relative.slice(index + marker.length) : relative.split("/").at(-1) ?? "";
        }
    }
    if (view === "CASTLE") {
        // CASTLE storage mounts can change; the public recording hierarchy does not.
        const recording = relative.match(/(?:^|\/)(day\d+\/[^/]+\/video\/[^/]+)$/i);
        if (recording) relative = recording[1];
    }
    const parts = relative.split("/").filter(Boolean);
    if (!parts.length || parts.some(part => decodeSegment(part) === "..")) return "";
    const encoded = parts.map(part => encodeURIComponent(decodeSegment(part))).join("/");
    return `${config.videoBase.replace(/\/+$/, "")}/${encoded}`;
}

export function resolveVideoSources(parentId: string, filePath: string | undefined, view: FrontendView, config = mediaConfiguration()) {
    const videoUrl = directVideoUrl(filePath, view, config);
    const hlsUrl = hlsMediaUrl(parentId, config);
    return {url: hlsUrl || videoUrl, videoUrl};
}
