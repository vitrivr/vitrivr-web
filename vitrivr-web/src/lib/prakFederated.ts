import type {BlockState} from "../components/SearchCard.tsx";
import {blockModalities} from "./blockModalities.ts";
import {withPrakMetadata, type PrakResponse} from "./prakSearch.ts";

export type FederatedTexts = {visual?: string; ocr?: string; asr?: string};
type QueryOperation = {field?: string; factory?: string; inputs: Record<string, string>; parameters: Record<string, string>};
export type FederatedQuery = {
    inputs: Record<string, {type: "TEXT"; data: string}>;
    operations: Record<string, QueryOperation>;
    output: string;
};
export type FederatedSession = {
    schema: string;
    request: FederatedQuery;
    prakCandidates: string | null;
    fusionState: string | null;
    eligibleIds: string[];
    selectedIds: string[];
    ranking?: string;
    queryKey?: string;
};

/** Every nonempty source has exactly one retrieval, fusion input and weight. */
export function buildFederatedQuery(texts: FederatedTexts): FederatedQuery {
    const inputs: FederatedQuery["inputs"] = {};
    const operations: FederatedQuery["operations"] = {};
    const fusionInputs: Record<string, string> = {};
    const parameters: Record<string, string> = {rankConstant: "60"};
    for (const [alias, operation, field, input] of [
        ["visual", "visual", "prak", "visualText"],
        ["ocr", "written", "ocr", "writtenText"],
        ["asr", "spoken", "asr", "spokenText"],
    ] as const) {
        const text = texts[alias]?.trim();
        if (!text) continue;
        inputs[input] = {type: "TEXT", data: text};
        operations[operation] = {field, inputs: {text: input}, parameters: {limit: "1000"}};
        fusionInputs[alias] = operation;
        parameters[`weight.${alias}`] = "1";
    }
    if (!Object.keys(fusionInputs).length) throw new Error("Enter a visual, OCR or ASR query.");
    if (fusionInputs.visual) {
        parameters.feedbackInput = "visual";
        parameters.stateProperties = "prak.candidates";
    }
    parameters.limit = "1000";
    operations.fusion = {factory: "ReciprocalRankFusion", inputs: fusionInputs, parameters};
    return {inputs, operations, output: "fusion"};
}

export function isFederatedBlock(block: BlockState) { return blockModalities(block).includes("prak"); }

export function federatedQueryFromBlock(block: BlockState) {
    const modes = blockModalities(block);
    if (modes.some(mode => !["prak", "ocr", "asr"].includes(mode))) {
        throw new Error("PraK ranked fusion supports visual, OCR and ASR queries. Use CLIP for other hard filters.");
    }
    return buildFederatedQuery({visual: modes.includes("prak") ? block.textQuery : undefined,
        ocr: modes.includes("ocr") ? block.ocrText : undefined, asr: modes.includes("asr") ? block.asrText : undefined});
}

export function buildFederatedFeedback(session: FederatedSession): FederatedQuery {
    if (!session.prakCandidates || !session.fusionState || !session.selectedIds.length ||
        session.selectedIds.some(id => !session.eligibleIds.includes(id)) || !session.request.operations.visual) {
        throw new Error("Select relevant results with PraK evidence. Local-only results cannot influence PraK feedback yet.");
    }
    const candidates: unknown = JSON.parse(session.prakCandidates);
    if (!Array.isArray(candidates) || !candidates.length) throw new Error("Missing PraK feedback candidates. Start a new search.");
    const request = structuredClone(session.request);
    request.operations.visual.parameters.feedback = JSON.stringify({candidates, selectedRetrievableIds: [...new Set(session.selectedIds)]});
    request.operations.fusion.parameters.replay = session.fusionState;
    return request;
}

export function readFederatedResults(response: PrakResponse, refining = false) {
    const rows = response.retrievables;
    if (!Array.isArray(rows)) throw new Error("Invalid federated search response.");
    // Extract BOTH opaque state strings from the entire response, before paging/filtering.
    const prakCandidates = rows.find(row => row.properties?.["prak.candidates"] !== undefined)?.properties?.["prak.candidates"] ?? null;
    const fusionState = rows.find(row => row.properties?.["fusion.state"] !== undefined)?.properties?.["fusion.state"] ?? null;
    if (prakCandidates !== null) {
        let parsed: unknown;
        try { parsed = JSON.parse(prakCandidates); } catch { throw new Error("Invalid PraK candidate state. Previous results were kept."); }
        if (!Array.isArray(parsed)) throw new Error("Invalid PraK candidate state. Previous results were kept.");
    }
    if (fusionState !== null) {
        let parsed: unknown;
        try { parsed = JSON.parse(fusionState); } catch { throw new Error("Invalid fusion replay state. Previous results were kept."); }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid fusion replay state. Previous results were kept.");
    }
    const eligible = rows.filter(row => row.properties?.["fusion.feedbackEligible"] === "true");
    if (refining && (!rows.length || !prakCandidates || !fusionState || !eligible.length ||
        eligible.some(row => row.properties?.["prak.ranking"] !== "bayes"))) {
        throw new Error("Incomplete Bayesian fusion response. Previous results were kept.");
    }
    const seen = new Set<string>();
    const retrievables = rows.filter(row => {
        if (!row.id || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
    });
    return {response: {...response, retrievables}, prakCandidates, fusionState,
        eligibleIds: [...new Set(eligible.flatMap(row => row.id ? [row.id] : []))],
        ranking: eligible.some(row => row.properties?.["prak.ranking"] === "bayes") ? "bayes" : undefined};
}

export type SourceEvidence = {source: string; rank?: number; score?: number | null; weight?: number; contribution?: number};
export function fusionEvidence(properties?: Record<string, string>): SourceEvidence[] {
    const encoded = properties?.["fusion.evidence"];
    if (!encoded) return [];
    try {
        const parsed: unknown = JSON.parse(encoded);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
        return Object.entries(parsed).flatMap(([source, value]) => {
            if (!value || typeof value !== "object" || Array.isArray(value)) return [];
            const evidence = value as Record<string, unknown>;
            return [{source, ...(typeof evidence.rank === "number" ? {rank: evidence.rank} : {}),
                ...(typeof evidence.score === "number" || evidence.score === null ? {score: evidence.score} : {}),
                ...(typeof evidence.weight === "number" ? {weight: evidence.weight} : {}),
                ...(typeof evidence.contribution === "number" ? {contribution: evidence.contribution} : {})}];
        });
    } catch { return []; }
}

/** No UI state is mutated until execution, validation and stale-response checks succeed. */
export async function executeFederatedSearch(options: {
    request: FederatedQuery;
    previous?: FederatedSession;
    isCurrent: () => boolean;
    execute: (query: ReturnType<typeof withPrakMetadata<FederatedQuery>>) => Promise<PrakResponse>;
}) {
    const request = options.previous ? buildFederatedFeedback(options.previous) : options.request;
    const response = await options.execute(withPrakMetadata(request));
    if (!options.isCurrent()) return undefined;
    const result = readFederatedResults(response, !!options.previous);
    if (options.previous && JSON.parse(result.prakCandidates!).length !== JSON.parse(options.previous.prakCandidates!).length) {
        throw new Error("Incomplete PraK candidates. Previous results were kept.");
    }
    return result;
}
