import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getFormulasByIds } from "../../entities/formulas/registry";
import { openFormulaDrawer } from "../../entities/formulas/formulaDrawer.store";
import { FormulaMath } from "./FormulaMath";

interface TooltipProps {
  title: string;
  description?: string;
  formulaLatex?: string | null;
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
/** Задержка перед закрытием — успеть перевести курсор с иконки на подсказку. */
const TOOLTIP_CLOSE_DELAY_MS = 180;
/** Невидимая зона над подсказкой, перекрывающая зазор между триггером и панелью. */
const TOOLTIP_HOVER_BRIDGE_PX = 12;

export function Tooltip({
  title,
  description,
  formulaLatex,
  details = [],
  linkedFormulaIds = [],
  className,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const showTooltip = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const scheduleHideTooltip = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, TOOLTIP_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);
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
      className="fixed z-[9999]"
      style={{
        left: position.left,
        top: position.top - TOOLTIP_HOVER_BRIDGE_PX,
        width: position.width,
        paddingTop: TOOLTIP_HOVER_BRIDGE_PX,
        pointerEvents: open ? "auto" : "none",
      }}
      onMouseEnter={showTooltip}
      onMouseLeave={scheduleHideTooltip}
    >
      <div
        role="tooltip"
        aria-hidden={!open}
        className={`ui-overlay p-3.5 text-left shadow-2xl transition-all duration-200 ease-out ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
      <p className="text-sm font-semibold text-[color:var(--text-base)] truncate">{title}</p>
      {description?.trim() ? (
        <p className="mt-1.5 text-xs leading-5 text-[color:var(--text-muted)]">{description}</p>
      ) : null}
      {formulaLatex?.trim() ? (
        <div className="mt-2.5">
          <p className="text-[11px] font-semibold text-[color:var(--text-soft)]">Формула</p>
          <FormulaMath latex={formulaLatex} className="mt-1" />
        </div>
      ) : null}
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
    </div>
  ) : null;

  return (
    <span
      ref={wrapperRef}
      className={wrapperClass}
      onMouseEnter={showTooltip}
      onMouseLeave={scheduleHideTooltip}
      onFocusCapture={showTooltip}
      onBlurCapture={scheduleHideTooltip}
    >
      {children}
      {typeof document !== "undefined" && tooltipBody ? createPortal(tooltipBody, document.body) : null}
    </span>
  );
}

export default Tooltip;
