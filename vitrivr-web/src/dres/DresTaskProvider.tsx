import {useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren} from "react";
import {useAuth} from "../state/AuthContext.tsx";
import {getCurrentSubmissionTask} from "./generated/api/taskTypeHelper.ts";
import {DresTaskContext} from "./TaskContext.ts";
import {requiresTextAnswer, submissionKindFromTask, taskFingerprint, type SubmissionKind} from "./taskKind.ts";

export default function DresTaskProvider({children}: PropsWithChildren) {
    const {session, evaluationId} = useAuth();
    const key = JSON.stringify([session, evaluationId]);
    const activeKey = useRef(key);
    activeKey.current = key;
    const [state, setState] = useState({key, kind: "unknown" as SubmissionKind});
    const corrections = useRef(new Set<string>());
    const currentTask = useRef<string | null>(null);
    const pending = useRef<{key: string; promise: Promise<SubmissionKind>} | null>(null);
    const refresh = useCallback((): Promise<SubmissionKind> => {
        if (!session || !evaluationId) return Promise.resolve("unknown");
        if (pending.current?.key === key) return pending.current.promise;
        const promise = getCurrentSubmissionTask({session, evaluationId}).then(task => {
            const fingerprint = JSON.stringify([key, taskFingerprint(task)]);
            const kind = corrections.current.has(fingerprint) ? "text" : submissionKindFromTask(task);
            if (activeKey.current === key) currentTask.current = fingerprint;
            if (activeKey.current === key) setState({key, kind});
            return kind;
        }, error => {
            if (activeKey.current === key) { currentTask.current = null; setState({key, kind: "unknown"}); }
            throw error;
        }).finally(() => {
            if (pending.current?.promise === promise) pending.current = null;
        });
        pending.current = {key, promise};
        return promise;
    }, [session, evaluationId, key]);
    useEffect(() => {
        const update = () => { void refresh().catch(() => { /* Submission shows actionable errors. */ }); };
        update();
        const timer = window.setInterval(update, 15000);
        window.addEventListener("focus", update);
        return () => { window.clearInterval(timer); window.removeEventListener("focus", update); };
    }, [refresh]);
    const reportSubmissionError = useCallback((error: unknown) => {
        if (activeKey.current !== key || !currentTask.current || !requiresTextAnswer(error)) return;
        corrections.current.add(currentTask.current);
        setState({key, kind: "text"});
    }, [key]);
    const kind = state.key === key ? state.kind : "unknown";
    const value = useMemo(() => ({kind, refresh, reportSubmissionError}), [kind, refresh, reportSubmissionError]);
    return <DresTaskContext.Provider value={value}>{children}</DresTaskContext.Provider>;
}
