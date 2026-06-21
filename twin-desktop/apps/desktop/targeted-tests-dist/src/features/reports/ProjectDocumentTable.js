import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ProjectDocumentTable({ title, columns, rows, note, }) {
    if (!rows.length) {
        return null;
    }
    return (_jsxs("div", { className: "document-table", children: [_jsxs("div", { className: "document-table__caption", children: [_jsx("strong", { children: title }), note ? _jsx("span", { children: note }) : null] }), _jsx("div", { className: "document-table__wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: columns.map((column) => (_jsx("th", { scope: "col", className: column.align ? `is-${column.align}` : undefined, style: column.width ? { width: column.width } : undefined, children: column.label }, column.label))) }) }), _jsx("tbody", { children: rows.map((row) => (_jsx("tr", { children: row.cells.map((cell, index) => (_jsx("td", { className: columns[index]?.align ? `is-${columns[index].align}` : undefined, children: cell }, `${row.key}-${index}`))) }, row.key))) })] }) })] }));
}
export default ProjectDocumentTable;
