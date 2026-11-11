export type DresNaming = {prefix: string; pattern: string; extension: string};
export type DresNamingSettings = {CASTLE: DresNaming; VBS: DresNaming};

export function normalizeDresNaming(value: unknown, view: "CASTLE" | "VBS"): DresNaming {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DRES naming must be an object.");
    const {prefix, pattern, extension} = value as DresNaming;
    if (typeof prefix !== "string" || typeof pattern !== "string" || typeof extension !== "string") throw new Error("DRES prefix, pattern and extension must be text.");
    const allowed = view === "CASTLE" ? ["day", "camera", "hour", "stem"] : ["stem"];
    const cleaned = pattern.trim();
    if (!cleaned || !/\{[^{}]+\}/.test(cleaned)) throw new Error("DRES filename pattern must include a placeholder.");
    const remainder = cleaned.replace(/\{([^{}]+)\}/g, (_token, key: string) => {
        if (!allowed.includes(key)) throw new Error(`Unknown DRES placeholder {${key}} for ${view}.`);
        return "";
    });
    if (/[{}]/.test(remainder)) throw new Error("DRES filename pattern has unmatched braces.");
    const suffix = extension.trim().replace(/^\.+/, "");
    if (suffix && !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(suffix)) throw new Error("DRES extension must be empty or an extension such as mp4 or webm.mp4.");
    return {prefix: prefix.trim(), pattern: cleaned, extension: suffix};
}

export function formatDresName(naming: DresNaming, values: Record<string, string>): string {
    const filename = naming.pattern.replace(/\{([^{}]+)\}/g, (_token, key: string) => values[key]);
    return `${naming.prefix}${filename}${naming.extension ? `.${naming.extension}` : ""}`;
}
