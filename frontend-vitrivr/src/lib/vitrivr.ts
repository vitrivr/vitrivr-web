export const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA
export const API_BASE = import.meta.env.VITE_VITRIVR_BASE_URL || "http://localhost:7070";
export const videoUrl = (id: string) => `${API_BASE}/api/${SCHEMA}/fetch/video/${encodeURIComponent(id)}`;
export const thumbnailUrl = (id: string) => `${API_BASE}/api/${SCHEMA}/fetch/thumbnail/${encodeURIComponent(id)}`;

/**
 * Builds the query for vitrivr-engine for textual queries
 * @param prompt
 */
export function buildTextQuery(prompt: string) {
    return {
        "inputs": {
            "txt": {"type": "TEXT", "data": prompt}
        },
        "operations": {
            "clip": {"field": "clip", "inputs": {"txt": "txt"}, "parameters": {"limit": "1000"}},
            "relations": {
                "factory": "RelationExpander",
                "inputs": {"in": "clip"},
                "parameters": {"outgoing": "partOf"}
            },
            "aggregator": {"factory": "ScoreAggregator", "inputs": {"in": "relations"}},
            "timelookup": {
                "factory": "FieldLookup",
                "inputs": {"in": "aggregator"},
                "parameters": {"field": "time", "keys": "start, end"}
            },
            "filelookup": {
                "factory": "FieldLookup",
                "inputs": {"in": "timelookup"},
                "parameters": {"field": "file", "predicates": "partOf", "keys": "path"}
            }
        },
        "output": "filelookup"
    } as const;
}

/**
 * TODO: Add more serialization things here. For example image-to-image stuff and the corresponding base64 encoding.
 */