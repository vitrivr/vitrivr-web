import {useEffect} from "react";
import RadioGroup, {type RadioOption} from "./RadioGroup.tsx";
import Dropdown, {type DropdownItem} from "./Dropdown.tsx";
import Input from "./Input.tsx";
//import FileUploader from "./FileUploader.tsx";
import type {BlockState} from "../SearchCard.tsx";

type QueryType = Extract<BlockState['queryType'], string>;
type Modality = Extract<BlockState["modality"], string>;
type EmotionTarget = "face" | "sound" | "ocr";

export type QueryBlockProps = {
    block: BlockState;
    onChange: (patch: Partial<BlockState>) => void;
    onRemove?: () => void;
    modalityOptions: RadioOption<Modality>[];
    queryTypeItems: RadioOption<QueryType>[];
    emotionItems: DropdownItem[];
    schema: string;
};

const emotionTargetItems =
    [
        {label: "Face", value: "face"},
        {label: "Sound", value: "sound"},
        {label: "OCR", value: "ocr"},
    ] as const satisfies RadioOption<EmotionTarget>[];

export default function QueryBlock({
                                       block,
                                       onChange,
                                       onRemove,
                                       modalityOptions,
                                       queryTypeItems,
                                       emotionItems,
                                       schema,
                                   }: QueryBlockProps) {
    const isEmotion = block.modality === "emotions";
    const isTextQuery = block.queryType === "text";
    const isCLIP = block.modality === "clip";
    const upperSchema = (schema ?? "").toUpperCase();
    const restrictAudioAndEmotion = upperSchema === "LHE" || upperSchema === "MVK";
    const isOcrOrAsr = block.modality === "ocr" || block.modality === "asr";
    const allowImageQueryType = isCLIP; // only CLIP supports image queries in your UI


    const allowedModalityOptions = restrictAudioAndEmotion
        ? modalityOptions.filter((o) => o.value !== "emotions" && o.value !== "asr")
        : modalityOptions;


    useEffect(() => {
        if (isTextQuery) onChange({file: null});
        else onChange({textQuery: ""});
    }, [isTextQuery]);

    useEffect(() => {
        if (isEmotion && !block.emotionTarget) {
            onChange({emotionTarget: "face"});
        }
        if (!isEmotion && block.emotionTarget) {
            onChange({emotionTarget: undefined});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEmotion]);

    useEffect(() => {
        if (restrictAudioAndEmotion && (block.modality === "emotions" || block.modality === "asr")) {
            onChange({
                modality: "clip",
                emotion: undefined,
                emotionTarget: undefined,
                queryType: "text",
                textQuery: "",
                file: null,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [restrictAudioAndEmotion]);

    useEffect(() => {
        if (isOcrOrAsr && block.queryType !== "text") {
            onChange({queryType: "text", file: null});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOcrOrAsr]);


    return (
        <div
            style={{
                position: "relative",
                background: "#ffffff",
                borderRadius: "20px",
                padding: "16px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                width: "100%",     // fill grid column
                minWidth: 0,       // allow shrinking inside grid
                height: "auto",    // grow with content
                // remove maxWidth/maxHeight
            }}
        >
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove block"
                    style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "1px solid #ccc",
                        background: "#fff",
                        cursor: "pointer",
                        fontSize: 18,
                        lineHeight: "24px",
                        textAlign: "center",
                        padding: 0,
                    }}
                >
                    ×
                </button>
            )}

            <div style={{marginBottom: 16}}>
                <RadioGroup
                    label="Modalities"
                    options={allowedModalityOptions}
                    value={block.modality}
                    onChange={(v) => {
                        const nextIsOcrOrAsr = v === "ocr" || v === "asr";

                        onChange({
                            modality: v,
                            emotion: undefined,
                            // if switching to OCR/ASR -> force text query
                            ...(nextIsOcrOrAsr ? {queryType: "text", file: null} : {}),
                        });
                    }}
                    orientation="horizontal"
                />
            </div>

            <div style={{marginBottom: 16}}>
                {isCLIP && (
                    <RadioGroup
                        label="Query Type"
                        options={queryTypeItems}
                        value={block.queryType}
                        onChange={(v) => {
                            // CLIP can do both text+image
                            if (v === "image") onChange({queryType: "image", textQuery: ""});
                            else onChange({queryType: "text", file: null});
                        }}
                        orientation="horizontal"
                    />
                )}

                {isEmotion && (
                    <>
                        <Dropdown
                            items={emotionItems}
                            value={block.emotion}
                            onChange={(v) => onChange({emotion: v})}
                            placeholder="Select an Emotion"
                            label="Emotion"
                        />

                        <div style={{marginTop: 12}}>
                            <RadioGroup
                                label="Emotion target"
                                options={emotionTargetItems as any}
                                value={(block.emotionTarget ?? "face") as any}
                                onChange={(v) => onChange({emotionTarget: v as EmotionTarget})}
                                orientation="horizontal"
                            />
                        </div>
                    </>
                )}

            </div>

            <div>
                {(isTextQuery || isEmotion) ? (
                    <Input
                        type="text"
                        value={block.textQuery}
                        onChange={(val: string) => onChange({textQuery: val})}
                        placeholder="Type your query…"
                    />
                ) : (
                    <Input
                        type="image"
                        onImageChange={(file) => onChange({file})}
                        className=""
                    />
                )}
            </div>
        </div>
    );
}

