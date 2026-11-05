import type {AxiosInstance, InternalAxiosRequestConfig} from "axios";
import {interactionLogger} from "../index.ts";
import {safeUrl} from "../sanitize.ts";

function authEndpoint(url: string) { return /\/(login|logout|user\/session)(?:[/?]|$)/i.test(url); }
function body(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
}

/** Observe DRES without modifying generated clients or retaining credentials/config objects. */
export function installDresLogging(client: AxiosInstance): () => void {
    const spans = new WeakMap<InternalAxiosRequestConfig, ReturnType<typeof interactionLogger.begin>>();
    const requestId = client.interceptors.request.use(config => {
        const url = config.url ?? "";
        const action = /\/submit\//i.test(url) ? "submission" : "api.dres";
        spans.set(config, interactionLogger.begin(action, {method: config.method, url: safeUrl(url),
            body: authEndpoint(url) ? "[Authentication payload omitted]" : body(config.data)}));
        return config;
    });
    const responseId = client.interceptors.response.use(response => {
        const url = response.config.url ?? "";
        spans.get(response.config)?.("response", {status: response.status,
            body: authEndpoint(url) ? "[Authentication response omitted]" : response.data});
        const observedEvaluation = url.match(/\/client\/evaluation\/currentTask\/([^/?]+)/i)?.[1];
        const activeEvaluation = interactionLogger.getContext().evaluationId;
        // The evaluation picker also inspects other evaluations; those responses
        // must never replace the task currently attributed to the operator.
        if (activeEvaluation && observedEvaluation === encodeURIComponent(activeEvaluation) && response.data && typeof response.data === "object") {
            const task = response.data as {taskId?: string; id?: string; name?: string};
            interactionLogger.setContext({taskId: task.taskId ?? task.id ?? null, taskName: task.name ?? null});
            interactionLogger.snapshot("task.observed", response.data);
        }
        return response;
    }, error => {
        const config = error?.config as InternalAxiosRequestConfig | undefined;
        if (config) spans.get(config)?.("error", {message: error?.message, status: error?.response?.status,
            body: authEndpoint(config.url ?? "") ? "[Authentication response omitted]" : error?.response?.data});
        return Promise.reject(error);
    });
    return () => { client.interceptors.request.eject(requestId); client.interceptors.response.eject(responseId); };
}
