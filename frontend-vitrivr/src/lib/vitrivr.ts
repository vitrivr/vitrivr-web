import type {BlockState} from "../components/SearchCard.tsx";

export const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA
export const API_BASE = import.meta.env.VITE_VITRIVR_BASE_URL;
export const THUMBNAIL_BASE = import.meta.env.VITE_THUMBNAIL_ORIGIN;
type TextInput = { type: "TEXT"; data: string }
type Inputs = Record<string, TextInput>
type Operator = Record<string, unknown>;
type RawSchema = string | { name?: string; [key: string]: unknown };
const stored = window.localStorage.getItem("vitrivr_schema");

const schema = stored ?? SCHEMA;


export function thumbnailUrl(id: string): string {
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
    console.log("Making a termporal query. ")
    const textBits: string[] = [];

    for (const b of blocks) {
        const isCLIP = b.modality === "clip";
        const isImage = b.queryType === "image";
        const isText = b.queryType === "text";
        const isEmotion = b.emotion !== undefined;
        console.log(b.emotion)

        if (isCLIP && isImage) {
            // TODO Implement image-to-image
            console.log("The image case has not been implemented in the backend yet. ")
        } else if (isEmotion) {
            // TODO Implement emotions
            console.log("The emotion case has not been implemented in the backend yet. ")
        } else if (isCLIP && isText) {
            textBits.push(b.textQuery);
            const inputs: Inputs = Object.fromEntries(textBits.map((term, i) => [`t${i}`, {
                type: "TEXT",
                data: term
            } as TextInput,])); // maps all the entries of the prompt array to variable called t1,...,tn
            const clipOps: Operator = Object.fromEntries(
                textBits.map((_, i) => {
                    const opName = i === 0 ? "clip" : `clip${i}`; // first one is just "clip" and not "clip0"
                    const op = {
                        field: "clip",
                        inputs: {txt: `t${i}`},
                    } as never;
                    return [opName, op];
                })
            );

            const temporalInputs = Object.fromEntries(textBits.map((_, i) => [`in${i}`, i === 0 ? "clip" : `clip${i}`]));
            const operations: Operator = {
                ...clipOps,
                "temporal-aggregator": {
                    factory: "TemporalSequenceAggregator",
                    inputs: temporalInputs,
                },
                relations: {
                    factory: "RelationExpander",
                    inputs: {in: "temporal-aggregator"},
                    parameters: {outgoing: "partOf"},
                },
                aggregator: {
                    factory: "ScoreAggregator",
                    inputs: {in: "relations"},
                },
                timelookup: {
                    factory: "FieldLookup",
                    inputs: {in: "aggregator"},
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
            };
        }
    }
}

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
                "factory": "ObjectFieldLookup",
                "inputs": {"in": "timelookup"},
                "parameters": {"field": "file", "predicates": "partOf", "keys": "path"}
            }
        },
        "output": "filelookup"
    } as const;
}