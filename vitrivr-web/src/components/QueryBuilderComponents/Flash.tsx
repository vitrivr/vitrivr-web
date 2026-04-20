/**
 * Flash warning for e.g. error messages.
 */

import React from "react";
import "./Flash.css";

type Props = { show: boolean; kind?: "success" | "error" | "info"; onClose?: () => void; children: React.ReactNode };
export default function Flash({show, kind = "info", onClose, children}: Props) {
    if (!show) return null;
    return (
        <div className={`flash flash--${kind}`} role="status" aria-live="polite">
            <div className="flash__content">{children}</div>
            <button className="flash__close" onClick={onClose} aria-label="Close">×</button>
        </div>
    );
}
