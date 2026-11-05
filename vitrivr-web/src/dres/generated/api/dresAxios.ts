import axios from "axios";
import {installDresLogging} from "../../../logging/adapters/dres.ts";
import {DRES_REQUEST_TIMEOUT_MS} from "../../auth.ts";

export const dresAxios = axios.create({
    baseURL: (import.meta.env.VITE_DRES_BASE_URL ?? "").toString(),
    withCredentials: true, // IMPORTANT: allow cookie set by /api/v2/login
    timeout: DRES_REQUEST_TIMEOUT_MS,
});
installDresLogging(dresAxios);
