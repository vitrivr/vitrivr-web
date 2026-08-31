/**
 * Converts file object into base64 data URL String.
 * @param file File to convert
 */
export function fileToBase64(file: File | null): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string") {
                resolve(result);
            } else {
                reject(new Error("Failed to convert file to base64"));
            }
        };

        reader.onerror = () => {
            reject(reader.error ?? new Error("FileReader error"));
        };

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        reader.readAsDataURL(file);
    });
}