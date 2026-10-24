import type {ReactNode} from "react";

type DisclosureSectionProps = {
    open: boolean;
    onToggle: () => void;
    title: string;
    count?: number;
    loading?: boolean;
    children: ReactNode;
};

/**
 * Section that collapses/opens when clicking on it.
 */
export default function DisclosureSection({
                                              open,
                                              onToggle,
                                              title,
                                              count,
                                              loading = false,
                                              children,
                                          }: DisclosureSectionProps) {
    return (
        <section className="vp-section">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="vp-disclosure"
            >
                <span
                    style={{
                        display: "inline-block",
                        transform: open ? "rotate(90deg)" : "rotate(0deg)",
                        transition: "transform 150ms ease",
                    }}
                >
                    ▶
                </span>

                <strong style={{fontSize: 14}}>
                    {title}
                </strong>

                {loading && (<span style={{fontSize: 12, opacity: 0.6}}>Loading…</span>)}

                {!loading && count !== undefined && (
                    <span
                        style={{
                            marginLeft: "auto",
                            fontSize: 12,
                            opacity: 0.6,
                        }}
                    >
                        {count}
                    </span>
                )}
            </button>

            {open && (
                <div className="vp-sectionBody">
                    {children}
                </div>
            )}
        </section>
    );
}