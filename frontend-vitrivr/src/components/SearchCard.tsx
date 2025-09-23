"use client";
import Card from "./Card";
import Dropdown, {type DropdownItem} from "./QueryBuilderComponents/Dropdown.tsx";
import "./QueryBuilderComponents/Dropdown.css"
import "./QueryBuilderComponents/Button.tsx"
import React, {useCallback, useState} from "react";
import Button from "./QueryBuilderComponents/Button.tsx";
import Input from "./QueryBuilderComponents/Input.tsx";
import RadioGroup, {type RadioOption} from "./QueryBuilderComponents/RadioGroup.tsx";
import {buildTextQuery} from "../lib/vitrivr.ts";

const modalityOptions: RadioOption[] = [
    {value: "clip", label: "CLIP"},
    {value: "emotions", label: "Emotions"},
    {value: "ocr", label: "OCR"},
    {value: "asr", label: "ASR"},
];

const emotionItems: DropdownItem[] = [
    {value: "sad", label: "sad"},
    {value: "happy", label: "happy"},
    {value: "neutral", label: "neutral"},
];

export default function SearchCard() {
    const [modality, setModality] = useState<string>(modalityOptions[0].value);
    const [emotion, setEmotion] = useState<string | undefined>(undefined);
    const [textQuery, setTextQuery] = useState<string>("");

    const onSearch = async () => {
        buildTextQuery(textQuery)
        console.log({modality, emotion, textQuery});
    };

    return (
        <div>
            <Card
                title="Query Builder"
                actions={<div>schema: <code>sandbox</code></div>}
            >
                <div style={{
                    display: "flex",
                    gap: 16,
                    flexWrap: "wrap",
                    alignItems: "flex-start"
                }}>
                    <div style={{flex: "1 1 400px", minWidth: 320, minHeight: 0}}>
                        <Card title="Query Building Block">
                            <div style={{padding: 16}}>
                                <RadioGroup
                                    label="Modalities"
                                    options={modalityOptions}
                                    value={modality}
                                    onChange={setModality}
                                    orientation="horizontal"
                                />
                            </div>
                            <div style={{padding: 16}}>
                                <Dropdown
                                    items={emotionItems}
                                    value={emotion}
                                    onChange={setEmotion}
                                    placeholder="Select an Emotion"
                                    label="Emotion"
                                />
                            </div>
                            <div style={{padding: 16}}>
                                <Input
                                    type="text"
                                    value={textQuery}
                                    onChange={setTextQuery}
                                    placeholder="Type your query…"
                                />
                            </div>
                        </Card>
                    </div>
                </div>
                <div style={{padding: 16}}>
                    <Button label="Search" onClick={onSearch}/>
                </div>
            </Card>
        </div>
    );
}