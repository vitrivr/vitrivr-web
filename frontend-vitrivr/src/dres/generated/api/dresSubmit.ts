import {SubmissionApiFactory, type ApiClientSubmission} from "./api.ts";
import {dresAxios} from "./dresAxios";


const basePath = (import.meta.env.VITE_DRES_BASE_URL ?? "").toString();

const submissionApi = SubmissionApiFactory(undefined, basePath, dresAxios);

export async function submitText(params: { evaluationId: string; session: string; text: string }) {
    const payload: ApiClientSubmission = {
        answerSets: [{answers: [{text: params.text}]}],
    };
    return submissionApi.postApiV2SubmitByEvaluationId(params.evaluationId, payload, params.session);
}

export async function submitVideo(params: {
    evaluationId: string;
    session: string;
    mediaItemName: string;
    start?: number;
    end?: number
}) {
    const payload: ApiClientSubmission = {
        answerSets: [
            {
                answers: [
                    {
                        mediaItemName: params.mediaItemName,
                        start: params.start ?? null,
                        end: params.end ?? null,
                    },
                ],
            },
        ],
    };
    return submissionApi.postApiV2SubmitByEvaluationId(params.evaluationId, payload, params.session);
}

