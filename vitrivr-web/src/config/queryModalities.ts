import settings from "./frontendSettings.json" with {type: "json"};

export const queryTypeOptions = [
    {value: "clip", label: "CLIP"},
    {value: "emotions", label: "Emotions"},
    {value: "ocr", label: "OCR"},
    {value: "asr", label: "ASR"},
    {value: "person", label: "Person"},
    {value: "prak", label: "PraK"},
] as const;

export type Modality = typeof queryTypeOptions[number]["value"] | "filter";

/** Configuration controls visibility and default order; schema restrictions still apply. */
export function enabledQueryModalities(schema = "", configured: readonly string[] = settings.enabledQueryTypes) {
    const restricted = ["LHE", "MVK"].includes(schema.toUpperCase());
    return [...new Set(configured)].flatMap(value => {
        const option = queryTypeOptions.find(option => option.value === value);
        if (!option || (option.value === "prak" && schema.toLowerCase() !== "castle") || (restricted && (value === "asr" || value === "emotions"))) return [];
        return [{...option}];
    });
}
