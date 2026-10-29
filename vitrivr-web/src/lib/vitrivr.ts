import {isFederatedBlock, federatedQueryFromBlock} from "./prakFederated.ts";
import {withPrakMetadata} from "./prakSearch.ts";
import {blockModalities} from "./blockModalities.ts";
import {blockCondition, booleanRetrieval, appendBooleanLookups} from "./booleanQuery.ts";
import {combineConditions, personCondition, type FilterCondition} from "./booleanFilters.ts";
import type {PersonFilterOptions} from "./personQuery.ts";
import type {BlockState} from "../components/SearchCard.tsx";

export const API_BASE = import.meta.env?.VITE_VITRIVR_BASE_URL;
export const THUMBNAIL_BASE = import.meta.env?.VITE_THUMBNAIL_ORIGIN;
export const SEGMENT_ORIGIN = import.meta.env?.VITE_SEGMENT_ORIGIN;
export const MEDIA_PATH_ORIGIN: string = import.meta.env?.VITE_MEDIA_PATH_ORIGIN ?? "";

type TextInput = { type: "TEXT"; data: string };
type FloatVectorInput = { type: "FLOATVECTOR"; data: number[] };
type Input = TextInput | FloatVectorInput;
type Inputs = Record<string, Input>;
type RawSchema = string | { name?: string; [key: string]: unknown };


/**
 * Builds the thumbnail URL for a given segment or media id.
 *
 * The current implementation is tailored to the VBS 2026 thumbnail layout,
 * where thumbnails are stored in shard folders derived from the first two
 * characters of the raw id.
 * @param schema - Active vitrivr schema name
 * @param id - Segment or media identifier used to locate the thumbnail
 * @returns The absolute thumbnail URL, or an empty string if it cannot be built
 */
export function thumbnailURL(id: string): string {
    if (!THUMBNAIL_BASE) return "";
    const clean = (id ?? "").trim();
    if (!clean) return "";
    return `${THUMBNAIL_BASE}/${encodeURIComponent(clean)}.jpg`;
}


/**
 * Extracts the filename from a filesystem-style path.
 *
 * @param p - Full path string
 * @returns The basename of the path, or an empty string if unavailable
 */
function basenameFromPath(p: string): string {
    const unixy = p.replace(/\\/g, "/");
    const parts = unixy.split("/");
    return parts[parts.length - 1] ?? "";
}

/**
 * TODO change this for the segment
 * Builds a public video URL from a source file path.
 *
 * @param filePath - Original file path descriptor from the backend
 * @returns A playable video URL, or an empty string if it cannot be built
 */
export function segmentURL(filePath: string): string {
    if (!SEGMENT_ORIGIN) return "";
    const clean = (filePath ?? "").trim();
    const url = new URL(`${SEGMENT_ORIGIN}/${encodeURIComponent(clean)}`).toString();
    console.log(url.toString());
    return url;
}

/**
 * TODO change this for the media
 * Builds a public video URL from a source file path.
 *
 * @param filePath - Original file path descriptor from the backend
 * @returns A playable video URL, or an empty string if it cannot be built
 */
export function videoURL(filePath: string | undefined): string {
    if (filePath === undefined) return "";
    const url = new URL(`${MEDIA_PATH_ORIGIN}/${(filePath)}`, SEGMENT_ORIGIN).toString();
    console.log(url.toString());
    return url.toString();
}


/**
 * Minimal frontend representation of a retrievable object returned by vitrivr.
 *
 * This type is used by helper functions that inspect descriptors and
 * relationship metadata, especially for segment/video results.
 */
export type VitrivrRetrievable = {
    score?: number;
    properties?: Record<string, string>;
    id?: string;
    type?: string;
    descriptors?: Record<string, unknown>;
    relationship?: {
        partOf?: {
            id: any;
            descriptors?: Record<string, unknown>;
        };
    };
};


/**
 * TODO: überarbeiten
 * Extracts a usable file path from a retrievable.
 *
 * The method first checks the retrievable's own descriptors for `file.path`.
 * If not found, it falls back to the parent object's descriptors via
 * `relationship.partOf`.
 * @param r - A vitrivr retrievable object
 * @returns The resolved file path, or `undefined`
 */
