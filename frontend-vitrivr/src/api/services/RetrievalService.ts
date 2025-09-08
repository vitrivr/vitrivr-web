/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InformationNeedDescription } from '../models/InformationNeedDescription';
import type { QueryResult } from '../models/QueryResult';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class RetrievalService {
    constructor(public readonly httpRequest: BaseHttpRequest) {}
    /**
     * Executes a query and returns the query's results.
     * @param schema The name of the schema to execute a query for.
     * @param requestBody
     * @returns QueryResult OK
     * @throws ApiError
     */
    public postExecuteQuery(
        schema: string,
        requestBody?: InformationNeedDescription,
    ): CancelablePromise<QueryResult> {
        return this.httpRequest.request({
            method: 'POST',
            url: '/api/{schema}/query',
            path: {
                'schema': schema,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `Bad Request`,
            },
        });
    }
}
