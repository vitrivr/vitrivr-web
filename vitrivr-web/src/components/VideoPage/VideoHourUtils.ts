export const MEDIA_PATH_ORIGIN: string = import.meta.env?.VITE_MEDIA_PATH_ORIGIN ?? "";

export type ParsedVideoUrl = {
    origin: string;
    day: string;
    source: string;
    filename: string;
};

/**
 * Function that parses the URL of the video to extract the day, person and filename from the path.
 * Mainly used for displaying the videos from the same time, date but different person.
 * @param url
 */
export function parseVideoURL(url: string): ParsedVideoUrl | null {
    if (!url) return null;

    try {
        const splitted = url.split("/")
        const len = splitted.length
        const hour = splitted[len-1]
        const name = splitted[len-2]
        const day = splitted[len-3]


        return {
            origin: MEDIA_PATH_ORIGIN,
            day: day,
            source: name,
            filename: hour,
        };
    } catch {
        console.log("Could not parse URL");
        return null;
    }
}

export function getHourFromFilename(filename: string): number | null {
    const match = filename.match(/^(\d+)\.[^.]+$/);
    if (!match) {
        return null;
    }
    const hour = Number(match[1]);
    return Number.isFinite(hour) ? hour : null;
}

export function getVideoAtOffset(src: string, offset: number): string | null {
    try {
        const url = new URL(src);
        const parts = url.pathname.split("/").filter(Boolean);
        const filename = parts.at(-1);

        if (!filename) {
            return null;
        }

        const currentHour =
            getHourFromFilename(filename);

        if (currentHour === null) {
            return null;
        }

        const targetHour = currentHour + offset;
        if (targetHour < 0 || targetHour > 23) {
            return null;
        }

        parts[parts.length - 1] = `${targetHour}.mp4`;
        url.pathname = "/" + parts.join("/");
        return url.toString();
    } catch {
        return null;
    }
}
/** Keep the original stream at its search result; use hourly files for navigation. */
export function getPlaybackSource(originalSrc: string, hourlySrc: string, offset: number): string | null {
    return offset === 0 ? originalSrc : getVideoAtOffset(hourlySrc, offset);
}

/** VBS files are unrelated: even numeric filenames must never be shifted by hour. */
export function getVideoViewPlayback(view: "CASTLE" | "VBS", originalSrc: string, originalFile: string, offset: number) {
    const activeOffset = view === "CASTLE" ? offset : 0;
    return {
        offset: activeOffset,
        file: view === "CASTLE"
            ? getVideoAtOffset(originalFile, activeOffset) ?? (activeOffset === 0 ? originalFile : "")
            : originalFile,
        src: view === "CASTLE"
            ? getPlaybackSource(originalSrc, originalFile, activeOffset) ?? originalSrc
            : originalSrc || originalFile,
    };
}

/** Filename-only collections and signed media URLs do not imply a recording hierarchy. */
export function getVideoFilename(path: string): string {
    const filename = path.replace(/\\/g, "/").split(/[?#]/, 1)[0].split("/").filter(Boolean).at(-1) ?? "";
    try { return decodeURIComponent(filename); } catch { return filename; }
}
