type TextInput = {type: "TEXT"; data: string};

export function personSearchOperation(labelInput: string) {
    return {
        field: "yoloadafacetwopass",
        inputs: {label: labelInput},
        parameters: {limit: "1000"},
    };
}

export function selectedPersonNames(block: {personNames?: string[]; textQuery: string}): string[] {
    return [...new Set((block.personNames ?? [block.textQuery]).map(name => name.trim()).filter(Boolean))];
}

/** Intersect all selected identities before expanding matches to their video segments. */
export function buildPersonSearch(names: string | string[], prefix = "") {
    const people = [...new Set((typeof names === "string" ? [names] : names).map(name => name.trim()).filter(Boolean))];
    if (people.length === 0) throw new Error("Please select at least one person.");
    const key = (name: string) => prefix ? `${prefix}-${name}` : name;
    const inputs: Record<string, TextInput> = {};
    const operations: Record<string, unknown> = {};
    if (people.length === 1) {
        inputs[key("label")] = {type: "TEXT", data: people[0]};
        operations[key("face")] = personSearchOperation(key("label"));
        return {inputs, operations, output: key("face")};
    }
    people.forEach((name, index) => {
        inputs[key(`person${index + 1}`)] = {type: "TEXT", data: name};
        operations[key(`face${index + 1}`)] = personSearchOperation(key(`person${index + 1}`));
    });
    let output = key("face1");
    for (let index = 1; index < people.length; index++) {
        const conjunction = key(index === 1 ? "both" : `both${index + 1}`);
        operations[conjunction] = {factory: "And", inputs: {first: output, second: key(`face${index + 1}`)}};
        output = conjunction;
    }
    return {inputs, operations, output};
}

/** Complete person query, using the same lookup chain for one or several identities. */
export function buildPersonQuery(names: string | string[]) {
    const search = buildPersonSearch(names);
    return {
        inputs: search.inputs,
        operations: {
            ...search.operations,
            relations: {factory: "RelationExpander", inputs: {in: search.output}, parameters: {outgoing: "partOf"}},
            aggregator: {factory: "ScoreAggregator", inputs: {in: "relations"}},
            timelookup: {factory: "FieldLookup", inputs: {in: "aggregator"}, parameters: {field: "time", keys: "start, end"}},
            filelookup: {factory: "ObjectFieldLookup", inputs: {in: "timelookup"}, parameters: {field: "file", predicates: "partOf", keys: "path"}},
        },
        output: "filelookup",
    };
}
