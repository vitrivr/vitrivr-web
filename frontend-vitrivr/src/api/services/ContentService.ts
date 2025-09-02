/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class ContentService {
    public readonly httpRequest: BaseHttpRequest;

    constructor(httpRequest: BaseHttpRequest) {
        this.httpRequest = httpRequest;
    }
    /**
     * Fetch previously exported data.
     * @param schema The schema this operation is for.
     * @param exporter The exporter of the schema to use.
     * @param retrievableId The ID of the retrievable.
     * @returns any OK
     * @throws ApiError
     */
    public getPreview(
        schema: string,
        exporter: string,
        retrievableId: string,
    ): CancelablePromise<any> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/{schema}/fetch/{exporter}/{retrievableId}',
            path: {
                'schema': schema,
                'exporter': exporter,
                'retrievableId': retrievableId,
            },
            errors: {
                400: `Bad Request`,
            },
        });
    }
}
