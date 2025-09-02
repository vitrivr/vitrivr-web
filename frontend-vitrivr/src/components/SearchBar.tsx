import {useState} from "react";
import {retrieval} from "../api/client";
import {buildTextQuery} from "../lib/vitrivr";
import {videoUrl, thumbnailUrl} from "../lib/vitrivr";
import "./SearchBar.css";

const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA || "sandbox";

type Row = { object?: { id?: string }; id?: string; fields?: Record<string, unknown> };
type Resp = { results?: Row[]; data?: Row[] } | Row[] | { retrievables?: Array<{ id?: string }> };

function rowsFrom(resp: Resp): Row[] {
    if (Array.isArray(resp)) return resp;
    if ("results" in resp && Array.isArray(resp.results)) return resp.results;
    if ("data" in resp && Array.isArray(resp.data)) return resp.data;
    return [];
}

function idsFrom(resp: Resp): string[] {
    if ("retrievables" in resp && Array.isArray(resp.retrievables)) {
        return resp.retrievables
            .map((r) => r?.id)
            .filter((v): v is string => typeof v === "string");
    }
    return rowsFrom(resp)
        .map((r) => r.object?.id ?? r.id)
        .filter((v): v is string => typeof v === "string");
}

export default function SearchBar() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [raw, setRaw] = useState<string>("");
    const [ids, setIds] = useState<string[]>([]);

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
            setIds(idsFrom(resp as Resp));
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            // optional: console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="sb">
            <form onSubmit={handleSubmit} className="sb__form">
                <input
                    type="text"
                    placeholder="Search videos…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="sb__input"
                />
                <button className="sb__button" disabled={loading}>
                    {loading ? "Searching…" : "Search"}
                </button>
            </form>

            {error && <div className="sb__error">{error}</div>}

            {ids.length > 0 && (
                <div className="sb__results">
                    {ids.map((id) => (
                        <figure key={id} className="sb__card">
                            <video
                                controls
                                preload="metadata"
                                poster={thumbnailUrl(id)}
                                className="sb__video"
                                src={videoUrl(id)}
                            />
                            <figcaption className="sb__caption">{id}</figcaption>
                        </figure>
                    ))}
                </div>
            )}

            {raw && <pre className="sb__raw">{raw}</pre>}
        </div>
    );
}
