/**
 * Input
 *
 * A small wrapper component that renders either a text input area
 * or an image input, depending on the selected type.
 *
 * Features:
 * - Supports text input with a textarea
 * - Supports image input through `ImageDropInput`
 * - Optional disabled state
 * - Customizable placeholder, class name, name, and id
 *
 * Props:
 * @param type - Input mode: "text" or "image". Defaults to "text"
 * @param disabled - Disables the input when true
 * @param value - Current text value
 * @param onChange - Called when the text value changes
 * @param onImageChange - Called when the selected image file changes
 * @param className - Optional class name for styling
 * @param placeholder - Placeholder text for text mode
 * @param name - Optional textarea name
 * @param id - Optional textarea id
 *
 * Behavior:
 * - When `type="image"`, the component renders `ImageDropInput`
 * - When `type="text"`, the component renders a textarea
 * - Text updates call `onChange`
 * - Image updates call `onImageChange`
 *
 * Example:
 * <Input
 *   type="text"
 *   value={query}
 *   onChange={setQuery}
 * />
 *
 * <Input
 *   type="image"
 *   onImageChange={setFile}
 * />
 */

"use client";
import ImageDropInput from "./ImageDropInput.tsx";

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
                <ImageDropInput disabled={disabled} onChange={onImageChange}/>
            </div>
        );
    }

    return (
        <div style={{minHeight: 120}}>
            <textarea
                id={id}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                className={className}
                rows={5}
                style={{
                    width: "95%",
                    height: "100%",
                    boxSizing: "border-box"
                }}
            />
        </div>
    );
}
