import settings from "../../config/frontendSettings.json" with {type: "json"};

export default function PersonSelector({value, onChange}: {value: string[]; onChange: (names: string[]) => void}) {
    const names = [...new Set([...settings.personNames, ...value].map(name => name.trim()).filter(Boolean))];
    return (
        <div className="sc-personSelector">
            <details>
                <summary>{value.length ? value.join(", ") : "Select people"}</summary>
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
            <p className="sc-personHint">Find segments containing all selected people.</p>
        </div>
    );
}
