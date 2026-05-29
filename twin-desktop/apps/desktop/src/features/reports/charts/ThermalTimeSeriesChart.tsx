import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ThermalSimulationResult } from "../../../core/thermal/solver";
import type { ResultSyncState } from "../../../shared/utils/modelSync";
import { EmptyState, MetricInfoTooltip } from "../../../shared/ui";
import { formatEnergy, formatNumber } from "../../../shared/utils/format";
import { resultsMetricInfo } from "../resultsMetricInfo";
import { CHART_AXIS_TICK, CHART_MARGIN, CHART_TOOLTIP_STYLE } from "./thermalChartTheme";

type ChartMode = "temperature" | "heating";

export type ThermalTimeSeriesHeatingDisplay = "raw" | "equipment";

interface RoomOption {
  id: string;
  label: string;
}

interface ThermalTimeSeriesChartProps {
  result: ThermalSimulationResult | null;
  roomId: string | null;
  roomOptions: RoomOption[];
  onSelectRoom?: (roomId: string | null) => void;
  resultState?: ResultSyncState;
  simulationSource?: "demo" | "computed" | null;
  onRunCalculation?: () => void;
  /** raw — шаги RC; equipment — ограничение и инерция, близко к работе реального источника. */
  heatingDisplay?: ThermalTimeSeriesHeatingDisplay;
  /** Установленная мощность отопления для режима equipment, кВт. */
  installedCapacityKW?: number | null;
}

interface ChartPoint {
  timeHours: number;
  /** Температура воздуха в зоне, °C. Из room.timeline[i].temperatureC (RC-состояние). */
  airTemperatureC: number | null;
  /** Уставка отопления в момент времени, °C. Из room.timeline[i].setpointC (добавлен в solver). */
  setpointC: number | null;
  /** Мощность отопления по шагу RC, кВт. */
  heatingPowerKW: number | null;
  /** Значение для линии на графике (может отличаться при сглаживании). */
  heatingPowerDisplayKW: number | null;
}

const UNDERLAY_GRID_COLOR = "rgba(148, 163, 184, 0.16)";
const TEMPERATURE_LINE_COLOR = "#2563eb";
const SETPOINT_LINE_COLOR = "#64748b";
const HEATING_LINE_COLOR = "#c67b2f";

const IS_DEV = typeof import.meta !== "undefined" && (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Builds chart points from a room's own timeline (self-contained, no cross-index lookup). */
function buildChartPoints(
  result: ThermalSimulationResult,
  roomId: string
): ChartPoint[] {
  const roomData = result.rooms[roomId];
  if (!roomData) {
    return [];
  }
  const roomTimeline = roomData.timeline;
  if (!roomTimeline.length) {
    return [];
  }

  return roomTimeline.map((pt, index) => {
    // Primary source: room timeline (now includes setpointC from solver)
    const airTemperatureC = toFiniteNumber(pt.temperatureC);
    const heatingPowerW = toFiniteNumber(pt.heatingPowerW);

    // setpointC: prefer room timeline (added in solver fix), fall back to main frame
    let setpointC = toFiniteNumber(pt.setpointC);
    if (setpointC === null) {
      // Fallback: index-based lookup into result.timeline
      const frame = result.timeline[index];
      setpointC = toFiniteNumber(frame?.rooms?.[roomId]?.setpointC);
    }

    const heatingPowerKW = heatingPowerW !== null ? heatingPowerW / 1000 : null;
    return {
      timeHours: toFiniteNumber(pt.timeHours) ?? index * (result.timeline[1]?.timeHours ?? 1),
      airTemperatureC,
      setpointC,
      heatingPowerKW,
      heatingPowerDisplayKW: heatingPowerKW,
    };
  });
}

function resolveEquipmentCapacityKW(points: ChartPoint[], installedCapacityKW: number | null): number {
  if (installedCapacityKW != null && installedCapacityKW > 0) {
    return installedCapacityKW;
  }
  const values = points.map((pt) => pt.heatingPowerKW).filter(isFiniteNumber);
  if (!values.length) {
    return 10;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? sorted[sorted.length - 1];
  return Math.max(0.5, p90 * 1.08);
}

function applyMovingAverageKW(values: Array<number | null>, windowSteps: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSteps + 1);
    const slice = values.slice(start, index + 1).filter(isFiniteNumber);
    if (!slice.length) {
      return 0;
    }
    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
  });
}

