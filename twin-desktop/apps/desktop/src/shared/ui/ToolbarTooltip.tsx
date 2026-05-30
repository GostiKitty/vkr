import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 320;
const HIDE_DELAY_MS = 60;
const VIEWPORT_MARGIN = 8;
const OFFSET_Y = 6;

interface ToolbarTooltipProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

type TooltipPosition = {
  centerX: number;
  top: number;
};

export function ToolbarTooltip({ label, className, children }: ToolbarTooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current != null) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current != null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleShow = useCallback(() => {
    clearTimers();
    showTimerRef.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  }, [clearTimers]);

  const scheduleHide = useCallback(() => {
    clearTimers();
    hideTimerRef.current = setTimeout(() => {
      setOpen(false);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const updatePosition = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const centerX = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left + rect.width * 0.5, window.innerWidth - VIEWPORT_MARGIN)
      );

      setPosition({
        centerX,
        top: rect.bottom + OFFSET_Y,
      });
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, label]);

  const wrapperClass = ["inline-flex", className ?? ""].filter(Boolean).join(" ");

  const tooltipBody =
    position && typeof document !== "undefined"
      ? createPortal(
          <div
            role="tooltip"
            className={`ui-toolbar-tooltip fixed z-[9999] -translate-x-1/2 transition-opacity duration-150 ease-out ${
              open ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            style={{ left: position.centerX, top: position.top }}
          >
            {label}
          </div>,
          document.body
        )
      : null;

  return (
    <span
      ref={wrapperRef}
      className={wrapperClass}
      onMouseEnter={scheduleShow}
      onMouseLeave={scheduleHide}
      onFocusCapture={scheduleShow}
      onBlurCapture={scheduleHide}
    >
      {children}
      {tooltipBody}
    </span>
  );
}

export default ToolbarTooltip;
