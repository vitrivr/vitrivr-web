import {DEFAULT_IDENTITY_FIELD, selectedPersonNames, type IdentityField} from "./personQuery.ts";
import {emotionsToVector} from "./vitrivr.ts";
import type {MediaItem} from "../components/SearchCard.tsx";
import type {BlockState} from "../components/SearchCard.tsx";
import {blockModalities} from "./blockModalities.ts";
import {combineConditions, personCondition} from "./booleanFilters.ts";
import type {FilterCondition} from "./booleanFilters.ts";
import {withPrakMetadata, type PrakResponse} from "./prakSearch.ts";

export type LocalQuery = {
    inputs: Record<string, {type: "TEXT"; data: string} | {type: "FLOATVECTOR"; data: number[]}>;
    operations: Record<string, {field?: string; factory?: string; inputs: Record<string, string>; parameters: Record<string, string>; filter?: FilterCondition}>;
    output: string;
};
export type LocalFeedbackSession = {
    schema: string;
    localState: string | null;
    eligibleIds: string[];
    selectedIds: string[];
    resultIds: string[];
    ranking?: string;
    queryKey?: string;
};

export type LocalDiscoveryTexts = {visual?: string; ocr?: string; asr?: string; prak?: string; person?: string | readonly string[]};
export type LocalDiscoveryOptions = {
    identityField?: IdentityField;
    personRanking?: boolean;
    mandatoryPersons?: readonly string[];
    personMode?: "all" | "any";
    minConfidence?: number;
    emotion?: {label: string; target?: "face" | "sound" | "ocr"};
};

/** Every enabled, nonempty signal contributes its own ranking to one feedback pool. */
export function buildLocalDiscoveryQuery(texts: LocalDiscoveryTexts, scope?: FilterCondition, options: LocalDiscoveryOptions = {}): LocalQuery {
    const inputs: LocalQuery["inputs"] = {};
    const operations: LocalQuery["operations"] = {};
    const fusionInputs: Record<string, string> = {};
    const names = (values: readonly string[]) => [...new Set(values.map(value => value.trim()).filter(Boolean))];
    const mandatory = names(options.mandatoryPersons ?? []);
    const identityField = options.identityField ?? DEFAULT_IDENTITY_FIELD;
    const hardParameters: Record<string, string> = mandatory.length ? {
        "filter.persons": mandatory.join(","), "filter.personMode": options.personMode ?? "all", "filter.identityField": identityField,
    } : {};
    if (mandatory.length && options.minConfidence !== undefined) {
        if (!Number.isFinite(options.minConfidence) || options.minConfidence < 0 || options.minConfidence > 1) throw new Error("Minimum person confidence must be between 0 and 1.");
        hardParameters["filter.personMinConfidence"] = String(options.minConfidence);
    }
    const add = (alias: string, name: string, field: string, port: string, input: string) => {
        operations[name] = {field, inputs: {[port]: input}, parameters: {limit: "1000", ...hardParameters}, ...(scope ? {filter: scope} : {})};
        fusionInputs[alias] = name;
    };
    for (const [source, name, field, input] of [
        ["visual", "visual", "clip", "visualText"], ["ocr", "written", "ocr", "writtenText"], ["asr", "spoken", "asr", "spokenText"], ["prak", "prak", "prak", "prakText"],
    ] as const) {
        const text = texts[source]?.trim();
        if (!text) continue;
        inputs[input] = {type: "TEXT", data: text};
        add(field, name, field, "text", input);
    }
    const people = names(typeof texts.person === "string" ? [texts.person] : texts.person ?? []);
    if (options.personRanking !== false) people.forEach((label, index) => {
        const alias = index === 0 ? "person" : `person${index + 1}`;
        const input = index === 0 ? "personName" : `personName${index + 1}`;
        inputs[input] = {type: "TEXT", data: label};
        add(alias, alias, identityField, "label", input);
    });
    if (options.emotion?.label.trim()) {
        inputs.emotionVector = {type: "FLOATVECTOR", data: emotionsToVector(options.emotion.label)};
        add("emotions", "emotions", `emotions${options.emotion.target ?? "face"}`, "vec", "emotionVector");
    }
    const sources = Object.values(fusionInputs);
    // External PraK retrieval does not enforce native early filters. Require
    // eligibility in fusion, at zero weight, so remote hits cannot bypass scope.
    const eligibility = texts.prak?.trim() ? combineConditions("all", [scope,
        personCondition(mandatory, {identityField, mode: options.personMode, minConfidence: options.minConfidence})]) : undefined;
    if (eligibility) {
        operations.eligibility = {factory: "FilteredRetrieval", inputs: {}, parameters: {limit: "2147483647"}, filter: eligibility};
        fusionInputs.eligibility = "eligibility";
    }
    if (!sources.length) throw new Error("Enter a native CLIP, OCR or ASR query, select a person, or select an emotion for ranking.");
    const needsFusion = sources.length > 1 || !!eligibility;
    if (needsFusion) operations.fusion = {factory: "ReciprocalRankFusion", inputs: fusionInputs, parameters: {
        rankConstant: "60", limit: "1000", ...(eligibility ? {requiredInputs: "eligibility", "weight.eligibility": "0"} : {}),
    }};
    return {inputs, operations, output: needsFusion ? "fusion" : sources[0]};
}