export function pickFilePath(r: VitrivrRetrievable): string | undefined {
    const local = r.descriptors?.["file.path"];
    if (typeof local === "string" && local.trim()) return local;

    const parent = r.relationship?.partOf?.descriptors?.["file.path"];
    if (typeof parent === "string" && parent.trim()) return parent;

    return undefined;
}

export type BuiltMediaUrls = {
    url: string;
    thumbUrl: string;
    filePath?: string;
    filename?: string;
};

/**
 * Builds the media URLs needed to render a segment-like retrievable.
 * This helper is mainly intended for video segment results.
 * @param schema - Active vitrivr schema name
 * @param r - Segment-like retrievable object
 * @returns An object containing video and thumbnail URLs plus path metadata
 */
export function buildSegmentMediaUrls(r: VitrivrRetrievable): BuiltMediaUrls {
    const id = (r.id ?? "").trim();
    const filePath = pickFilePath(r);
    const url = filePath ? segmentURL(filePath) : "";
    const thumbUrl = id ? thumbnailURL(id) : "";
    const filename = filePath ? basenameFromPath(filePath) : undefined;

    return {url, thumbUrl, filePath: filePath ?? undefined, filename};
}


/**
 * Fetches the list of available schemas from the vitrivr backend.
 * @returns A promise resolving to a list of schema names
 * @throws Error when the HTTP request fails
 */
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
 * Build a temporal query that consists of multiple QueryBlocks.
 * @param blocks ordered list of QueryBlocks from the UI
 */
