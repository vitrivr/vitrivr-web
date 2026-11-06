import {EvaluationClientApiFactory} from "./api.ts";
import {dresAxios} from "./dresAxios.ts";

import {submissionKindFromTask, type SubmissionKind, type SubmissionTask} from "../../taskKind.ts";
export type {SubmissionKind} from "../../taskKind.ts";

const BASE_URL = (import.meta.env.VITE_DRES_BASE_URL ?? "").toString();

const evalClient = EvaluationClientApiFactory(undefined, BASE_URL, dresAxios);

/**
 * Determines what kind of submission the current task expects.
 */
export async function getCurrentSubmissionKind(params: {
    evaluationId: string;
    session: string;
}): Promise<SubmissionKind> {
    return submissionKindFromTask(await getCurrentSubmissionTask(params));
}

export async function getCurrentSubmissionTask(params: {evaluationId: string; session: string}): Promise<SubmissionTask> {
    const resp = await evalClient.getApiV2ClientEvaluationCurrentTaskByEvaluationId(params.evaluationId, params.session);
    return resp.data;
}
