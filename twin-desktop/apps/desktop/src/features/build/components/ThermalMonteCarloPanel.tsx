import { useCallback, useMemo, useState } from "react";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { AdjacencyResult } from "../../../core/graph/adjacency";
import type { ThermalSimulationOptions } from "../../../core/thermal/solver";
import {
  runThermalMonteCarlo,
  runThermalMonteCarloAsync,
  THERMAL_MONTE_CARLO_MAX_RUNS,
  THERMAL_UNCERTAINTY_DEFINITIONS,
  type ThermalMonteCarloResult,
} from "../../../core/uncertainty/thermalMonteCarlo";
import { buildMonteCarloInterpretationLines } from "../../../core/thermal/thermalResultsInterpretation";
import { formatNumber, formatPercentage } from "../../../shared/utils/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { TooltipProps } from "recharts";
import Tooltip from "../../../shared/ui/Tooltip";

interface ThermalMonteCarloPanelProps {
  model: BuildingModel;
  adjacency: AdjacencyResult;
  options: ThermalSimulationOptions;
}

const DEFAULT_RUNS = 200;
const DEFAULT_SEED = 2026;
const DEFAULT_THRESHOLD = 60;
const DEFAULT_VAR_LEVEL = 0.95;
/** При большем числе прогонов расчёт выполняется асинхронно с уступкой UI между пакетами итераций. */
const MONTE_CARLO_ASYNC_FROM = 80;
const MONTE_CARLO_YIELD_EVERY = 22;
export const THERMAL_MONTE_CARLO_HELP_TEXT =
  "Метод Монте-Карло многократно пересчитывает модель при случайном изменении исходных параметров в заданных пределах. Это помогает оценить диапазон возможных результатов и риск выхода за заданный порог, а не только одно расчетное значение.";

