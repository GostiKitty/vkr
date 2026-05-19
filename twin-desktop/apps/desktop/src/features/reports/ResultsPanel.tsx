import React, { useEffect, useMemo, useState } from "react";
import type { SimulationFrame, ThermalGraph } from "../../entities/twin/types";
import { useTwinStore } from "../../entities/twin/twin.store";
import { EngineeringCallout, EngineeringMetricTile, EngineeringSectionHeader, TemperatureScaleLegend } from "../../shared/ui";
import { Tabs } from "../../shared/ui";
import SpaceDetails from "../twin/SpaceDetails";
import SpaceList from "../twin/SpaceList";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import ReportGenerator from "./ReportGenerator";
import MetricsResultsTab from "./MetricsResultsTab";
import { formatTemperature, temperatureToColor } from "../twin/twin.theme";

type WorkspaceTab = "overview" | "metrics" | "view3d";

interface ResultsPanelProps {
  projectId: string | null;
}

const tabItems = [
  {
    id: "overview" as const,
    label: "Помещения",
    hint: "Список зон и карточка выбранного помещения",
  },
  {
    id: "metrics" as const,
    label: "Показатели",
    hint: "KPI, графики T(t) и доли потерь после зонального расчёта",
  },
  {
    id: "view3d" as const,
    label: "Карта и связи",
    hint: "3D-окраска и граф тепловых связей зон (не CFD)",
  },
];

const calculationContours = [
  {
    id: "rc",
    title: "RC-модель помещения",
    description: "Основной зональный расчёт во времени: температуры, энергия, пиковая нагрузка и сценарный Monte Carlo поверх RC.",
  },
  {
    id: "engineering",
    title: "Инженерный квазистационарный баланс",
    description: "Разложение потерь по ограждениям, окнам, дверям, вентиляции и инфильтрации для инженерной интерпретации результата.",
  },
  {
    id: "sp50",
    title: "Проверка по СП 50",
    description: "Отдельный нормативный контур по ограждающим конструкциям. Не равен RC-результатам и не заменяется ими.",
  },
  {
    id: "transient1d",
    title: "1D transient расчёт конструкции",
    description: "Отдельный послойный нестационарный анализ конструкции. Используется как самостоятельный контур, а не как часть основного RC solver.",
  },
  {
    id: "legacy",
    title: "Legacy report / legacy Monte Carlo path",
    description: "Устаревший отчётный контур по данным Twin API. Требует синхронизации с основным расчётом конструктора и помечается отдельно.",
  },
] as const;

