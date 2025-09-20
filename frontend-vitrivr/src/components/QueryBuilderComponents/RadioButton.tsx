import "./RadioButton.css";

export type RadioButtonProps = {
    label: string;
    name: string;
    value: string;
    checked?: boolean;
    onChange?: (value: string) => void;
    disabled?: boolean;
    className?: string;
};

function RadioButton({
                         label,
                         name,
                         value,
                         checked = false,
                         onChange,
                         disabled = false,
                         className = "",
                     }: RadioButtonProps) {
    return (
        <label className={`radio ${className}`}>
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange?.(value)}
                className="radio__input"
            />
            <span className="radio__label">{label}</span>
        </label>
    );
}

export default RadioButton;
