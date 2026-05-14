import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getFormulasByIds } from "../../entities/formulas/registry";
import { openFormulaDrawer } from "../../entities/formulas/formulaDrawer.store";
const TOOLTIP_WIDTH = 288;
const VIEWPORT_MARGIN = 16;
export function Tooltip({ title, description, details = [], linkedFormulaIds = [], className, children, }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);
    const wrapperRef = useRef(null);
    const formulas = useMemo(() => {
        if (!linkedFormulaIds.length) {
            return [];
        }
        return getFormulasByIds(linkedFormulaIds);
    }, [linkedFormulaIds.join("|")]);
    useLayoutEffect(() => {
        if (!open || typeof window === "undefined") {
            return;
        }
        const updatePosition = () => {
            const rect = wrapperRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }
            const viewportWidth = window.innerWidth;
            const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left + rect.width * 0.5 - TOOLTIP_WIDTH * 0.5, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN));
            setPosition({
                left,
                top: rect.bottom + 10,
                width: TOOLTIP_WIDTH,
            });
        };
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);
        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [open]);
    const wrapperClass = ["relative", className ?? "inline-flex"].join(" ");
    const tooltipBody = position ? (_jsxs("div", { role: "tooltip", "aria-hidden": !open, className: `ui-overlay fixed z-[9999] origin-top p-3.5 text-left shadow-2xl transition-all duration-200 ease-out ${open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"}`, style: {
            left: position.left,
            top: position.top,
            width: position.width,
            pointerEvents: open ? "auto" : "none",
        }, children: [_jsx("p", { className: "ui-kicker truncate", children: title }), _jsx("p", { className: "mt-1.5 text-xs leading-5 text-slate-600", children: description }), details.length > 0 && (_jsx("ul", { className: "mt-2.5 list-disc space-y-1 pl-4 text-[11px] leading-5 text-slate-500", children: details.map((item) => (_jsx("li", { children: item }, item))) })), formulas.length > 0 && (_jsxs("div", { className: "ui-panel-muted mt-3 p-2.5", children: [_jsx("p", { className: "text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500", children: "\u0424\u043E\u0440\u043C\u0443\u043B\u044B" }), _jsx("ul", { className: "mt-1.5 space-y-1 text-[11px] text-slate-600", children: formulas.map((formula) => (_jsxs("li", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "min-w-0 truncate", children: formula.title }), _jsx("button", { type: "button", className: "ui-control-quiet shrink-0 px-2 py-1 text-[10px] font-semibold", onMouseDown: (event) => event.preventDefault(), onClick: () => openFormulaDrawer(linkedFormulaIds, formula.id), children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" })] }, formula.id))) })] }))] })) : null;
    return (_jsxs("div", { ref: wrapperRef, className: wrapperClass, onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), onFocusCapture: () => setOpen(true), onBlurCapture: () => setOpen(false), children: [children, typeof document !== "undefined" && tooltipBody ? createPortal(tooltipBody, document.body) : null] }));
}
export default Tooltip;
