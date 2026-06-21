import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import autoCalculatedSourceIconUrl from "../assets/auto-calculated-source.png";
import demoFallbackSourceIconUrl from "../assets/demo-fallback-source.png";
import modelSourceIconUrl from "../assets/model-source.png";
/** Натуральные пропорции эталонных PNG. */
const FX_ASPECT = 1024 / 933;
const HOUSE_ASPECT = 853 / 849;
const REFRESH_ASPECT = 920 / 768;
/** Растровая иконка в фиксированном контейнере — без фильтров и без растягивания. */
function SourceBadgeRasterIcon({ src, variant, aspect, size = 18, className = "", ...rest }) {
    const height = size;
    const width = Math.round(size * aspect);
    return (_jsx("span", { className: `ui-source-badge-icon-wrap ui-source-badge-icon-wrap--${variant} ${className}`.trim(), style: { width, height }, "aria-hidden": true, children: _jsx("img", { src: src, alt: "", className: "ui-source-badge-icon", ...rest }) }));
}
export function SourceBadgeFxIcon(props) {
    return (_jsx(SourceBadgeRasterIcon, { src: autoCalculatedSourceIconUrl, variant: "fx", aspect: FX_ASPECT, ...props }));
}
export function SourceBadgeHouseIcon(props) {
    return (_jsx(SourceBadgeRasterIcon, { src: modelSourceIconUrl, variant: "house", aspect: HOUSE_ASPECT, ...props }));
}
export function SourceBadgeRefreshIcon(props) {
    return (_jsx(SourceBadgeRasterIcon, { src: demoFallbackSourceIconUrl, variant: "refresh", aspect: REFRESH_ASPECT, ...props }));
}
/** Слегка утоньшает контур fx на прозрачном PNG (без перекраски в сплошной квадрат). */
export function SourceBadgeIconFilters() {
    return (_jsx("svg", { "aria-hidden": true, className: "ui-source-badge-filters", width: 0, height: 0, children: _jsx("defs", { children: _jsxs("filter", { id: "ui-source-badge-fx-thin", x: "-10%", y: "-10%", width: "120%", height: "120%", colorInterpolationFilters: "sRGB", children: [_jsx("feMorphology", { in: "SourceAlpha", operator: "erode", radius: "0.42", result: "thinAlpha" }), _jsx("feComposite", { in: "SourceGraphic", in2: "thinAlpha", operator: "in" })] }) }) }));
}