export function buildTemporalQuery(blocks: BlockState[], scope?: FilterCondition) {
    if (blocks.some(isFederatedBlock)) throw new Error("PraK ranked fusion currently supports a single query block.");
    const LIMIT = "10";
    const summary: string[] = [];

    const hasImageBlock = blocks.some((b) => b.queryType === "image");
    if (hasImageBlock) {
        throw new Error("Temporal query currently supports only text/emotion blocks (no image blocks yet).");
    }
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

        if (b.modalities) {
            const search = flatBlockRetrieval(b, blockModalities(b).length === 1 && blockModalities(b)[0] === "person" ? "1000" : LIMIT, `block-${opIdx}`, scope);
            Object.assign(inputs, search.inputs);
            Object.assign(operations, search.operations);
            temporalInputs[inName] = search.output;
            summary.push(blockModalities(b).join(" + "));
            opIdx++;
            continue;
        }
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

            const emotionField = emotionTypeToField(b.emotionTarget);
            const filter = combineConditions("all", [blockCondition(b), scope]);

            operations[clipOp] = {
                field: "clip",
                inputs: {txt: txtKey},
                parameters: {limit: LIMIT},
                ...(filter ? {filter} : {}),
            };

            operations[emoOp] = {
                field: emotionField,
                inputs: {vec: vecKey},
                parameters: {limit: LIMIT},
                ...(filter ? {filter} : {}),
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

        const search = booleanRetrieval(b, b.modality === "person" ? "1000" : LIMIT, `block-${opIdx}`, scope);
        Object.assign(inputs, search.inputs);
        Object.assign(operations, search.operations);
        temporalInputs[inName] = search.output;
        summary.push(b.modality);
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


/**
 * Builds the query for vitrivr-engine for textual queries
 * @param prompt the textual query
 * @param field such as clip, ocr, asr, or emotions
 * @param emotions emotion label such as happy, sad, etc.
 * @param emotionType where the emotions occurs such as face, asr or ocr.
 */
export function buildTextQuery(field: string, prompt: string, emotions: string = "", emotionType: string = "", people: readonly string[] = [], personOptions: PersonFilterOptions = {}, additionalFilter?: FilterCondition) {

    const LIMIT = "1000";

    let emotionField = "emotionssound";
    if (emotionType === "face") emotionField = "emotionsface";
    else if (emotionType === "ocr") emotionField = "emotionsocr";

    if (field === "emotions") {
        const emotionsVector = emotionsToVector(emotions);
        const filter = combineConditions("all", [personCondition(people, personOptions), additionalFilter]);

        const inputs: Inputs = {
            "txt-1": {type: "TEXT", data: prompt},
            emotion: {type: "FLOATVECTOR", data: emotionsVector},
        };

        const operations: Record<string, unknown> = {
            clip: {
                field: "clip",
                inputs: {txt: "txt-1"},
                parameters: {limit: LIMIT},
                ...(filter ? {filter} : {}),
            },

            emotions: {
                field: emotionField,
                inputs: {vec: "emotion"},
                parameters: {limit: LIMIT},
                ...(filter ? {filter} : {}),
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

    return appendBooleanLookups(booleanRetrieval({id: "", modality: field as BlockState["modality"], queryType: "text", file: null,
        textQuery: prompt, personNames: field === "person" && !people.length ? [prompt] : [...people], identityField: personOptions.identityField,
        personMode: personOptions.mode, personMinConfidence: personOptions.minConfidence, conditions: additionalFilter}));
}

/** Build the selected ranked modalities, applying hard requirements to each leaf. */
function flatBlockRetrieval(block: BlockState, limit: string, prefix = "", scope?: FilterCondition) {
    const modes = blockModalities(block);
    if (!modes.length) throw new Error("Please select at least one modality.");
    if (!modes.includes("emotions")) return booleanRetrieval(block, limit, prefix, scope);
    if (!block.emotion) throw new Error("Please select an emotion.");
    const key = (name: string) => prefix ? `${prefix}-${name}` : name;
    const filter = combineConditions("all", [blockCondition(block), scope]);
    const inputs: Inputs = {[key("emotion")]: {type: "FLOATVECTOR", data: emotionsToVector(block.emotion)}};
    const operations: Record<string, unknown> = {
        [key("emotions")]: {field: `emotions${block.emotionTarget ?? "face"}`, inputs: {vec: key("emotion")}, parameters: {limit}, ...(filter ? {filter} : {})},
    };
    if (!modes.includes("clip")) return {inputs, operations, output: key("emotions")};
    const clip = booleanRetrieval(block, limit, prefix, scope);
    Object.assign(inputs, clip.inputs);
    Object.assign(operations, clip.operations);
    for (const [name, source] of [["scene", clip.output], ["emotion", key("emotions")]]) {
        operations[key(`${name}-relations`)] = {factory: "RelationExpander", inputs: {in: source}, parameters: {outgoing: "partOf"}};
        operations[key(`${name}-scores`)] = {factory: "ScoreAggregator", inputs: {in: key(`${name}-relations`)}};
    }
    operations[key("fusion")] = {factory: "WeightedScoreFusion", inputs: {in: key("scene-scores"), "in-2": key("emotion-scores")}, parameters: {weights: "0.7 , 100", p: "2", normalize: "true"}};
    return {inputs, operations, output: key("fusion")};
}

export function buildQueryBlock(block: BlockState, scope?: FilterCondition) {
    if (isFederatedBlock(block)) return withPrakMetadata(federatedQueryFromBlock(block));
    if (block.modalities) {
        const retrieval = flatBlockRetrieval(block, "1000", "", scope);
        const query = appendBooleanLookups(retrieval);
        // Fusion already aggregates scores at the parent level.
        if (retrieval.output === "fusion") {
            const {relations: _relations, aggregator: _aggregator, ...operations} = query.operations;
            void _relations; void _aggregator;
            return {...query, operations: {...operations, timelookup: {...query.operations.timelookup, inputs: {in: "fusion"}}}};
        }
        return query;
    }
    if (block.modality === "emotions") {
        if (!block.emotion) throw new Error("Please select an emotion.");
        return buildTextQuery("emotions", "", block.emotion, block.emotionTarget, [], {}, combineConditions("all", [blockCondition(block), scope]));
    }
    return appendBooleanLookups(booleanRetrieval(block, "1000", "", scope));
}

/**
 * Builds a vector-based vitrivr query that is used for the nearest neighbor search.
 * @param vector embedding vector
 * @param limit maximum number of retrieval results
 */
export function buildVectorQuery(vector: number[], limit: number) {
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

/**
 * Converts emotion labels into a one-hot representation
 * @param emotion label
 * @returns the one-hot encoded vector
 */
export function emotionsToVector(emotion: string | undefined | null): number[] {
    const orderingEmotions = ["anger", "disgust", "fear", "happy", "neutral", "sad", "surprise"];

    if (!emotion) {
        return new Array(orderingEmotions.length).fill(0);
    }

    const normalized = emotion.toLowerCase().trim();

    return orderingEmotions.map(e => (e === normalized ? 1 : 0));
}


