import settings from "../config/frontendSettings.json" with {type: "json"};

export type VisualDeduplicationSettings = {
    enabled: boolean;
    field: string;
    similarityThreshold: number;
    timeWindowSeconds: number;
    candidateLimit: number;
    limit: number;
};

export const visualDeduplicationSettings: VisualDeduplicationSettings = settings.visualDeduplication;

type Query = {operations: Record<string, unknown>; output: string};

const lookupFactories = new Set(["RelationExpander", "ScoreAggregator", "FieldLookup", "ObjectFieldLookup"]);
const compositionFactories = new Set(["And", "WeightedScoreFusion", "TemporalSequenceAggregator", "ReciprocalRankFusion"]);

/** Find the complete matching stream, before the final metadata/relationship lookups. */
function matchingStream(query: Query): string | null {
    const visited = new Set<string>();
    let name = query.output;
    while (!visited.has(name)) {
        visited.add(name);
        const operation = query.operations[name];
        if (!operation || typeof operation !== "object") return null;
        if ("field" in operation && typeof operation.field === "string") return name;
        if (!("factory" in operation) || typeof operation.factory !== "string") return null;
        if (operation.factory === "FilteredRetrieval" || compositionFactories.has(operation.factory)) return name;
        if (!lookupFactories.has(operation.factory) || !("inputs" in operation) || !operation.inputs || typeof operation.inputs !== "object"
            || !("in" in operation.inputs) || typeof operation.inputs.in !== "string") return null;
        name = operation.inputs.in;
    }
    return null;
}

/** Compare all modalities visually, after their complete match conditions have been evaluated. */
export function applyVisualDeduplication<T extends Query>(query: T, enabled: boolean, config = visualDeduplicationSettings): T {
    if (!enabled) return query;
    if (!config.field.trim() || !Number.isFinite(config.similarityThreshold) || config.similarityThreshold < 0 || config.similarityThreshold > 1
        || !Number.isFinite(config.timeWindowSeconds) || config.timeWindowSeconds < 0
        || !Number.isInteger(config.candidateLimit) || config.candidateLimit < 1
        || !Number.isInteger(config.limit) || config.limit < 1) {
        throw new Error("Invalid visualDeduplication parameters in frontendSettings.json.");
    }
    const source = matchingStream(query);
    if (!source) return query;
    let unique = "unique";
    let suffix = 2;
    while (unique in query.operations) unique = `unique-${suffix++}`;
    // Zero-weight required inputs are complete eligibility sets, not ranked
    // candidate searches. Their limits must never be reduced by deduplication.
    const eligibilityInputs = new Set<string>();
    for (const operation of Object.values(query.operations)) {
        if (!operation || typeof operation !== "object" || !("factory" in operation) || operation.factory !== "ReciprocalRankFusion" || !("parameters" in operation) || !("inputs" in operation)) continue;
        const parameters = operation.parameters as Record<string, string>;
        const inputs = operation.inputs as Record<string, string>;
        for (const alias of (parameters.requiredInputs ?? "").split(",").map(value => value.trim()).filter(Boolean)) {
            if (parameters[`weight.${alias}`] === "0" && inputs[alias]) eligibilityInputs.add(inputs[alias]);
        }
    }
    const operations: Record<string, unknown> = {};
    for (const [name, operation] of Object.entries(query.operations)) {
        if (!eligibilityInputs.has(name) && operation && typeof operation === "object" && (("field" in operation && typeof operation.field === "string") || ("factory" in operation && operation.factory === "FilteredRetrieval"))) {
            const parameters = "parameters" in operation && typeof operation.parameters === "object" ? operation.parameters : {};
            operations[name] = {...operation, parameters: {...parameters, limit: String(config.candidateLimit)}};
        } else if (name !== source && operation && typeof operation === "object" && "inputs" in operation && operation.inputs && typeof operation.inputs === "object") {
            const inputs = Object.fromEntries(Object.entries(operation.inputs).map(([port, reference]) =>
                [port, reference === source ? unique : reference]));
            operations[name] = {...operation, inputs};
        } else {
            operations[name] = operation;
        }
        if (name === source) {
            operations[unique] = {
                factory: "VisualDeduplicator",
                inputs: {in: source},
                parameters: {
                    field: config.field,
                    similarityThreshold: String(config.similarityThreshold),
                    timeWindowSeconds: String(config.timeWindowSeconds),
                    limit: String(config.limit),
                },
            };
        }
    }
    return {...query, operations, output: query.output === source ? unique : query.output};
}
