import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useDeferredValue, useMemo, useRef, useState, } from "react";
import { LAW87_BREADCRUMBS, LAW87_CENTER_TITLE_LINES, LAW87_MAIN_TITLE, LAW87_NAVIGATION, LAW87_SOURCE_TITLE, LAW87_SOURCE_URL, LAW87_STATUS_TEXT, PROJECT_DOCUMENTATION_LAW87_SECTIONS, } from "../../data/projectDocumentationLaw87";
export function NormativeDocumentPage({ toolbar }) {
    const [searchValue, setSearchValue] = useState("");
    const deferredQuery = useDeferredValue(searchValue.trim());
    const anchorRefs = useRef({});
    const matchingSectionIds = useMemo(() => PROJECT_DOCUMENTATION_LAW87_SECTIONS.filter((section) => sectionContainsQuery(section, deferredQuery)).map((section) => section.anchorId), [deferredQuery]);
    const handleSearchSubmit = (event) => {
        event.preventDefault();
        if (!matchingSectionIds.length) {
            return;
        }
        const firstMatch = anchorRefs.current[matchingSectionIds[0]];
        firstMatch?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const navigateToAnchor = (anchorId) => {
        anchorRefs.current[anchorId]?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    return (_jsxs("div", { className: "legal-page", id: "legal-document", children: [_jsxs("div", { className: "legal-topbar document-print-hidden", children: [_jsx("nav", { className: "legal-breadcrumbs", "aria-label": "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0446\u0435\u043F\u043E\u0447\u043A\u0430", children: LAW87_BREADCRUMBS.map((item, index) => {
                            const href = "href" in item ? item.href : undefined;
                            return (_jsxs("span", { children: [href ? (_jsx("a", { className: "legal-breadcrumb-link", href: href, target: href.startsWith("http") ? "_blank" : undefined, rel: href.startsWith("http") ? "noreferrer" : undefined, children: item.label })) : (_jsx("span", { className: "legal-muted", children: item.label })), index < LAW87_BREADCRUMBS.length - 1 ? _jsx("span", { className: "legal-muted", children: " / " }) : null] }, `${item.label}-${index}`));
                        }) }), _jsx("div", { className: "legal-right-tools legal-right-tools--inline", children: toolbar })] }), _jsxs("div", { className: "legal-page__layout", children: [_jsxs("main", { className: "legal-content", children: [_jsx("p", { className: "legal-status", children: LAW87_STATUS_TEXT }), _jsx("a", { className: "legal-source-link legal-link", href: LAW87_SOURCE_URL, target: "_blank", rel: "noreferrer", children: LAW87_SOURCE_TITLE }), _jsx("h1", { className: "legal-document-title", children: LAW87_MAIN_TITLE }), _jsx("div", { className: "legal-section-title", children: LAW87_CENTER_TITLE_LINES.map((line) => (_jsx("div", { children: line }, line))) }), _jsxs("form", { className: "legal-search-panel document-print-hidden", role: "search", onSubmit: handleSearchSubmit, children: [_jsx("label", { htmlFor: "legal-document-search", className: "legal-muted", children: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0443" }), _jsxs("div", { className: "legal-search-panel__controls", children: [_jsx("input", { id: "legal-document-search", type: "search", value: searchValue, onChange: (event) => setSearchValue(event.target.value), placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0443", className: "ui-field" }), _jsx("button", { type: "submit", className: "ui-btn-secondary px-3 py-2 text-sm", children: "\u041D\u0430\u0439\u0442\u0438" })] }), _jsx("p", { className: "legal-muted", children: deferredQuery
                                            ? matchingSectionIds.length
                                                ? `Найдено разделов: ${matchingSectionIds.length}.`
                                                : "Совпадения не найдены."
                                            : "Поиск подсвечивает найденные фрагменты и переводит к первому совпавшему разделу." })] }), PROJECT_DOCUMENTATION_LAW87_SECTIONS.map((section) => (_jsxs("section", { id: section.anchorId, className: "legal-anchor", ref: (node) => {
                                    anchorRefs.current[section.anchorId] = node;
                                }, children: [_jsx("h2", { children: section.heading }), section.lead?.map((paragraph) => (_jsx("p", { className: "legal-paragraph legal-muted", children: renderHighlightedText(paragraph, deferredQuery) }, paragraph))), section.items.map((item, index) => renderSectionItem(item, deferredQuery, `${section.anchorId}-${index}`))] }, section.anchorId)))] }), _jsxs("aside", { className: "legal-right-tools legal-right-tools--nav document-print-hidden", "aria-label": "\u041D\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u044F \u043F\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C", children: [_jsx("p", { className: "legal-muted", children: "\u041F\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C" }), _jsx("nav", { children: LAW87_NAVIGATION.map((item) => {
                                    const active = matchingSectionIds.includes(item.id);
                                    return (_jsx("button", { type: "button", className: `legal-anchor-link${active ? " is-match" : ""}`, onClick: () => navigateToAnchor(item.id), children: item.label }, item.id));
                                }) })] })] })] }));
}
function renderSectionItem(item, query, key) {
    if (item.type === "note") {
        return (_jsxs("div", { className: "legal-note", children: [_jsx("div", { className: "legal-note-title", children: renderHighlightedText(item.title, query) }), _jsx("p", { className: "legal-paragraph", children: renderHighlightedText(item.text, query) }), item.paragraphs?.map((paragraph) => (_jsx("p", { className: "legal-subpoint", children: renderHighlightedText(paragraph, query) }, paragraph)))] }, key));
    }
    return (_jsxs("article", { children: [_jsxs("p", { className: "legal-point", children: [_jsx("span", { className: "legal-point-number", children: renderHighlightedText(`${item.number}.`, query) }), " ", item.title ? renderHighlightedText(item.title, query) : renderHighlightedText(item.text ?? "", query)] }), !item.title && item.text ? null : item.text ? (_jsx("p", { className: "legal-paragraph", children: renderHighlightedText(item.text, query) })) : null, item.intro ? _jsx("p", { className: "legal-paragraph legal-muted", children: renderHighlightedText(item.intro, query) }) : null, item.subpoints?.map((subpoint) => (_jsxs("div", { className: "legal-subpoint", children: [_jsxs("p", { className: "legal-paragraph", children: [_jsxs("span", { className: "legal-subpoint-letter", children: [subpoint.letter, ")"] }), " ", renderHighlightedText(subpoint.text, query)] }), subpoint.details?.map((detail) => (_jsx("p", { className: "legal-paragraph legal-subpoint legal-subpoint-detail", children: renderHighlightedText(detail, query) }, detail)))] }, `${key}-${subpoint.letter}`))), item.paragraphs?.map((paragraph) => (_jsx("p", { className: "legal-paragraph", children: renderHighlightedText(paragraph, query) }, paragraph))), item.editorialNotes?.map((note) => (_jsx("p", { className: "legal-editorial-note", children: renderHighlightedText(note, query) }, note))), item.oldEditionLabel ? (_jsx("p", { className: "legal-old-edition-link", children: _jsx("a", { className: "legal-link", href: LAW87_SOURCE_URL, target: "_blank", rel: "noreferrer", children: renderHighlightedText(`(${item.oldEditionLabel})`, query) }) })) : null] }, key));
}
function sectionContainsQuery(section, query) {
    if (!query) {
        return false;
    }
    const haystack = [
        section.heading,
        ...(section.lead ?? []),
        ...section.items.flatMap((item) => item.type === "note"
            ? [item.title, item.text, ...(item.paragraphs ?? [])]
            : [
                item.number,
                item.title ?? "",
                item.text ?? "",
                item.intro ?? "",
                ...(item.paragraphs ?? []),
                ...(item.editorialNotes ?? []),
                ...(item.subpoints?.flatMap((subpoint) => [subpoint.letter, subpoint.text, ...(subpoint.details ?? [])]) ?? []),
            ]),
    ]
        .join(" ")
        .toLowerCase();
    return haystack.includes(query.toLowerCase());
}
function renderHighlightedText(text, query) {
    if (!query) {
        return text;
    }
    const escaped = escapeRegExp(query);
    const parts = text.split(new RegExp(`(${escaped})`, "ig"));
    const normalizedQuery = query.toLowerCase();
    return parts.map((part, index) => part.toLowerCase() === normalizedQuery ? _jsx("mark", { children: part }, `${part}-${index}`) : _jsx("span", { children: part }, `${part}-${index}`));
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export default NormativeDocumentPage;
