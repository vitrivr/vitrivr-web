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

/** Constrain every retrieval leaf, before backend limits and temporal/person aggregation. */
export function applyQueryFilters<T extends {operations: Record<string, unknown>}>(query: T, configuredFilters: QueryFilters, enabled: readonly ResourceFilter[] = enabledResourceFilters()): T {
    const filters = activeQueryFilters(configuredFilters, enabled);
    const parameters: Record<string, string> = {};
    if (filters.day) parameters["filter.day"] = filters.day;
    if (filters.source) parameters["filter.source"] = filters.source;
    if (filters.sourceType) parameters["filter.source_type"] = filters.sourceType;
    if (Object.keys(parameters).length === 0) return query;
    const operations = Object.fromEntries(Object.entries(query.operations).map(([name, operation]) => {
        if (!operation || typeof operation !== "object" || !("field" in operation) || typeof operation.field !== "string") {
            return [name, operation];
        }
        const previous = "parameters" in operation && operation.parameters && typeof operation.parameters === "object"
            ? operation.parameters : {};
        return [name, {...operation, parameters: {...previous, ...parameters}}];
    }));
    return {...query, operations};
}
