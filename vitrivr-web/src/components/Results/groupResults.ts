import type {MediaItem} from "../SearchCard.tsx";

export type ResultGroup = {key: string; label: string; items: MediaItem[]};

/** Group ranked matches by source identity, retaining first-match group order and sorting video segments by start time. */
export function groupResultsByVideo(items: MediaItem[]): ResultGroup[] {
    const groups = new Map<string, ResultGroup>();
    for (const item of items) {
        const filename = item.mediaItemName || item.name;
        const identity = item.kind === "video" ? item.parentId || filename || item.id : item.id;
        const key = `${item.kind}:${identity}`;
        let group = groups.get(key);
        if (!group) {
            group = {key, label: filename || item.parentId || item.id, items: []};
            groups.set(key, group);
        }
        group.items.push(item);
    }
    for (const group of groups.values()) {
        if (group.items[0]?.kind === "video") {
            group.items.sort((a, b) => a.start - b.start);
        }
    }
    return [...groups.values()];
}
