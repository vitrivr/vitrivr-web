import {useEffect} from "react";
import RadioGroup, {type RadioOption} from "./RadioGroup.tsx";
import Dropdown, {type DropdownItem} from "./Dropdown.tsx";
import Input from "./Input.tsx";
import FileUploader from "./FileUploader.tsx";
import type {BlockState} from "../SearchCard.tsx";

type QueryType = Extract<BlockState['queryType'], string>;
type Modality = Extract<BlockState["modality"], string>;

export type QueryBlockProps = {
    block: BlockState;
    onChange: (patch: Partial<BlockState>) => void;
    onRemove?: () => void;
    modalityOptions: RadioOption<Modality>[];
    queryTypeItems: RadioOption<QueryType>[];
    emotionItems: DropdownItem[];
};

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

    return (
        <div
            style={{
                position: "relative",
                background: "#ffffff",
                borderRadius: "20px",
                padding: "16px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                minWidth: 0,
                maxWidth: "300px",
                maxHeight: "210px",
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
                    <Dropdown
                        items={emotionItems}
                        value={block.emotion}
                        onChange={(v) => onChange({emotion: v})}
                        placeholder="Select an Emotion"
                        label="Emotion"
                    />
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
                    <FileUploader
                        file={block.file}
                        onChange={(f) => onChange({file: f})}
                        label="Upload an image"
                    />
                )}
            </div>
        </div>
    );
}

