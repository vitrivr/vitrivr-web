/** Route configured media through a same-origin capture proxy; leave unrelated URLs alone. */
export function mediaCaptureUrl(url: string, mediaBase: string, proxyBase: string): string {
    if (!mediaBase || !proxyBase) return url;
    try {
        const source = new URL(url);
        const configured = new URL(mediaBase);
        const prefix = configured.pathname.replace(/\/$/, "");
        if (source.origin !== configured.origin || !source.pathname.startsWith(`${prefix}/`)) return url;
        return `${proxyBase.replace(/\/$/, "")}${source.pathname}${source.search}`;
    } catch {
        return url;
    }
}
