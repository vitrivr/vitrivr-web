import { useState } from "react";
import { retrieval } from "../api/client";
import {buildTextQuery} from "../lib/vitrivr.ts";

const SCHEMA = import.meta.env.VITE_VITRIVR_SCHEMA || "sandbox";

export default function SearchBar() {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [raw, setRaw] = useState<string>("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError(null);
        setRaw("");

        try {
            const body = buildTextQuery(query.trim());
            const resp = await retrieval.postExecuteQuery(SCHEMA, body); // it works, red nevertheless
            console.log(resp);
            setRaw(JSON.stringify(resp, null, 2)); // just show whatever comes back
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            console.log(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-2 space-y-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    placeholder="Search…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 border rounded px-3 py-2"
                />
                <button className="bg-blue-600 text-white rounded px-4 py-2" disabled={loading}>
                    {loading ? "Searching…" : "Search"}
                </button>
            </form>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            {raw && (
                <pre className="text-xs bg-neutral-100 border rounded p-3 overflow-auto max-h-80">
{raw}
        </pre>
            )}
        </div>
    );
}