export function ThermalMonteCarloPanel({ model, adjacency, options }: ThermalMonteCarloPanelProps) {
  const [runs, setRuns] = useState(DEFAULT_RUNS);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [threshold, setThreshold] = useState<number | "">(DEFAULT_THRESHOLD);
  const [varLevel, setVarLevel] = useState(DEFAULT_VAR_LEVEL);
  const [correlationInput, setCorrelationInput] = useState(buildIdentityMatrixText(THERMAL_UNCERTAINTY_DEFINITIONS.length));
  const [correlationError, setCorrelationError] = useState<string | null>(null);
  const [result, setResult] = useState<ThermalMonteCarloResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const histogramData = useMemo(() => {
    if (!result) {
      return [];
    }
    return result.peakLoad.histogram.map((bin, index) => ({
      id: index,
      label: `${bin.binStart.toFixed(1)}–${bin.binEnd.toFixed(1)}`,
      count: bin.count,
      probability: bin.probability * 100,
      mid: bin.mid,
    }));
  }, [result]);

  const cdfData = useMemo(() => {
    if (!result) {
      return [];
    }
    return result.peakLoad.cdf.map((point) => ({
      value: point.value,
      probability: point.probability * 100,
    }));
  }, [result]);

  const monteCarloInsightLines = useMemo(() => {
    if (!result) {
      return [];
    }
    const thresholdKW = threshold === "" ? undefined : Number(threshold);
    return buildMonteCarloInterpretationLines(result, Number.isFinite(thresholdKW) ? thresholdKW : undefined);
  }, [result, threshold]);

  const geometryBlockedReason = useMemo(() => {
    if (!model.rooms.length) {
      return "Добавьте хотя бы одно помещение на вкладке «План».";
    }
    if (!model.walls.length) {
      return "Добавьте стены на плане или используйте инструмент «Стены из комнат» в палитре построения.";
    }
    return null;
  }, [model.rooms.length, model.walls.length]);

  const canRun = geometryBlockedReason === null;

  const handleRun = useCallback(async () => {
    if (!canRun) {
      setError("Добавьте геометрию, чтобы выполнить расчёт неопределённостей.");
      return;
    }
    setError(null);
    setCorrelationError(null);
    let parsedMatrix: number[][] | undefined;
    try {
      parsedMatrix = parseCorrelationMatrix(correlationInput, THERMAL_UNCERTAINTY_DEFINITIONS.length);
    } catch (matrixError) {
      const message = matrixError instanceof Error ? matrixError.message : "Матрица корреляций некорректна.";
      setCorrelationError(message);
      return;
    }
    setRunning(true);
    setProgress(0);
    try {
      const thresholdValue = threshold === "" ? undefined : Number(threshold);
      const runCount = Math.max(1, runs);
      const baseArgs = {
        model,
        adjacency,
        baseOptions: options,
        runs: runCount,
        seed,
        heatingThresholdKW: thresholdValue,
        varLevel,
        correlationMatrix: parsedMatrix,
        onProgress: (completed: number, total: number) => {
          setProgress(completed / total);
        },
      };
      const data =
        runCount >= MONTE_CARLO_ASYNC_FROM
          ? await runThermalMonteCarloAsync({ ...baseArgs, yieldEvery: MONTE_CARLO_YIELD_EVERY })
          : runThermalMonteCarlo(baseArgs);
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось выполнить расчёт Монте‑Карло.";
      setError(message);
    } finally {
      setRunning(false);
      setTimeout(() => setProgress(0), 300);
    }
  }, [adjacency, canRun, correlationInput, model, options, runs, seed, threshold, varLevel]);

  const stats = result?.peakLoad;
  const energyStats = result?.annualEnergy;
  const exceedProbability =
    result?.exceedanceProbability !== undefined
      ? formatPercentage(result.exceedanceProbability)
      : "—";
  const varDisplay = result ? `${formatNumber(result.peakLoad.valueAtRisk, { maximumFractionDigits: 1 })} кВт` : "—";
  const cvarDisplay = result ? `${formatNumber(result.peakLoad.conditionalValueAtRisk, { maximumFractionDigits: 1 })} кВт` : "—";

  return (
    <section className="min-w-0 space-y-4 overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4 shadow-sm">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Неопределённость</p>
        <h2 className="text-2xl font-semibold text-[color:var(--text-base)]">Вероятностная оценка риска</h2>
        <p className="text-sm text-[color:var(--text-soft)]">
          {THERMAL_MONTE_CARLO_HELP_TEXT}
        </p>
        <p className="text-sm text-[color:var(--text-soft)]">
          Зачем это нужно: чтобы понять, насколько результат устойчив к неточности исходных данных и какие параметры сильнее всего влияют на риск перегрузки или дискомфорта.
        </p>
        <p className="mt-2 text-xs text-[color:var(--text-soft)]">
          Гистограмма и CDF ниже — наглядное дополнение к числам P5/P50/P95: показывают форму распределения пиковой нагрузки и накопленную
          долю сценариев. Для быстрой оценки достаточно перцентилей; графики полезны в пояснительной записке ВКР.
        </p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <div className="min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Настройки поиска</h3>
            <div className="mt-3 space-y-3">
              <LabelledInput
                label="Число прогонов"
                value={runs}
                min={10}
                max={THERMAL_MONTE_CARLO_MAX_RUNS}
                step={10}
                onChange={(value) => {
                  if (typeof value === "number") {
                    setRuns(Math.max(1, Math.min(THERMAL_MONTE_CARLO_MAX_RUNS, value)));
                  }
                }}
              />
              {runs >= MONTE_CARLO_ASYNC_FROM && (
                <p className="text-xs text-[color:var(--warning-fg)]">
                  При {MONTE_CARLO_ASYNC_FROM}+ прогонах расчёт выполняется пакетами, чтобы окно не зависало. Для видео обычно достаточно 150–300 прогонов.
                </p>
              )}
              <LabelledInput
                label="Seed"
                value={seed}
                min={1}
                step={1}
                onChange={(value) => {
                  if (typeof value === "number") {
                    setSeed(value);
                  }
                }}
              />
              <LabelledInput
                label="Порог пиковой нагрузки, кВт"
                value={threshold}
                min={1}
                step={1}
                allowEmpty
                onChange={(value) => setThreshold(value === "" ? "" : value)}
              />
              <LabelledInput
                label="Уровень VaR (0.50–0.99)"
                value={Number(varLevel.toFixed(2))}
                min={0.5}
                max={0.99}
                step={0.01}
                onChange={(value) => {
                  if (typeof value === "number") {
                    setVarLevel(Math.min(0.99, Math.max(0.5, value)));
                  }
                }}
              />
            </div>
            <Tooltip
              className="mt-4 w-full"
              title="Монте‑Карло"
              description="Многократный пересчёт зональной тепловой модели здания с вариацией климатических и режимных параметров."
              details={["Ввод: число прогонов N, seed", "Выход: гистограмма и CDF пиковой нагрузки (кВт), энергии (кВт·ч)"]}
              linkedFormulaIds={["uncertainty_mc", "uncertainty_std", "thermal_peak_load"]}
            >
              <button
                type="button"
                disabled={!canRun || running}
                onClick={() => {
                  void handleRun();
                }}
                className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-muted)] ${
                  !canRun || running ? "cursor-not-allowed bg-[color:var(--surface-strong)] text-[color:var(--text-soft)]" : "bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] hover:brightness-110"
                }`}
              >
                {running ? "Сэмплирую..." : "Запустить вероятностный расчет"}
              </button>
            </Tooltip>
            {!canRun && geometryBlockedReason ? (
              <p className="mt-2 rounded-xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-3 py-2 text-xs text-[color:var(--warning-fg)]">
                {geometryBlockedReason}
              </p>
            ) : null}
            {running && (
              <div className="mt-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
                <p className="font-semibold text-[color:var(--text-muted)]">Прогресс: {(progress * 100).toFixed(0)}%</p>
                <div className="mt-1 h-2 rounded-full bg-[color:var(--surface-strong)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--accent-base)] transition-all duration-200"
                    style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
                  />
                </div>
              </div>
            )}
            {error && (
              <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}
            <details className="mt-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-3 text-xs text-[color:var(--text-muted)]">
              <summary className="cursor-pointer font-semibold text-[color:var(--text-muted)]">Матрица корреляций</summary>
              <p className="mt-2 text-[color:var(--text-soft)]">
                Введите {THERMAL_UNCERTAINTY_DEFINITIONS.length}×{THERMAL_UNCERTAINTY_DEFINITIONS.length} матрицу (значения 1 на диагонали).
              </p>
              <textarea
                className="mt-2 min-h-[140px] w-full resize-y rounded-xl border border-[color:var(--border-soft)] px-2 py-1 text-xs text-[color:var(--text-base)]"
                rows={THERMAL_UNCERTAINTY_DEFINITIONS.length}
                value={correlationInput}
                onChange={(event) => setCorrelationInput(event.target.value)}
              />
              {correlationError && (
                <p className="mt-1 text-xs text-red-600">{correlationError}</p>
              )}
            </details>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <StatBadge label="P5, кВт" value={stats ? formatNumber(stats.p5, { maximumFractionDigits: 1 }) : "—"} />
            <StatBadge label="P50, кВт" value={stats ? formatNumber(stats.p50, { maximumFractionDigits: 1 }) : "—"} />
            <StatBadge label="P95, кВт" value={stats ? formatNumber(stats.p95, { maximumFractionDigits: 1 }) : "—"} />
            <StatBadge
              label="Вероятность превышения"
              value={result ? exceedProbability : "—"}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatBadge
              label={`VaR (${result?.varLevel ? formatPercentage(result.varLevel) : "—"}) пиковой нагрузки, кВт`}
              value={varDisplay}
            />
            <StatBadge label="CVaR пиковой нагрузки, кВт" value={cvarDisplay} />
          </div>
          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Как читать</p>
            <ul className="mt-2 space-y-2">
              <li>P5 / P50 / P95 — 5‑й, 50‑й и 95‑й перцентили пиковых нагрузок (низкий, медианный и высокий сценарии).</li>
              <li>Вероятность превышения — доля прогонов, в которых пик выше заданного порога (частота по выборке, не «истинная» вероятность без модели ошибок).</li>
              <li>VaR — перцентиль пиковой нагрузки; CVaR — среднее значение по сценариям с пиком не ниже VaR (тяжёлый хвост).</li>
            </ul>
            {monteCarloInsightLines.length ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[color:var(--text-muted)]">
                {monteCarloInsightLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Гистограмма пиковой нагрузки</h3>
            <p className="text-xs text-[color:var(--text-soft)]">Количество случаев vs мощность, кВт</p>
            <div className="mt-3 h-[220px] sm:h-[240px]">
              {histogramData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#475569" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
                  <RechartsTooltip content={<HistogramTooltip />} />
                    <Bar dataKey="count" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Кумулятивное распределение</h3>
            <p className="text-xs text-[color:var(--text-soft)]">CDF для пиковой нагрузки</p>
            <div className="mt-3 h-[220px] sm:h-[240px]">
              {cdfData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cdfData}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="value"
                      tickFormatter={(value) => `${formatNumber(value, { maximumFractionDigits: 1 })}`}
                      tick={{ fontSize: 11, fill: "#475569" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      tick={{ fontSize: 11, fill: "#475569" }}
                    />
                  <RechartsTooltip content={<CdfTooltip />} />
                    <Line type="monotone" dataKey="probability" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ChartPlaceholder />
              )}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Энергетические метрики</h3>
            <p className="mt-1 text-xs text-[color:var(--text-soft)]">
              «Условный год» = 365 × среднесуточная энергия за период базового расчёта (24 ч или 7 суток); для сравнения
              сценариев Монте‑Карло, не нормативный годовой расход.
            </p>
            {energyStats ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                <StatBadge
                  label="Условный год (365×), кВт·ч"
                  value={formatNumber(energyStats.mean, { maximumFractionDigits: 0 })}
                />
                <StatBadge
                  label="P95, кВт·ч"
                  value={formatNumber(energyStats.p95, { maximumFractionDigits: 0 })}
                />
                <StatBadge
                  label="σ, кВт·ч"
                  value={formatNumber(energyStats.stdDev, { maximumFractionDigits: 0 })}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-[color:var(--text-soft)]">Запустите анализ, чтобы увидеть распределение энергопотребления.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const LabelledInput = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  allowEmpty,
}: {
  label: string;
  value: number | "";
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | "") => void;
  allowEmpty?: boolean;
}) => (
  <label className="text-xs font-semibold text-[color:var(--text-muted)]">
    {label}
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(event) => {
        if (allowEmpty && event.target.value === "") {
          onChange("");
          return;
        }
        const next = Number(event.target.value);
        if (Number.isNaN(next)) {
          return;
        }
        if (typeof min === "number" && next < min) {
          onChange(min);
          return;
        }
        if (typeof max === "number" && next > max) {
          onChange(max);
          return;
        }
        onChange(next);
      }}
      className="mt-1 w-full rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-base)]"
    />
  </label>
);

const StatBadge = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-center shadow-inner">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">{label}</p>
    <p className="mt-1 text-xl font-semibold text-[color:var(--text-base)]">{value}</p>
  </div>
);

const HistogramTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0];
  const label = entry.payload?.label as string;
  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-lg">
      <p className="font-semibold">{label} кВт</p>
      <p>Сценариев: {entry.value}</p>
    </div>
  );
};

const CdfTooltip = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
  if (!active || !payload?.length) {
    return null;
  }
  const entry = payload[0];
  return (
    <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-lg">
      <p>Нагрузка: {formatNumber(entry.payload.value, { maximumFractionDigits: 1 })} кВт</p>
      <p>Вероятность: {formatNumber(Number(entry.value), { maximumFractionDigits: 1 })}%</p>
    </div>
  );
};

const ChartPlaceholder = () => (
  <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-sm text-[color:var(--text-soft)]">
    Запустите анализ, чтобы увидеть график.
  </div>
);

function buildIdentityMatrixText(size: number): string {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => (row === col ? "1" : "0")).join(" ")
  ).join("\n");
}

function parseCorrelationMatrix(input: string, size: number): number[][] | undefined {
  const trimmed = input.trim();
  if (!trimmed.length) {
    return undefined;
  }
  const rows = trimmed
    .split(/\n+/)
    .map((row) =>
      row
        .trim()
        .split(/[\s,;]+/)
        .filter(Boolean)
        .map(Number)
    )
    .filter((row) => row.length);
  if (rows.length !== size) {
    throw new Error(`Ожидается ${size} строк в матрице корреляций.`);
  }
  rows.forEach((row) => {
    if (row.length !== size) {
      throw new Error(`Каждая строка должна содержать ${size} значений.`);
    }
    if (row.some((value) => Number.isNaN(value))) {
      throw new Error("Матрица содержит нечисловые значения.");
    }
  });
  return rows;
}

export default ThermalMonteCarloPanel;
