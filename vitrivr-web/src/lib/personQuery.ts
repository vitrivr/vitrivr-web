import {personCondition} from "./booleanFilters.ts";
type TextInput = {type: "TEXT"; data: string};
export const DEFAULT_IDENTITY_FIELD = "yoloadafacetwopass";
export const identityFieldOptions = [
    {value: "adaface", label: "AdaFace"},
    {value: "yoloadafacetwopass", label: "YOLO AdaFace two-pass"},
    {value: "yoloadafacetwopassv2", label: "YOLO AdaFace two-pass v2"},
] as const;
export type IdentityField = typeof identityFieldOptions[number]["value"];
export type PersonFilterOptions = {identityField?: IdentityField; mode?: "all" | "any"; minConfidence?: number};

type PersonBlock = {
    modality?: string;
    personNames?: string[];
    textQuery: string;
    identityField?: IdentityField;
    personMode?: "all" | "any";
    personMinConfidence?: number;
};

function normalizeNames(names: string | readonly string[]): string[] {
    return [...new Set((typeof names === "string" ? [names] : names).map(name => name.trim()).filter(Boolean))];
}

export function selectedPersonNames(block: PersonBlock): string[] {
    // Legacy Person blocks stored one label in textQuery; CLIP text is never a label.
    return normalizeNames(block.personNames ?? (!block.modality || block.modality === "person" ? [block.textQuery] : []));
}

export function personFilterOptions(block: PersonBlock): PersonFilterOptions {
    return {identityField: block.identityField, mode: block.personMode, minConfidence: block.personMinConfidence};
}

/** Eligibility is applied by the retrieval field before its candidate limit. */
export function personSearchOperation(_labelInput: string, names: string | readonly string[] = [], options: PersonFilterOptions = {}) {
    const filter = personCondition(normalizeNames(names), options);
    if (!filter) throw new Error("Please select at least one person.");
    return {factory: "FilteredRetrieval", inputs: {}, parameters: {limit: "1000"}, filter};
}

export function buildPersonSearch(names: string | readonly string[], prefix = "", options: PersonFilterOptions = {}) {
    const operation = prefix ? `${prefix}-matches` : "matches";
    return {inputs: {} as Record<string, TextInput>, operations: {[operation]: personSearchOperation("", names, options)}, output: operation};
}

export function buildPersonQuery(names: string | readonly string[], options: PersonFilterOptions = {}) {
    const search = buildPersonSearch(names, "", options);
    return {inputs: search.inputs, operations: {...search.operations,
        relations: {factory: "RelationExpander", inputs: {in: search.output}, parameters: {outgoing: "partOf"}},
        aggregator: {factory: "ScoreAggregator", inputs: {in: "relations"}},
        timelookup: {factory: "FieldLookup", inputs: {in: "aggregator"}, parameters: {field: "time", keys: "start, end"}},
        filelookup: {factory: "ObjectFieldLookup", inputs: {in: "timelookup"}, parameters: {field: "file", predicates: "partOf", keys: "path"}},
    }, output: "filelookup"};
}
