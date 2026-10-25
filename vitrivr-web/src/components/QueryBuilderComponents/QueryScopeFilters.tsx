import {useEffect, useId, useRef} from "react";
import {useFrontendSettings} from "../../state/FrontendSettingsContext.tsx";
import {activeQueryFilters, enabledResourceFilters, emptyQueryFilters, type QueryFilters} from "../../lib/queryFilters.ts";

type Props = {
    value: QueryFilters;
    onChange: (filters: QueryFilters) => void;
    deduplication?: {enabled: boolean; onChange: (enabled: boolean) => void; disabled?: boolean; description: string};
};

export default function QueryScopeFilters({value: storedValue, onChange, deduplication}: Props) {
    const {settings} = useFrontendSettings();
    const id = useId();
    const menuRef = useRef<HTMLDetailsElement>(null);
    useEffect(() => {
        const closeOutside = (event: MouseEvent) => {
            const menu = menuRef.current;
            if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            const menu = menuRef.current;
            if (event.key === "Escape" && menu?.open) {
                menu.open = false;
                menu.querySelector<HTMLElement>("summary")?.focus();
            }
        };
        document.addEventListener("mousedown", closeOutside);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("mousedown", closeOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, []);
    const enabled = enabledResourceFilters(settings.enabledResourceFilters);
    const value = activeQueryFilters(storedValue, enabled);
    if (enabled.length === 0 && !deduplication) return null;
    const hasFilters = Boolean(value.day || value.source || value.sourceType);
    const cameraSummary = value.sourceType === "person" ? "Person cameras" : value.sourceType === "room" ? "Location cameras" : "All cameras";
    const activeCount = Number(Boolean(value.day)) + Number(Boolean(value.source || value.sourceType));
    const compactClass = `sc-scopeField${enabled.includes("day") && enabled.includes("sourceType") ? "" : " sc-scopeField--wide"}`;
    const controls = {
        day: <label className={compactClass} htmlFor={`${id}-day`} key="day">Day
            <select id={`${id}-day`} value={value.day} onChange={event => onChange({...value, day: event.target.value})}>
                <option value="">All days</option>
                {settings.recordingDays.map(day => <option key={day} value={day}>{day}</option>)}
            </select>
        </label>,
        sourceType: <label className={compactClass} htmlFor={`${id}-type`} key="sourceType">Camera type
            <select id={`${id}-type`} value={value.sourceType} onChange={event => {
                const sourceType = event.target.value === "person" ? "person" : event.target.value === "room" ? "room" : "";
                onChange({...value, sourceType, source: ""});
            }}>
                <option value="">All camera types</option>
                <option value="person">Person cameras</option>
                <option value="room">Location cameras</option>
            </select>
        </label>,
        source: <label className="sc-scopeField sc-scopeField--wide" htmlFor={`${id}-source`} key="source">Recording person / camera
            <select id={`${id}-source`} value={value.source} onChange={event => {
                const source = event.target.value;
                const sourceType = !enabled.includes("sourceType") ? "" : source ? settings.sourcePersons.includes(source) ? "person" : "room" : value.sourceType;
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
        </label>,
    };
    return (
        <div className="sc-searchRefinements">
            <div className="sc-refineToolbar">
                {enabled.length > 0 && <details className="sc-scopeMenu" ref={menuRef}>
                    <summary aria-label="Recording scope filters">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                            <path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--input-bg)"/><circle cx="15" cy="17" r="3" fill="var(--input-bg)"/>
                        </svg>
                        Scope
                        {activeCount > 0 && <span className="sc-scopeBadge" aria-label={`${activeCount} active filters`}>{activeCount}</span>}
                        <span className="sc-scopeChevron" aria-hidden="true">⌄</span>
                    </summary>
                    <div className="sc-scopePanel">
                        <div className="sc-scopePanelHead">
                            <strong>Recording scope</strong>
                            <button type="button" aria-label="Close recording scope" onClick={() => {
                                if (menuRef.current) {
                                    menuRef.current.open = false;
                                    menuRef.current.querySelector<HTMLElement>("summary")?.focus();
                                }
                            }}>×</button>
                        </div>
                        <div className="sc-scopeFields">
                            {enabled.map(key => controls[key])}
                            {hasFilters && <button type="button" className="sc-personClear" onClick={() => onChange(emptyQueryFilters())}>Clear filters</button>}
                        </div>
                    </div>
                </details>}
                {deduplication && <label className="sc-dedupControl" title={`Visual deduplication. ${deduplication.description} Applies on the next search.`}>
                    <span>Deduplication</span>
                    <input type="checkbox" role="switch" aria-label="Visual deduplication" className="sc-dedupSwitch"
                        checked={deduplication.enabled} disabled={deduplication.disabled}
                        onChange={event => deduplication.onChange(event.target.checked)}/>
                </label>}
            </div>
            {hasFilters && <div className="sc-scopeChips" role="group" aria-label="Active recording filters">
                {value.day && <button type="button" title={`Remove day filter: ${value.day}`} onClick={() => onChange({...value, day: ""})}>
                    <span>{value.day}</span><span aria-hidden="true">×</span>
                </button>}
                {(value.source || value.sourceType) && <button type="button" title={`Remove camera filter: ${value.source || cameraSummary}`}
                    onClick={() => onChange({...value, source: "", sourceType: ""})}>
                    <span>{value.source || cameraSummary}</span><span aria-hidden="true">×</span>
                </button>}
            </div>}
        </div>
    );
}
