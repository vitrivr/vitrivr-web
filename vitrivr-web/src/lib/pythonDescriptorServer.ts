export const DESCRIPTOR_SERVER = import.meta.env.VITE_PYTHON_DESCRIPTOR_SERVER;

export async function requestCLIPVector(base64Image: string): Promise<number[]> {
    if (!base64Image) {
        throw new Error("base64Image is required");
    }
    const formData = new FormData(); // this allows us to skip the header part.
    formData.append("data", base64Image);

    const response = await fetch(
        `${DESCRIPTOR_SERVER.replace(/\/$/, "")}/extract/clip_image`,
        {
            method: "POST",
            body: formData,
        }
    );
    if (!response.ok) {
        throw new Error("Could not find clip image: " + response.statusText + response.status);
    }
    const data: unknown = await response.json();

    if (!Array.isArray(data) || !data.every((value) => typeof value === "number" && Number.isFinite(value))) {
        throw new Error("Invalid CLIP vector.");
    }

    return data;
}