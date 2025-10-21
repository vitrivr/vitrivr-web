import {useEffect} from "react";
import Card from "../Card.tsx";
import Button from "./Button.tsx";
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
    onRemove: () => void;
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

    // keep text/file mutually exclusive based on queryType
    useEffect(() => {
        if (isTextQuery) {
            onChange({file: null});
        } else {
            onChange({textQuery: ""});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTextQuery]);

    return (
        <Card
            title="Query Building Block"
            actions={onRemove ? <Button label="Remove" onClick={onRemove}/> : null}
        >
            <div style={{padding: 16}}>
                <RadioGroup<Modality>
                    label="Modalities"
                    options={modalityOptions}
                    value={block.modality}
                    onChange={(v) => onChange({modality: v, emotion: undefined})}
                    orientation="horizontal"
                />
            </div>

            <div style={{padding: 16}}>
                {isCLIP ? (
                    <RadioGroup<QueryType>
                        label="Query Type"
                        options={queryTypeItems}
                        value={block.queryType}
                        onChange={(v) => onChange({queryType: v, textQuery: ""})}
                        orientation="horizontal"
                    />
                ) : null}
                {isEmotion ? (
                    <Dropdown
                        items={emotionItems}
                        value={block.emotion}
                        onChange={(v) => onChange({emotion: v})}
                        placeholder="Select an Emotion"
                        label="Emotion"
                    />
                ) : null}
            </div>

            <div style={{padding: 16}}>
                {isTextQuery || isEmotion ? (
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
        </Card>
    );
}