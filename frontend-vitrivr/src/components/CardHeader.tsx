import type {PropsWithChildren, ReactNode} from "react";
import "./CardHeader.css";

type CardProps = PropsWithChildren<{
    title?: ReactNode;
    subtitle?: ReactNode;
    className?: string;
    actions?: ReactNode;
}>;

function CardHeader({title, subtitle, actions, className = "", children}: CardProps) {
    return (
        <section className={`card card--with-header ${className}`}>
            {(title || actions) && (
                <div className="card-header">
                    <div className="card-header-text">
                        {title && <h2 className="card-title">{title}</h2>}
                        {subtitle && <p className="card-subtitle">{subtitle}</p>}
                    </div>
                    {actions && <div className="card-actions">{actions}</div>}
                </div>
            )}
            <div className="card-body">{children}</div>
        </section>
    );
}


export default CardHeader;
