import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ProjectDocumentSection from "./ProjectDocumentSection";
import ProjectDocumentTable from "./ProjectDocumentTable";
export function DynamicRcAppendix({ summaryRows, zoneRows }) {
    return (_jsxs(ProjectDocumentSection, { id: "appendix-c", title: "\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0412. \u041F\u043E\u0434\u0440\u043E\u0431\u043D\u044B\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B RC-\u043C\u043E\u0434\u0435\u043B\u0438", pageBreak: true, children: [_jsx("p", { className: "document-paragraph", children: "\u0421\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u044B\u0439 \u0440\u0430\u0441\u0447\u0435\u0442. \u041D\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u0435\u0442 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u043D\u0443\u044E \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443 \u043F\u043E \u0421\u041F 50." }), summaryRows.length ? (_jsx(ProjectDocumentTable, { title: "\u0421\u0432\u043E\u0434\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u0434\u0438\u043D\u0430\u043C\u0438\u0447\u0435\u0441\u043A\u043E\u0439 RC-\u043C\u043E\u0434\u0435\u043B\u0438", columns: [
                    { label: "Показатель", width: "52%" },
                    { label: "Ед. изм.", width: "16%" },
                    { label: "Значение", align: "right" },
                ], rows: summaryRows.map((row) => ({
                    key: row.key,
                    cells: [row.label, row.unit || "—", row.value],
                })) })) : null, zoneRows.length ? (_jsx(ProjectDocumentTable, { title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u0438 \u043F\u043E \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F\u043C", columns: [
                    { label: "Помещение", width: "28%" },
                    { label: "Температура, °C", align: "right" },
                    { label: "Дискомфорт, ч", align: "right" },
                    { label: "Пик, Вт/м²", align: "right" },
                    { label: "Энергия, кВт·ч/м²", align: "right" },
                    { label: "Статус", width: "16%" },
                ], rows: zoneRows.map((row) => ({
                    key: row.key,
                    cells: [
                        row.zoneName,
                        row.temperature,
                        row.discomfortHours,
                        row.peakSpecificLoad,
                        row.specificEnergy,
                        row.status,
                    ],
                })) })) : (_jsx("p", { children: "\u041F\u043E\u0434\u0440\u043E\u0431\u043D\u044B\u0435 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B RC-\u043C\u043E\u0434\u0435\u043B\u0438 \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u044B." }))] }));
}
export default DynamicRcAppendix;
