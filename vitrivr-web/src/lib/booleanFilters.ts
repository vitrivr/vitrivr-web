export type FilterCondition =
    | {type: "all" | "any"; conditions: FilterCondition[]}
    | {type: "not"; condition: FilterCondition}
    | {type: "persons"; names: string[]; field?: string; mode?: "all" | "any"; minConfidence?: number}
    | {type: "recording"; values: {day?: string[]; source?: string[]; source_type?: string[]}; field?: string}
    | {type: "text"; field: string; text: string; match?: "fulltext" | "contains" | "exact"}
    | {type: "exists"; field: string};

export function textValues(values: readonly string[]): string[] {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

/** Prune unfinished controls, never send empty groups, and enforce backend tree bounds. */
export function cleanCondition(condition?: FilterCondition, depth = 1, budget = {nodes: 0}): FilterCondition | undefined {
    if (!condition) return undefined;
    if (++budget.nodes > 256 || depth > 32) throw new Error("Conditions support at most 256 nodes and 32 levels.");
    if (condition.type === "all" || condition.type === "any") {
        const conditions = condition.conditions.map(child => cleanCondition(child, depth + 1, budget)).filter((child): child is FilterCondition => Boolean(child));
        return conditions.length > 1 ? {type: condition.type, conditions} : conditions[0];
    }
    if (condition.type === "not") {
        const child = cleanCondition(condition.condition, depth + 1, budget);
        return child ? {type: "not", condition: child} : undefined;
    }
    if (condition.type === "persons") {
        const names = textValues(condition.names.map(name => name.normalize("NFC")));
        if (condition.mode && condition.mode !== "all" && condition.mode !== "any") throw new Error("Unknown person matching mode.");
        if (!names.length) return undefined;
        if (condition.minConfidence !== undefined && (!Number.isFinite(condition.minConfidence) || condition.minConfidence < 0 || condition.minConfidence > 1)) throw new Error("Person confidence must be between 0 and 1.");
        return {type: "persons", names, field: condition.field || "yoloadafacetwopass", mode: condition.mode ?? "all",
            ...(condition.minConfidence === undefined ? {} : {minConfidence: condition.minConfidence})};
    }
    if (condition.type === "recording") {
        const values = Object.fromEntries(Object.entries(condition.values).map(([key, items]) => [key, textValues(items ?? [])]).filter(([, items]) => items.length));
        return Object.keys(values).length ? {type: "recording", values, ...(condition.field ? {field: condition.field} : {})} : undefined;
    }
    if (condition.type === "text") {
        if (!condition.field.trim() || !condition.text.trim()) return undefined;
        if (condition.match && !["fulltext", "contains", "exact"].includes(condition.match)) throw new Error("Unknown text match mode.");
        // Literal modes preserve whitespace/case; they are not wildcard patterns.
        return {type: "text", field: condition.field.trim(), text: condition.text, ...(condition.match ? {match: condition.match} : {})};
    }
    if (condition.type === "exists") return condition.field.trim() ? {type: "exists", field: condition.field.trim()} : undefined;
    throw new Error("Unknown condition type.");
}

export function combineConditions(type: "all" | "any", conditions: (FilterCondition | undefined)[]): FilterCondition | undefined {
    const children = conditions.map(condition => cleanCondition(condition)).filter((condition): condition is FilterCondition => Boolean(condition));
    if (!children.length) return undefined;
    if (children.length === 1) return cleanCondition(children[0]);
    return cleanCondition({type, conditions: children});
}

export function personCondition(names: readonly string[], options: {identityField?: string; mode?: "all" | "any"; minConfidence?: number} = {}): FilterCondition | undefined {
    return cleanCondition({type: "persons", names: [...names], field: options.identityField ?? "yoloadafacetwopass", mode: options.mode ?? "all", minConfidence: options.minConfidence});
}
