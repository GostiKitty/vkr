import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getFormulasByIds } from "../../entities/formulas/registry";
import { openFormulaDrawer } from "../../entities/formulas/formulaDrawer.store";

interface TooltipProps {
  title: string;
  description: string;
  details?: string[];
  linkedFormulaIds?: string[];
  className?: string;
  children: React.ReactNode;
}

type TooltipPosition = {
  left: number;
  top: number;
  width: number;
};

const TOOLTIP_WIDTH = 288;
const VIEWPORT_MARGIN = 16;

export function Tooltip({
  title,
  description,
  details = [],
  linkedFormulaIds = [],
  className,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const formulas = useMemo(() => {
    if (!linkedFormulaIds.length) {
      return [];
    }
    return getFormulasByIds(linkedFormulaIds);
  }, [linkedFormulaIds]);

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
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left + rect.width * 0.5 - TOOLTIP_WIDTH * 0.5, viewportWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN)
      );
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
  const tooltipBody = position ? (
    <div
      role="tooltip"
      aria-hidden={!open}
      className={`ui-overlay fixed z-[9999] origin-top p-3.5 text-left shadow-2xl transition-all duration-200 ease-out ${
        open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"
      }`}
      style={{
        left: position.left,
        top: position.top,
        width: position.width,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <p className="text-sm font-semibold text-[color:var(--text-base)] truncate">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-muted)]">{description}</p>
      {details.length > 0 && (
        <ul className="mt-2.5 list-disc space-y-1 pl-4 text-[11px] leading-5 text-[color:var(--text-soft)]">
          {details.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {formulas.length > 0 && (
        <div className="ui-panel-muted mt-3 p-2.5">
          <p className="text-sm font-semibold text-[color:var(--text-base)]">Формулы</p>
          <ul className="mt-1.5 space-y-1 text-[11px] text-[color:var(--text-muted)]">
            {formulas.map((formula) => (
              <li key={formula.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{formula.title}</span>
                <button
                  type="button"
                  className="ui-control-quiet shrink-0 px-2 py-1 text-[10px] font-semibold"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => openFormulaDrawer(linkedFormulaIds, formula.id)}
                >
                  Открыть
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      ref={wrapperRef}
      className={wrapperClass}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {typeof document !== "undefined" && tooltipBody ? createPortal(tooltipBody, document.body) : null}
    </div>
  );
}

export default Tooltip;