/** Ограничение мощности + сглаживание ~2 ч + ограничение скорости набора нагрузки. */
function applyEquipmentLikeDisplay(points: ChartPoint[], installedCapacityKW: number | null): ChartPoint[] {
  if (points.length < 2) {
    return points;
  }

  const capKW = resolveEquipmentCapacityKW(points, installedCapacityKW);
  const timestepHours = resolveTimestepHours(points);
  const windowSteps = Math.max(4, Math.min(18, Math.round(2 / Math.max(timestepHours, 1 / 12))));
  const maxRampKWPerStep = Math.max(0.08, capKW * Math.min(0.2, (0.12 * timestepHours) / 0.167));

  const capped = points.map((pt) =>
    isFiniteNumber(pt.heatingPowerKW)
      ? { ...pt, heatingPowerDisplayKW: Math.min(pt.heatingPowerKW, capKW) }
      : { ...pt, heatingPowerDisplayKW: null }
  );

  const averaged = applyMovingAverageKW(
    capped.map((pt) => pt.heatingPowerDisplayKW),
    windowSteps
  );

  let previous: number | null = null;
  return capped.map((pt, index) => {
    if (!isFiniteNumber(averaged[index])) {
      previous = null;
      return { ...pt, heatingPowerDisplayKW: null };
    }
    let next = Math.min(averaged[index], capKW);
    if (previous != null) {
      next = Math.max(previous - maxRampKWPerStep, Math.min(previous + maxRampKWPerStep, next));
    }
    previous = next;
    return { ...pt, heatingPowerDisplayKW: next };
  });
}

function enrichPlottedPoints(
  points: ChartPoint[],
  heatingDisplay: ThermalTimeSeriesHeatingDisplay,
  installedCapacityKW: number | null
): ChartPoint[] {
  if (heatingDisplay !== "equipment" || points.length < 2) {
    return points;
  }
  return applyEquipmentLikeDisplay(points, installedCapacityKW);
}

