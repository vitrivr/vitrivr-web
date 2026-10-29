import {blockModalities} from "./blockModalities.ts";
import {combineConditions, personCondition, type FilterCondition} from "./booleanFilters.ts";
import type {BlockState} from "../components/SearchCard.tsx";
import {selectedPersonNames, personFilterOptions} from "./personQuery.ts";

export function blockCondition(block: BlockState): FilterCondition | undefined {
    if (block.modalities) {
        const modes = blockModalities(block);
        return combineConditions(block.conditionMode ?? "all", [
            ...(["ocr", "asr"] as const).map(field => modes.includes(field) && block[`${field}Text`]?.trim()
                ? {type: "text" as const, field, text: block[`${field}Text`]!, match: block[`${field}Match`] ?? "fulltext"} : undefined),
            modes.includes("person") ? personCondition(block.personNames ?? [], personFilterOptions(block)) : undefined,
        ]);
    }
    const primary = (block.modality === "ocr" || block.modality === "asr") && block.textQuery.trim()
        ? {type: "text" as const, field: block.modality, text: block.textQuery, match: block.textMatch ?? "fulltext"} : undefined;
    const primaryCondition = primary && block.negatePrimary ? {type: "not" as const, condition: primary} : primary;
    const extra = block.conditions?.type === (block.conditionMode ?? "all") ? block.conditions.conditions : [block.conditions];
    return combineConditions(block.conditionMode ?? "all", [primaryCondition,
        personCondition(selectedPersonNames(block), personFilterOptions(block)), ...extra]);
}

export function booleanRetrieval(block: BlockState, limit = "1000", prefix = "", scope?: FilterCondition) {
    const key = (value: string) => prefix ? `${prefix}-${value}` : value;
    const filter = combineConditions("all", [blockCondition(block), scope]);
    if (blockModalities(block).includes("clip")) {
        if (!block.textQuery.trim()) throw new Error("Please enter a CLIP query.");
        return {inputs: {[key("sceneText")]: {type: "TEXT" as const, data: block.textQuery.trim()}},
            operations: {[key("scene")]: {field: "clip", inputs: {text: key("sceneText")}, parameters: {limit}, ...(filter ? {filter} : {})}}, output: key("scene")};
    }
    if (!filter) throw new Error("Please add at least one nonempty condition.");
    return {inputs: {}, operations: {[key("matches")]: {factory: "FilteredRetrieval", inputs: {}, parameters: {limit, ...(block.retrievableType?.trim() ? {retrievableType: block.retrievableType.trim()} : {})}, filter}}, output: key("matches")};
}

export function appendBooleanLookups<T extends {inputs: object; operations: Record<string, unknown>; output: string}>(query: T) {
    return {inputs: query.inputs, operations: {...query.operations,
        relations: {factory: "RelationExpander", inputs: {in: query.output}, parameters: {outgoing: "partOf"}},
        aggregator: {factory: "ScoreAggregator", inputs: {in: "relations"}},
        timelookup: {factory: "FieldLookup", inputs: {in: "aggregator"}, parameters: {field: "time", keys: "start, end"}},
        filelookup: {factory: "ObjectFieldLookup", inputs: {in: "timelookup"}, parameters: {field: "file", predicates: "partOf", keys: "path"}},
    }, output: "filelookup"};
}
