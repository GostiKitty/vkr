import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export type ResultsTabId = "overview" | "thermal" | "probabilistic" | "economy" | "map";

const TAB_META: Record<ResultsTabId, { label: string }> = {
  overview: { label: "Обзор" },
  thermal: { label: "Тепловой" },
  probabilistic: { label: "Риски" },
  economy: { label: "Экономика" },
  map: { label: "Карта" },
};

const TAB_ORDER: ResultsTabId[] = ["overview", "thermal", "probabilistic", "economy"];

export function ResultsTabBar({
  value,
  onChange,
}: {
  value: ResultsTabId;
  onChange: (id: ResultsTabId) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Partial<Record<ResultsTabId, HTMLButtonElement | null>>>({});
  const [indicator, setIndicator] = useState({ width: 0, left: 0 });
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const container = containerRef.current;
    const activeButton = buttonRefs.current[value];
    if (!container || !activeButton) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    setIndicator({
      width: buttonRect.width,
      left: buttonRect.left - containerRect.left,
    });
  }, [value]);

  return (
    <div className="ui-results-tabbar" role="tablist" aria-label="Разделы результатов">
      <div className="ui-results-tabbar__track" ref={containerRef}>
        <span
          className="ui-results-tabbar__indicator"
          aria-hidden="true"
          style={
            {
              width: indicator.width,
              transform: `translateX(${indicator.left}px)`,
              transitionDuration: reducedMotion ? "0ms" : "280ms",
            } as CSSProperties
          }
        />
        {TAB_ORDER.map((id) => {
          const { label } = TAB_META[id];
          const active = value === id;
          return (
            <button
              key={id}
              ref={(el) => {
                buttonRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={`ui-results-tabbar__tab ${active ? "ui-results-tabbar__tab--active" : ""}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ResultsTabBar;
