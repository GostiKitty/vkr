/** Длительность сценария в часах (календарная, не число шагов). */
export function getThermalSimulationDurationHours(duration) {
    return duration === "7d" ? 24 * 7 : 24;
}
export function formatThermalSimulationPeriodRu(duration) {
    return duration === "7d" ? "7 суток (168 ч)" : "24 ч";
}
/**
 * Короткие выводы по результатам зональной RC‑модели (прототип ВКР, не замена полноформатного ТПР).
 */
export function buildThermalSimulationInsightLines(result, options) {
    const lines = [];
    const d = result.diagnostics;
    if (d) {
        const b = d.building;
        const eng = d.engineering;
        lines.push(`${eng.calculationLevelRu}. Дискретный баланс: ${eng.discreteBalanceEquation}. Инфильтрация (сенсибельная модель воздухообмена): ${eng.infiltrationConductanceFormula}. ${eng.notSp50NormativeCheckRu}`);
        lines.push(`Разрез потерь (срез при пике Σ Q̇_ot по зонам, t≈${b.referenceTimeHours.toFixed(1)} ч, Tₙ≈${b.referenceOutdoorC.toFixed(1)} °C; ${eng.envelopeLossSliceFormula}): непрозрачная часть ${b.lossSharePercent.opaque.toFixed(0)}%, окна ${b.lossSharePercent.window.toFixed(0)}%, двери ${b.lossSharePercent.door.toFixed(0)}%, инфильтрация ${(b.infiltrationShareOfTotalPct ?? b.lossSharePercent.infiltration).toFixed(0)}% от всех теплопотерь.`);
        lines.push(`Удельные показатели за период (RC): пик ≈ ${b.specificPeakLoad_W_m2.toFixed(1)} Вт/м² пола зон, энергия ≈ ${b.specificEnergyKWh_m2.toFixed(2)} кВт·ч/м² пола зон. Остаток r в срезе (алгебраический, с Σ_k G_k,ext(T_i−T_n) и G_inf(T_i−T_n), без max(0,·) как в долях «зимних» потерь): ${b.balanceResidualW.toFixed(0)} Вт (${(100 * b.balanceRelativeResidual).toFixed(1)}% от масштаба мощностей), статус: ${b.balanceStatus}. ${b.balanceStatusNoteRu}`);
    }
    const period = formatThermalSimulationPeriodRu(options.duration);
    const area = options.totalHeatedAreaM2;
    const peak = result.summary.peakLoadKW;
    const energy = result.summary.totalEnergyKWh;
    const discomfort = result.summary.discomfortHours;
    lines.push(`Период расчёта: ${period}. Пиковая мощность отопления — максимум по времени суммы мощностей по всем зонам (одновременная нагрузка на «систему»).`);
    lines.push(`Тепловая энергия за период — интеграл суммарной мощности отопления: ${energy.toFixed(1)} кВт·ч (пропорционально длине шага).`);
    lines.push(`Показатель дискомфорта — сумма по зонам времени, когда температура зоны ниже уставки более чем на 0,05 °C; при нескольких зонах число может превышать длительность периода.`);
    if (area && area > 1 && Number.isFinite(peak)) {
        const wPerM2 = (peak * 1000) / area;
        if (wPerM2 > 90) {
            lines.push(`Пиковая удельная нагрузка около ${wPerM2.toFixed(0)} Вт/м² по отапливаемой площади — относительно высоко для учебного прототипа; имеет смысл проверить наружные ограждения, инфильтрацию и запасной наружный контур зон без фасада.`);
        }
        else if (wPerM2 < 25) {
            lines.push(`Пиковая удельная нагрузка около ${wPerM2.toFixed(0)} Вт/м² — низкая относительно типичных ориентиров; убедитесь, что модель геометрии и режимы соответствуют задумке сценария.`);
        }
    }
    if (discomfort > 0) {
        if (discomfort > getThermalSimulationDurationHours(options.duration) * 0.25) {
            lines.push("Значительная доля периода с температурой ниже уставки: для прототипа это сигнал проверить уставки, притоки и потери; не трактуйте как нормативный показатель комфорта.");
        }
        else {
            lines.push("Наблюдается умеренный дискомфорт по критерию уставки; оценка грубая (одноточечная температура зоны).");
        }
    }
    const roomTemps = Object.values(result.rooms).map((r) => r.timeline[r.timeline.length - 1]?.temperatureC).filter((t) => Number.isFinite(t));
    if (roomTemps.length >= 2) {
        const spread = Math.max(...roomTemps) - Math.min(...roomTemps);
        if (spread > 3) {
            lines.push(`Разброс конечных температур по зонам около ${spread.toFixed(1)} °C — заметная неравномерность режима в рамках зональной модели.`);
        }
    }
    return lines;
}
/** Короткие выводы по результатам Монте‑Карло (учебный сценарий, не замена полного риск‑анализа). */
export function buildMonteCarloInterpretationLines(result, heatingThresholdKW) {
    const lines = [];
    lines.push(result.engineeringScopeRu);
    lines.push(`Прогоны: ${result.runs}, детерминированный seed: ${result.seed} (повторяемость при тех же входных данных).`);
    const peak = result.peakLoad;
    const spread = peak.p95 - peak.p5;
    if (spread > Math.max(peak.p50 * 0.35, 1e-6)) {
        lines.push("Заметный разброс между P5 и P95 — результат чувствителен к неопределённости исходных данных в рамках выбранных распределений.");
    }
    if (peak.conditionalValueAtRisk > peak.valueAtRisk * 1.08) {
        lines.push("CVaR заметно выше VaR: в «хвосте» сценариев средняя пиковая нагрузка существенно тяжелее, чем на границе перцентиля.");
    }
    if (heatingThresholdKW !== undefined && result.exceedanceProbability !== undefined) {
        if (result.exceedanceProbability > 0.2) {
            lines.push(`Высокая доля прогонов (${(result.exceedanceProbability * 100).toFixed(0)}%) с пиком выше ${heatingThresholdKW} кВт — осторожно трактуйте как инженерный сигнал по выборке, а не как готовую вероятность для проектной документации.`);
        }
        else if (result.exceedanceProbability < 0.05) {
            lines.push("Вероятность превышения порога по выборке невелика; при увеличении числа прогонов оценка обычно стабилизируется.");
        }
    }
    lines.push("Показатель «условный год (365×)» — это 365× среднесуточная энергия за смоделированный период (24 ч или 7 суток), упрощённая экстраполяция для сравнения сценариев, не нормативный годовой расход.");
    return lines;
}