/** Emits a dev-mode diagnostic log for the chart to help debug data issues. */
function devLogChartDiagnostics(
  roomId: string | null,
  roomLabel: string | null,
  data: ChartPoint[],
  result: ThermalSimulationResult | null
): void {
  if (!IS_DEV) {
    return;
  }
  const availableRoomIds = result
    ? Object.entries(result.rooms)
        .filter(([, r]) => r.timeline.length > 0)
        .map(([id]) => id)
    : [];
  const tempPoints = data.filter((pt) => isFiniteNumber(pt.airTemperatureC));
  const heatingPoints = data.filter((pt) => isFiniteNumber(pt.heatingPowerKW));

  // eslint-disable-next-line no-console
  console.group("[ThermalTimeSeriesChart] dev diagnostics");
  // eslint-disable-next-line no-console
  console.log({
    selectedRoomId: roomId,
    selectedRoomName: roomLabel,
    matchedZoneId: roomId && result?.rooms[roomId] ? roomId : null,
    countTemperaturePoints: tempPoints.length,
    countHeatingPoints: heatingPoints.length,
    firstTemperaturePoint: tempPoints[0] ?? null,
    lastTemperaturePoint: tempPoints[tempPoints.length - 1] ?? null,
    availableRoomIdsWithTimeline: availableRoomIds,
  });
  if (tempPoints.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      "[ThermalTimeSeriesChart] ⚠ No finite airTemperatureC values found. " +
        "Check that result.rooms[roomId].timeline is populated and temperatureC is a finite number."
    );
  }
  if (data.every((pt) => pt.setpointC === null)) {
    // eslint-disable-next-line no-console
    console.warn(
      "[ThermalTimeSeriesChart] ⚠ All setpointC values are null. " +
        "Ensure solver pushes setpointC in history.timeline.push, or result.timeline[i].rooms[roomId].setpointC exists."
    );
  }
  // eslint-disable-next-line no-console
  console.groupEnd();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThermalTimeSeriesChart({
  result,
  roomId,
  roomOptions,
  onSelectRoom,
  resultState = "current",
  simulationSource = "computed",
  onRunCalculation,
  heatingDisplay = "raw",
  installedCapacityKW = null,
}: ThermalTimeSeriesChartProps) {
  const [mode, setMode] = useState<ChartMode>("temperature");

  const selectedRoom = useMemo(
    () => roomOptions.find((room) => room.id === roomId) ?? null,
    [roomId, roomOptions]
  );

  const data = useMemo<ChartPoint[]>(() => {
    if (!result || !roomId) {
      return [];
    }
    return enrichPlottedPoints(buildChartPoints(result, roomId), heatingDisplay, installedCapacityKW);
  }, [result, roomId, heatingDisplay, installedCapacityKW]);

  const heatingIsEquipment = heatingDisplay === "equipment";

  // Emit dev diagnostics after data is computed
  useMemo(() => {
    devLogChartDiagnostics(roomId, selectedRoom?.label ?? null, data, result);
  }, [data, roomId, selectedRoom, result]);

  const stats = useMemo(() => {
    if (!result || !roomId || !result.rooms[roomId]) {
      return null;
    }
    const room = result.rooms[roomId];
    const temperatures = data
      .map((pt) => pt.airTemperatureC)
      .filter((v): v is number => isFiniteNumber(v));
    const peakHeatingW = room.timeline.reduce(
      (peak, pt) => (Number.isFinite(pt.heatingPowerW) ? Math.max(peak, pt.heatingPowerW) : peak),
      0
    );
    const timestepHours = resolveTimestepHours(room.timeline);
    const heatingRuntimeHours = room.timeline.reduce(
      (sum, pt) => sum + (Number.isFinite(pt.heatingPowerW) && pt.heatingPowerW > 1 ? timestepHours : 0),
      0
    );
    return {
      averageTemperatureC:
        temperatures.length > 0 ? temperatures.reduce((s, v) => s + v, 0) / temperatures.length : null,
      peakHeatingKW: peakHeatingW / 1000,
      energyKWh: Number.isFinite(room.dailyEnergyKWh) ? room.dailyEnergyKWh : null,
      heatingRuntimeHours,
    };
  }, [result, roomId, data]);

  const periodLabel = useMemo(() => buildPeriodLabel(data), [data]);
  const peakExplanation = useMemo(() => buildPeakExplanation(data), [data]);

  const temperatureDomain = useMemo(() => {
    const values = data
      .flatMap((pt) => [pt.airTemperatureC, pt.setpointC])
      .filter(isFiniteNumber);
    if (!values.length) {
      return [18, 24] as [number, number];
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Ensure a minimum visible span of 2°C so lines don't collapse to an invisible dot
    const span = Math.max(max - min, 2);
    const margin = Math.max(0.6, span * 0.08);
    return [
      Math.floor((min - margin) * 2) / 2,
      Math.ceil((max + margin) * 2) / 2,
    ] as [number, number];
  }, [data]);

  const heatingDomain = useMemo(() => {
    const values = data.map((pt) => pt.heatingPowerDisplayKW).filter(isFiniteNumber);
    const max = values.length ? Math.max(...values) : 1;
    return [0, Math.max(0.5, Math.ceil(max * 10) / 10)] as [number, number];
  }, [data]);

  const hasTemperatureSeries = useMemo(
    () => data.some((pt) => isFiniteNumber(pt.airTemperatureC) || isFiniteNumber(pt.setpointC)),
    [data]
  );
  const hasHeatingSeries = useMemo(
    () => data.some((pt) => isFiniteNumber(pt.heatingPowerDisplayKW)),
    [data]
  );

  // All three Lines are always rendered (hidden via the `hide` prop), so pass all data.
  // DO NOT filter by mode here — Recharts 2 does not traverse Fragments, so Lines must
  // be direct children and data must cover all series at once.
  const plottedData = data;

  // ---------------------------------------------------------------------------
  // Guard renders
  // ---------------------------------------------------------------------------

  if (resultState === "stale") {
    return (
      <ChartState
        title="Результаты устарели"
        message="График относится к предыдущей версии модели. Модель изменилась после последнего расчёта."
        buttonLabel="Пересчитать по текущей модели"
        onClick={onRunCalculation}
      />
    );
  }

  if (simulationSource === "demo" && !result) {
    return (
      <ChartState
        title="Нет актуальных расчётных данных"
        message="Для текущей модели нет RC-ряда. Добавьте помещения в конструкторе или запустите расчёт."
        buttonLabel="Запустить расчёт"
        onClick={onRunCalculation}
      />
    );
  }

  if (!result) {
    return (
      <ChartState
        title="Нет расчётных данных"
        message="Запустите расчёт, чтобы увидеть динамику температуры и мощности."
        buttonLabel="Запустить расчёт"
        onClick={onRunCalculation}
      />
    );
  }

  if (!roomOptions.length) {
    return (
      <ChartState
        title="Нет помещений текущей модели"
        message="Сначала создайте помещения в модели, затем запустите расчёт."
        buttonLabel="Запустить расчёт"
        onClick={onRunCalculation}
      />
    );
  }

  if (!roomId || !selectedRoom) {
    return (
      <section className="ui-chart-shell">
        <ChartHeader
          roomId={roomId}
          roomOptions={roomOptions}
          onSelectRoom={onSelectRoom}
          periodLabel={periodLabel}
        />
        <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-5">
          <EmptyState
            title="Выберите помещение"
            message="График строится для отдельного помещения текущей модели."
          />
        </div>
      </section>
    );
  }

  // No data at all for any room
  if (!roomId || !data.length) {
    return (
      <section className="ui-chart-shell">
        <ChartHeader
          roomId={roomId}
          roomOptions={roomOptions}
          onSelectRoom={onSelectRoom}
          periodLabel={null}
        />
        <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-5">
          <EmptyState
            title="Нет температурного временного ряда"
            message="Проверьте запуск RC-расчёта. Данные timeline не найдены ни для одного помещения."
          />
        </div>
      </section>
    );
  }

  // Mode-specific empty guard
  if (
    (mode === "temperature" && (!hasTemperatureSeries || !data.length)) ||
    (mode === "heating" && (!hasHeatingSeries || !data.length))
  ) {
    return (
      <section className="ui-chart-shell">
        <ChartHeader
          roomId={roomId}
          roomOptions={roomOptions}
          onSelectRoom={onSelectRoom}
          periodLabel={periodLabel}
        />
        <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-5">
          <EmptyState
            title={
              mode === "temperature"
                ? "Нет температурного временного ряда"
                : "Нет данных мощности отопления"
            }
            message={
              mode === "temperature"
                ? "Для выбранного помещения отсутствуют данные температуры воздуха и уставки в RC timeline. Проверьте запуск RC-расчёта."
                : "Для выбранного помещения отсутствуют данные мощности отопления."
            }
          />
        </div>
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Normal render
  // ---------------------------------------------------------------------------

  const roomLabel = selectedRoom?.label ?? roomId;

  return (
    <section className="ui-chart-shell">
      <ChartHeader roomId={roomId} roomOptions={roomOptions} onSelectRoom={onSelectRoom} periodLabel={periodLabel} />

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MetricPill label="Средняя температура" value={formatTemperatureValue(stats?.averageTemperatureC ?? null)} />
        <MetricPill label="Пиковая мощность" value={formatPowerValue(stats?.peakHeatingKW ?? null)} />
        <MetricPill label="Энергия за период" value={formatEnergy(stats?.energyKWh ?? null, "кВт·ч")} />
        <MetricPill
          label="Время работы отопления"
          value={stats == null ? "—" : `${formatNumber(stats.heatingRuntimeHours, { maximumFractionDigits: 1 })} ч`}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("temperature")}
          className={mode === "temperature" ? "ui-btn-primary px-3 py-1.5 text-xs" : "ui-btn-secondary px-3 py-1.5 text-xs"}
        >
          Температура
        </button>
        <button
          type="button"
          onClick={() => setMode("heating")}
          className={mode === "heating" ? "ui-btn-primary px-3 py-1.5 text-xs" : "ui-btn-secondary px-3 py-1.5 text-xs"}
        >
          Отопление
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--text-muted)]">
        {mode === "temperature" ? (
          <>
            <LegendSwatch color={TEMPERATURE_LINE_COLOR} label="Температура воздуха, °C" />
            <LegendSwatch color={SETPOINT_LINE_COLOR} dashed label="Уставка, °C" />
          </>
        ) : (
          <LegendSwatch
            color={HEATING_LINE_COLOR}
            label={
              heatingIsEquipment ? "Нагрузка (огранич. источник), кВт" : "Тепловая нагрузка, кВт"
            }
          />
        )}
      </div>

      <div className="ui-chart-shell__body mt-3 h-[min(320px,42vh)] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={plottedData} margin={CHART_MARGIN} accessibilityLayer>
            <CartesianGrid stroke={UNDERLAY_GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="timeHours"
              tick={CHART_AXIS_TICK}
              tickFormatter={(value) =>
                formatTimeAxisTick(Number(value), data[data.length - 1]?.timeHours ?? 24)
              }
              ticks={buildTimeTicks(data[data.length - 1]?.timeHours ?? 24)}
              minTickGap={12}
            />
            {mode === "temperature" ? (
              <YAxis
                domain={temperatureDomain}
                tick={CHART_AXIS_TICK}
                tickFormatter={(value) => `${formatNumber(Number(value), { maximumFractionDigits: 0 })}`}
                width={44}
                label={{
                  value: "°C",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--text-soft)", fontSize: 11, textAnchor: "middle" },
                }}
              />
            ) : (
              <YAxis
                domain={heatingDomain}
                tick={CHART_AXIS_TICK}
                tickFormatter={(value) => formatNumber(Number(value), { maximumFractionDigits: 1 })}
                width={52}
                label={{
                  value: "кВт",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "var(--text-soft)", fontSize: 11, textAnchor: "middle" },
                }}
              />
            )}
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelFormatter={(label) => `Время: ${formatTooltipTime(Number(label))}`}
              formatter={(value: number, name: string) => {
                // In heating mode hide temperature entries; in temperature mode hide heating entry
                if (mode === "heating" && (name === "Температура воздуха, °C" || name === "Уставка, °C")) {
                  return null as unknown as [string, string];
                }
                if (
                  mode === "temperature" &&
                  (name === "Тепловая нагрузка, кВт" || name === "Нагрузка (огранич. источник), кВт")
                ) {
                  return null as unknown as [string, string];
                }
                if (name === "Температура воздуха, °C" || name === "Уставка, °C") {
                  return [`${formatNumber(value, { maximumFractionDigits: 1 })} °C`, name];
                }
                const heatingLabel = heatingIsEquipment ? "источник" : "нагрузка";
                return [`${formatNumber(value, { maximumFractionDigits: 2 })} кВт (${heatingLabel})`, name];
              }}
            />
            {/*
              IMPORTANT: Recharts 2 does NOT traverse React Fragments when resolving Line children.
              All <Line> components must be direct children of <LineChart> (no Fragment wrapper).
              Use the `hide` prop to show/hide per mode instead.
            */}
            <Line
              type="monotone"
              dataKey="airTemperatureC"
              name="Температура воздуха, °C"
              stroke={TEMPERATURE_LINE_COLOR}
              strokeWidth={2.2}
              dot={data.length <= 2 ? { r: 2.5 } : false}
              activeDot={{ r: 3 }}
              connectNulls
              hide={mode !== "temperature"}
            />
            <Line
              type="stepAfter"
              dataKey="setpointC"
              name="Уставка, °C"
              stroke={SETPOINT_LINE_COLOR}
              strokeDasharray="5 4"
              strokeWidth={1.6}
              dot={data.length <= 2 ? { r: 2 } : false}
              activeDot={{ r: 2 }}
              connectNulls
              hide={mode !== "temperature"}
            />
            <Line
              type="monotone"
              dataKey="heatingPowerDisplayKW"
              name={heatingIsEquipment ? "Нагрузка (огранич. источник), кВт" : "Тепловая нагрузка, кВт"}
              stroke={HEATING_LINE_COLOR}
              strokeWidth={2.2}
              dot={data.length <= 2 ? { r: 2.5 } : false}
              activeDot={{ r: 3 }}
              connectNulls
              hide={mode !== "heating"}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-col gap-1 text-sm text-[color:var(--text-muted)]">
        {mode === "heating" ? (
          <p className="text-xs text-[color:var(--text-soft)]">
            {heatingIsEquipment
              ? "Оранжевая кривая — потребность с учётом установленной мощности и инерции источника (~2 ч), как у реального котла. KPI «Пиковая мощность» — по сырому RC без этой обработки."
              : "Тепловая нагрузка по шагам RC без сглаживания. Данные пересчитываются по текущей модели и сценарию."}
          </p>
        ) : null}
        {peakExplanation ? <p>{peakExplanation}</p> : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChartHeader({
  roomId,
  roomOptions,
  onSelectRoom,
  periodLabel,
}: {
  roomId: string | null;
  roomOptions: RoomOption[];
  onSelectRoom?: (roomId: string | null) => void;
  periodLabel: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-base font-semibold text-[color:var(--text-base)]">Динамика температуры и отопления</p>
          <MetricInfoTooltip {...resultsMetricInfo.rcBalance} />
        </div>
        {periodLabel ? <p className="mt-1 text-xs text-[color:var(--text-soft)]">Расчётный период: {periodLabel}.</p> : null}
      </div>

      <label className="block w-full lg:max-w-xs">
        <span className="mb-1 block text-sm font-semibold text-[color:var(--text-base)]">Помещение</span>
        <select
          value={roomId ?? ""}
          onChange={(event) => onSelectRoom?.(event.target.value || null)}
          className="ui-field w-full px-3 py-2 text-sm shadow-inner"
        >
          <option value="">Выберите помещение</option>
          {roomOptions.map((room) => (
            <option key={room.id} value={room.id}>
              {room.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ChartState({
  title,
  message,
  buttonLabel,
  onClick,
}: {
  title: string;
  message: string;
  buttonLabel?: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <section className="ui-chart-shell">
      <EmptyState title={title} message={message} />
      {buttonLabel && onClick ? (
        <div className="mt-4">
          <button type="button" onClick={onClick} className="ui-btn-primary px-4 py-2 text-sm">
            {buttonLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-4 py-3">
      <p className="text-sm font-semibold text-[color:var(--text-muted)]">{label}</p>
      <p className="mt-1 text-base font-semibold text-[color:var(--text-base)]">{value}</p>
    </div>
  );
}

function LegendSwatch({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="h-[2px] w-6"
        style={{
          backgroundImage: dashed
            ? `repeating-linear-gradient(to right, ${color}, ${color} 6px, transparent 6px, transparent 10px)`
            : "none",
          backgroundColor: dashed ? "transparent" : color,
        }}
      />
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function resolveTimestepHours(points: Array<{ timeHours: number }>): number {
  if (points.length < 2) {
    return 0;
  }
  const delta = points[1].timeHours - points[0].timeHours;
  return Number.isFinite(delta) && delta > 0 ? delta : 0;
}

function buildPeriodLabel(data: ChartPoint[]): string | null {
  if (!data.length) {
    return null;
  }
  const maxTime = data[data.length - 1]?.timeHours ?? 0;
  if (!Number.isFinite(maxTime) || maxTime <= 0) {
    return null;
  }
  if (maxTime <= 24.01) {
    return `${formatNumber(maxTime, { maximumFractionDigits: 0 })} ч`;
  }
  const days = maxTime / 24;
  return `${formatNumber(days, { maximumFractionDigits: 0 })} суток`;
}

function buildPeakExplanation(data: ChartPoint[]): string | null {
  const peakIndex = data.reduce((maxIndex, pt, index, items) => {
    const current = pt.heatingPowerKW ?? -Infinity;
    const maxValue = items[maxIndex]?.heatingPowerKW ?? -Infinity;
    return current > maxValue ? index : maxIndex;
  }, 0);
  if (!data.length || peakIndex <= 0) {
    return null;
  }
  const current = data[peakIndex];
  const previous = data[peakIndex - 1];
  if (!isFiniteNumber(current.heatingPowerKW) || current.heatingPowerKW <= 0) {
    return null;
  }
  const setpointStep = (current.setpointC ?? 0) - (previous.setpointC ?? 0);
  if (setpointStep >= 0.4) {
    return "Пик мощности связан с восстановлением температуры до новой уставки.";
  }
  return null;
}

function buildTimeTicks(maxTime: number): number[] {
  if (!Number.isFinite(maxTime) || maxTime <= 0) {
    return [0, 4, 8, 12, 16, 20, 24];
  }
  if (maxTime <= 24.01) {
    return [0, 4, 8, 12, 16, 20, 24].filter((tick) => tick <= maxTime + 0.01);
  }
  const step = maxTime <= 48 ? 8 : 24;
  const ticks: number[] = [];
  for (let value = 0; value <= maxTime + 0.01; value += step) {
    ticks.push(Number(value.toFixed(2)));
  }
  return ticks;
}

function formatTimeAxisTick(value: number, maxTime: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (maxTime <= 24.01) {
    return `${Math.round(value)}`;
  }
  const day = Math.floor(value / 24) + 1;
  const hour = Math.round(value % 24);
  return `Д${day} ${hour}`;
}

function formatTooltipTime(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const totalMinutes = Math.round(value * 60);
  const day = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (day > 0) {
    return `день ${day + 1}, ${hours}:${String(minutes).padStart(2, "0")}`;
  }
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function formatTemperatureValue(value: number | null): string {
  return value == null ? "—" : `${formatNumber(value, { maximumFractionDigits: 1 })} °C`;
}

function formatPowerValue(value: number | null): string {
  return value == null ? "—" : `${formatNumber(value, { maximumFractionDigits: 2 })} кВт`;
}

export default ThermalTimeSeriesChart;
