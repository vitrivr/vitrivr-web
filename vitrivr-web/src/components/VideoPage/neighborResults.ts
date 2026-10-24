import type {MediaItem} from "../SearchCard.tsx";

type RetrievablesResponse = {
    retrievables?: Array<{
        id?: string;
        type?: string;
        score?: number;
        relationship?: {
            partOf?: {
                id?: string;
                type?: string;
                descriptors?: Record<string, unknown>;
            };
        };
        descriptors?: Record<string, unknown>;
    }>;
};

function pickNumber(r: { descriptors?: Record<string, unknown> }, key: string): number | undefined {
    const value = r.descriptors?.[key];

    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string") {
        const number = Number(value.trim());
        return Number.isFinite(number) ? number : undefined;
    }

    return undefined;
}

/**
 * Transforms dictionary of records into a number array.
 * @param r dictionary of records from the vitrivr response
 * @param key
 */
function pickFloatArray(r: { descriptors?: Record<string, unknown> }, key: string): number[] | undefined {
    const value = r.descriptors?.[key];
    if (!Array.isArray(value)) {
        return undefined;
    }
    const output: number[] = [];
    for (const item of value) {
        if (typeof item !== "number" || !Number.isFinite(item)) {
            return undefined;
        }
        output.push(item);
    }
    return output;
}

function nsToSeconds(value: number): number {
    return value / 1_000_000_000;
}

/**
 * Maps each result to a mediaItem.
 * @param response of vitrivr
 */
export function mapNeighborResults(response: RetrievablesResponse, urls: {video: (id: string) => string; thumbnail: (id: string) => string}): MediaItem[] {
    const retrievables = response.retrievables ?? [];
    const output: MediaItem[] = [];
    for (const retrievable of retrievables) {
        const id = retrievable.id?.trim();

        if (!id || retrievable.type !== "SEGMENT") {
            continue;
        }

        const clipVector = pickFloatArray(retrievable, "clip.vector");
        const start = nsToSeconds(pickNumber(retrievable, "time.start") ?? 0);
        const end = nsToSeconds(pickNumber(retrievable, "time.end") ?? 0);
        const parentId = retrievable.relationship?.partOf?.id?.trim();
        const filePath = retrievable.relationship?.partOf?.descriptors?.["file.path"] as | string | undefined;

        if (!parentId || !filePath) {
            continue;
        }
        const mediaItemName = filePath.replace(/\\/g, "/").split("/").filter(Boolean).slice(-4).join("/");
        const hlsUrl = urls.video(parentId);

        output.push({
            id,
            parentId,
            kind: "video",
            mediaItemName: mediaItemName ?? filePath,
            url: hlsUrl,
            name: mediaItemName ?? filePath,
            thumbUrl: urls.thumbnail(id),
            start,
            end,
            rawType: retrievable.type,
            clipVector,
        });
    }
    return output;
}

