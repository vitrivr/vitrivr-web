/**
 * ImageDropInput
 *
 * A image input component with drag-and-drop, click-to-browse,
 * and paste support.
 *
 * Features:
 * - Accepts image files only
 * - Drag and drop support
 * - Click to open file picker
 * - Paste image support when focused
 * - Displays selected file name
 * - Allows clearing the current file
 *
 * Props:
 * @param disabled - Disables all interactions when true
 * @param className - Optional class name for the dropzone container
 * @param onChange - Called when the selected file changes
 * @param accept - File input accept value, defaults to "image/*"
 *
 * Behavior:
 * - Only the first valid image file is selected
 * - Non-image files are ignored
 * - Pasted images are supported when the dropzone is focused
 * - Clicking "Clear" removes the selected file and calls `onChange(null)`
 *
 * Example:
 * <ImageDropInput
 *   onChange={setFile}
 * />
 */

"use client";

import React, {useEffect, useRef, useState} from "react";

type Props = {
    disabled?: boolean;
    className?: string;
    onChange?: (file: File | null) => void;
    accept?: string; // default: image/*
};

export default function ImageDropInput({
                                           disabled = false,
                                           className = "",
                                           onChange,
                                           accept = "image/*",
                                       }: Props) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [isOver, setIsOver] = useState(false);
    const [fileName, setFileName] = useState<string>("");

    const pickFirstImage = (files: FileList | null): File | null => {
        if (!files || files.length === 0) return null;
        const arr = Array.from(files);
        return arr.find(f => f.type.startsWith("image/")) ?? null;
    };

    const handleFile = (f: File | null) => {
        setFileName(f?.name ?? "");
        onChange?.(f)
    };

    const onBrowse = () => {
        if (disabled) return;
        inputRef.current?.click();
    };

    const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);
        if (disabled) return;

        const f = pickFirstImage(e.dataTransfer.files);
        handleFile(f);
    };

    const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsOver(true);
    };

    const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);
    };

    // Ctrl+V / Cmd+V paste support when this dropzone is focused
    useEffect(() => {
        const el = document.getElementById("__imgdropzone");
        if (!el) return;

        const onPaste = (e: ClipboardEvent) => {
            if (disabled) return;
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const it of Array.from(items)) {
                if (it.kind === "file") {
                    const f = it.getAsFile();
                    if (f && f.type.startsWith("image/")) {
                        e.preventDefault();
                        handleFile(f);
                        return;
                    }
                }
            }
        };

        el.addEventListener("paste", onPaste);
        return () => el.removeEventListener("paste", onPaste);
    }, [disabled, handleFile]);

    return (
        <div
            id="__imgdropzone"
            className={className}
            tabIndex={0} // makes it focusable for paste
            onClick={onBrowse}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            style={{
                border: "2px dashed #d1d5db",
                borderRadius: 12,
                padding: 12,
                cursor: disabled ? "not-allowed" : "pointer",
                background: isOver ? "#f3f4f6" : "#fff",
                color: "#374151",
                outline: "none",
                userSelect: "none",
            }}
            aria-disabled={disabled}
            title="Drop an image, click to browse, or paste (Ctrl+V / Cmd+V)"
        >
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                disabled={disabled}
                style={{display: "none"}}
                onChange={(e) => {
                    const f = pickFirstImage(e.target.files);
                    handleFile(f);
                    e.currentTarget.value = "";
                }}
            />

            <div style={{display: "grid", gap: 6}}>
                <div style={{fontWeight: 600}}>
                    {fileName ? `Selected: ${fileName}` : "Drop an image here"}
                </div>
                <div style={{fontSize: 12, color: "#6b7280"}}>
                    Drag & drop • Click to browse
                </div>

                {fileName && !disabled && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleFile(null);
                        }}
                        style={{
                            justifySelf: "start",
                            border: "1px solid #e5e7eb",
                            borderRadius: 8,
                            padding: "6px 10px",
                            background: "#fff",
                            cursor: "pointer",
                            fontSize: 12,
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>
        </div>
    );
}
