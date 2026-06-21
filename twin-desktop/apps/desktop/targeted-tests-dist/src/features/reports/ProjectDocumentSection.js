import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ProjectDocumentSection({ id, number, title, children, pageBreak = false, }) {
    return (_jsxs("section", { id: id, className: `document-section${pageBreak ? " document-section--page-break" : ""}`, children: [_jsxs("h2", { children: [number ? _jsx("span", { children: number }) : null, _jsx("span", { children: title })] }), _jsx("div", { children: children })] }));
}
export function ProjectDocumentClause({ number, title, children, }) {
    return (_jsxs("article", { className: "document-clause", children: [_jsxs("h3", { children: [number ? _jsx("span", { children: number }) : null, _jsx("span", { children: title })] }), _jsx("div", { children: children })] }));
}
export default ProjectDocumentSection;
