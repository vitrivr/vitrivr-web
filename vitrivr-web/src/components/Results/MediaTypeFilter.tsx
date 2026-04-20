/**
 * MediaTypeFilter
 *
 * A small popover component for filtering visible media result types.
 *
 * Features:
 * - Toggles image, video, and custom result visibility
 * - Supports hiding duplicate videos
 * - Closes on outside click
 * - Closes when Escape is pressed
 * - Displays result counts for each media type
 *
 * Props:
 * @param open - Whether the filter popover is visible
 * @param value - Current filter state
 * @param counts - Optional result counts for images, videos, and custom items
 * @param onChange - Called when any filter value changes
 * @param onClose - Called when the popover should close
 * @param className - Optional class name for the popover container
 *
 * Behavior:
 * - Returns `null` when `open` is false
 * - Updates individual filter keys through checkbox changes
 * - Closes automatically on outside click or Escape key press
 * - Includes a `uniqueVideos` option for hiding duplicate video results
 *
 * Example:
 * <MediaTypeFilter
 *   open={open}
 *   value={mediaFilter}
 *   counts={{ image: 12, video: 8, custom: 2 }}
 *   onChange={setMediaFilter}
 *   onClose={() => setOpen(false)}
 * />
 */


"use client";
import React, {useEffect, useRef} from "react";
import "./MediaTypeFilter.css"

export type MediaFilter = { image: boolean; video: boolean; custom: boolean; uniqueVideos: boolean };

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

    const setKey =
        (k: keyof MediaFilter) =>
            (e: React.ChangeEvent<HTMLInputElement>) =>
                onChange({...value, [k]: e.target.checked});

    //const selectAll = () => onChange({image: true, video: true, custom: true, uniqueVideos: true});
    //const clear = () => onChange({image: false, video: false, custom: false, uniqueVideos: false});

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

            <label className="mtf__row" style={{marginTop: 6}}>
                <input
                    type="checkbox"
                    checked={value.uniqueVideos}
                    onChange={setKey("uniqueVideos")}
                />
                <span>Hide duplicate videos</span>
            </label>
        </div>
    );
}