export function ResultsPanel(_props: ResultsPanelProps) {
  const frames = useTwinStore((state) => state.simulationFrames);
  const timeIndex = useTwinStore((state) => state.timeIndex);
  const setTimeIndex = useTwinStore((state) => state.setTimeIndex);
  const thermalGraph = useTwinStore((state) => state.thermalGraph);
  const simulationDataSource = useTwinStore((state) => state.simulationDataSource);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const setWorkflowStep = useWorkflowStore((state) => state.setCurrentStep);

  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const currentFrame = frames[timeIndex] ?? null;
  const timeLabel = currentFrame ? formatTime(currentFrame.time) : "—";

  const frameTempRange = useMemo(() => {
    const t = currentFrame?.temperatures;
    if (!t) {
      return { min: null as number | null, max: null as number | null };
    }
    const vals = Object.values(t).filter((v): v is number => Number.isFinite(v));
    if (!vals.length) {
      return { min: null, max: null };
    }
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [currentFrame]);

  useEffect(() => {
    if (!playing || frames.length < 2) {
      return;
    }
    const interval = setInterval(() => {
      const { setTimeIndex: update, timeIndex: current } = useTwinStore.getState();
      const next = current + 1 >= frames.length ? 0 : current + 1;
      update(next);
    }, 800);
    return () => clearInterval(interval);
  }, [playing, frames.length]);

  useEffect(() => {
    if (!frames.length) {
      setPlaying(false);
    }
  }, [frames.length]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTimeIndex(Number(event.target.value));
  };

  const handlePlayToggle = () => {
    if (!frames.length) {
      return;
    }
    setPlaying((prev) => !prev);
  };

  const tabContent: Record<WorkspaceTab, React.ReactNode> = {
    overview: (
      <div className="grid gap-4 lg:grid-cols-[1fr,0.7fr]">
        <SpaceList />
        <SpaceDetails />
      </div>
    ),
    metrics: (
      <MetricsResultsTab onRecalculate={() => setWorkflowStep("solve")} />
    ),
    view3d: (
      <div className="space-y-4">
        <SpaceViewer3D heatmap caption="Температурная визуализация по зонам" height={420} showLegend showFitControl />
        <GraphPanel graph={thermalGraph} frame={currentFrame} selectedId={selectedSpaceId} onSelect={selectSpace} />
      </div>
    ),
  };

  return (
    <div className="flex min-h-0 flex-col gap-6">
      <div className="ui-panel shrink-0 p-5 ring-1 ring-[color:var(--accent-muted)]/30 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <EngineeringSectionHeader
            kicker="Результаты"
            title="Обзор после расчёта"
            subtitle="Сдвигайте момент времени, чтобы увидеть, как меняются зональные температуры. Вкладки: помещения, показатели расчёта, 3D и граф связей."
          />
          {simulationDataSource === "demo" && frames.length > 0 ? (
            <span className="mt-2 inline-flex rounded-full border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--warning-fg)]">
              Демо-кадры twin
            </span>
          ) : simulationDataSource === "computed" ? (
            <span className="mt-2 inline-flex rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-2.5 py-1 text-xs font-medium text-[color:var(--success-fg)]">
              После расчёта RC
            </span>
          ) : null}
          {frames.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <EngineeringMetricTile
                label="Кадры по времени"
                value={frames.length}
                hint="Дискретные шаги после зонального расчёта"
                tone="neutral"
              />
              <EngineeringMetricTile
                label="Текущий кадр"
                value={timeIndex + 1}
                unit={` / ${frames.length}`}
                hint="Позиция на временной оси"
                tone="neutral"
              />
              <EngineeringMetricTile
                label="Мин. T по зонам (кадр)"
                value={frameTempRange.min == null ? "—" : formatTemperature(frameTempRange.min)}
                hint="Минимум по всем зонам в выбранный момент"
                tone="neutral"
              />
              <EngineeringMetricTile
                label="Макс. T по зонам (кадр)"
                value={frameTempRange.max == null ? "—" : formatTemperature(frameTempRange.max)}
                hint="Максимум по всем зонам в выбранный момент"
                tone="neutral"
              />
            </div>
          ) : null}
          <div className="mt-5 flex w-full flex-col gap-3 xl:max-w-md">
            <div className="flex items-center justify-between text-sm font-medium text-[color:var(--text-muted)]">
              <span>Момент времени</span>
              <span className="tabular-nums text-[color:var(--text-base)]">{timeLabel}</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              value={timeIndex}
              onChange={handleSliderChange}
              className="w-full accent-[color:var(--accent-base)]"
              disabled={!frames.length}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePlayToggle}
                disabled={!frames.length}
                className={
                  !frames.length
                    ? "cursor-not-allowed rounded-full px-4 py-2 text-sm font-semibold opacity-45 ui-btn-secondary"
                    : playing
                      ? "ui-btn-secondary rounded-full px-4 py-2 text-sm"
                      : "ui-btn-primary rounded-full px-4 py-2 text-sm"
                }
              >
                {playing ? "Пауза" : "Пуск по шагам"}
              </button>
              <span className="text-xs text-[color:var(--text-soft)]">
                {frames.length ? `${frames.length} шагов` : "Сначала выполните расчёт на шаге «Расчёт» студии"}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("view3d")}
                className="ui-btn-secondary ml-auto px-3 py-1.5 text-xs"
              >
                Показать на модели
              </button>
            </div>
            {frameTempRange.min != null && frameTempRange.max != null && (
              <p className="text-xs text-[color:var(--text-muted)]">
                В выбранный момент по зонам:{" "}
                <span className="font-semibold tabular-nums text-[color:var(--text-base)]">
                  {formatTemperature(frameTempRange.min)} … {formatTemperature(frameTempRange.max)}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0">
        <div className="ui-panel-muted mb-4 space-y-3 rounded-2xl p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[color:var(--text-base)]">Расчётные контуры</p>
            <p className="text-sm text-[color:var(--text-muted)]">
              В результатах одновременно присутствуют несколько независимых расчётных контуров. Их нужно читать раздельно, а не как один общий solver.
            </p>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {calculationContours.map((contour) => (
              <article
                key={contour.id}
                className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3"
              >
                <p className="text-sm font-semibold text-[color:var(--text-base)]">{contour.title}</p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{contour.description}</p>
              </article>
            ))}
          </div>
        </div>
        <Tabs<WorkspaceTab>
          tabs={tabItems}
          value={activeTab}
          onChange={setActiveTab}
        />
        <p className="mt-2 text-xs text-[color:var(--text-soft)]">
          Подсказка: наведите на вкладку — краткое описание. Сценарии и параметры неопределённости настраиваются в конструкторе проекта.
        </p>
      </div>

      <EngineeringCallout variant="info" title="Температурная карта и 3D">
        <p>
          Температурная карта построена по зональной модели и не является CFD. Окраска отражает усреднённые по объёму зоны
          температуры RC-модели. Колёсико мыши — масштаб, перетаскивание — обзор.
        </p>
      </EngineeringCallout>

      <div className="ui-panel min-h-0 p-4 sm:p-5 xl:p-6">
        {tabContent[activeTab]}
      </div>

      <div id="report-generator-anchor" className="shrink-0 scroll-mt-28">
        <ReportGenerator />
      </div>
    </div>
  );
}

