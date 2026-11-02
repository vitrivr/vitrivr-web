import type {VlmRerankingSettings} from "../../lib/vlm.ts";
import {useFrontendSettings} from "../../state/FrontendSettingsContext.tsx";
import Input from "./Input.tsx";

type Props = {
    value: VlmRerankingSettings;
    onChange: (value: VlmRerankingSettings) => void;
    candidateCount: number;
};

export function VlmRerankingToggle({value, onChange}: Pick<Props, "value" | "onChange">) {
    return <label className="sc-dedupControl sc-vlmHeaderToggle">
        <span>VLM reranking</span>
        <input type="checkbox" role="switch" aria-label="VLM reranking" aria-controls="vlm-reranking-panel"
            className="sc-dedupSwitch" checked={value.enabled}
            onChange={event => onChange({...value, enabled: event.target.checked})}/>
    </label>;
}

export default function VlmReranking({value, onChange, candidateCount}: Props) {
    const {settings} = useFrontendSettings();
    return <div className="sc-vlmReranking" id="vlm-reranking-panel" hidden={!value.enabled}>
        <div className="sc-vlmHeading">
            <label htmlFor="vlm-reranking-prompt">Reranking prompt</label>
            <button className="sc-personClear" type="button" onClick={() => onChange({...value, enabled: false})}>Turn off</button>
        </div>
        <div className="sc-vlmPromptRow">
                <Input id="vlm-reranking-prompt" value={value.prompt} onChange={prompt => onChange({...value, prompt})}
                    placeholder="Describe what the candidate frames should show…"/>
            <div className="sc-vlmActions">
                <p className="sc-personHint" id="vlm-reranking-status">Top {Math.min(candidateCount, settings.vlmReranking.candidateLimit)} of {candidateCount} candidates</p>
                <button className="btn btn-primary" type="button" disabled aria-describedby="vlm-reranking-status">Rerank results</button>
            </div>
        </div>
    </div>;
}
