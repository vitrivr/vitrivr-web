import {enabledQueryModalities} from "../config/queryModalities.ts";
import {uuid} from "../utils/uuid";
import type {BlockState} from "../components/SearchCard";

export function makeBlockState(schema = "", configured?: readonly string[]): BlockState {
    return {
        id: uuid(),
        modality: enabledQueryModalities(schema, configured)[0]?.value ?? "clip",
        modalities: enabledQueryModalities(schema, configured).slice(0, 1).map(option => option.value),
        emotion: undefined,
        emotionTarget: "face",
        queryType: "text",
        textQuery: "",
        file: null,
    };
}
