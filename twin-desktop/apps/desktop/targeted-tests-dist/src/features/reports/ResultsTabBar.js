import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
const TAB_META = {
    overview: { label: "Обзор" },
    thermal: { label: "Тепловой" },
    probabilistic: { label: "Риски" },
    economy: { label: "Экономика" },
    map: { label: "Карта" },
};
const TAB_ORDER = ["overview", "thermal", "probabilistic", "economy"];
export function ResultsTabBar({ value, onChange, }) {
    const containerRef = useRef(null);
    const buttonRefs = useRef({});
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
    return (_jsx("div", { className: "ui-results-tabbar", role: "tablist", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432", children: _jsxs("div", { className: "ui-results-tabbar__track", ref: containerRef, children: [_jsx("span", { className: "ui-results-tabbar__indicator", "aria-hidden": "true", style: {
                        width: indicator.width,
                        transform: `translateX(${indicator.left}px)`,
                        transitionDuration: reducedMotion ? "0ms" : "280ms",
                    } }), TAB_ORDER.map((id) => {
                    const { label } = TAB_META[id];
                    const active = value === id;
                    return (_jsx("button", { ref: (el) => {
                            buttonRefs.current[id] = el;
                        }, type: "button", role: "tab", "aria-selected": active, onClick: () => onChange(id), className: `ui-results-tabbar__tab ${active ? "ui-results-tabbar__tab--active" : ""}`, children: label }, id));
                })] }) }));
}
export default ResultsTabBar;
