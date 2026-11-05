import {RetrievalService} from "./services/RetrievalService.ts";
import {LoggedHttpRequest} from "../../logging/adapters/LoggedHttpRequest.ts";
import {OpenAPI, type OpenAPIConfig} from "./core/OpenAPI.ts";

export const API_BASE = import.meta.env.VITE_VITRIVR_BASE_URL;
const config: OpenAPIConfig = {
    ...OpenAPI, BASE: API_BASE, ENCODE_PATH: OpenAPI.ENCODE_PATH ?? ((p: string) =>
        encodeURI(p).replace(/%5B/g, "[").replace(/%5D/g, "]")),
};
const httpRequest = new LoggedHttpRequest(config);
export const retrieval = new RetrievalService(httpRequest);
