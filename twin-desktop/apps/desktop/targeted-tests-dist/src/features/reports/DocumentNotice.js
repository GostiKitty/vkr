import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function DocumentNotice({ title, children, variant = "note" }) {
    return (_jsxs("aside", { className: variant === "warning" ? "document-warning" : "document-note", children: [_jsx("strong", { children: title }), _jsx("div", { children: children })] }));
}
export default DocumentNotice;
