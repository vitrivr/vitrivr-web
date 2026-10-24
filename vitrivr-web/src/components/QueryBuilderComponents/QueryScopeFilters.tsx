import {useId} from "react";
import settings from "../../config/frontendSettings.json";
import {emptyQueryFilters, type QueryFilters} from "../../lib/queryFilters.ts";

export default function QueryScopeFilters({value, onChange}: {value: QueryFilters; onChange: (filters: QueryFilters) => void}) {
    const id = useId();
    const hasFilters = Boolean(value.day || value.source || value.sourceType);
    const summary = [value.day || "All days", value.source || (value.sourceType === "person" ? "Person cameras" : value.sourceType === "room" ? "Location cameras" : "All cameras")].join(" · ");
    return (
        <details className="sc-scopeFilters">
            <summary><span>Search scope</span><span className="sc-scopeSummary">{summary}</span></summary>
            <div className="sc-scopeFields">
            <label className="sc-scopeField" htmlFor={`${id}-day`}>Day
            <select id={`${id}-day`} value={value.day} onChange={event => onChange({...value, day: event.target.value})}>
                <option value="">All days</option>
                {settings.recordingDays.map(day => <option key={day} value={day}>{day}</option>)}
            </select>
            </label>
            <label className="sc-scopeField" htmlFor={`${id}-type`}>Camera type
            <select id={`${id}-type`} value={value.sourceType} onChange={event => {
                const sourceType = event.target.value === "person" ? "person" : event.target.value === "room" ? "room" : "";
                onChange({...value, sourceType, source: ""});
            }}>
                <option value="">All camera types</option>
                <option value="person">Person cameras</option>
                <option value="room">Location cameras</option>
            </select>
            </label>
            <label className="sc-scopeField sc-scopeField--wide" htmlFor={`${id}-source`}>Recording person / camera
            <select id={`${id}-source`} value={value.source} onChange={event => {
                const source = event.target.value;
                const sourceType = source ? settings.sourcePersons.includes(source) ? "person" : "room" : value.sourceType;
                onChange({...value, source, sourceType});
            }}>
                <option value="">All recording sources</option>
                {value.sourceType !== "room" && <optgroup label="Person cameras">
                    {settings.sourcePersons.map(name => <option key={name} value={name}>{name}</option>)}
                </optgroup>}
                {value.sourceType !== "person" && <optgroup label="Location cameras">
                    {settings.sourceLocations.map(name => <option key={name} value={name}>{name}</option>)}
                </optgroup>}
            </select>
            </label>
            {hasFilters && <button type="button" className="sc-personClear" onClick={() => onChange(emptyQueryFilters())}>Clear scope filters</button>}
            </div>
        </details>
    );
}
