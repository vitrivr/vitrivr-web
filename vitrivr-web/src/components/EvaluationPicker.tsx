/**
 * EvaluationPicker
 *
 * A modal dialog for selecting the active DRES evaluation/task.
 *
 * Features:
 * - Loads available evaluations for the current user
 * - Tries to fetch the current task for each evaluation
 * - Lets the user select one evaluation from a list
 * - Stores the selected evaluation in auth state
 * - Supports closing by button or backdrop click
 *
 * Props:
 * @param onClose - Optional callback fired when the dialog should close
 *
 * Behavior:
 * - Loads evaluations when the component mounts
 * - Shows loading and error states
 * - Preselects the saved evaluation, or the first available evaluation
 * - Clicking "Continue" saves the selected evaluation id
 * - Clicking outside the panel closes the dialog
 *
 * Dependencies:
 * - Uses `useAuth` for session access and `setEvaluationId`
 * - Uses the DRES evaluation client API to load evaluations and tasks
 *
 * Example:
 * <EvaluationPicker onClose={() => setOpen(false)} />
 */

"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import {useAuth} from "../state/AuthContext";
import {EvaluationClientApiFactory} from "../dres/generated/api";
import {dresAxios} from "../dres/generated/api/dresAxios";
import {dresErrorMessage} from "../dres/auth.ts";
import {loadEvaluationChoices, type EvaluationChoice} from "../dres/evaluations.ts";
import "./EvaluationPicker.css";

type EvaluationPickerProps = {
    onClose?: () => void;
};

export default function EvaluationPicker({onClose}: EvaluationPickerProps) {
    const {session, evaluationId, setEvaluationId, logout} = useAuth();
    const basePath = useMemo(() => (import.meta.env.VITE_DRES_BASE_URL ?? "").toString(), []);
    const api = useMemo(() => EvaluationClientApiFactory(undefined, basePath, dresAxios), [basePath]);

    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const panel = panelRef.current;
        panel?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && onClose) { event.preventDefault(); onClose(); }
            if (event.key !== "Tab" || !panel) return;
            const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel)) { event.preventDefault(); first?.focus(); }
        };
        panel?.addEventListener("keydown", onKeyDown);
        return () => { panel?.removeEventListener("keydown", onKeyDown); previous?.focus(); };
    }, [onClose]);

    const [rows, setRows] = useState<EvaluationChoice[]>([]);
    const [selected, setSelected] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        async function load() {
            if (!session) {
                setLoading(false);
                setErr("Sign in to DRES before selecting an evaluation.");
                return;
            }

            setLoading(true);
            setErr(null);
            setRows([]);
            setSelected("");

            try {
                await loadEvaluationChoices(api, session, controller.signal, display => {
                    setRows(display);
                    setSelected(display.find(row => row.id === evaluationId)?.id ?? display[0]?.id ?? "");
                    setLoading(false);
                }, (id, patch) => setRows(previous => previous.map(row => row.id === id ? {...row, ...patch} : row)));
            } catch (error) {
                if (!controller.signal.aborted) setErr(dresErrorMessage(error));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        load();
        return () => {
            controller.abort();
        };
    }, [api, session, evaluationId, attempt]);

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
            <div className="ep-panel" ref={panelRef} tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}>
                <div className="ep-titleRow">
                    <div className="ep-title">Select DRES evaluation</div>
                    {onClose && (
                        <button className="ep-close" type="button" aria-label="Close" onClick={onClose}>
                            ×
                        </button>
                    )}
                </div>

                <div className="ep-subtitle">Choose where your answers will be submitted.</div>

                {loading && <div className="ep-muted" role="status">Loading evaluations…</div>}
                {err && <div className="ep-error" role="alert">{err}</div>}

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
                                        {r.taskLoading ? "Loading task…" : r.taskName ? `Task: ${r.taskName}` : "Task: (not available)"}{" "}
                                        {r.taskType ? `• Type: ${r.taskType}` : ""}
                                    </div>
                                    <details className="ep-itemId"><summary>Evaluation ID</summary>{r.id}</details>
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                <div className="ep-actions">
                    {err && <button className="ep-btn" type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}
                    {!onClose && <button className="ep-btn" type="button" onClick={() => void logout()}>Sign out</button>}
                    <button className="ep-btn ep-btn--primary" type="button" disabled={loading || !selected} onClick={onContinue}>
                        Use evaluation
                    </button>
                </div>
            </div>
        </div>
    );
}
