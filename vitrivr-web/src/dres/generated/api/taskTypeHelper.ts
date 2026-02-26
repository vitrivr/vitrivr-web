import {EvaluationClientApiFactory} from "./api.ts";
import {dresAxios} from "./dresAxios.ts";

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
    //console.log("taskType", taskType);


    // Could be implemented more pretty, but oh well...
    if (t.includes("qa")) {
        return "text";
    }

    return "item";
}
