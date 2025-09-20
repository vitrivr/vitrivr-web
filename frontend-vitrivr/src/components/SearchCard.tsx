import Card from "./Card";
import Dropdown, {type DropdownItem} from "./QueryBuilderComponents/Dropdown.tsx";
import "./QueryBuilderComponents/Dropdown.css"
import "./QueryBuilderComponents/Button.tsx"
import React from "react";
import Button from "./QueryBuilderComponents/Button.tsx";
import Input from "./QueryBuilderComponents/Input.tsx";
import RadioGroup, {type RadioOption} from "./QueryBuilderComponents/RadioGroup.tsx";

export default function SearchCard() {
    const items: DropdownItem[] = [
        {value: "sad", label: "sad"},
        {value: "happy", label: "happy"},
        {value: "neutral", label: "neutral"}
    ];

    const [value, setValue] = React.useState<string | undefined>();

    const options: RadioOption[] = [
        {value: "clip", label: "CLIP"},
        {value: "emotions", label: "Emotions"},
        {value: "ocr", label: "OCR", disabled: false},
        {value: "asr", label: "ASR"},
    ];

    return (
        <div>
            <Card
                title="Query Building Block"
                actions={
                    <div>schema: <code>sandbox</code></div>
                }
            >
                <div style={{padding: 16}}>
                    <RadioGroup
                        label="Modalities"
                        options={options}
                        value={value}
                        onChange={setValue}
                        orientation="horizontal"
                    />
                </div>
                <div>
                    <Dropdown
                        items={items}
                        value={value}
                        onChange={(val) => setValue(val)}
                        placeholder="Select an Emotion"
                        label="Emotion"
                    />
                    <Button label="Search" onClick={() => alert("Searching for Query")}/>
                    <Input
                        type="text"
                    ></Input>
                </div>
            </Card>
        </div>
    );
}