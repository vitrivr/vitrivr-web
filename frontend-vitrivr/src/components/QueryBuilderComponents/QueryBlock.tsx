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
                                   }: QueryBlockProps) {
    const isEmotion = block.modality === "emotions";
    const isTextQuery = block.queryType === "text";
    const isCLIP = block.modality === "clip";

    useEffect(() => {
        if (isTextQuery) {
            onChange({file: null});
        } else {
            onChange({textQuery: ""});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                    options={modalityOptions}
                    value={block.modality}
                    onChange={(v) => onChange({modality: v, emotion: undefined})}
                    orientation="horizontal"
                />
            </div>

            <div style={{marginBottom: 16}}>
                {isCLIP && (
                    <RadioGroup
                        label="Query Type"
                        options={queryTypeItems}
                        value={block.queryType}
                        onChange={(v) => onChange({queryType: v, textQuery: ""})}
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

