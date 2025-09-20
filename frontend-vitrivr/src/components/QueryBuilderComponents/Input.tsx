import {useState} from "react";
import FileUploader from "./FileUploader.tsx";

export type InputProps = {
    type?: string;
    disabled?: boolean;
    className?: string;
}

function Input({type, disabled = false, className = ""}: InputProps) {
    const [query, setQuery] = useState("");
    const [image, setImage] = useState<string | null>(null);

    if (type === "image") {
        return (
            <div>
                <FileUploader/>
            </div>
        );
    } else {
        return (
            <div>
                <input
                    type="text"
                    placeholder="Enter textual query. "
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={disabled}
                    className={className}
                />
            </div>
        );
    }
}

export default Input;
