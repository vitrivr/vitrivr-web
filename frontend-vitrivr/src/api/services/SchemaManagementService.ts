/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SchemaList } from '../models/SchemaList';
import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';
export class SchemaManagementService {
    public readonly httpRequest: BaseHttpRequest;

    constructor(httpRequest: BaseHttpRequest) {
        this.httpRequest = httpRequest;
    }
    /**
     * Lists the names of all available schemas.
     * @returns SchemaList OK
     * @throws ApiError
     */
    public getListSchemas(): CancelablePromise<SchemaList> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/schema/list',
            errors: {
                400: `Bad Request`,
            },
        });
    }
}