function GraphPanel({
  graph,
  frame,
  selectedId,
  onSelect,
}: {
  graph: ThermalGraph | null;
  frame: SimulationFrame | null;
  selectedId: string | null;
  onSelect: (spaceId: string | null) => void;
}) {
  if (!graph || !graph.nodes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-muted)] p-4 text-sm text-[color:var(--text-muted)]">
        Тепловой граф появится после загрузки модели и появления кадров симуляции в студии.
      </div>
    );
  }

  const width = 600;
  const height = 320;
  const nodes = graph.nodes;
  const edges = graph.edges;
  const frameTemps = frame
    ? Object.values(frame.temperatures).filter((value): value is number => Number.isFinite(value))
    : [];
  const dynamicMin = frameTemps.length ? Math.min(...frameTemps) : 15;
  const dynamicMax = frameTemps.length ? Math.max(...frameTemps) : 30;
  const legendMin = Math.min(15, dynamicMin);
  const legendMax = Math.max(30, dynamicMax);
  const scaleClamped = dynamicMin < 15 || dynamicMax > 30;
  const positions = new Map<string, { x: number; y: number }>();
  const spaceNodes = nodes.filter((node) => node.type === "space");
  const radius = Math.min(width, height) / 2 - 40;

  spaceNodes.forEach((node, index) => {
    const angle = (index / Math.max(spaceNodes.length, 1)) * Math.PI * 2;
    positions.set(node.id, {
      x: width / 2 + radius * Math.cos(angle),
      y: height / 2 + radius * Math.sin(angle),
    });
  });
  positions.set("outdoor", { x: width / 2, y: 40 });

  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Тепловой граф зон</h3>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">
            Условная зональная модель. Толщина линии ∝ проводимость (Вт/К). Не CFD.
          </p>
        </div>
        <TemperatureScaleLegend
          caption={
            scaleClamped
              ? `Шкала ${legendMin.toFixed(0)}…${legendMax.toFixed(0)} °C (кадр: ${dynamicMin.toFixed(1)}…${dynamicMax.toFixed(1)} °C).`
              : `Шкала ${legendMin.toFixed(0)}…${legendMax.toFixed(0)} °C для узлов кадра.`
          }
        />
      </div>
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} className="max-w-full">
          {edges.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) {
              return null;
            }
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--chart-edge)"
                strokeWidth={Math.max(1, edge.conductance * 4)}
                strokeOpacity={0.85}
              />
            );
          })}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) {
              return null;
            }
            const temp = frame?.temperatures[node.id] ?? node.initialTemp;
            const color = temperatureToColor(temp, legendMin, legendMax);
            const displayLabel = node.id === "outdoor" ? "Наружный воздух" : node.label;
            const isSelected = selectedId === node.id;
            return (
              <g
                key={node.id}
                onClick={() => node.type === "space" && onSelect(node.id)}
                cursor={node.type === "space" ? "pointer" : "default"}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 18 : 14}
                  fill={color}
                  stroke={node.type === "space" ? "var(--text-base)" : "var(--text-soft)"}
                  strokeWidth={node.type === "space" ? 2 : 1}
                  opacity={node.type === "space" ? 0.95 : 0.7}
                />
                <text x={pos.x} y={pos.y + 30} textAnchor="middle" className="text-xs font-medium fill-[color:var(--text-muted)]">
                  {displayLabel}
                </text>
                <text x={pos.x} y={pos.y + 44} textAnchor="middle" className="text-[10px] fill-[color:var(--text-soft)]">
                  {formatTemperature(temp)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function formatTime(timeHours: number) {
  const hours = Math.floor(timeHours);
  const minutes = Math.round((timeHours - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export default ResultsPanel;
