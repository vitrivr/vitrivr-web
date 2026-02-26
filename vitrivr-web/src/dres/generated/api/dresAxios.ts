import axios from "axios";

export const dresAxios = axios.create({
    baseURL: (import.meta.env.VITE_DRES_BASE_URL ?? "").toString(),
    withCredentials: true, // IMPORTANT: allow cookie set by /api/v2/login
});
