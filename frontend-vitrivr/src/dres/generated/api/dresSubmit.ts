import {SubmissionApiFactory, type ApiClientSubmission} from "./api.ts";
import {dresAxios} from "./dresAxios";


const basePath = (import.meta.env.VITE_DRES_BASE_URL ?? "").toString();

const submissionApi = SubmissionApiFactory(undefined, basePath, dresAxios);

export async function submitVideoAnswer(params: {
    session: string;
    evaluationId: string;
    mediaItemName: string;
    startMs?: number;
    endMs?: number;
}) {
    const {session, evaluationId, mediaItemName, startMs, endMs} = params;

    const payload: ApiClientSubmission = {
        answerSets: [{answers: [{mediaItemName, start: startMs ?? null, end: endMs ?? null}]}],
    };

    return submissionApi.postApiV2SubmitByEvaluationId(evaluationId, payload, session);
}

