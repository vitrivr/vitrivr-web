import "./Button.css"

export type ButtonProps = {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
};

function Button({label, onClick, disabled = false, className = ""}: ButtonProps) {
    return (
        <button
            className={`btn ${className}`}
            onClick={onClick}
            disabled={disabled}
        >
            {label}
        </button>
    );
}

export default Button;