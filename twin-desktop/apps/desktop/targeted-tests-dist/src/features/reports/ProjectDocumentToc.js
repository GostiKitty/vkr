import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ProjectDocumentToc({ items }) {
    return (_jsxs("nav", { className: "document-toc", "aria-label": "\u0421\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435", children: [_jsx("strong", { children: "\u0421\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435" }), _jsx("ol", { children: items.map((item) => (_jsx("li", { children: _jsx("a", { href: `#${item.id}`, children: item.label }) }, item.id))) })] }));
}
export default ProjectDocumentToc;
