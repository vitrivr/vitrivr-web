const secretKey = /^(password|passwd|authorization|cookie|set-cookie|session|session[_-]?id|session[_-]?token|access[_-]?token|refresh[_-]?token|api[_-]?key|token|signature|sig|x-amz-(credential|security-token|signature))$/i;

export function safeUrl(value: string): string {
    try {
        const absolute = /^[a-z][a-z\d+.-]*:/i.test(value);
        const url = new URL(value, "https://logging.invalid");
        url.username = "";
        url.password = "";
        for (const key of [...url.searchParams.keys()]) if (secretKey.test(key)) url.searchParams.set(key, "[REDACTED]");
        if (url.hash.includes("=")) {
            const hash = new URLSearchParams(url.hash.slice(1));
            for (const key of [...hash.keys()]) if (secretKey.test(key)) hash.set(key, "[REDACTED]");
            url.hash = hash.toString();
        }
        return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
    } catch { return value; }
}

/** Snapshot complete JSON payloads; never keep live references or authentication secrets. */
export function sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
    if (value == null || typeof value === "boolean" || typeof value === "number") return value ?? null;
    if (typeof value === "string") return /^(https?:\/\/|blob:)/i.test(value) ? safeUrl(value) : value;
    if (typeof value === "bigint") return value.toString();
    if (typeof value !== "object") return String(value);
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    try {
        if (value instanceof Date) return value.toISOString();
        if (typeof File !== "undefined" && value instanceof File) return {name: value.name, size: value.size, type: value.type, lastModified: value.lastModified};
        if (typeof Blob !== "undefined" && value instanceof Blob) return {type: value.type, size: value.size};
        if (value instanceof Error) {
            const extra = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKey.test(key) ? "[REDACTED]" : sanitize(item, seen)]));
            return {name: value.name, message: value.message, stack: value.stack, ...extra};
        }
        if (Array.isArray(value)) return value.map(item => sanitize(item, seen));
        if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>);
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, secretKey.test(key) ? "[REDACTED]" : sanitize(item, seen)]));
    } finally { seen.delete(value); }
}
