/**
 * FileUploader
 *
 * Currently not used, but relevant for future iterations were direct image-to-image search is necessary.
 * (This was not used because the frontend was first developed for the VBS26 in Prague. Image-to-Image search
 * is not permitted at the VBS.)
 *
 * A simple image file input component with basic validation.
 *
 * Features:
 * - Accepts image files only
 * - Shows an error message for invalid file types
 * - Displays basic file details after selection
 * - Supports optional label and custom styling
 *
 * Props:
 * @param label - Optional label shown above the file input
 * @param file - Currently selected file
 * @param onChange - Called when the selected file changes
 * @param className - Optional class name for the wrapper
 *
 * Behavior:
 * - If no file is selected, `onChange(null)` is called
 * - If a non-image file is selected, the component shows an error and resets the value
 * - If a valid image is selected, `onChange(file)` is called
 *
 * Example:
 * <FileUploader
 *   label="Upload an image"
 *   file={file}
 *   onChange={setFile}
 * />
 */

import React from "react";
import Flash from "./Flash";

export type FileUploaderProps = {
    label?: string;
    file?: File | null;
    onChange?: (file: File | null) => void;
    className?: string;
};

const FileUploader = ({file, label, onChange, className = ""}: FileUploaderProps) => {
    const [show, setShow] = React.useState(false);
    const [msg, setMsg] = React.useState<string>("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.files?.[0] ?? null;
        if (!next) {
            onChange?.(null);
            return;
        }
        if (!next.type.startsWith("image/")) {
            onChange?.(null);
            setMsg("Please upload an image!");
            setShow(true);
            return;
        }
        onChange?.(next);
        setShow(false);
    };

    return (
        <>
            <Flash show={show} kind="error" onClose={() => setShow(false)}>
                {msg || "Something went wrong."}
            </Flash>

            <div className={`input-group ${className}`}>
                {label && <label htmlFor="file">{label}</label>}
                <input id="file" type="file" accept="image/*" onChange={handleFileChange}/>
            </div>

            {file && (
                <section>
                    File details:
                    <ul>
                        <li>Name: {file.name}</li>
                        <li>Type: {file.type}</li>
                        <li>Size: {file.size} bytes</li>
                    </ul>
                </section>
            )}
        </>
    );
};

export default FileUploader;
