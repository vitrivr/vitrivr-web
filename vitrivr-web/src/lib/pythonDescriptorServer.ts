export const DESCRIPTOR_SERVER = import.meta.env.VITE_DESCRIPTOR_API_BASE
    ?? (import.meta.env.DEV ? "/descriptor-api" : import.meta.env.VITE_PYTHON_DESCRIPTOR_SERVER);

export async function requestCLIPVector(base64Image: string, signal?: AbortSignal): Promise<number[]> {
    if (!base64Image) {
        throw new Error("base64Image is required");
    }
    if (!DESCRIPTOR_SERVER) throw new Error("The image descriptor server is not configured.");
    const formData = new FormData(); // this allows us to skip the header part.
    formData.append("data", base64Image);

    const response = await fetch(
        `${DESCRIPTOR_SERVER.replace(/\/$/, "")}/extract/clip_image`,
        {
            method: "POST",
            body: formData,
            signal,
        }
    );
    if (!response.ok) {
        throw new Error(`Image vector extraction failed (HTTP ${response.status}).`);
    }
    const data: unknown = await response.json();

    if (!Array.isArray(data) || data.length === 0 || !data.every((value) => typeof value === "number" && Number.isFinite(value))) {
        throw new Error("Invalid CLIP vector.");
    }

    return data;
}