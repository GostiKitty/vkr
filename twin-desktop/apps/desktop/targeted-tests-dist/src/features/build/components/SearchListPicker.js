import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
function useDismissOnOutside(ref, open, onClose) {
    useEffect(() => {
        if (!open) {
            return;
        }
        const handlePointer = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                onClose();
            }
        };
        const handleKey = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        document.addEventListener("mousedown", handlePointer);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handlePointer);
            document.removeEventListener("keydown", handleKey);
        };
    }, [onClose, open, ref]);
}
export function SearchListPicker({ value, options, onChange, placeholder = "Выберите…", searchPlaceholder = "Поиск…", compact = false, defaultAccentColor = "var(--accent-base)", }) {
    const rootRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const selected = options.find((option) => option.value === value);
    const accent = selected?.accentColor ?? defaultAccentColor;
    const filteredOptions = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            return options;
        }
        return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery) ||
            option.hint?.toLowerCase().includes(normalizedQuery));
    }, [options, query]);
    const close = useCallback(() => {
        setOpen(false);
        setQuery("");
    }, []);
    useDismissOnOutside(rootRef, open, close);
    return (_jsxs("div", { ref: rootRef, className: "min-w-0 flex-1", children: [_jsxs("button", { type: "button", onClick: () => setOpen((current) => !current), "aria-expanded": open, className: `group flex w-full min-w-0 items-center gap-2 rounded-[11px] border bg-[color:var(--surface-elevated)] text-left transition ${open
                    ? "border-[color:var(--accent-muted)] ring-2 ring-[color:var(--accent-soft)]"
                    : "border-[color:var(--border-soft)] hover:border-[color:var(--border-base)]"} ${compact ? "px-2 py-1.5" : "px-2.5 py-2"}`, style: { boxShadow: open ? undefined : `inset 3px 0 0 ${accent}` }, children: [_jsx("span", { className: `min-w-0 flex-1 truncate font-medium text-[color:var(--text-base)] ${compact ? "text-[12px]" : "text-[13px]"}`, title: selected?.label, children: selected?.label ?? placeholder }), _jsx("span", { className: `shrink-0 rounded-md px-1.5 py-0.5 tabular-nums text-[color:var(--text-soft)] transition group-hover:text-[color:var(--text-muted)] ${compact ? "text-[10px]" : "text-[11px]"}`, children: open ? "▴" : "▾" })] }), open ? (_jsxs("div", { className: "mt-1.5 overflow-hidden rounded-[12px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] shadow-[0_12px_28px_-18px_rgba(15,23,42,0.45)]", children: [_jsx("div", { className: "border-b border-[color:var(--border-soft)] px-2 py-1.5", children: _jsx("input", { type: "search", value: query, onChange: (event) => setQuery(event.target.value), placeholder: searchPlaceholder, autoFocus: true, className: "ui-field w-full rounded-[9px] border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-2.5 py-1.5 text-[12px] text-[color:var(--text-base)] placeholder:text-[color:var(--text-soft)]" }) }), _jsx("ul", { className: "ui-scroll max-h-[220px] overflow-y-auto p-1", children: filteredOptions.length ? (filteredOptions.map((option) => {
                            const active = option.value === value;
                            const itemAccent = option.accentColor ?? defaultAccentColor;
                            return (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => {
                                        onChange(option.value);
                                        close();
                                    }, className: `flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition ${active ? "bg-[color:var(--accent-soft)]" : "hover:bg-[color:var(--surface-muted)]"}`, children: [_jsx("span", { className: "h-2 w-2 shrink-0 rounded-full", style: { backgroundColor: itemAccent }, "aria-hidden": true }), _jsx("span", { className: `min-w-0 flex-1 truncate text-[12px] leading-snug ${active ? "font-semibold text-[color:var(--text-base)]" : "text-[color:var(--text-muted)]"}`, title: option.label, children: option.label }), option.hint ? (_jsx("span", { className: "shrink-0 text-[10px] tabular-nums text-[color:var(--text-soft)]", children: option.hint })) : null] }) }, option.value));
                        })) : (_jsx("li", { className: "px-2 py-3 text-center text-[12px] text-[color:var(--text-soft)]", children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" })) })] })) : null] }));
}
