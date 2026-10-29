import type {BlockState} from "../components/SearchCard.tsx";

/** Explicit selections take precedence over legacy single-modality state. */
export function blockModalities(block: BlockState) {
    return block.modalities ?? [...(block.modality === "filter" ? [] : [block.modality]),
        ...(block.modality !== "person" && block.personNames?.length ? ["person" as const] : [])];
}

/** Migrate existing blocks once, removing the former hidden condition tree. */
export function flattenBlock(block: BlockState): Partial<BlockState> {
    return {
        modalities: blockModalities(block),
        prakText: block.prakText ?? (block.modality === "prak" ? block.textQuery : ""),
        ocrText: block.ocrText ?? (block.modality === "ocr" ? block.textQuery : ""),
        asrText: block.asrText ?? (block.modality === "asr" ? block.textQuery : ""),
        ocrMatch: block.ocrMatch ?? block.textMatch,
        asrMatch: block.asrMatch ?? block.textMatch,
        personNames: block.personNames ?? (block.modality === "person" && block.textQuery ? [block.textQuery] : []),
        textQuery: block.modality === "clip" || block.modality === "prak" || block.modality === "emotions" ? block.textQuery : "",
        conditions: undefined, negatePrimary: undefined, retrievableType: undefined,
    };
}
