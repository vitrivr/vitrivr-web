import {getHourFromFilename, parseVideoURL} from "./VideoHourUtils.ts";
import type {CastleRecording} from "./castleRecordings.ts";

export type PovRecording = CastleRecording & {kind: "person" | "room"};
const key = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const defaultRooms = ["Reading", "Living1", "Living2", "Kitchen", "Meeting"];

/** Use actual indexed paths, including source names not present in frontend preferences. */
export function otherPovRecordings(recordings: CastleRecording[], file: string, roomNames: readonly string[] = []): PovRecording[] {
    const info = parseVideoURL(file);
    if (!info) return [];
    const hour = getHourFromFilename(info.filename);
    const rooms = new Set([...defaultRooms, ...roomNames].map(key));
    const sources = new Set<string>();
    return recordings.filter(recording => {
        const source = key(recording.source);
        if (recording.day !== info.day || recording.hour !== hour || source === key(info.source) || sources.has(source)) return false;
        sources.add(source);
        return true;
    }).map(recording => ({...recording, kind: rooms.has(key(recording.source)) ? "room" as const : "person" as const}))
        .sort((a, b) => a.source.localeCompare(b.source));
}
