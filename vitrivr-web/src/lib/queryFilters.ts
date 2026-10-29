import {combineConditions, type FilterCondition} from "./booleanFilters.ts";
import settings from "../config/frontendSettings.json" with {type: "json"};

export type QueryFilters = {
    day: string;
    source: string;
    sourceType: "" | "person" | "room";
};

export type ResourceFilter = keyof QueryFilters;

export function enabledResourceFilters(configured: readonly string[] = settings.enabledResourceFilters): ResourceFilter[] {
    return [...new Set(configured)].filter((key): key is ResourceFilter => key === "day" || key === "sourceType" || key === "source");
}

/** Hidden controls cannot retain active restrictions in outgoing searches. */
export function activeQueryFilters(filters: QueryFilters, enabled: readonly ResourceFilter[] = enabledResourceFilters()): QueryFilters {
    return {
        day: enabled.includes("day") ? filters.day : "",
        source: enabled.includes("source") ? filters.source : "",
        sourceType: enabled.includes("sourceType") ? filters.sourceType : "",
    };
}

export function emptyQueryFilters(): QueryFilters {
    return {day: "", source: "", sourceType: ""};
}

export function recordingScopeCondition(configuredFilters: QueryFilters, enabled: readonly ResourceFilter[] = enabledResourceFilters()): FilterCondition | undefined {
    const scope = activeQueryFilters(configuredFilters, enabled);
    const values = {...(scope.day ? {day: [scope.day]} : {}), ...(scope.source ? {source: [scope.source]} : {}), ...(scope.sourceType ? {source_type: [scope.sourceType]} : {})};
    return Object.keys(values).length ? {type: "recording", values} : undefined;
}

/** Attach global recording constraints to every retrieval, without legacy filter.* parameters. */
export function applyQueryFilters<T extends {operations: Record<string, unknown>}>(query: T, configuredFilters: QueryFilters, enabled: readonly ResourceFilter[] = enabledResourceFilters()): T {
    const scope = activeQueryFilters(configuredFilters, enabled);
    const globalValues = {...(scope.day ? {day: [scope.day]} : {}), ...(scope.source ? {source: [scope.source]} : {}), ...(scope.sourceType ? {source_type: [scope.sourceType]} : {})};
    let changed = false;
    const operations = Object.fromEntries(Object.entries(query.operations).map(([name, operation]) => {
        if (!operation || typeof operation !== "object" || !(("field" in operation && typeof operation.field === "string") || ("factory" in operation && operation.factory === "FilteredRetrieval"))) return [name, operation];
        const previous = "parameters" in operation && operation.parameters && typeof operation.parameters === "object" ? operation.parameters as Record<string, string> : {};
        const keys = ["filter.day", "filter.source", "filter.source_type", "filter.persons", "filter.personMode", "filter.identityField", "filter.personMinConfidence", "filter.ocr", "filter.asr"];
        if (!Object.keys(globalValues).length && !keys.some(key => key in previous)) return [name, operation];
        changed = true;
        const legacy: FilterCondition[] = [];
        const values = Object.fromEntries(["day", "source", "source_type"].flatMap(key => previous[`filter.${key}`] ? [[key, previous[`filter.${key}`].split(",").map(value => value.trim()).filter(Boolean)]] : []));
        if (Object.keys(values).length) legacy.push({type: "recording", values});
        if (previous["filter.persons"]) legacy.push({type: "persons", names: previous["filter.persons"].split(","), field: previous["filter.identityField"] || "yoloadafacetwopass", mode: previous["filter.personMode"] === "any" ? "any" : "all", ...(previous["filter.personMinConfidence"] ? {minConfidence: Number(previous["filter.personMinConfidence"])} : {})});
        for (const field of ["ocr", "asr"]) if (previous[`filter.${field}`]) legacy.push({type: "text", field, text: previous[`filter.${field}`]});
        const filter = combineConditions("all", ["filter" in operation ? operation.filter as FilterCondition : undefined, ...legacy,
            Object.keys(globalValues).length ? {type: "recording", values: globalValues} : undefined]);
        if (!filter && !Object.keys(previous).some(key => key.startsWith("filter."))) return [name, operation];
        const parameters = Object.fromEntries(Object.entries(previous).filter(([key]) => !["filter.day", "filter.source", "filter.source_type", "filter.persons", "filter.personMode", "filter.identityField", "filter.personMinConfidence", "filter.ocr", "filter.asr"].includes(key)));
        return [name, {...operation, parameters, ...(filter ? {filter} : {})}];
    }));
    return changed ? {...query, operations} : query;
}
