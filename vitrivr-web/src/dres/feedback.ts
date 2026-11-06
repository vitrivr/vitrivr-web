import type {SuccessfulSubmissionsStatus} from "./generated/api/api.ts";

export type Notice = {message: string; kind: "success" | "error" | "pending"; title?: string};
export const noticeEvent = "vitrivr:dres-feedback";

export function notifyDres(message: string, kind: Notice["kind"] = "error") {
    window.dispatchEvent(new CustomEvent<Notice>(noticeEvent, {detail: {message, kind}}));
}

export function submissionNotice(response: SuccessfulSubmissionsStatus): Notice {
    if (!response.status) return {title: "Submission failed", message: response.description || "DRES did not accept the answer.", kind: "error"};
    switch (response.submission) {
        case "CORRECT": return {title: "Correct answer", message: response.description || "DRES marked your answer as correct.", kind: "success"};
        case "WRONG": return {title: "Incorrect answer", message: response.description || "DRES marked your answer as incorrect.", kind: "error"};
        case "INDETERMINATE": return {title: "Awaiting judgement", message: response.description || "Answer received. DRES has not determined its correctness yet.", kind: "pending"};
        case "UNDECIDABLE": return {title: "Unable to judge answer", message: response.description || "Answer received, but DRES could not determine its correctness.", kind: "pending"};
        default: return {title: "Answer received", message: response.description || "DRES returned no recognised correctness verdict.", kind: "pending"};
    }
}

export function notifyDresSubmission(response: SuccessfulSubmissionsStatus) {
    window.dispatchEvent(new CustomEvent<Notice>(noticeEvent, {detail: submissionNotice(response)}));
}
