import {getHourFromFilename, parseVideoURL} from "./VideoHourUtils.ts";
import {directVideoUrl, hlsMediaUrl, type MediaConfiguration} from "../../lib/mediaSources.ts";

export type CastleRecording = {id: string; file: string; stream: string; day: string; source: string; hour: number};

/** Source IDs address HLS playlists; segment IDs and fabricated UUIDs do not. */
export function recordingCatalogueQuery() {
    return {inputs: {}, operations: {
        sources: {factory: "FilteredRetrieval", inputs: {}, parameters: {limit: "10000", retrievableType: "SOURCE:VIDEO"}, filter: {type: "exists", field: "file"}},
        files: {factory: "FieldLookup", inputs: {in: "sources"}, parameters: {field: "file", keys: "path"}},
    }, output: "files"};
}

export function mapCastleRecordings(rows: {id?: string; type?: string; descriptors?: Record<string, unknown>}[], config: MediaConfiguration): CastleRecording[] {
    return rows.flatMap(row => {
        const path = row.descriptors?.["file.path"];
        if (!row.id || row.type !== "SOURCE:VIDEO" || typeof path !== "string") return [];
        const file = directVideoUrl(path, "CASTLE", config);
        const info = parseVideoURL(file);
        if (!info) return [];
        const hour = getHourFromFilename(info.filename);
        return hour !== null ? [{id: row.id, file, stream: hlsMediaUrl(row.id, config), day: info.day, source: info.source, hour}] : [];
    });
}

export function findCastleRecording(recordings: CastleRecording[], file: string): CastleRecording | undefined {
    const info = parseVideoURL(file);
    if (!info) return undefined;
    const hour = getHourFromFilename(info.filename);
    return recordings.find(recording => recording.day === info.day && recording.source === info.source && recording.hour === hour);
}
