import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { polygonArea, segmentLength } from "../../../entities/geometry/geom";
import { firstDisplayText } from "../../../shared/utils/displayText";
export function ModelSummaryPanel({ model, snapshot, issuesCount, compact = false, }) {
    const totalArea = model.rooms.reduce((sum, room) => sum + Math.abs(polygonArea(room.polygon)), 0);
    const wallLength = model.walls.reduce((sum, wall) => sum + segmentLength(wall.a, wall.b), 0);
    const networkCount = model.pipes.length + model.ducts.length;
    const activeEvents = snapshot.events.length;
    const sensorAlerts = snapshot.sensorStates.filter((sensor) => sensor.status !== "normal").length;
    const summaryCards = [
        {
            label: "Помещения",
            value: `${model.rooms.length}`,
            detail: `${totalArea.toFixed(1)} м²`,
        },
        {
            label: "Ограждения",
            value: `${model.walls.length}`,
            detail: `${wallLength.toFixed(1)} м стен`,
        },
        {
            label: "Сети",
            value: `${networkCount}`,
            detail: `${model.sensors.length} датчиков`,
        },
        {
            label: "Проверка",
            value: `${issuesCount}`,
            detail: activeEvents ? `${activeEvents} активных событий` : `${sensorAlerts} сигналов датчиков`,
        },
    ];
    return (_jsxs("section", { className: "ui-panel p-4", children: [_jsxs("header", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "ui-kicker", children: "\u0421\u0432\u043E\u0434\u043A\u0430 \u043C\u043E\u0434\u0435\u043B\u0438" }), _jsx("h3", { className: "truncate text-base font-semibold text-[color:var(--text-base)]", children: firstDisplayText([model.meta?.name], "Текущий BIM-проект") })] }), _jsxs("span", { className: "ui-chip shrink-0 px-3 py-1 text-[11px] font-semibold", children: [model.levels.length, " \u0443\u0440."] })] }), _jsx("div", { className: `grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-2"}`, children: summaryCards.map((card) => (_jsxs("article", { className: "ui-metric flex min-h-[112px] flex-col justify-between p-3.5", children: [_jsx("p", { className: "ui-kicker truncate", children: card.label }), _jsxs("div", { className: "mt-3", children: [_jsx("p", { className: "truncate text-2xl font-semibold text-[color:var(--text-base)]", children: card.value }), _jsx("p", { className: "mt-1 max-h-10 overflow-hidden text-xs leading-5 text-[color:var(--text-soft)]", children: card.detail })] })] }, card.label))) })] }));
}
export default ModelSummaryPanel;
