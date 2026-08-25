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
        const parsed = new URL(url);
        // TODO: adjust this to the actual schema of the filename. not all filenames contain "videos"
        // the expected format is like this: http://10.34.64.212:8080/videos/day4/Luca/video/08.mp4
        const match = parsed.pathname.match(/^\/videos\/([^/]+)\/([^/]+)\/video\/([^/]+)$/);
        if (!match) return null;

        return {
            origin: parsed.origin,
            day: match[1],
            source: match[2],
            filename: match[3],
        };
    } catch {
        return null;
    }
}

export function getHourFromFilename(filename: string): number | null {
    const match = filename.match(/^(\d{1,2})\.mp4$/);
    if (!match) return null;
    const hour = Number(match[1]);
    if (
        !Number.isInteger(hour) ||
        hour < 0 ||
        hour > 23
    ) {
        return null;
    }

    return hour;
}

export function buildHourUrl(info: ParsedVideoUrl, hour: number): string {
    const paddedHour = String(hour).padStart(2, "0");
    return (
        `${info.origin}/videos/` +
        `${encodeURIComponent(info.day)}/` +
        `${encodeURIComponent(info.source)}/video/` +
        `${paddedHour}.mp4`
    );
}

export function getVideoAtOffset(src: string, offset: number): string | null {
    const info = parseVideoURL(src);
    if (!info) return null;
    const currentHour = getHourFromFilename(info.filename);
    if (currentHour === null) {
        return null;
    }

    const targetHour = currentHour + offset;

    // For now we do not cross day boundaries.
    if (targetHour < 9 || targetHour > 20) {
        return null;
    }

    return buildHourUrl(info, targetHour);
}