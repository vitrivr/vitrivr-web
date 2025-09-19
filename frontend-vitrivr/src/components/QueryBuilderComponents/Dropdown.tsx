import React from "react";

export type DropdownItem =
    | string
    | {
    value: string;
    label?: string;
    disabled?: boolean;
};

type NormalizedItem = { value: string; label: string; disabled?: boolean };

function normalize(items: DropdownItem[]): NormalizedItem[] {
    return items.map((it) =>
        typeof it === "string" ? {value: it, label: it} : {label: it.label ?? it.value, ...it}
    );
}

export type DropdownProps = {
    items: DropdownItem[];
    value?: string;
    defaultValue?: string;
    onChange?: (value: string, item: NormalizedItem) => void;
    label?: string;
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    listClassName?: string;
};

export const Dropdown: React.FC<DropdownProps> = ({
                                                      items,
                                                      value,
                                                      defaultValue,
                                                      onChange,
                                                      label = "Select an option",
                                                      placeholder = "Select…",
                                                      className,
                                                      buttonClassName,
                                                      listClassName,
                                                  }) => {
    const data = normalize(items);

    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);

    const selectedValue = isControlled ? value : internalValue;
    const selectedIndex = selectedValue
        ? Math.max(0, data.findIndex((d) => d.value === selectedValue))
        : -1;

    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState<number>(Math.max(0, selectedIndex));

    const btnRef = React.useRef<HTMLButtonElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const idBase = React.useId();

    const select = (idx: number) => {
        const item = data[idx];
        if (!item || item.disabled) return;
        if (!isControlled) setInternalValue(item.value);
        onChange?.(item.value, item);
        setOpen(false);
        btnRef.current?.focus();
    };

    React.useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!open) return;
            const t = e.target as Node;
            if (btnRef.current?.contains(t) || listRef.current?.contains(t)) return;
            setOpen(false);
        }

        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [open]);

    React.useEffect(() => {
        if (open) {
            setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        }
    }, [open, selectedIndex]);

    const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
            setTimeout(() => {
                listRef.current?.focus();
            }, 0);
        }
    };

    const moveActive = (delta: number) => {
        if (!data.length) return;
        let i = activeIndex;
        for (let tries = 0; tries < data.length; tries++) {
            i = (i + delta + data.length) % data.length;
            if (!data[i].disabled) {
                setActiveIndex(i);
                break;
            }
        }
    };

    const handleListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                moveActive(+1);
                break;
            case "ArrowUp":
                e.preventDefault();
                moveActive(-1);
                break;
            case "Home":
                e.preventDefault();
                setActiveIndex(0);
                break;
            case "End":
                e.preventDefault();
                setActiveIndex(data.length - 1);
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                select(activeIndex);
                break;
            case "Escape":
                e.preventDefault();
                setOpen(false);
                btnRef.current?.focus();
                break;
        }
    };

    return (
        <div className={`dropdown ${className ?? ""}`}>
            <button
                ref={btnRef}
                type="button"
                className={`dropdown__button ${buttonClassName ?? ""}`}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={`${idBase}-listbox`}
                aria-label={label}
                onClick={() => setOpen((o) => !o)}
                onKeyDown={handleButtonKeyDown}
            >
        <span className={`dropdown__label ${selectedIndex === -1 ? "dropdown__placeholder" : ""}`}>
          {selectedIndex === -1 ? placeholder : data[selectedIndex]?.label}
        </span>
                <span aria-hidden className={`dropdown__chevron ${open ? "open" : ""}`}>▾</span>
            </button>

            {open && (
                <ul
                    id={`${idBase}-listbox`}
                    ref={listRef}
                    className={`dropdown__list ${listClassName ?? ""}`}
                    role="listbox"
                    tabIndex={-1}
                    aria-activedescendant={`${idBase}-opt-${activeIndex}`}
                    onKeyDown={handleListKeyDown}
                >
                    {data.map((item, idx) => {
                        const selected = idx === selectedIndex;
                        const active = idx === activeIndex;
                        return (
                            <li
                                key={item.value}
                                id={`${idBase}-opt-${idx}`}
                                role="option"
                                aria-selected={selected}
                                aria-disabled={item.disabled || undefined}
                                className={[
                                    "dropdown__option",
                                    selected ? "is-selected" : "",
                                    active ? "is-active" : "",
                                    item.disabled ? "is-disabled" : "",
                                ].join(" ")}
                                onMouseEnter={() => !item.disabled && setActiveIndex(idx)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => select(idx)}
                            >
                                {item.label}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default Dropdown;
