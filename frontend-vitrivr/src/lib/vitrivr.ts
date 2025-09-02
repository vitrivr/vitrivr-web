export const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA

export function buildTextQuery(prompt: string) {
    return {
        inputs: { "input-text": { type: "TEXT", data: prompt } },
        "operations": {
            "clip" : {"type": "RETRIEVER", "field": "clip", "input": "input-text"},
            "relations" : {"type": "TRANSFORMER", "transformerName": "RelationExpander", "input": "clip"},
            "lookup" : {"type": "TRANSFORMER", "transformerName": "FieldLookup", "input": "relations"},
            "aggregator" : {"type": "TRANSFORMER", "transformerName": "ScoreAggregator",  "input": "lookup"},
            "filelookup" : {"type": "TRANSFORMER", "transformerName": "FieldLookup", "input": "aggregator"}
        },
        "context": {
            "global": {
                "limit": "1000"
            },
            "local" : {
                "lookup":{"field": "time", "keys": "start, end"},
                "relations" :{"outgoing": "partOf"},
                "filelookup": {"field": "file", "keys": "path"}
            }
        },
        "output": "filelookup",
    } as const;
}