import {EvaluationClientApiFactory} from "./api.ts";
import {dresAxios} from "./dresAxios";

export type SubmissionKind =
    | "text"
    | "item"
    | "temporal"
    | "unknown";

const BASE_URL = (import.meta.env.VITE_DRES_BASE_URL ?? "").toString();

const evalClient = EvaluationClientApiFactory(undefined, BASE_URL, dresAxios);

/**
 * Determines what kind of submission the current task expects.
 */
export async function getCurrentSubmissionKind(params: {
    evaluationId: string;
    session: string;
}): Promise<SubmissionKind> {
    const {evaluationId, session} = params;

    const resp = await evalClient.getApiV2ClientEvaluationCurrentTaskByEvaluationId(
        evaluationId,
        session
    );

    const task = resp.data as any;
    if (!task) return "unknown";

    const taskType: string | undefined = task.taskType ?? task.type ?? task.name;

    if (!taskType) return "unknown";

    const t = taskType.toLowerCase();


    // Could be implemented more pretty, but oh well...
    if (t.includes("text") || t.includes("qa") || t.includes("answer")) {
        return "text";
    }

    if (t.includes("temporal") || t.includes("segment") || t.includes("range")) {
        return "temporal";
    }

    if (t.includes("item") || t.includes("video") || t.includes("image")) {
        return "item";
    }

    return "unknown";
}
