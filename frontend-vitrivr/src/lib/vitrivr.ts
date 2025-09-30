import type {BlockState} from "../components/SearchCard.tsx";

export const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA
export const API_BASE = import.meta.env.VITE_VITRIVR_BASE_URL || "http://localhost:7070";
export const videoUrl = (id: string) => `${API_BASE}/api/${SCHEMA}/fetch/video/${encodeURIComponent(id)}`;
export const thumbnailUrl = (id: string) => `${API_BASE}/api/${SCHEMA}/fetch/thumbnail/${encodeURIComponent(id)}`;
type TextInput = { type: "TEXT"; data: string }
type Inputs = Record<string, TextInput>
type Operator = Record<string, any>;

/**
 * TODO adjust this such that images, emotions and non clip modalities can be entered.
 * @param blocks
 */
export function buildTemporalQuery(blocks: BlockState[]) {
    console.log("Making a termporal query. ")
    const textBits: string[] = [];

    for (const b of blocks) {
        //const isEmotion = b.modality === "emotions";
        const isText = b.queryType === "text";

        if (isText) {
            textBits.push(b.textQuery);
        }

        /**if (isEmotion && b.textQuery.trim()) {
         textBits.push(`${b.textQuery.trim()} ${b.emotion ?? ""}`.trim());
         continue;
         }

         if (!isEmotion && isText && b.textQuery.trim()) {
         textBits.push(b.textQuery.trim());
         continue;
         }**/

    }
    if (textBits.length === 0) {
        throw new Error("Prompt Array must not be empty.");
    }
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
            } as any;
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