import type {PropsWithChildren, ReactNode} from "react";
import "./Card.css";

type CardProps = PropsWithChildren<{
    subtitle?: ReactNode;
    className?: string;
    actions?: ReactNode;
}>;

function Card({actions, className = "", children}: CardProps) {
    return (
        <section className={`card ${className}`}>
            {actions && <div className="card-actions">{actions}</div>}
            <div className="card-body">{children}</div>
        </section>
    );
}

export default Card;
