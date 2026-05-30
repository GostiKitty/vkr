import { jsx as _jsx } from "react/jsx-runtime";
import ProjectDocumentSection from "./ProjectDocumentSection";
import ProjectDocumentTable from "./ProjectDocumentTable";
export function EnvelopeElementsAppendix({ rows }) {
    return (_jsx(ProjectDocumentSection, { id: "appendix-b", title: "\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0411. \u0412\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C \u043E\u0433\u0440\u0430\u0436\u0434\u0430\u044E\u0449\u0438\u0445 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439", pageBreak: true, children: rows.length ? (_jsx(ProjectDocumentTable, { title: "\u041F\u043E\u043B\u043D\u0430\u044F \u0432\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C \u043E\u0433\u0440\u0430\u0436\u0434\u0430\u044E\u0449\u0438\u0445 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439", columns: [
                { label: "Элемент", width: "24%" },
                { label: "Тип", width: "16%" },
                { label: "Площадь, м²", align: "right" },
                { label: "Rфакт", align: "right" },
                { label: "Rнорм", align: "right" },
                { label: "U", align: "right" },
                { label: "Статус", width: "14%" },
                { label: "Примечание", width: "22%" },
            ], rows: rows.map((row) => ({
                key: row.key,
                cells: [
                    row.elementName,
                    row.typeLabel,
                    row.area,
                    row.actualResistance,
                    row.requiredResistance,
                    row.uValue,
                    row.status,
                    row.note,
                ],
            })), note: "\u042D\u043B\u0435\u043C\u0435\u043D\u0442\u044B \u0441 \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u043E\u043C \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0438\u043B\u0438 \u043D\u0435\u043F\u043E\u043B\u043D\u044B\u043C \u043F\u043E\u0441\u043B\u043E\u0439\u043D\u044B\u043C \u0441\u043E\u0441\u0442\u0430\u0432\u043E\u043C \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u044B \u043A\u0430\u043A \u0442\u0440\u0435\u0431\u0443\u044E\u0449\u0438\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438." })) : (_jsx("p", { children: "\u0412\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C \u043E\u0433\u0440\u0430\u0436\u0434\u0430\u044E\u0449\u0438\u0445 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439 \u043D\u0435 \u0441\u0444\u043E\u0440\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u0430." })) }));
}
export default EnvelopeElementsAppendix;
