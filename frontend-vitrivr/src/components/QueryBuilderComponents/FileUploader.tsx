import React, {useState} from "react";
import Flash from "./Flash";

const FileUploader = () => {
    const [file, setFile] = useState<File | null>(null);
    const [show, setShow] = useState(false);
    const [msg, setMsg] = useState<string>("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.files?.[0] ?? null;
        if (!next) {
            setFile(null);
            return;
        }
        if (!next.type.startsWith("image/")) {
            setFile(null);
            setMsg("Please upload an image!");
            setShow(true);
            return;
        }

        setFile(next);
        setShow(false);
    };

    const handleUpload = () => {
        // TODO: integrate with VITRIVR engine
    };

    return (
        <>
            <Flash show={show} kind="error" onClose={() => setShow(false)}>
                {msg || "Something went wrong."}
            </Flash>

            <div className="input-group">
                <input
                    id="file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                />
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