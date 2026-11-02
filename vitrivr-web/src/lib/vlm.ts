/** UI drafts only. Backend field names, model IDs and reranking APIs are not assigned yet. */
export const vlmModelOptions = [
    {value: "qwen3-vl-4b", label: "Qwen3-VL-4B-Instruct"},
    {value: "smolvlm2-2.2b", label: "SmolVLM2-2.2B-Instruct"},
    {value: "minicpm-v", label: "MiniCPM-V"},
    {value: "gemma3-12b", label: "Gemma 3 12B IT"},
] as const;

export type VlmRerankingSettings = {
    enabled: boolean;
    prompt: string;
};

export type VlmRerankingPreferences = {
    model: typeof vlmModelOptions[number]["value"];
    candidateLimit: number;
};

export function defaultVlmReranking(): VlmRerankingSettings {
    return {enabled: false, prompt: ""};
}
