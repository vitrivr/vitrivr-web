import {useFrontendSettings} from "../../state/FrontendSettingsContext.tsx";

export default function PersonSelector({value, onChange, mode = "all", optional = false, showHint = true}: {value: string[]; onChange: (names: string[]) => void; mode?: "all" | "any"; optional?: boolean; showHint?: boolean}) {
    const {settings} = useFrontendSettings();
    const names = [...new Set([...settings.personNames, ...value].map(name => name.trim()).filter(Boolean))];
    return (
        <div className="sc-personSelector">
            <details>
                <summary>{value.length ? value.join(", ") : optional ? "Any people" : "Select people"}</summary>
                <fieldset>
                    <legend>Recognized people</legend>
                    {names.map(name => <label key={name}>
                        <input type="checkbox" checked={value.includes(name)} onChange={event =>
                            onChange(event.target.checked ? [...value, name] : value.filter(selected => selected !== name))}/>
                        <span>{name}</span>
                    </label>)}
                    {names.length === 0 && <p>No person names configured.</p>}
                </fieldset>
            </details>
            {value.length > 0 && <button type="button" className="sc-personClear" onClick={() => onChange([])}>Clear selection</button>}
            {showHint && value.length > 0 && <p className="sc-personHint">{mode === "any" ? "Match any selected person." : "Match all selected people together."}</p>}
        </div>
    );
}
