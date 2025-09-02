export const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA
export const API_BASE = import.meta.env.VITE_VITRIVR_BASE_URL || "http://localhost:7070";
export const videoUrl = (id: string) => `${API_BASE}/api/${SCHEMA}/fetch/video/${encodeURIComponent(id)}`;
export const thumbnailUrl = (id: string) => `${API_BASE}/api/${SCHEMA}/fetch/thumbnail/${encodeURIComponent(id)}`;

export function buildTextQuery(prompt: string) {
    return {
        inputs: {"input-text": {type: "TEXT", data: prompt}},
        "operations": {
            "clip": {"type": "RETRIEVER", "field": "clip", "input": "input-text"},
            "relations": {"type": "TRANSFORMER", "transformerName": "RelationExpander", "input": "clip"},
            "lookup": {"type": "TRANSFORMER", "transformerName": "FieldLookup", "input": "relations"},
            "aggregator": {"type": "TRANSFORMER", "transformerName": "ScoreAggregator", "input": "lookup"},
            "filelookup": {"type": "TRANSFORMER", "transformerName": "FieldLookup", "input": "aggregator"}
        },
        "context": {
            "global": {
                "limit": "1000"
            },
            "local": {
                "lookup": {"field": "time", "keys": "start, end"},
                "relations": {"outgoing": "partOf"},
                "filelookup": {"field": "file", "keys": "path"}
            }
        },
        "output": "filelookup",
    } as const;
}