export function localDiscoveryFromBlock(block: BlockState, scope?: FilterCondition) {
    const modes = blockModalities(block);
    if (modes.some(mode => !["clip", "ocr", "asr", "person", "emotions", "prak"].includes(mode))) throw new Error("Select a supported retrieval feature.");
    const people = modes.includes("person") ? selectedPersonNames(block) : [];
    return buildLocalDiscoveryQuery({visual: modes.includes("clip") ? block.textQuery : undefined,
        ocr: modes.includes("ocr") ? block.ocrText : undefined, asr: modes.includes("asr") ? block.asrText : undefined, person: people,
        prak: modes.includes("prak") ? block.prakText ?? (!modes.includes("clip") ? block.textQuery : undefined) : undefined}, scope,
        {identityField: block.identityField, personRanking: block.personRanking, mandatoryPersons: block.mustContainPerson ? people : [],
            personMode: block.personMode, minConfidence: block.personMinConfidence,
            emotion: modes.includes("emotions") && block.emotion ? {label: block.emotion, target: block.emotionTarget} : undefined});
}

/** Query inputs/configuration identify the feedback session, never result selections. */
export function feedbackQueryKey(query: unknown): string { return JSON.stringify(query); }

/** Capture the whole final pool after discovery/deduplication, before display lookups. */
export function appendLocalFeedbackPool(query: LocalQuery, enabled = true): LocalQuery {
    if (!enabled) return query;
    return {...query, operations: {...query.operations, feedbackPool: {
        factory: "PrakLocalFeedback", inputs: {in: query.output}, parameters: {prakField: "prak", limit: "1000"},
    }}, output: "feedbackPool"};
}

/** Feedback must be a NEW pipeline: even parsing native retrievals can re-embed text. */
export function buildLocalFeedbackRequest(session: LocalFeedbackSession): LocalQuery {
    if (!session.localState || !session.selectedIds.length || session.selectedIds.some(id => !session.eligibleIds.includes(id))) {
        throw new Error("Select relevant results that are eligible for PraK mapping.");
    }
    return {inputs: {}, operations: {feedback: {factory: "PrakLocalFeedback", inputs: {}, parameters: {
        prakField: "prak", state: session.localState, selectedRetrievableIds: JSON.stringify([...new Set(session.selectedIds)]),
    }}}, output: "feedback"};
}

export function readLocalFeedbackResults(response: PrakResponse, refining = false, refinementEnabled = true) {
    const rows = response.retrievables;
    if (!Array.isArray(rows)) throw new Error("Invalid local feedback response. Previous results were kept.");
    // Read the complete opaque state before pagination, display filtering or deduplication.
    const localState = refinementEnabled ? rows.find(row => row.properties?.["prak.localState"] !== undefined)?.properties?.["prak.localState"] ?? null : null;
    if (refinementEnabled && rows.length && !localState) throw new Error("Missing local feedback state. Previous results were kept.");
    if (localState !== null) {
        let parsed: unknown;
        try { parsed = JSON.parse(localState); } catch { throw new Error("Invalid local feedback state. Previous results were kept."); }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid local feedback state. Previous results were kept.");
    }
    const eligible = refinementEnabled ? rows.filter(row => row.properties?.["fusion.feedbackEligible"] === "true") : [];
    if (refining && (!rows.length || !eligible.length || eligible.some(row => row.properties?.["prak.ranking"] !== "bayes"))) {
        throw new Error("Incomplete local Bayesian feedback response. Previous results were kept.");
    }
    const seen = new Set<string>();
    const retrievables = rows.filter(row => {
        if (!row.id || seen.has(row.id)) return false;
        seen.add(row.id); return true;
    });
    return {response: {...response, retrievables}, localState,
        resultIds: retrievables.map(row => row.id!), eligibleIds: [...new Set(eligible.flatMap(row => row.id ? [row.id] : []))],
        ranking: eligible.some(row => row.properties?.["prak.ranking"] === "bayes") ? "bayes" : undefined};
}

export async function executeLocalFeedbackSearch(options: {
    request?: LocalQuery;
    requestHasDisplayMetadata?: boolean;
    refinementEnabled?: boolean;
    previous?: LocalFeedbackSession;
    isCurrent: () => boolean;
    execute: (query: LocalQuery) => Promise<PrakResponse>;
}) {
    if (options.refinementEnabled === false && options.previous) throw new Error("Bayesian refinement is disabled in settings.");
    const request = options.previous ? buildLocalFeedbackRequest(options.previous) : options.request;
    if (!request) throw new Error("Missing local discovery query.");
    // The feedback-only contract contains exactly one operation. Local IDs stay
    // fixed, so the UI can reuse the initial pool's playback metadata.
    const response = await options.execute(options.previous || options.requestHasDisplayMetadata ? request : withPrakMetadata(request));
    if (!options.isCurrent()) return undefined;
    const result = readLocalFeedbackResults(response, !!options.previous, options.refinementEnabled ?? true);
    if (options.previous && (result.resultIds.length !== options.previous.resultIds.length || result.resultIds.some(id => !options.previous!.resultIds.includes(id)))) {
        throw new Error("Local feedback changed the saved result pool. Previous results were kept.");
    }
    return result;
}

/** Surface backend mapping/feedback errors rather than only the HTTP status label. */
export function feedbackErrorMessage(error: unknown): string {
    if (error && typeof error === "object" && "body" in error && error.body && typeof error.body === "object") {
        for (const key of ["message", "description", "error"] as const) {
            if (key in error.body) {
                const value = (error.body as Record<string, unknown>)[key];
                if (typeof value === "string" && value.trim()) return value;
            }
        }
    }
    return error instanceof Error ? error.message : String(error);
}

/** Keep the projected server order and score while reusing the same local media. */
export function projectLocalFeedbackMedia(response: PrakResponse, previous: MediaItem[]): MediaItem[] {
    const mediaById = new Map(previous.map(item => [item.id, item]));
    return (response.retrievables ?? []).map((row, index) => {
        const item = row.id ? mediaById.get(row.id) : undefined;
        if (!item) throw new Error("Local feedback returned an unknown result. Previous results were kept.");
        return {...item, score: row.score, properties: row.properties, searchRank: index + 1};
    });
}
