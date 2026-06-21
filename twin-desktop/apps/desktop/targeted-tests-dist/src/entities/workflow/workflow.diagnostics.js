export function evaluateWorkflowDiagnostics(context) {
    const geometryMissing = [];
    if (context.twinSpaces <= 0 && context.localRooms <= 0) {
        geometryMissing.push("Импортируйте IFC или создайте помещения в Build Mode.");
    }
    const envelopeMissing = [];
    if (geometryMissing.length) {
        envelopeMissing.push("Сначала завершите шаг «Геометрия».");
    }
    else {
        const hasEnvelope = context.twinEnvelope > 0 || context.localWalls > 0;
        if (!hasEnvelope) {
            envelopeMissing.push("Добавьте стены и материалы, чтобы рассчитать теплопотери.");
        }
        else if (context.localWalls > 0 && context.wallsMissingAssemblies > 0) {
            envelopeMissing.push(`Назначьте материалы для ${context.wallsMissingAssemblies} стен.`);
        }
    }
    const scenarioMissing = [];
    if (envelopeMissing.length || geometryMissing.length) {
        scenarioMissing.push("Заполните предыдущие шаги перед настройкой сценария.");
    }
    else if (!context.scenarioConfig) {
        scenarioMissing.push("Укажите климат, уставки и профиль эксплуатации.");
    }
    const solveMissing = [];
    if (scenarioMissing.length) {
        solveMissing.push("Сохраните сценарий, чтобы запустить расчёт.");
    }
    else if (!context.solveCompleted) {
        solveMissing.push("Запустите расчёт, чтобы получить результаты.");
    }
    const uncertaintyMissing = [];
    if (solveMissing.length) {
        uncertaintyMissing.push("Сначала выполните детерминированный расчёт.");
    }
    else if (!context.uncertaintyConfig) {
        uncertaintyMissing.push("Настройте Монте-Карло: количество прогонов и режим.");
    }
    const resultsMissing = [];
    if (solveMissing.length) {
        resultsMissing.push("Получите базовый расчёт, чтобы открыть результаты.");
    }
    else if (!context.resultsAvailable) {
        resultsMissing.push("Нет сохранённых кадров расчёта.");
    }
    return {
        geometry: diagnosticsFrom(geometryMissing),
        envelope: diagnosticsFrom(envelopeMissing),
        scenario: diagnosticsFrom(scenarioMissing),
        solve: diagnosticsFrom(solveMissing),
        uncertainty: diagnosticsFrom(uncertaintyMissing),
        results: diagnosticsFrom(resultsMissing),
    };
}
function diagnosticsFrom(missing) {
    if (!missing.length) {
        return { status: "ready", missing };
    }
    const status = missing.some((item) => item.toLowerCase().includes("сначала"))
        ? "pending"
        : "error";
    return { status, missing };
}
