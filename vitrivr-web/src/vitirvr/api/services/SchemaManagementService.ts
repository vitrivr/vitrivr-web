/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type {SchemaList} from '../models/SchemaList.ts';
import type {CancelablePromise} from '../core/CancelablePromise.ts';
import type {BaseHttpRequest} from '../core/BaseHttpRequest.ts';

export class SchemaManagementService {
    // @ts-ignore
    constructor(public readonly httpRequest: BaseHttpRequest) {
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
