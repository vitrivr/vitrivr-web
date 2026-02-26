"use client";

import {useEffect, useMemo, useState} from "react";
import {useAuth} from "../state/AuthContext";
import {EvaluationClientApiFactory} from "../dres/generated/api";
import {dresAxios} from "../dres/generated/api/dresAxios";
import "./EvaluationPicker.css";

type EvalRow = {
    id: string;
    name: string;
    taskName?: string;
    taskType?: string;
};

type EvaluationPickerProps = {
    onClose?: () => void;
};

export default function EvaluationPicker({onClose}: EvaluationPickerProps) {
    const {session, setEvaluationId} = useAuth();
    const basePath = useMemo(() => (import.meta.env.VITE_DRES_BASE_URL ?? "").toString(), []);
    const api = useMemo(() => EvaluationClientApiFactory(undefined, basePath, dresAxios), [basePath]);

    const [rows, setRows] = useState<EvalRow[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!session) return;

            setLoading(true);
            setErr(null);

            try {
                const evaluationsResp = await api.getApiV2ClientEvaluationList(session);
                const evaluations = evaluationsResp.data ?? [];

                const display: EvalRow[] = [];

                for (const ev of evaluations) {
                    const id = (ev as any).id;
                    const name = (ev as any).name;
                    if (!id || !name) continue;

                    try {
                        const taskResp = await api.getApiV2ClientEvaluationCurrentTaskByEvaluationId(id, session);
                        const task = taskResp.data as any;
                        display.push({
                            id,
                            name,
                            taskName: task?.name,
                            taskType: task?.taskType,
                        });
                    } catch {
                        display.push({id, name});
                    }
                }

                if (!cancelled) {
                    setRows(display);
                    setSelected(display[0]?.id ?? "");
                }
            } catch (e: any) {
                if (!cancelled) setErr(e?.message ?? "Failed to load evaluations.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, [api, session]);

    const onContinue = () => {
        if (!selected) return;
        setEvaluationId(selected);
        onClose?.(); // <-- close modal after selection
    };

    return (
        <div
            className="ep-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label="Select evaluation"
            onMouseDown={(e) => {
                // close if user clicks the backdrop (not the panel)
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div className="ep-panel" onMouseDown={(e) => e.stopPropagation()}>
                <div className="ep-titleRow">
                    <div className="ep-title">Select evaluation / task</div>
                    {onClose && (
                        <button className="ep-close" type="button" aria-label="Close" onClick={onClose}>
                            ×
                        </button>
                    )}
                </div>

                <div className="ep-subtitle">Choose the active evaluation you want to submit to.</div>

                {loading && <div className="ep-muted">Loading…</div>}
                {err && <div className="ep-error">{err}</div>}

                {!loading && !err && rows.length === 0 && (
                    <div className="ep-error">No evaluations found for this user.</div>
                )}

                {!loading && !err && rows.length > 0 && (
                    <div className="ep-list">
                        {rows.map((r) => (
                            <label key={r.id} className="ep-item">
                                <input
                                    type="radio"
                                    name="evaluation"
                                    checked={selected === r.id}
                                    onChange={() => setSelected(r.id)}
                                />
                                <div className="ep-itemText">
                                    <div className="ep-itemName">{r.name}</div>
                                    <div className="ep-itemMeta">
                                        {r.taskName ? `Task: ${r.taskName}` : "Task: (not available)"}{" "}
                                        {r.taskType ? `• Type: ${r.taskType}` : ""}
                                    </div>
                                    <div className="ep-itemId">{r.id}</div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                <div className="ep-actions">
                    <button className="ep-btn" type="button" disabled={!selected} onClick={onContinue}>
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
