"use client";
import React, {useEffect, useRef} from "react";
import "./MediaTypeFilter.css"

export type MediaFilter = { image: boolean; video: boolean; custom: boolean };

export type MediaTypeFilterProps = {
    open: boolean;
    value: MediaFilter;
    counts?: { image: number; video: number; custom: number };
    onChange: (next: MediaFilter) => void;
    onClose: () => void;
    className?: string;
};

export default function MediaTypeFilter({
                                            open,
                                            value,
                                            counts = {image: 0, video: 0, custom: 0},
                                            onChange,
                                            onClose,
                                            className = "",
                                        }: MediaTypeFilterProps) {
    const popoverRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const onClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (popoverRef.current && !popoverRef.current.contains(t)) onClose();
        };
        window.addEventListener("mousedown", onClick);
        return () => window.removeEventListener("mousedown", onClick);
    }, [open, onClose]);

    const setKey = (k: keyof MediaFilter) => (e: React.ChangeEvent<HTMLInputElement>) =>
        onChange({...value, [k]: e.target.checked});

    const selectAll = () => onChange({image: true, video: true, custom: true});
    const clear = () => onChange({image: false, video: false, custom: false});

    if (!open) return null;

    return (
        <div
            ref={popoverRef}
            role="dialog"
            aria-label="Filter media types"
            className={`mtf__popover ${className}`}
            style={{
                position: "absolute",
                top: 44,
                right: 0,
                zIndex: 20,
                width: 240,
                background: "#fff",
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                padding: 12,
            }}
        >
            <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                <strong style={{fontSize: 14}}>Filter</strong>
                <button
                    onClick={onClose}
                    aria-label="Close filter"
                    style={{background: "transparent", border: 0, cursor: "pointer", fontSize: 18, lineHeight: 1}}
                >
                    ×
                </button>
            </div>

            <label className="mtf__row">
                <input type="checkbox" checked={value.image} onChange={setKey("image")}/>
                <span>Images ({counts.image})</span>
            </label>

            <label className="mtf__row">
                <input type="checkbox" checked={value.video} onChange={setKey("video")}/>
                <span>Videos ({counts.video})</span>
            </label>

            <label className="mtf__row">
                <input type="checkbox" checked={value.custom} onChange={setKey("custom")}/>
                <span>Other ({counts.custom})</span>
            </label>

            <div style={{display: "flex", gap: 8, marginTop: 10}}>
                <button onClick={selectAll} className="mtf__btn">Select all</button>
                <button onClick={clear} className="mtf__btn">Clear</button>
            </div>
        </div>
    );
}
