/**
 * SchemaSelector
 *
 * A small selector component for choosing the active vitrivr schema.
 *
 * Features:
 * - Loads available schemas from the backend
 * - Displays loading, error, and empty states
 * - Selects a fallback schema when the current value is invalid
 * - Persists the selected schema in localStorage
 *
 * Props:
 * @param value - Currently selected schema
 * @param onChange - Called when the selected schema changes
 *
 * Behavior:
 * - Fetches schemas when the component mounts
 * - If the current schema is missing or invalid, selects the first available schema
 * - Saves schema changes to `localStorage` under `vitrivr_schema`
 *
 * Dependencies:
 * - Uses `fetchSchemas` to load available schemas
 *
 * Example:
 * <SchemaSelector
 *   value={schema}
 *   onChange={setSchema}
 * />
 */

"use client";

import {useEffect, useState, type ReactNode} from "react";
import {fetchSchemas} from "../lib/vitrivr.ts";

type SchemaSelectorProps = {
    value: string;
    onChange: (schema: string) => void;
    renderControl?: (control: ReactNode) => ReactNode;
};

export default function SchemaSelector({value, onChange, renderControl}: SchemaSelectorProps) {
    const [schemas, setSchemas] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setLoading(true);
                setError(null);

                const result = await fetchSchemas();
                if (cancelled) return;

                setSchemas(result);
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (schemas.length === 0) return;

        const current = (value ?? "").trim();
        const valid = current && schemas.includes(current);

        if (!valid) {
            const next = schemas[0];
            onChange(next);
            try {
                window.localStorage.setItem("vitrivr_schema", next);
            } catch {
                //
            }
        }
    }, [schemas, value, onChange]);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        onChange(next);
        try {
            window.localStorage.setItem("vitrivr_schema", next);
        } catch {
            //
        }
    };

    const present = (control: ReactNode) => renderControl ? renderControl(control) : control;
    if (loading) return present(<span className="schema-status" role="status">Loading schemas…</span>);
    if (error) return present(<span className="schema-status schema-status--error" role="alert">Error loading schemas: {error}</span>);
    if (!schemas.length) return present(<span className="schema-status" role="status">No schemas available</span>);

    return present(
        <label style={{fontSize: 13, display: "flex", alignItems: "center", gap: 6}}>
            <select
                aria-label="Schema"
                value={(value && schemas.includes(value)) ? value : schemas[0]}
                onChange={handleChange}
                className="schema-select"
            >
                {schemas.map((name) => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </select>
        </label>
    );
}
