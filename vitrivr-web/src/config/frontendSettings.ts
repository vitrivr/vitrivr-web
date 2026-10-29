import jsonDefaults from "./frontendSettings.json" with {type: "json"};
import type {VisualDeduplicationSettings} from "../lib/visualDeduplication.ts";

export type FrontendSettings = {
    bayesianRefinementEnabled: boolean;
    enabledQueryTypes: string[];
    enabledResourceFilters: string[];
    personNames: string[];
    recordingDays: string[];
    sourcePersons: string[];
    sourceLocations: string[];
    visualDeduplication: VisualDeduplicationSettings;
};

export const SETTINGS_STORAGE_KEY = "vitrivr_frontend_settings_v1";

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Settings must be an object.");
    return value as Record<string, unknown>;
}

/** Validate saved/UI overrides while using the JSON file for missing defaults. */
export function normalizeFrontendSettings(value: unknown): FrontendSettings {
    const input = {...jsonDefaults, ...record(value)};
    const list = (key: keyof Omit<FrontendSettings, "visualDeduplication" | "bayesianRefinementEnabled">): string[] => {
        const values = input[key];
        if (!Array.isArray(values) || !values.every(item => typeof item === "string")) throw new Error(`${key} must contain text values.`);
        return [...new Set(values.map(item => item.trim()).filter(Boolean))];
    };
    if (typeof input.bayesianRefinementEnabled !== "boolean") throw new Error("Bayesian refinement must be enabled or disabled.");
    const enabledQueryTypes = list("enabledQueryTypes").filter(type => type !== "filter");
    if (enabledQueryTypes.some(type => !["clip", "emotions", "ocr", "asr", "person", "prak"].includes(type))) throw new Error("Unknown query type.");
    const enabledResourceFilters = list("enabledResourceFilters");
    if (enabledResourceFilters.some(type => !["day", "sourceType", "source"].includes(type))) throw new Error("Unknown resource filter.");
    const visual = {...jsonDefaults.visualDeduplication, ...record(input.visualDeduplication)};
    if (typeof visual.enabled !== "boolean" || typeof visual.field !== "string" || !visual.field.trim()) throw new Error("Deduplication needs an enabled flag and a comparison field.");
    if (!Number.isFinite(visual.similarityThreshold) || visual.similarityThreshold < 0 || visual.similarityThreshold > 1) throw new Error("Similarity threshold must be between 0 and 1.");
    if (!Number.isFinite(visual.timeWindowSeconds) || visual.timeWindowSeconds < 0) throw new Error("Time window must be zero or greater.");
    if (!Number.isInteger(visual.candidateLimit) || visual.candidateLimit < 1 || !Number.isInteger(visual.limit) || visual.limit < 1) throw new Error("Candidate and result limits must be positive whole numbers.");
    return {
        bayesianRefinementEnabled: input.bayesianRefinementEnabled,
        enabledQueryTypes, enabledResourceFilters,
        personNames: list("personNames"), recordingDays: list("recordingDays"),
        sourcePersons: list("sourcePersons"), sourceLocations: list("sourceLocations"),
        visualDeduplication: {...visual, field: visual.field.trim()},
    };
}

export function defaultFrontendSettings(): FrontendSettings {
    return normalizeFrontendSettings(jsonDefaults);
}

export function readFrontendSettings(serialized: string | null): FrontendSettings {
    try { return serialized ? normalizeFrontendSettings(JSON.parse(serialized)) : defaultFrontendSettings(); }
    catch { return defaultFrontendSettings(); }
}
