/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { IngestStatus } from '../models/IngestStatus';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class IngestService {
    public readonly httpRequest: BaseHttpRequest;

    constructor(httpRequest: BaseHttpRequest) {
        this.httpRequest = httpRequest;
    }
    /**
     * Indexes an item, adding it to the defined schema.
     * @param schema The name of the schema to execute a query for.
     * @returns IngestStatus OK
     * @throws ApiError
     */
    public postExecuteIngest(
        schema: string,
    ): CancelablePromise<IngestStatus> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/{schema}/index',
            path: {
                'schema': schema,
            },
            errors: {
                400: `Bad Request`,
            },
        });
    }
    /**
     * Queries the status of a given ingest job.
     * @param schema The name of the schema to execute a query for.
     * @param jobId The id of the job to query the status for.
     * @returns IngestStatus OK
     * @throws ApiError
     */
    public getIngestStatus(
        schema: string,
        jobId: string,
    ): CancelablePromise<IngestStatus> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/{schema}/index/{jobId}',
            path: {
                'schema': schema,
                'jobId': jobId,
            },
            errors: {
                400: `Bad Request`,
            },
        });
    }
}
