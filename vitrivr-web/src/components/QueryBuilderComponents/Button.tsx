export type ButtonProps = {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    backgroundColor?: string;
    children?: React.ReactNode;
};

function Button({label, onClick, disabled = false, className = "", backgroundColor = "", children,}: ButtonProps) {
    return (
        <button
            className={`btn ${className}`}
            onClick={onClick}
            disabled={disabled}
            style={backgroundColor ? {backgroundColor} : undefined}
        >
            {children ?? label}
        </button>
    );
}

export default Button;