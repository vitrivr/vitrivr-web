"use client";

import {useEffect, useState} from "react";
import {fetchSchemas} from "../lib/vitrivr.ts";

type SchemaSelectorProps = {
    value: string;
    onChange: (schema: string) => void;
};

export default function SchemaSelector({value, onChange}: SchemaSelectorProps) {
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
                const message = err instanceof Error ? err.message : String(err);
                setError(message);
                console.error("Failed to fetch schemas:", err);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const next = e.target.value;
        onChange(next);

        try {
            window.localStorage.setItem("vitrivr_schema", next);
        } catch {
            // ignore
        }
    };


    if (loading) {
        return <span style={{fontSize: 12, color: "#666"}}>Loading schemas…</span>;
    }

    if (error) {
        return (
            <span style={{fontSize: 12, color: "crimson"}}>
        Error loading schemas: {error}
      </span>
        );
    }

    if (!schemas.length) {
        return <span style={{fontSize: 12, color: "#666"}}>No schemas available</span>;
    }


    return (
        <label
            style={{
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
            }}
        >
            <span>Schema:</span>
            <select
                value={value}
                onChange={handleChange}
                style={{
                    fontSize: 13,
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: "1px solid #ddd",
                    background: "#fff",
                }}
            >
                {schemas.map((name) => (
                    <option key={name} value={name}>
                        {name}
                    </option>
                ))}
            </select>
        </label>
    );
}
