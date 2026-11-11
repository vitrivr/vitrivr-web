import jsonDefaults from "./frontendSettings.json" with {type: "json"};
import type {VisualDeduplicationSettings} from "../lib/visualDeduplication.ts";
import {vlmModelOptions, type VlmRerankingPreferences} from "../lib/vlm.ts";

import {normalizeDresNaming, type DresNamingSettings} from "../dres/naming.ts";

export type FrontendView = "CASTLE" | "VBS";

export type FrontendSettings = {
    frontendView: FrontendView;
    dresNaming: DresNamingSettings;
    bayesianRefinementEnabled: boolean;
    enabledQueryTypes: string[];
    enabledResourceFilters: string[];
    personNames: string[];
    recordingDays: string[];
    sourcePersons: string[];
    sourceLocations: string[];
    visualDeduplication: VisualDeduplicationSettings;
    vlmReranking: VlmRerankingPreferences;
};

export const SETTINGS_STORAGE_KEY = "vitrivr_frontend_settings_v1";

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Settings must be an object.");
    return value as Record<string, unknown>;
}

/** Validate saved/UI overrides while using the JSON file for missing defaults. */
export function normalizeFrontendSettings(value: unknown): FrontendSettings {
    const input = {...jsonDefaults, ...record(value)};
    const list = (key: keyof Omit<FrontendSettings, "dresNaming" | "visualDeduplication" | "vlmReranking" | "bayesianRefinementEnabled" | "frontendView">): string[] => {
        const values = input[key];
        if (!Array.isArray(values) || !values.every(item => typeof item === "string")) throw new Error(`${key} must contain text values.`);
        return [...new Set(values.map(item => item.trim()).filter(Boolean))];
    };
    if (input.frontendView !== "CASTLE" && input.frontendView !== "VBS") throw new Error("Frontend view must be CASTLE or VBS.");
    if (typeof input.bayesianRefinementEnabled !== "boolean") throw new Error("Bayesian refinement must be enabled or disabled.");
    const enabledQueryTypes = list("enabledQueryTypes").filter(type => type !== "filter");
    if (enabledQueryTypes.some(type => !["clip", "vlm", "emotions", "ocr", "asr", "person", "prak"].includes(type))) throw new Error("Unknown query type.");
    const enabledResourceFilters = list("enabledResourceFilters");
    if (enabledResourceFilters.some(type => !["day", "sourceType", "source"].includes(type))) throw new Error("Unknown resource filter.");
    const visual = {...jsonDefaults.visualDeduplication, ...record(input.visualDeduplication)};
    if (typeof visual.enabled !== "boolean" || typeof visual.field !== "string" || !visual.field.trim()) throw new Error("Deduplication needs an enabled flag and a comparison field.");
    if (!Number.isFinite(visual.similarityThreshold) || visual.similarityThreshold < 0 || visual.similarityThreshold > 1) throw new Error("Similarity threshold must be between 0 and 1.");
    if (!Number.isFinite(visual.timeWindowSeconds) || visual.timeWindowSeconds < 0) throw new Error("Time window must be zero or greater.");
    if (!Number.isInteger(visual.candidateLimit) || visual.candidateLimit < 1 || !Number.isInteger(visual.limit) || visual.limit < 1) throw new Error("Candidate and result limits must be positive whole numbers.");
    const vlm = {...jsonDefaults.vlmReranking, ...record(input.vlmReranking)};
    const model = vlmModelOptions.find(option => option.value === vlm.model)?.value;
    if (!model) throw new Error("Unknown VLM reranking model.");
    if (!Number.isInteger(vlm.candidateLimit) || vlm.candidateLimit < 1 || vlm.candidateLimit > 1000) throw new Error("VLM candidate limit must be a whole number between 1 and 1000.");
    const naming = {...jsonDefaults.dresNaming, ...record(input.dresNaming)};
    const dresNaming = {
        CASTLE: normalizeDresNaming({...jsonDefaults.dresNaming.CASTLE, ...record(naming.CASTLE)}, "CASTLE"),
        VBS: normalizeDresNaming({...jsonDefaults.dresNaming.VBS, ...record(naming.VBS)}, "VBS"),
    };
    return {
        dresNaming,
        frontendView: input.frontendView,
        bayesianRefinementEnabled: input.bayesianRefinementEnabled,
        enabledQueryTypes, enabledResourceFilters,
        personNames: list("personNames"), recordingDays: list("recordingDays"),
        sourcePersons: list("sourcePersons"), sourceLocations: list("sourceLocations"),
        visualDeduplication: {...visual, field: visual.field.trim()},
        vlmReranking: {model, candidateLimit: vlm.candidateLimit},
    };
}

export function defaultFrontendSettings(): FrontendSettings {
    return normalizeFrontendSettings(jsonDefaults);
}

export function readFrontendSettings(serialized: string | null): FrontendSettings {
    try { return serialized ? normalizeFrontendSettings(JSON.parse(serialized)) : defaultFrontendSettings(); }
    catch { return defaultFrontendSettings(); }
}

/** VBS has no PraK feedback capability, regardless of the saved CASTLE preference. */
export function isBayesianRefinementEnabled(settings: Pick<FrontendSettings, "frontendView" | "bayesianRefinementEnabled">): boolean {
    return settings.frontendView === "CASTLE" && settings.bayesianRefinementEnabled;
}
