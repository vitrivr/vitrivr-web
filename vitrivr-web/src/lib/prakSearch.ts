/** PraK is always queried through vitrivr-engine; feedback candidates are opaque. */
export type PrakRetrievable = {
    id?: string;
    type?: string;
    score?: number;
    properties?: Record<string, string>;
    descriptors?: Record<string, unknown>;
    relationship?: {partOf?: {id?: string; type?: string; descriptors?: Record<string, unknown>}};
};
export type PrakResponse = {retrievables?: PrakRetrievable[]};
export type PrakSession = {
    schema: string;
    text: string;
    candidates: unknown[];
    selectedIds: string[];
    resultIds: string[];
    ranking?: string;
};

export function buildPrakQuery(text: string, feedback?: Pick<PrakSession, "candidates" | "selectedIds">) {
    if (!text.trim()) throw new Error("Please enter a PraK search description.");
    const parameters: Record<string, string> = {limit: "1000"};
    if (feedback) {
        if (!feedback.candidates.length || !feedback.selectedIds.length) throw new Error("Select relevant results before refining.");
        parameters.feedback = JSON.stringify({candidates: feedback.candidates, selectedRetrievableIds: [...new Set(feedback.selectedIds)]});
    }
    return {inputs: {text: {type: "TEXT" as const, data: text.trim()}}, operations: {
        search: {field: "prak", inputs: {query: "text"}, parameters},
    }, output: "search"};
}

/** These lookups copy results in stream order, retaining scores and properties.
 * No aggregation, deduplicator or limit is placed after PraK retrieval. */
export function withPrakMetadata<T extends {inputs: object; operations: Record<string, unknown>; output: string}>(query: T) {
    return {...query, operations: {...query.operations,
        relations: {factory: "RelationExpander", inputs: {in: query.output}, parameters: {outgoing: "partOf"}},
        timelookup: {factory: "FieldLookup", inputs: {in: "relations"}, parameters: {field: "time", keys: "start, end"}},
        filelookup: {factory: "ObjectFieldLookup", inputs: {in: "timelookup"}, parameters: {field: "file", predicates: "partOf", keys: "path"}},
    }, output: "filelookup"};
}

export function readPrakResults(response: PrakResponse, refining = false) {
    const results = response.retrievables;
    if (!Array.isArray(results)) throw new Error("Invalid PraK response: missing results.");
    // Read the complete candidate property before any paging or deduplication.
    const encoded = results.find(result => result.properties?.["prak.candidates"] !== undefined)?.properties?.["prak.candidates"];
    let candidates: unknown[] = [];
    if (encoded !== undefined) {
        let parsed: unknown;
        try { parsed = JSON.parse(encoded); }
        catch { throw new Error("Invalid PraK feedback candidate data. Previous results were kept."); }
        if (!Array.isArray(parsed)) throw new Error("Invalid PraK feedback candidate data. Previous results were kept.");
        candidates = parsed;
    }
    if (refining && (!results.length || !candidates.length || results.some(result => result.properties?.["prak.ranking"] !== "bayes"))) {
        throw new Error("PraK refinement did not return a complete Bayesian result. Previous results were kept.");
    }
    const seen = new Set<string>();
    const retrievables = results.filter(result => {
        if (!result.id || seen.has(result.id)) return false;
        seen.add(result.id);
        return true;
    });
    return {response: {...response, retrievables}, candidates, ranking: retrievables[0]?.properties?.["prak.ranking"]};
}

/** A shared generation gate prevents older searches (including reset/unmount) committing. */
export class SearchRequestGate {
    private generation = 0;
    begin() { return ++this.generation; }
    invalidate() { this.generation++; }
    isCurrent(generation: number) { return generation === this.generation; }
}

/** The UI commits this complete result only after the request and validation succeed. */
export async function executePrakSearch(options: {
    execute: (query: ReturnType<typeof withPrakMetadata<ReturnType<typeof buildPrakQuery>>>) => Promise<PrakResponse>;
    isCurrent: () => boolean;
    text: string;
    previous?: Pick<PrakSession, "candidates" | "selectedIds">;
}) {
    const request = withPrakMetadata(buildPrakQuery(options.text, options.previous));
    const response = await options.execute(request);
    if (!options.isCurrent()) return undefined;
    const result = readPrakResults(response, options.previous !== undefined);
    if (options.previous && result.candidates.length !== options.previous.candidates.length) {
        throw new Error("PraK refinement returned an incomplete candidate list. Previous results were kept.");
    }
    return result;
}
