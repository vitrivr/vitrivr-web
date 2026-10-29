import {useEffect} from "react";
import RadioGroup, {type RadioOption} from "./RadioGroup.tsx";
import Dropdown, {type DropdownItem} from "./Dropdown.tsx";
import {DEFAULT_IDENTITY_FIELD, identityFieldOptions, type IdentityField} from "../../lib/personQuery.ts";
import {blockModalities, flattenBlock} from "../../lib/blockModalities.ts";
import PersonSelector from "./PersonSelector.tsx";
import Input from "./Input.tsx";
import type {BlockState} from "../SearchCard.tsx";

export type QueryBlockProps = {
    block: BlockState;
    onChange: (patch: Partial<BlockState>) => void;
    onRemove?: () => void;
    modalityOptions: RadioOption<BlockState["modality"]>[];
    queryTypeItems: RadioOption<BlockState["queryType"]>[];
    emotionItems: DropdownItem[];
    schema: string;
    localFeedback?: boolean;
};

export default function QueryBlock({block, onChange, onRemove, modalityOptions, queryTypeItems, emotionItems, schema, localFeedback = false}: QueryBlockProps) {
    const allowed = modalityOptions.filter(option => option.value !== "filter" &&
        (!['LHE', 'MVK'].includes(schema.toUpperCase()) || !['asr', 'emotions'].includes(option.value)));
    const modes = blockModalities(block).filter(mode => allowed.some(option => option.value === mode));
    useEffect(() => {
        if (!block.modalities) onChange(flattenBlock(block));
        else if (modes.length !== block.modalities.length) {
            const next = modes.length ? modes : allowed.slice(0, 1).map(option => option.value);
            onChange({modalities: next, modality: next.includes("clip") ? "clip" : next.includes("emotions") ? "emotions" : next[0] ?? "clip"});
        }
    });
    const isFederated = !localFeedback && modes.includes("prak");
    const toggle = (mode: BlockState["modality"]) => {
        const next = modes.includes(mode) ? modes.filter(value => value !== mode) : [...modes, mode];
        onChange({modalities: next, ...(mode === "prak" && !modes.includes(mode) ? {prakText: block.prakText ?? block.textQuery} : {}), modality: next.includes("clip") ? "clip" : next.includes("emotions") ? "emotions" : next[0] ?? "clip",
            ...(!next.includes("clip") ? {queryType: "text", file: null} : {})});
    };
    if (!allowed.length) return <p className="muted">No modalities are enabled for this schema. Update the frontend settings.</p>;
    return <div className="sc-queryBlock">
        {onRemove && <div className="sc-blockHeader"><span>Temporal block</span><button type="button" className="sc-removeBlock" onClick={onRemove}>Remove ×</button></div>}
        <fieldset className="rg rg--row sc-modalities"><legend className="rg__legend">Modalities</legend>
            {allowed.map(option => <label className="rg__option" key={option.value}>
                <input className="rg__input" type="checkbox" value={option.value} checked={modes.includes(option.value)} onChange={() => toggle(option.value)}/>
                <span className="rg__label">{option.label}</span>
            </label>)}
        </fieldset>
        <p className="sc-personHint">Select one or more modalities for this moment.</p>
        {!isFederated && !localFeedback && modes.filter(mode => ['ocr', 'asr', 'person'].includes(mode)).length > 1 && <label className="sc-flatField">Combine requirements
            <select value={block.conditionMode ?? "all"} onChange={event => onChange({conditionMode: event.target.value === "any" ? "any" : "all"})}>
                <option value="all">Match all</option><option value="any">Match any</option>
            </select>
        </label>}
        {(modes.includes("clip") || isFederated) && <div className="sc-flatField">
            {!isFederated && !localFeedback && queryTypeItems.length > 1 && <RadioGroup label="Query type" options={queryTypeItems} value={block.queryType} onChange={queryType => onChange({queryType, file: null})}/>}
            <label className="label" htmlFor={`scene-${block.id}`}>{isFederated ? "Visual description (PraK)" : "Scene description"}</label>
            {!isFederated && !localFeedback && block.queryType === "image" ? <Input type="image" onImageChange={file => onChange({file})}/> : <Input type="text" id={`scene-${block.id}`} value={block.textQuery} onChange={textQuery => onChange({textQuery})} placeholder="Describe the scene…"/>}
        </div>}
        {localFeedback && modes.includes("prak") && <div className="sc-flatField">
            <label className="label" htmlFor={`prak-${block.id}`}>PraK description</label>
            <Input type="text" id={`prak-${block.id}`} value={block.prakText ?? (!modes.includes("clip") ? block.textQuery : "")}
                onChange={prakText => onChange({prakText})} placeholder="Describe what PraK should retrieve…"/>
        </div>}
        {(["ocr", "asr"] as const).filter(field => modes.includes(field)).map(field => <div className="sc-flatField" key={field}>
            <label className="label" htmlFor={`${field}-${block.id}`}>{field === "ocr" ? "Visible text (OCR)" : "Spoken text (ASR)"}</label>
            <Input type="text" id={`${field}-${block.id}`} value={block[`${field}Text`] ?? ""} onChange={value => onChange({[`${field}Text`]: value})} placeholder={field === "ocr" ? "Text to find in the image…" : "Words to find in speech…"}/>
            {!isFederated && !localFeedback && <select aria-label={`${field.toUpperCase()} matching`} value={block[`${field}Match`] ?? "fulltext"} onChange={event => onChange({[`${field}Match`]: event.target.value})}>
                <option value="fulltext">Full text</option><option value="contains">Contains (case-sensitive)</option><option value="exact">Exact (case-sensitive)</option>
            </select>}
        </div>)}
        {modes.includes("person") && <div className="sc-flatField">
            <span className="label">Recognised people</span>
            <PersonSelector value={block.personNames ?? []} showHint={!localFeedback || block.mustContainPerson} mode={block.personMode ?? "all"} onChange={personNames => onChange({personNames})}/>
            {localFeedback && <div className="sc-personRoles">
                <label><input type="checkbox" checked={block.personRanking !== false} onChange={event => onChange({personRanking: event.target.checked})}/>Use person matches for ranking</label>
                <label><input type="checkbox" checked={block.mustContainPerson ?? false} onChange={event => onChange({mustContainPerson: event.target.checked})}/>Must contain selected people</label>
                <p className="sc-personHint">Ranking adds person matches to the results. A mandatory condition restricts every retrieval source to the selected people.</p>
            </div>}
            <details className="sc-personOptions"><summary>Recognition options</summary>
                <label className="label">Recognition field<select value={block.identityField ?? DEFAULT_IDENTITY_FIELD} onChange={event => onChange({identityField: event.target.value as IdentityField})}>{identityFieldOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                {(!localFeedback || block.mustContainPerson) && <label className="label">{localFeedback ? "Required people match" : "People match"}<select value={block.personMode ?? "all"} onChange={event => onChange({personMode: event.target.value === "any" ? "any" : "all"})}><option value="all">All selected people</option><option value="any">Any selected person</option></select></label>}
                {(!localFeedback || block.mustContainPerson) && <><label className="sc-confidenceToggle"><input type="checkbox" checked={block.personMinConfidence !== undefined} onChange={event => onChange({personMinConfidence: event.target.checked ? 0 : undefined})}/>Minimum stored confidence</label>
                {block.personMinConfidence !== undefined && <input aria-label="Minimum stored confidence" type="number" min="0" max="1" step="any" value={block.personMinConfidence} onChange={event => onChange({personMinConfidence: event.target.value === "" ? undefined : Number(event.target.value)})}/>}
                </>}
            </details>
        </div>}
        {modes.includes("emotions") && <div className="sc-flatField">
            <Dropdown label="Emotion" items={emotionItems} value={block.emotion} onChange={emotion => onChange({emotion})} placeholder="Select an emotion"/>
            <RadioGroup label="Emotion target" options={[{value:"face", label:"Face"}, {value:"sound", label:"Sound"}, {value:"ocr", label:"OCR"}]} value={block.emotionTarget ?? "face"} onChange={emotionTarget => onChange({emotionTarget})}/>
        </div>}
        {!localFeedback && modes.includes("clip") && <p className="sc-personHint">CLIP ranks results matching your selected requirements.</p>}
        {isFederated && <p className="sc-personHint">PraK, OCR and ASR search independently and contribute to a fused ranking. Leave an input blank to skip that source. PraK fusion currently uses one block.</p>}
        {!localFeedback && !isFederated && !modes.includes("clip") && !modes.includes("emotions") && modes.length > 0 && <p className="sc-personHint">Matches are returned in ID order.</p>}
        {modes.includes("person") && modes.includes("asr") && <p className="sc-personHint">People and speech match the same segment; this does not identify the speaker.</p>}
    </div>;
}
