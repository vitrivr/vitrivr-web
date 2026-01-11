import type {BlockState} from "../components/SearchCard.tsx";

export const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA
export const API_BASE = import.meta.env.VITE_VITRIVR_BASE_URL;
export const THUMBNAIL_BASE = import.meta.env.VITE_THUMBNAIL_ORIGIN;
type TextInput = { type: "TEXT"; data: string };
type FloatVectorInput = { type: "FLOATVECTOR"; data: number[] };
type Input = TextInput | FloatVectorInput;
type Inputs = Record<string, Input>;
type RawSchema = string | { name?: string; [key: string]: unknown };


export function thumbnailUrl(schema: string, id: string): string {
    return `${THUMBNAIL_BASE}/${schema}/thumbnails/${encodeURIComponent(id)}.jpg`;
}

export async function fetchSchemas(): Promise<string[]> {
    const url = `${API_BASE}/api/schema/list`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch schemas (HTTP ${res.status})`);
    }

    const data = await res.json() as unknown;
    let rawList: unknown;

    if (Array.isArray(data)) {
        rawList = data;
    } else if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        if (Array.isArray(obj.schemas)) {
            rawList = obj.schemas;
        } else if (Array.isArray(obj.result)) {
            rawList = obj.result;
        }
    }

    if (!Array.isArray(rawList)) {
        return [];
    }

    const names = (rawList as RawSchema[])
        .map((item) =>
            typeof item === "string"
                ? item
                : item?.name ?? undefined
        )
        .filter((name): name is string => typeof name === "string" && name.length > 0);

    return names;
}

/**
 * TODO adjust this such that images, emotions and non clip modalities can be entered.
 * @param blocks
 */
export function buildTemporalQuery(blocks: BlockState[]) {
    const LIMIT = "10";
    const summary: string[] = [];

    const hasImageBlock = blocks.some((b) => b.queryType === "image");
    if (hasImageBlock) {
        throw new Error("Temporal query currently supports only text/emotion blocks (no image blocks yet).");
    }
    const modalityToField = (m: BlockState["modality"]) => {
        switch (m) {
            case "clip":
                return "clip";
            case "asr":
                return "asr";
            case "ocr":
                return "ocr";
            case "emotions":
                return "emotionsface"; // your existing emotions operator field
            default:
                return m;
        }
    };

    const inputs: Inputs = {};
    const operations: Record<string, unknown> = {};
    const temporalInputs: Record<string, string> = {};

    let opIdx = 0;

    for (const b of blocks) {
        const opName = opIdx === 0 ? "op" : `op${opIdx}`; // stable unique op names
        const inName = `in${opIdx}`;

        // Emotions block
        if (b.modality === "emotions") {
            const chosen = (b.emotion ?? "").trim();
            if (!chosen) {
                throw new Error("Temporal query: an emotions block is missing a selected emotion.");
            }
            summary.push(`emotion: ${chosen}`);


            const vecKey = `e${opIdx}`;
            inputs[vecKey] = {type: "FLOATVECTOR", data: emotionsToVector(chosen)};

            operations[opName] = {
                field: modalityToField("emotions"),
                inputs: {vec: vecKey},
                parameters: {limit: LIMIT},
            };

            temporalInputs[inName] = opName;
            opIdx++;
            continue;
        }

        // Text-based blocks (clip/asr/ocr)
        const txt = (b.textQuery ?? "").trim();
        if (!txt) {
            throw new Error(`Temporal query: a ${b.modality.toUpperCase()} block is missing text.`);
        }

        const txtKey = `t${opIdx}`;
        inputs[txtKey] = {type: "TEXT", data: txt};

        summary.push(`${b.modality}: ${txt}`);

        operations[opName] = {
            field: modalityToField(b.modality),
            inputs: {txt: txtKey},
            parameters: {limit: LIMIT},
        };

        temporalInputs[inName] = opName;
        opIdx++;
    }

    if (opIdx === 0) {
        throw new Error("Temporal query needs at least one supported block.");
    }

    operations["temporal-aggregator"] = {
        factory: "TemporalSequenceAggregator",
        inputs: temporalInputs,
    };

    operations["relations"] = {
        factory: "RelationExpander",
        inputs: {in: "temporal-aggregator"},
        parameters: {outgoing: "partOf"},
    };

    operations["aggregator"] = {
        factory: "ScoreAggregator",
        inputs: {in: "relations"},
    };

    operations["timelookup"] = {
        factory: "FieldLookup",
        inputs: {in: "aggregator"},
        parameters: {field: "time", keys: "start, end"},
    };

    operations["filelookup"] = {
        factory: "ObjectFieldLookup",
        inputs: {in: "timelookup"},
        parameters: {field: "file", predicates: "partOf", keys: "path"},
    };

    console.log(
        "[TemporalQuery] sequence:",
        summary.join(" → ")
    );


    return {
        inputs,
        operations,
        output: "filelookup",
    } as const;
}


export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string") {
                resolve(result);
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };

        reader.onerror = () => {
            reject(reader.error ?? new Error("FileReader error"));
        };

        reader.readAsDataURL(file);
    });
}


/**
 * Builds the query for vitrivr-engine for textual queries
 * @param prompt
 * @param field
 * @param emotions
 */
export function buildTextQuery(field: string, prompt: string, emotions: string = "") {
    if (field === "emotions") {
        const emotionsVector = emotionsToVector(emotions);
        return {
            "inputs": {
                "emotion": {
                    "type": "FLOATVECTOR",
                    "data": emotionsVector,
                }
            },
            "operations": {
                "emotions": {
                    "field": "emotionsface",
                    "inputs": {
                        "vec": "emotion"
                    },
                    "parameters": {
                        "limit": "1000"
                    }
                },
                "relations": {
                    "factory": "RelationExpander",
                    "inputs": {
                        "in": "emotions"
                    },
                    "parameters": {
                        "outgoing": "partOf"
                    }
                },
                "aggregator": {
                    "factory": "ScoreAggregator",
                    "inputs": {
                        "in": "relations"
                    }
                },
                "timelookup": {
                    "factory": "FieldLookup",
                    "inputs": {
                        "in": "aggregator"
                    },
                    "parameters": {
                        "field": "time",
                        "keys": "start, end"
                    }
                },
                "filelookup": {
                    "factory": "ObjectFieldLookup",
                    "inputs": {
                        "in": "timelookup"
                    },
                    "parameters": {
                        "field": "file",
                        "predicates": "partOf",
                        "keys": "path"
                    }
                }
            },
            "output": "filelookup"
        } as const;
    } else {
        return {
            "inputs": {
                "txt": {"type": "TEXT", "data": prompt}
            },
            "operations": {
                "clip": {"field": field, "inputs": {"txt": "txt"}, "parameters": {"limit": "1000"}},
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
                    "factory": "ObjectFieldLookup",
                    "inputs": {"in": "timelookup"},
                    "parameters": {"field": "file", "predicates": "partOf", "keys": "path"}
                }
            },
            "output": "filelookup"
        } as const;
    }
}

export function emotionsToVector(emotion: string | undefined | null): number[] {
    const orderingEmotions = ["anger", "disgust", "fear", "happy", "neutral", "sad", "surprise"];

    if (!emotion) {
        return new Array(orderingEmotions.length).fill(0);
    }

    const normalized = emotion.toLowerCase().trim();

    return orderingEmotions.map(e => (e === normalized ? 1 : 0));
}

