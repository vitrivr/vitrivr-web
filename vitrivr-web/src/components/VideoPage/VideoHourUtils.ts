export const MEDIA_PATH_ORIGIN: string = import.meta.env.VITE_MEDIA_PATH_ORIGIN ?? "";

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