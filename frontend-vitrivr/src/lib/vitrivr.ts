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
 * TODO make this for more like this
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
            default:
                return m;
        }
    };

    const emotionTypeToField = (emotionType?: string) => {
        if (emotionType === "face") return "emotionsface";
        if (emotionType === "ocr") return "emotionsocr";
        return "emotionssound";
    };

    const inputs: Inputs = {};
    const operations: Record<string, unknown> = {};
    const temporalInputs: Record<string, string> = {};

    let opIdx = 0;

    for (const b of blocks) {
        const inName = `in${opIdx}`;

        if (b.modality === "emotions") {
            const chosen = (b.emotion ?? "").trim();
            if (!chosen) {
                throw new Error("Temporal query: an emotions block is missing a selected emotion.");
            }

            const txt = (b.textQuery ?? "").trim();
            if (!txt) {
                throw new Error("Temporal query: an emotions block is missing text (needed for fusion).");
            }

            const txtKey = `txt-${opIdx}`;
            const vecKey = `e${opIdx}`;

            inputs[txtKey] = {type: "TEXT", data: txt};
            inputs[vecKey] = {type: "FLOATVECTOR", data: emotionsToVector(chosen)};

            const clipOp = `clip-${opIdx}`;
            const emoOp = `emotions-${opIdx}`;
            const rel1 = `relations-${opIdx}`;
            const rel2 = `relations2-${opIdx}`;
            const agg1 = `agg-${opIdx}`;
            const agg2 = `agg2-${opIdx}`;
            const fusion = `fusion-${opIdx}`;

            summary.push(`emotions(${chosen})+clip("${txt}")`);

            const emotionField = emotionTypeToField(b.emotionType);

            operations[clipOp] = {
                field: "clip",
                inputs: {txt: txtKey},
                parameters: {limit: LIMIT},
            };

            operations[emoOp] = {
                field: emotionField,
                inputs: {vec: vecKey},
                parameters: {limit: LIMIT},
            };

            operations[rel1] = {
                factory: "RelationExpander",
                inputs: {in: clipOp},
                parameters: {outgoing: "partOf"},
            };

            operations[rel2] = {
                factory: "RelationExpander",
                inputs: {in: emoOp},
                parameters: {outgoing: "partOf"},
            };

            operations[agg1] = {
                factory: "ScoreAggregator",
                inputs: {in: rel1},
            };

            operations[agg2] = {
                factory: "ScoreAggregator",
                inputs: {in: rel2},
            };

            operations[fusion] = {
                factory: "WeightedScoreFusion",
                inputs: {in: agg1, "in-2": agg2},
                parameters: {
                    weights: "0.7 , 100",
                    p: "2",
                    normalize: "true",
                },
            };

            temporalInputs[inName] = fusion;

            opIdx++;
            continue;
        }

        const txt = (b.textQuery ?? "").trim();
        if (!txt) {
            throw new Error(`Temporal query: a ${b.modality.toUpperCase()} block is missing text.`);
        }

        const txtKey = `t${opIdx}`;
        const opName = `op-${opIdx}`;
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

    operations["desclookup"] = {
        factory: "FieldLookup",
        inputs: {in: "timelookup"},
        parameters: {"field": "clip", "keys": "descriptord"},
    };

    operations["filelookup"] = {
        factory: "ObjectFieldLookup",
        inputs: {in: "desclookup"},
        parameters: {field: "file", predicates: "partOf", keys: "path"},
    };

    console.log("[TemporalQuery] sequence:", summary.join(" → "));

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
export function buildTextQuery(
    field: string,
    prompt: string,
    emotions: string = "",
    emotionType: string = ""
) {
    const LIMIT = "1000";

    let emotionField = "emotionssound";
    if (emotionType === "face") emotionField = "emotionsface";
    else if (emotionType === "ocr") emotionField = "emotionsocr";

    if (field === "emotions") {
        const emotionsVector = emotionsToVector(emotions);

        const inputs: Inputs = {
            "txt-1": {type: "TEXT", data: prompt},
            emotion: {type: "FLOATVECTOR", data: emotionsVector},
        };

        const operations: Record<string, unknown> = {
            clip: {
                field: "clip",
                inputs: {txt: "txt-1"},
                parameters: {limit: LIMIT},
            },

            emotions: {
                field: emotionField,
                inputs: {vec: "emotion"},
                parameters: {limit: LIMIT},
            },

            relations: {
                factory: "RelationExpander",
                inputs: {in: "clip"},
                parameters: {outgoing: "partOf"},
            },
            "relations-2": {
                factory: "RelationExpander",
                inputs: {in: "emotions"},
                parameters: {outgoing: "partOf"},
            },

            aggregator: {
                factory: "ScoreAggregator",
                inputs: {in: "relations"},
            },
            "aggregator-2": {
                factory: "ScoreAggregator",
                inputs: {in: "relations-2"},
            },

            fusion: {
                factory: "WeightedScoreFusion",
                inputs: {in: "aggregator", "in-2": "aggregator-2"},
                parameters: {
                    weights: "0.7 , 100",
                    p: "2",
                    normalize: "true",
                },
            },

            timelookup: {
                factory: "FieldLookup",
                inputs: {in: "fusion"},
                parameters: {field: "time", keys: "start, end"},
            },
            filelookup: {
                factory: "ObjectFieldLookup",
                inputs: {in: "timelookup"},
                parameters: {field: "file", predicates: "partOf", keys: "path"},
            },
        };

        return {
            inputs,
            operations,
            output: "filelookup",
        } as const;
    }

    const inputs: Inputs = {
        txt: {type: "TEXT", data: prompt},
    };

    const operations: Record<string, unknown> = {
        clip: {
            field,
            inputs: {txt: "txt"},
            parameters: {limit: LIMIT},
        },
    };

    const output = addSegmentToFileLookups(operations, "clip");
    return {inputs, operations, output} as const;
}


export function buildVectorQuery(vector: [], limit: number) {
    return {
        "inputs": {
            "txt": {
                "type": "FLOATVECTOR", "data": vector
            }
        },
        "operations": {
            "clip": {"field": "clip", "inputs": {"txt": "txt"}, "parameters": {"limit": limit.toString()}},

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
            "desclookup": {
                "factory": "FieldLookup",
                "inputs": {"in": "timelookup"},
                "parameters": {"field": "clip", "keys": "descriptord"}
            },
            "filelookup": {
                "factory": "ObjectFieldLookup",
                "inputs": {"in": "desclookup"},
                "parameters": {"field": "file", "predicates": "partOf", "keys": "path"}
            }
        },
        "output": "filelookup"
    } as const
}

export function emotionsToVector(emotion: string | undefined | null): number[] {
    const orderingEmotions = ["anger", "disgust", "fear", "happy", "neutral", "sad", "surprise"];

    if (!emotion) {
        return new Array(orderingEmotions.length).fill(0);
    }

    const normalized = emotion.toLowerCase().trim();

    return orderingEmotions.map(e => (e === normalized ? 1 : 0));
}


type Ops = Record<string, unknown>;

function addSegmentToFileLookups(operations: Ops, inputOp: string) {
    operations["relations"] = {
        factory: "RelationExpander",
        inputs: {in: inputOp},
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

    operations["desclookup"] = {
        factory: "FieldLookup",
        inputs: {in: "timelookup"},
        parameters: {field: "clip", keys: "descriptord"},
    };

    operations["filelookup"] = {
        factory: "ObjectFieldLookup",
        inputs: {in: "desclookup"},
        parameters: {field: "file", predicates: "partOf", keys: "path"},
    };

    return "filelookup" as const;
}


