/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BaseHttpRequest } from './core/BaseHttpRequest';
import type { OpenAPIConfig } from './core/OpenAPI';
import { FetchHttpRequest } from './core/FetchHttpRequest';
import { ContentService } from './services/ContentService';
import { IngestService } from './services/IngestService';
import { RetrievalService } from './services/RetrievalService';
import { SchemaManagementService } from './services/SchemaManagementService';
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest;
export class VitrivrApi {
    public readonly content: ContentService;
    public readonly ingest: IngestService;
    public readonly retrieval: RetrievalService;
    public readonly schemaManagement: SchemaManagementService;
    public readonly request: BaseHttpRequest;
    constructor(config?: Partial<OpenAPIConfig>, HttpRequest: HttpRequestConstructor = FetchHttpRequest) {
        this.request = new HttpRequest({
            BASE: config?.BASE ?? '',
            VERSION: config?.VERSION ?? '0.1.0',
            WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
            CREDENTIALS: config?.CREDENTIALS ?? 'include',
            TOKEN: config?.TOKEN,
            USERNAME: config?.USERNAME,
            PASSWORD: config?.PASSWORD,
            HEADERS: config?.HEADERS,
            ENCODE_PATH: config?.ENCODE_PATH,
        });
        this.content = new ContentService(this.request);
        this.ingest = new IngestService(this.request);
        this.retrieval = new RetrievalService(this.request);
        this.schemaManagement = new SchemaManagementService(this.request);
    }
}

