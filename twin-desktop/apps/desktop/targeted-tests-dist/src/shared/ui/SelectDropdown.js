import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
function SelectChevron({ open }) {
    return (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true", className: `ui-select__chevron${open ? " ui-select__chevron--open" : ""}`, children: _jsx("path", { d: "M6 9l6 6 6-6", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
function SelectCheckIcon() {
    return (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true", className: "ui-select__check", children: _jsx("path", { d: "M5 12.5l4.25 4.25L19 7", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
export function SelectDropdown({ label, value, options, onChange, className, }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const listboxId = useId();
    const labelId = useId();
    const selected = options.find((option) => option.value === value) ?? options[0];
    useEffect(() => {
        if (!open) {
            return;
        }
        const handlePointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);
    const rootClassName = className ? `ui-select ${className}` : "ui-select";
    const triggerLabelledBy = label ? labelId : undefined;
    return (_jsxs("div", { ref: rootRef, className: rootClassName, children: [label ? (_jsx("span", { id: labelId, className: "ui-select__label", children: label })) : null, _jsxs("button", { type: "button", className: `ui-select__trigger${open ? " ui-select__trigger--open" : ""}`, "aria-haspopup": "listbox", "aria-expanded": open, "aria-labelledby": triggerLabelledBy, onClick: () => setOpen((current) => !current), children: [_jsx("span", { className: "ui-select__value", children: selected?.label ?? "" }), _jsx(SelectChevron, { open: open })] }), open ? (_jsx("ul", { id: listboxId, role: "listbox", "aria-labelledby": triggerLabelledBy, className: "ui-select__menu ui-scroll", children: options.map((option) => {
                    const isActive = option.value === value;
                    return (_jsx("li", { role: "presentation", children: _jsxs("button", { type: "button", role: "option", "aria-selected": isActive, className: `ui-select__option${isActive ? " ui-select__option--active" : ""}${option.description ? " ui-select__option--rich" : ""}`, onClick: () => {
                                onChange(option.value);
                                setOpen(false);
                            }, children: [_jsxs("span", { className: "ui-select__option-content", children: [_jsx("span", { className: "ui-select__option-label", children: option.label }), option.description ? (_jsx("span", { className: "ui-select__option-desc", children: option.description })) : null] }), isActive ? _jsx(SelectCheckIcon, {}) : _jsx("span", { className: "ui-select__check ui-select__check--placeholder" })] }) }, option.value || "empty"));
                }) })) : null] }));
}
