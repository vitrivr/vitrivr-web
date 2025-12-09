"use client";
import FileUploader from "./FileUploader.tsx";

export type InputProps = {
    type?: "text" | "image";
    disabled?: boolean;
    value?: string;
    onChange?: (value: string) => void;
    onImageChange?: (file: File | null) => void;
    className?: string;
    placeholder?: string;
    name?: string;
    id?: string;
};

export default function Input({
                                  type = "text",
                                  disabled = false,
                                  value = "",
                                  onChange,
                                  onImageChange,
                                  className = "",
                                  placeholder = "Enter textual query.",
                                  name,
                                  id,
                              }: InputProps) {
    if (type === "image") {
        return (
            <div className={className}>
                <FileUploader onChange={onImageChange}/>
            </div>
        );
    }

    return (
        <div style={{minHeight: 80}}>
            <input
                id={id}
                name={name}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                className={className}
            />
        </div>
    );
}
