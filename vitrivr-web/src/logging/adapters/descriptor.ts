import {interactionLogger} from "../index.ts";

/** Keep image-query inputs and vector-extraction outcomes alongside engine requests. */
export async function loggedDescriptorFetch(url: string, options: RequestInit): Promise<Response> {
    const data = options.body instanceof FormData ? Object.fromEntries(options.body.entries()) : options.body;
    const finish = interactionLogger.begin("api.descriptor", {url, method: options.method, data});
    try {
        const response = await fetch(url, options);
        void response.clone().json().then(body => finish(response.ok ? "response" : "error", {status: response.status, body}),
            error => finish("error", {status: response.status, error}));
        return response;
    } catch (error) {
        finish(options.signal?.aborted ? "cancelled" : "error", error);
        throw error;
    }
}
