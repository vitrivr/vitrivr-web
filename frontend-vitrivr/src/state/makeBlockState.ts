import {uuid} from "../utils/uuid";
import type {BlockState} from "../components/SearchCard";

export function makeBlockState(): BlockState {
    return {
        id: uuid(),
        modality: "clip",
        emotion: undefined,
        emotionTarget: "face",
        queryType: "text",
        textQuery: "",
        file: null,
    };
}
