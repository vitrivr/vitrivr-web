import {FetchHttpRequest} from "../../vitirvr/api/core/FetchHttpRequest.ts";
import type {ApiRequestOptions} from "../../vitirvr/api/core/ApiRequestOptions.ts";
import {interactionLogger} from "../index.ts";
import {editingPeriods} from "../editing.ts";

function requestKind(options: ApiRequestOptions): string {
    const operations = Object.values(options.body?.operations ?? {}) as {field?: string; factory?: string}[];
    if (operations.some(operation => operation?.field === "videoqa")) return "qa";
    if (operations.some(operation => operation?.factory === "PrakLocalFeedback")) return "query.feedback";
    if (operations.some(operation => operation?.field === "clip") && Object.values(options.body?.inputs ?? {}).some(input => (input as {type?: string} | null)?.type === "FLOATVECTOR")) return "query.similarity";
    if (options.body?.operations?.sources?.parameters?.retrievableType === "SOURCE:VIDEO") return "catalogue";
    return options.url.endsWith("/query") ? "query" : "api.engine";
}

/** Preserve the generated client's CancelablePromise and cancellation semantics. */
export class LoggedHttpRequest extends FetchHttpRequest {
    override request<T>(options: ApiRequestOptions) {
        const kind = requestKind(options);
        // Covers keyboard submissions too, even when focus stays in the text field.
        if (kind === "qa" || kind.startsWith("query")) editingPeriods.reset();
        const finish = interactionLogger.begin(kind, {method: options.method, server: this.config.BASE, endpoint: options.url, path: options.path, query: options.body});
        const request = super.request<T>(options);
        const cancel = request.cancel.bind(request);
        request.cancel = () => { finish("cancelled", null); cancel(); };
        void request.then(response => finish("response", response), error => finish("error", error));
        return request;
    }
}
