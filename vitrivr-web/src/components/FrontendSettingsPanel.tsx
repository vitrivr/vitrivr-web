import {useState, type FormEvent} from "react";
import {defaultFrontendSettings, normalizeFrontendSettings, type FrontendSettings} from "../config/frontendSettings.ts";
import {queryTypeOptions} from "../config/queryModalities.ts";
import {useFrontendSettings} from "../state/FrontendSettingsContext.tsx";
import {useSearch} from "../state/SearchContext.tsx";
import {activeQueryFilters, enabledResourceFilters} from "../lib/queryFilters.ts";
import {selectedPersonNames} from "../lib/personQuery.ts";
import "./FrontendSettingsPanel.css";

type Choice = {value: string; label: string};
const resourceOptions: Choice[] = [{value: "day", label: "Day"}, {value: "sourceType", label: "Camera type"}, {value: "source", label: "Recording source"}];
const listOptions = [
    {key: "personNames", label: "Recognized people"},
    {key: "recordingDays", label: "Recording days"},
    {key: "sourcePersons", label: "Person cameras"},
    {key: "sourceLocations", label: "Room cameras"},
] as const;
const numericOptions = [
    {key: "similarityThreshold", label: "Similarity threshold", min: 0, max: 1, step: "any"},
    {key: "timeWindowSeconds", label: "Time window (seconds)", min: 0, step: "any"},
    {key: "candidateLimit", label: "Candidate limit", min: 1, step: "1"},
    {key: "limit", label: "Deduplicated result limit", min: 1, step: "1"},
] as const;

function Choices({label, options, value, onChange}: {label: string; options: readonly Choice[]; value: string[]; onChange: (value: string[]) => void}) {
    const ordered = [...value.map(selected => options.find(option => option.value === selected)).filter((option): option is Choice => Boolean(option)),
        ...options.filter(option => !value.includes(option.value))];
    const move = (index: number, offset: number) => {
        const next = [...value];
        [next[index], next[index + offset]] = [next[index + offset], next[index]];
        onChange(next);
    };
    return <fieldset className="fs-choices">
        <legend>{label}</legend>
        {ordered.map(option => {
            const index = value.indexOf(option.value);
            return <div className="fs-choice" key={option.value}>
                <label><input type="checkbox" checked={index >= 0} onChange={event => onChange(event.target.checked ? [...value, option.value] : value.filter(item => item !== option.value))}/>{option.label}</label>
                {index >= 0 && <div className="fs-order">
                    <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${option.label} earlier`}>↑</button>
                    <button type="button" disabled={index === value.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${option.label} later`}>↓</button>
                </div>}
            </div>;
        })}
    </fieldset>;
}

export default function FrontendSettingsPanel({onClose}: {onClose: () => void}) {
    const {settings, saveSettings} = useFrontendSettings();
    const {setQueryFilters, setBlocks} = useSearch();
    const [base, setBase] = useState(settings);
    const [revision, setRevision] = useState(0);
    const [queryTypes, setQueryTypes] = useState(settings.enabledQueryTypes);
    const [resourceFilters, setResourceFilters] = useState(settings.enabledResourceFilters);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const save = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const draft: FrontendSettings = {...base, bayesianRefinementEnabled: data.has("bayesianRefinementEnabled"), enabledQueryTypes: queryTypes, enabledResourceFilters: resourceFilters,
            visualDeduplication: {...base.visualDeduplication, enabled: data.has("dedupEnabled"), field: String(data.get("dedupField") ?? "")}};
        for (const {key} of listOptions) draft[key] = String(data.get(key) ?? "").split(/[\n,]/).map(value => value.trim()).filter(Boolean);
        for (const {key} of numericOptions) draft.visualDeduplication[key] = Number(data.get(key));
        try {
            const next = normalizeFrontendSettings(draft);
            const persisted = saveSettings(next);
            setQueryFilters(previous => {
                const active = activeQueryFilters(previous, enabledResourceFilters(next.enabledResourceFilters));
                if (!next.recordingDays.includes(active.day)) active.day = "";
                const sources = active.sourceType === "person" ? next.sourcePersons : active.sourceType === "room" ? next.sourceLocations : [...next.sourcePersons, ...next.sourceLocations];
                if (!sources.includes(active.source)) active.source = "";
                return active;
            });
            setBlocks(previous => previous.map(block => ({...block,
                personNames: selectedPersonNames(block).filter(name => next.personNames.includes(name)),
                textQuery: !block.modalities && block.modality === "person" ? "" : block.textQuery})));
            setError("");
            if (persisted) onClose();
            else setNotice("Settings applied for this session. Browser storage is unavailable, so they cannot be saved for your next visit.");
        } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    };
    const restore = () => {
        const defaults = defaultFrontendSettings();
        setBase(defaults);
        setQueryTypes(defaults.enabledQueryTypes);
        setResourceFilters(defaults.enabledResourceFilters);
        setRevision(value => value + 1);
        setError("");
        setNotice("Project defaults loaded. Save changes to apply them.");
    };
    return <form key={revision} className="fs-form" onSubmit={save}>
        <p className="fs-note">Preferences are saved in this browser. The project JSON provides the defaults.</p>
        <div className="fs-grid">
            <Choices label="Query types" options={queryTypeOptions} value={queryTypes} onChange={setQueryTypes}/>
            <Choices label="Resource filters" options={resourceOptions} value={resourceFilters} onChange={setResourceFilters}/>
        </div>
        <p className="fs-note">Use the arrows to change display order. The first enabled query type is the default for new blocks.</p>
        <section className="fs-section" aria-label="Relevance feedback">
            <label className="fs-check"><input type="checkbox" name="bayesianRefinementEnabled" defaultChecked={base.bayesianRefinementEnabled}/>Enable Bayesian refinement</label>
            <p className="fs-note">Mark results as relevant and refine their ranking with PraK Bayes. Applies to new searches. Changing this setting clears the current feedback session.</p>
        </section>
        <details className="fs-section">
            <summary>People, days and cameras</summary>
            <p className="fs-note">One value per line, or separate values with commas. Keep spelling and case consistent with the backend.</p>
            <div className="fs-grid">
                {listOptions.map(({key, label}) => <label className="fs-field" key={key}>{label}
                    <textarea name={key} rows={4} defaultValue={base[key].join("\n")}/>
                </label>)}
            </div>
        </details>
        <details className="fs-section" open>
            <summary>Visual deduplication</summary>
            <label className="fs-check"><input type="checkbox" name="dedupEnabled" defaultChecked={base.visualDeduplication.enabled}/>Enable visual deduplication</label>
            <div className="fs-grid">
                <label className="fs-field">Comparison field<input name="dedupField" required defaultValue={base.visualDeduplication.field}/></label>
                {numericOptions.map(({key, label, min, step, ...constraints}) => <label className="fs-field" key={key}>{label}
                    <input type="number" name={key} required min={min} step={step} {...constraints} defaultValue={base.visualDeduplication[key]}/>
                </label>)}
            </div>
        </details>
        {error && <p className="fs-error" role="alert">{error}</p>}
        {notice && <p className="fs-note" role="status">{notice}</p>}
        <div className="fs-footer">
            <button type="button" className="btn" onClick={restore}>Restore JSON defaults</button>
            <div><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary">Save changes</button></div>
        </div>
    </form>;
}
