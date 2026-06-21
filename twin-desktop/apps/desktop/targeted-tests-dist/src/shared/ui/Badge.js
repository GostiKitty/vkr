import { jsx as _jsx } from "react/jsx-runtime";
const toneClass = {
    neutral: "",
    info: "ui-build-badge--info",
    success: "ui-build-badge--success",
    warning: "ui-build-badge--warning",
    accent: "ui-build-badge--accent",
};
export function Badge({ tone = "neutral", children, className = "", title }) {
    return (_jsx("span", { className: `ui-build-badge ${toneClass[tone]} ${className}`.trim(), title: title, children: children }));
}
