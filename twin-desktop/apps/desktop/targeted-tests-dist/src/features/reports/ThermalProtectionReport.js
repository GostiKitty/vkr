import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import DocumentNotice from "./DocumentNotice";
import EnergyPassportAppendix from "./EnergyPassportAppendix";
import DynamicRcAppendix from "./DynamicRcAppendix";
import EnvelopeElementsAppendix from "./EnvelopeElementsAppendix";
import ProjectDocumentSection, { ProjectDocumentClause } from "./ProjectDocumentSection";
import ProjectDocumentTable from "./ProjectDocumentTable";
import ProjectDocumentTitlePage from "./ProjectDocumentTitlePage";
import ProjectDocumentToc from "./ProjectDocumentToc";
export function ThermalProtectionReport({ data, sheetRef, }) {
    return (_jsx("div", { className: "document-page", children: _jsxs("div", { ref: sheetRef, className: "document-sheet", children: [_jsx(ProjectDocumentTitlePage, { data: data }), data.warnings.length ? (_jsx(DocumentNotice, { title: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435", variant: "note", children: _jsx("ul", { children: data.warnings.map((warning) => (_jsx("li", { children: warning }, warning))) }) })) : null, _jsx(ProjectDocumentToc, { items: data.toc }), _jsx(ProjectDocumentSection, { id: "report-section-1", number: "1", title: "\u041E\u0431\u0449\u0438\u0435 \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u044F", children: data.generalParagraphs.map((paragraph) => (_jsx("p", { className: "document-paragraph", children: paragraph }, paragraph))) }), _jsx(ProjectDocumentSection, { id: "report-section-2", number: "2", title: "\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435", children: _jsx(ProjectDocumentTable, { title: "\u0418\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0440\u0430\u0441\u0447\u0435\u0442\u0430", columns: [
                            { label: "Показатель", width: "55%" },
                            { label: "Ед. изм.", width: "15%" },
                            { label: "Значение", align: "right" },
                        ], rows: data.sourceDataRows.map((row) => ({
                            key: row.key,
                            cells: [row.label, row.unit || "—", row.value],
                        })) }) }), _jsx(ProjectDocumentSection, { id: "report-section-3", number: "3", title: "\u041A\u0440\u0430\u0442\u043A\u0430\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 \u0437\u0434\u0430\u043D\u0438\u044F", children: _jsx(ProjectDocumentTable, { title: "\u0421\u0432\u043E\u0434\u043D\u044B\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u0437\u0434\u0430\u043D\u0438\u044F", columns: [
                            { label: "Показатель", width: "55%" },
                            { label: "Ед. изм.", width: "15%" },
                            { label: "Значение", align: "right" },
                        ], rows: data.buildingSummaryRows.map((row) => ({
                            key: row.key,
                            cells: [row.label, row.unit || "—", row.value],
                        })) }) }), _jsx(ProjectDocumentSection, { id: "report-section-4", number: "4", title: "\u041A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B", children: _jsx(ProjectDocumentTable, { title: "\u041A\u043B\u0438\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0438 \u044D\u043A\u0441\u043F\u043B\u0443\u0430\u0442\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B", columns: [
                            { label: "Показатель", width: "34%" },
                            { label: "Обозначение", width: "14%" },
                            { label: "Ед. изм.", width: "12%" },
                            { label: "Значение", align: "right" },
                            { label: "Источник / примечание", width: "20%" },
                        ], rows: data.climateRows.map((row) => ({
                            key: row.key,
                            cells: [row.label, row.symbol ?? "—", row.unit || "—", row.value, row.note ?? "—"],
                        })) }) }), _jsx(ProjectDocumentSection, { id: "report-section-5", number: "5", title: "\u041C\u0435\u0442\u043E\u0434\u0438\u043A\u0430 \u0440\u0430\u0441\u0447\u0435\u0442\u0430", children: _jsx("ul", { children: data.methodologyLines.map((line) => (_jsx("li", { children: line }, line))) }) }), _jsx(ProjectDocumentSection, { id: "report-section-6", number: "6", title: "\u0422\u0435\u043F\u043B\u043E\u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0438 \u043E\u0433\u0440\u0430\u0436\u0434\u0430\u044E\u0449\u0438\u0445 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439", pageBreak: true, children: data.envelopeGroupRows.length ? (_jsx(ProjectDocumentTable, { title: "\u0421\u0432\u043E\u0434\u043D\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u043F\u043E \u0442\u0438\u043F\u0430\u043C \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439", columns: [
                            { label: "Тип конструкции", width: "28%" },
                            { label: "Количество элементов", align: "right" },
                            { label: "Площадь, м²", align: "right" },
                            { label: "Rфакт", align: "right" },
                            { label: "Rнорм", align: "right" },
                            { label: "U", align: "right" },
                            { label: "Статус", width: "16%" },
                        ], rows: data.envelopeGroupRows.map((row) => ({
                            key: row.key,
                            cells: [
                                row.typeLabel,
                                row.elementCount,
                                row.area,
                                row.actualResistance,
                                row.requiredResistance,
                                row.uValue,
                                row.status,
                            ],
                        })), note: "\u041F\u043E\u0434\u0440\u043E\u0431\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0447\u0435\u043D\u044C \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u043F\u0440\u0438\u0432\u0435\u0434\u0435\u043D \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u0411." })) : (_jsx("p", { children: "\u0421\u0432\u043E\u0434\u043D\u0430\u044F \u0442\u0430\u0431\u043B\u0438\u0446\u0430 \u043F\u043E \u043E\u0433\u0440\u0430\u0436\u0434\u0430\u044E\u0449\u0438\u043C \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u044F\u043C \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0430." })) }), _jsxs(ProjectDocumentSection, { id: "report-section-7", number: "7", title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0441\u043E\u043F\u0440\u043E\u0442\u0438\u0432\u043B\u0435\u043D\u0438\u044F \u0442\u0435\u043F\u043B\u043E\u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0435", children: [_jsx(ProjectDocumentClause, { title: "\u0421\u0432\u043E\u0434\u043D\u0430\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430", children: _jsx("p", { className: "document-paragraph", children: data.conclusions.normative }) }), data.criticalEnvelopeRows.length ? (_jsx(ProjectDocumentTable, { title: "\u041D\u0430\u0438\u0431\u043E\u043B\u0435\u0435 \u043A\u0440\u0438\u0442\u0438\u0447\u043D\u044B\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B", columns: [
                                { label: "Элемент", width: "24%" },
                                { label: "Тип", width: "16%" },
                                { label: "Площадь, м²", align: "right" },
                                { label: "Rфакт", align: "right" },
                                { label: "Rнорм", align: "right" },
                                { label: "Статус", width: "16%" },
                                { label: "Примечание", width: "20%" },
                            ], rows: data.criticalEnvelopeRows.map((row) => ({
                                key: row.key,
                                cells: [
                                    row.elementName,
                                    row.typeLabel,
                                    row.area,
                                    row.actualResistance,
                                    row.requiredResistance,
                                    row.status,
                                    row.note,
                                ],
                            })), note: "\u041F\u043E\u043B\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0447\u0435\u043D\u044C \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u043E\u0432 \u0441 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430\u043C\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043F\u0440\u0438\u0432\u0435\u0434\u0435\u043D \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u0411." })) : (_jsx("p", { children: "\u041A\u0440\u0438\u0442\u0438\u0447\u043D\u044B\u0435 \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u043F\u043E \u0441\u043E\u043F\u0440\u043E\u0442\u0438\u0432\u043B\u0435\u043D\u0438\u044E \u0442\u0435\u043F\u043B\u043E\u043F\u0435\u0440\u0435\u0434\u0430\u0447\u0435 \u043D\u0435 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u044B." }))] }), _jsxs(ProjectDocumentSection, { id: "report-section-8", number: "8", title: "\u0423\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0442\u0435\u043F\u043B\u043E\u0437\u0430\u0449\u0438\u0442\u043D\u0430\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 \u0437\u0434\u0430\u043D\u0438\u044F", children: [_jsx(ProjectDocumentTable, { title: "\u0421\u0432\u043E\u0434\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0442\u0435\u043F\u043B\u043E\u0437\u0430\u0449\u0438\u0442\u044B \u0437\u0434\u0430\u043D\u0438\u044F", columns: [
                                { label: "Показатель", width: "55%" },
                                { label: "Ед. изм.", width: "15%" },
                                { label: "Значение", align: "right" },
                            ], rows: data.thermalProtectionSummaryRows.map((row) => ({
                                key: row.key,
                                cells: [row.label, row.unit || "—", row.value],
                            })) }), _jsx("p", { className: "document-paragraph", children: data.thermalProtectionConclusion })] }), _jsxs(ProjectDocumentSection, { id: "report-section-9", number: "9", title: "\u042D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 \u0438 \u0440\u0430\u0441\u0445\u043E\u0434 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0439 \u044D\u043D\u0435\u0440\u0433\u0438\u0438", children: [data.energyAvailable ? (_jsx(ProjectDocumentTable, { title: "\u042D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 \u0437\u0434\u0430\u043D\u0438\u044F", columns: [
                                { label: "Показатель", width: "55%" },
                                { label: "Ед. изм.", width: "15%" },
                                { label: "Значение", align: "right" },
                            ], rows: data.energyRows.map((row) => ({
                                key: row.key,
                                cells: [row.label, row.unit || "—", row.value],
                            })) })) : (_jsx("p", { children: "\u042D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043A\u0430 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u0430 \u0438\u0437-\u0437\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0442\u043A\u0430 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445." })), data.energyNote ? _jsx("p", { className: "document-paragraph", children: data.energyNote }) : null] }), _jsxs(ProjectDocumentSection, { id: "report-section-10", number: "10", title: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043E\u0446\u0435\u043D\u043A\u0430 \u0442\u0435\u043F\u043B\u043E\u0432\u043E\u0433\u043E \u0440\u0435\u0436\u0438\u043C\u0430", children: [_jsx("p", { className: "document-paragraph", children: DYNAMIC_NOTE }), data.dynamicAvailable ? (_jsxs(_Fragment, { children: [_jsx(ProjectDocumentTable, { title: "\u0421\u0432\u043E\u0434\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 RC-\u043C\u043E\u0434\u0435\u043B\u0438", columns: [
                                        { label: "Показатель", width: "55%" },
                                        { label: "Ед. изм.", width: "15%" },
                                        { label: "Значение", align: "right" },
                                    ], rows: data.dynamicRows.map((row) => ({
                                        key: row.key,
                                        cells: [row.label, row.unit || "—", row.value],
                                    })) }), _jsx(ProjectDocumentTable, { title: "\u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0440\u0430\u0441\u0447\u0435\u0442\u043D\u044B\u0445 \u043F\u043E\u0442\u0435\u0440\u044C", columns: [
                                        { label: "Показатель", width: "32%" },
                                        { label: "Значение, Вт", align: "right" },
                                        { label: "Примечание", width: "42%" },
                                    ], rows: data.dynamicLossRows.map((row) => ({
                                        key: row.key,
                                        cells: [row.label, row.value, row.note],
                                    })) })] })) : (_jsx("p", { children: "\u0414\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u0430\u044F RC-\u043E\u0446\u0435\u043D\u043A\u0430 \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0430." })), data.dynamicProblemZones.length ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "document-paragraph", children: "\u041F\u0440\u043E\u0431\u043B\u0435\u043C\u043D\u044B\u0435 \u0437\u043E\u043D\u044B \u043F\u043E RC-\u043C\u043E\u0434\u0435\u043B\u0438:" }), _jsx("ul", { children: data.dynamicProblemZones.map((zone) => (_jsx("li", { children: zone }, zone))) })] })) : null] }), _jsxs(ProjectDocumentSection, { id: "report-section-11", number: "11", title: "\u0412\u044B\u0432\u043E\u0434\u044B", children: [_jsx(ProjectDocumentClause, { number: "\u0430)", title: "\u041F\u043E \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u043E\u0439 \u0442\u0435\u043F\u043B\u043E\u0437\u0430\u0449\u0438\u0442\u0435", children: _jsx("p", { className: "document-paragraph", children: data.conclusions.normative }) }), _jsx(ProjectDocumentClause, { number: "\u0431)", title: "\u041F\u043E \u044D\u043D\u0435\u0440\u0433\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044F\u043C", children: _jsx("p", { className: "document-paragraph", children: data.conclusions.energy }) }), _jsx(ProjectDocumentClause, { number: "\u0432)", title: "\u041F\u043E \u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u0442\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u043E\u0439 \u043E\u0446\u0435\u043D\u043A\u0435", children: _jsx("p", { className: "document-paragraph", children: data.conclusions.dynamic }) }), _jsx(ProjectDocumentClause, { number: "\u0433)", title: "\u041F\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u044E\u0449\u0438\u043C \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u043C \u0434\u0430\u043D\u043D\u044B\u043C", children: _jsx("p", { className: "document-paragraph", children: data.conclusions.missing }) })] }), _jsx(ProjectDocumentSection, { id: "report-section-12", number: "12", title: "\u041F\u0435\u0440\u0435\u0447\u0435\u043D\u044C \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u044E\u0449\u0438\u0445 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445", children: data.missingData.length ? (_jsx("ul", { children: data.missingData.map((item) => (_jsx("li", { children: item }, item))) })) : (_jsx("p", { children: "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u044E\u0449\u0438\u0435 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435, \u043A\u0440\u0438\u0442\u0438\u0447\u043D\u044B\u0435 \u0434\u043B\u044F \u0441\u0432\u043E\u0434\u043D\u043E\u0433\u043E \u043E\u0442\u0447\u0435\u0442\u0430, \u043D\u0435 \u0432\u044B\u044F\u0432\u043B\u0435\u043D\u044B." })) }), _jsx(EnergyPassportAppendix, { rows: data.appendices.energyPassportRows }), _jsx(EnvelopeElementsAppendix, { rows: data.appendices.envelopeRows }), _jsx(DynamicRcAppendix, { summaryRows: data.appendices.rcSummaryRows, zoneRows: data.appendices.rcZoneRows }), _jsxs("div", { className: "document-signature", children: [_jsxs("div", { children: [_jsx("span", { children: "\u0420\u0430\u0437\u0440\u0430\u0431\u043E\u0442\u0430\u043B" }), _jsx("strong", { children: "______________________________" }), _jsx("p", { className: "document-signature__name", children: data.metadata.developedBy })] }), _jsxs("div", { children: [_jsx("span", { children: "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u043B" }), _jsx("strong", { children: "______________________________" }), _jsx("p", { className: "document-signature__name", children: data.metadata.checkedBy })] }), _jsxs("div", { children: [_jsx("span", { children: "\u0413\u0418\u041F" }), _jsx("strong", { children: "______________________________" }), _jsx("p", { className: "document-signature__name", children: data.metadata.chiefEngineer })] })] })] }) }));
}
const DYNAMIC_NOTE = "Справочный расчет. Не заменяет нормативную проверку по СП 50.";
export default ThermalProtectionReport;
