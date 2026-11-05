import axios, {type RawAxiosRequestConfig} from "axios";
import type {ApiUser, LoginRequest} from "./generated/api/api.ts";

export const DRES_REQUEST_TIMEOUT_MS = 15_000;
export const DRES_SIGN_IN_TIMEOUT_MS = 30_000;
export type DresLoginStage = "credentials" | "session";
export type DresLoginOptions = {signal?: AbortSignal; onStage?: (stage: DresLoginStage) => void; timeoutMs?: number};
type AuthenticationApi = {
    postApiV2Login(request: LoginRequest, options?: RawAxiosRequestConfig): PromiseLike<{data: ApiUser}>;
    getApiV2UserSession(session?: string, options?: RawAxiosRequestConfig): PromiseLike<{data: string}>;
};

export function dresErrorMessage(error: unknown, stage?: DresLoginStage): string {
    if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return "DRES did not respond in time. Check the configured DRES address and your network connection.";
        if (!error.response) return "Could not reach DRES. Check the server address, your network/VPN connection and browser access to the server.";
        if (stage === "session" && [401, 403].includes(error.response.status)) return "DRES accepted the sign-in, but the session could not be verified. Your browser may be blocking the DRES session cookie.";
        const body: unknown = error.response.data;
        if (body && typeof body === "object") for (const key of ["description", "message", "error"]) {
            const value = (body as Record<string, unknown>)[key];
            if (typeof value === "string" && value.trim()) return value;
        }
        if (error.response.status === 401) return stage === "credentials" ? "DRES rejected the username or password." : "The DRES session has expired. Please sign in again.";
        return `DRES returned HTTP ${error.response.status}. Please try again.`;
    }
    return error instanceof Error ? error.message : "DRES sign-in failed.";
}

function sessionToken(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() && !/[\s<>{}]/.test(value.trim()) && !["null", "undefined"].includes(value.trim()) ? value.trim() : undefined;
}

/** Prefer the login response token; only older DRES versions require a cookie lookup. */
export function authenticateDres(api: AuthenticationApi, credentials: LoginRequest, options: DresLoginOptions = {}): Promise<{user: ApiUser; session: string}> {
    if (options.signal?.aborted) return Promise.reject(new DOMException("Sign-in cancelled.", "AbortError"));
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        let stage: DresLoginStage = "credentials";
        let finished = false;
        const finish = (action: () => void) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            options.signal?.removeEventListener("abort", cancel);
            action();
        };
        const cancel = () => { finish(() => reject(new DOMException("Sign-in cancelled.", "AbortError"))); controller.abort(); };
        const timeoutMs = options.timeoutMs ?? DRES_SIGN_IN_TIMEOUT_MS;
        const timer = setTimeout(() => {
            finish(() => reject(new Error(`DRES did not respond while ${stage === "session" ? "checking the session" : "signing in"}. Check the configured DRES address and your network connection.`)));
            controller.abort();
        }, timeoutMs);
        options.signal?.addEventListener("abort", cancel, {once: true});
        const checkActive = () => { if (controller.signal.aborted) throw new DOMException("Sign-in cancelled.", "AbortError"); };
        const requestOptions = {signal: controller.signal, timeout: Math.min(DRES_REQUEST_TIMEOUT_MS, timeoutMs)};
        const run = async () => {
            checkActive();
            options.onStage?.(stage);
            const login = await api.postApiV2Login(credentials, requestOptions);
            checkActive();
            const user = login.data;
            if (!user || typeof user !== "object" || Array.isArray(user)) throw new Error("DRES returned an unexpected login response. Check the configured DRES server address.");
            let session = sessionToken(user.sessionId);
            if (!session) {
                stage = "session";
                options.onStage?.(stage);
                const response = await api.getApiV2UserSession(undefined, requestOptions);
                checkActive();
                session = sessionToken(response.data);
            }
            if (!session) throw new Error("DRES returned no valid session. Please check that your browser allows the DRES session cookie and try again.");
            return {user, session};
        };
        void run().then(result => finish(() => resolve(result)), error => finish(() => reject(new Error(dresErrorMessage(error, stage)))));
        if (options.signal?.aborted) cancel();
    });
}
