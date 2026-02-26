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
