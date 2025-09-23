import {useMemo, useState} from "react";
import {retrieval} from "../api/client";
import {buildTextQuery} from "../lib/vitrivr";
import "./SearchBar.css";
import "./Card.css"
import ResultItem from "./Results/ResultItem.tsx";

const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA || "sandbox";

type MediaKind = "image" | "video" | "costum";
type MediaItem = { id: string; kind: MediaKind; rawType?: string; url?: string };
type RetrievablesResponse = {
    retrievables?: Array<{
        id?: string;
        type?: string;
        score?: number;
        parts?: unknown[];
        properties?: Record<string, unknown>
    }>;
};

function mapTypeToKind(t?: string): MediaKind {
    switch (t) {
        case "SOURCE:IMAGE":
            return "image";
        case "SEGMENT":
            return "video";
        default:
            return "costum";
    }
}

function mediaFrom(resp: RetrievablesResponse): MediaItem[] {
    const list = resp.retrievables ?? [];
    return list
        .map((r) => {
            const id = r.id?.trim();
            if (!id) return null;
            const filePath = (r as any).descriptors?.["file.path"];
            let url: string | undefined;
            if (filePath) {
                const relative = filePath.split("/sandbox/")[1];
                url = `/sandbox/${relative}`;
            }

            return {
                id,
                kind: mapTypeToKind(r.type),
                rawType: r.type,
                url,
            };
        })
        .filter((v): v is MediaItem => !!v);
}


export default function SearchBar() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [raw, setRaw] = useState<string>("");
    const [ids, setIds] = useState<string[]>([]);
    const [items, setItems] = useState<MediaItem[]>([]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setRaw("");
        setIds([]);

        try {
            const body = buildTextQuery(query.trim());
            const resp = await retrieval.postExecuteQuery(SCHEMA, body);
            setRaw(JSON.stringify(resp, null, 2));
            const media = mediaFrom(resp as RetrievablesResponse);
            setItems(media);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            // optional: console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const images = useMemo(() => items.filter(i => i.kind === "image").slice(0, 10), [items]);
    const videos = useMemo(() => items.filter(i => i.kind === "video").slice(0, 10), [items]);
    const others = useMemo(() => items.filter(i => i.kind === "costum").slice(0, 10), [items]);

    return (
        <div className="sb">
            <form onSubmit={handleSubmit} className="sb__form">
                <input
                    type="text"
                    placeholder="Search media…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="sb__input"
                />
                <button className="sb__button" disabled={loading}>
                    {loading ? "Searching…" : "Search"}
                </button>
            </form>

            {error && <div className="sb__error">{error}</div>}

            {videos.length > 0 && (
                <>
                    <h3 className="sb__sectionTitle">Videos</h3>
                    <div className="sb__results">
                        {videos.map(({id}) => (
                            <ResultItem key={id} id={id} kind="video"/>
                        ))}
                    </div>
                </>
            )}

            {images.length > 0 && (
                <>
                    <h3 className="sb__sectionTitle">Images</h3>
                    <div className="sb__results">
                        {images.map(({id, url}) => (
                            <ResultItem key={id} id={id} kind="image" getImageSrc={() => url ?? ""}/>
                        ))}
                    </div>
                </>
            )}

            {others.length > 0 && (
                <>
                    <h3 className="sb__sectionTitle">Other</h3>
                    <div className="sb__results">
                        {others.map(({id, rawType}) => (
                            <ResultItem
                                key={id}
                                id={id}
                                kind="custom"
                                renderMedia={() => (
                                    <div className="sb__unknown">
                                        <div className="sb__caption">Type: {rawType ?? "unknown"}</div>
                                    </div>
                                )}
                            />
                        ))}
                    </div>
                </>
            )}

            {raw && <pre className="sb__raw">{raw}</pre>}
        </div>
    );
}