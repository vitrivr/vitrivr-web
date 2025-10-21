"use client";
import React from "react";
import "./RadioGroup.css";

export type RadioOption<T extends string = string> = {
    value: T;
    label: string;
    disabled?: boolean;
};

export type RadioGroupProps<T extends string = string> = {
    label?: string;
    ariaLabel?: string;
    name?: string;
    options: RadioOption<T>[];
    value: T;
    onChange: (value: T) => void;
    orientation?: "horizontal" | "vertical";
    className?: string;
};

export default function RadioGroup<T extends string = string>({
                                                                  label,
                                                                  ariaLabel,
                                                                  name,
                                                                  options,
                                                                  value,
                                                                  onChange,
                                                                  orientation = "horizontal",
                                                                  className = "",
                                                              }: RadioGroupProps<T>) {
    const id = React.useId();
    const groupName = name ?? `${id}-radio`;

    return (
        <fieldset
            className={`rg ${orientation === "vertical" ? "rg--col" : "rg--row"} ${className}`}
            aria-label={label ? undefined : ariaLabel}
        >
            {label && <legend className="rg__legend">{label}</legend>}

            {options.map((opt) => {
                const inputId = `${id}-${opt.value}`;
                const checked = value === opt.value;
                return (
                    <label key={opt.value} className={`rg__option ${opt.disabled ? "is-disabled" : ""}`}>
                        <input
                            id={inputId}
                            type="radio"
                            className="rg__input"
                            name={groupName}
                            value={opt.value}
                            checked={checked}
                            disabled={opt.disabled}
                            onChange={() => onChange(opt.value)}
                        />
                        <span className={`rg__control ${checked ? "is-checked" : ""}`} aria-hidden/>
                        <span className="rg__label">{opt.label}</span>
                    </label>
                );
            })}
        </fieldset>
    );
}
