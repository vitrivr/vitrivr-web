import type {RawAxiosRequestConfig} from "axios";
import {DRES_REQUEST_TIMEOUT_MS} from "./auth.ts";

export type EvaluationChoice = {id: string; name: string; taskName?: string; taskType?: string; taskLoading: boolean};
type EvaluationApi = {
    getApiV2ClientEvaluationList(session?: string, options?: RawAxiosRequestConfig): PromiseLike<{data: {id?: string; name?: string}[]}>;
    getApiV2ClientEvaluationCurrentTaskByEvaluationId(id: string, session?: string, options?: RawAxiosRequestConfig): PromiseLike<{data: {name?: string; taskType?: string}}>;
};

/** Publish selectable evaluations first; optional task descriptions must not block sign-in. */
export async function loadEvaluationChoices(api: EvaluationApi, session: string, signal: AbortSignal,
    onList: (rows: EvaluationChoice[]) => void,
    onTask: (id: string, patch: Pick<EvaluationChoice, "taskName" | "taskType" | "taskLoading">) => void,
    concurrency = 3,
): Promise<void> {
    if (signal.aborted) return;
    const options = {signal, timeout: DRES_REQUEST_TIMEOUT_MS};
    const response = await api.getApiV2ClientEvaluationList(session, options);
    if (signal.aborted) return;
    if (!Array.isArray(response.data)) throw new Error("DRES returned an invalid evaluation list.");
    const rows: EvaluationChoice[] = response.data.flatMap(row =>
        typeof row.id === "string" && row.id && typeof row.name === "string" ? [{id: row.id, name: row.name, taskLoading: true}] : []);
    onList(rows);
    let next = 0;
    async function worker() {
        while (!signal.aborted) {
            const row = rows[next++];
            if (!row) return;
            try {
                const task = await api.getApiV2ClientEvaluationCurrentTaskByEvaluationId(row.id, session, options);
                if (!signal.aborted) onTask(row.id, {taskName: task.data?.name, taskType: task.data?.taskType, taskLoading: false});
            } catch {
                if (!signal.aborted) onTask(row.id, {taskLoading: false});
            }
        }
    }
    await Promise.all(Array.from({length: Math.min(Math.max(1, concurrency), rows.length)}, worker));
}
