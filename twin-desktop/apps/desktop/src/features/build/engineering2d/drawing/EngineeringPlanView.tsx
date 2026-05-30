import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { BuildingModel } from "../../../../entities/geometry/types";
import type { EngineeringMedium } from "../../../../entities/engineering/types";
import { DEFAULT_SHEET_PRESET, SHEET_PRESETS, type SheetMetrics } from "./drawingTheme";
import {
  computePlanBounds,
  computePlanScale,
  expandBounds,
  makeProjection,
  type PlanBounds,
} from "./geometry";
import ArchitectureLayer from "./layers/ArchitectureLayer";
import EngineeringRoutesLayer from "./layers/EngineeringRoutesLayer";
import EquipmentSymbolsLayer from "./layers/EquipmentSymbolsLayer";
import LabelsLayer from "./layers/LabelsLayer";
import SheetLayer, { type SheetMetadata } from "./layers/SheetLayer";

export type EngineeringPlanLayerId =
  | "sheet"
  | "architecture"
  | "engineering"
  | "equipment"
  | "labels";

export interface EngineeringPlanLayerVisibility {
  sheet: boolean;
  architecture: boolean;
  engineering: boolean;
  equipment: boolean;
  labels: boolean;
  arrows: boolean;
  pipeLabels: boolean;
  equipmentLabels: boolean;
}

export const DEFAULT_ENGINEERING_PLAN_LAYERS: EngineeringPlanLayerVisibility = {
  sheet: true,
  architecture: true,
  engineering: true,
  equipment: true,
  labels: true,
  arrows: true,
  pipeLabels: true,
  equipmentLabels: true,
};

export const DEFAULT_VISIBLE_MEDIA: EngineeringMedium[] = [
  "supply",
  "return",
  "dhw",
  "coldWater",
  "drain",
  "electric",
  "signal",
];

export interface EngineeringPlanViewHandle {
  getSvgElement: () => SVGSVGElement | null;
}

export interface EngineeringPlanViewProps {
  model: BuildingModel;
  activeLevelId: string | null;
  sheetPreset?: keyof typeof SHEET_PRESETS;
  layers?: Partial<EngineeringPlanLayerVisibility>;
  visibleMedia?: EngineeringMedium[];
  metadata?: Partial<SheetMetadata>;
  className?: string;
  responsive?: boolean;
}

function resolveLayers(partial?: Partial<EngineeringPlanLayerVisibility>): EngineeringPlanLayerVisibility {
  return { ...DEFAULT_ENGINEERING_PLAN_LAYERS, ...(partial ?? {}) };
}

function deriveScaleLabel(metersPerPx: number): string {
  if (!Number.isFinite(metersPerPx) || metersPerPx <= 0) return "1:100";
  // 1 px ≈ 0.265 мм при 96 dpi
  const mmPerMeterReal = 1000;
  const mmPerPx = 0.2645833;
  const drawingMmPerMeter = mmPerPx / metersPerPx;
  const ratio = mmPerMeterReal / Math.max(1e-6, drawingMmPerMeter);
  const candidates = [50, 75, 100, 150, 200, 250, 500, 1000];
  const closest = candidates.reduce((best, current) =>
    Math.abs(Math.log(current / ratio)) < Math.abs(Math.log(best / ratio)) ? current : best,
    candidates[0]
  );
  return `1:${closest}`;
}

function fitProjection(bounds: PlanBounds, metrics: SheetMetrics) {
  const padded = expandBounds(bounds, 1.0);
  const stampPad = metrics.stamp.height + 24;
  const drawableWidth = Math.max(120, metrics.width - metrics.margin.left - metrics.margin.right - 48);
  const drawableHeight = Math.max(120, metrics.height - metrics.margin.top - metrics.margin.bottom - stampPad);
  const scale = computePlanScale(padded, drawableWidth, drawableHeight, { minScale: 6, maxScale: 220 });
  const projected = {
    width: padded.width * scale,
    height: padded.height * scale,
  };
  const offsetX = metrics.margin.left + Math.max(24, (drawableWidth - projected.width) / 2);
  const offsetY = metrics.margin.top + Math.max(24, (drawableHeight - projected.height) / 2);
  return { projection: makeProjection(padded, scale, offsetX, offsetY), scale };
}

function inferDefaultTitle(model: BuildingModel, activeLevelId: string | null): string {
  if (!activeLevelId) return "План инженерных сетей";
  const level = model.levels.find((l) => l.id === activeLevelId);
  if (!level) return "План инженерных сетей";
  return `План инженерных сетей. ${level.name}`;
}

const EngineeringPlanView = forwardRef<EngineeringPlanViewHandle, EngineeringPlanViewProps>(function EngineeringPlanView(
  { model, activeLevelId, sheetPreset = DEFAULT_SHEET_PRESET, layers, visibleMedia, metadata, className, responsive = true },
  ref
) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  useImperativeHandle(ref, () => ({ getSvgElement: () => svgRef.current }));

  const resolvedLayers = useMemo(() => resolveLayers(layers), [layers]);
  const media = useMemo(() => new Set(visibleMedia ?? DEFAULT_VISIBLE_MEDIA), [visibleMedia]);

  const sheetMetrics = SHEET_PRESETS[sheetPreset];
  const bounds = useMemo(() => computePlanBounds(model, activeLevelId), [model, activeLevelId]);
  const { projection, scale } = useMemo(() => fitProjection(bounds, sheetMetrics), [bounds, sheetMetrics]);

  const today = new Date();
  const isoDate = `${today.getDate().toString().padStart(2, "0")}.${(today.getMonth() + 1)
    .toString()
    .padStart(2, "0")}.${today.getFullYear()}`;
  const resolvedMetadata: SheetMetadata = {
    title: metadata?.title ?? inferDefaultTitle(model, activeLevelId),
    subtitle: metadata?.subtitle ?? "Инженерные сети — план / схема",
    projectName: metadata?.projectName ?? "",
    drawingNumber: metadata?.drawingNumber ?? "ОВ-1",
    stage: metadata?.stage ?? "Р",
    sheetNumber: metadata?.sheetNumber ?? "1",
    scale: metadata?.scale ?? deriveScaleLabel(1 / scale),
    date: metadata?.date ?? isoDate,
    author: metadata?.author ?? "",
    reviewer: metadata?.reviewer ?? "",
  };

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      data-component="engineering-plan-view"
      viewBox={`0 0 ${sheetMetrics.width} ${sheetMetrics.height}`}
      width={responsive ? "100%" : sheetMetrics.width}
      height={responsive ? "100%" : sheetMetrics.height}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ display: "block", background: "#e8e8e0" }}
    >
      {resolvedLayers.sheet ? (
        <SheetLayer
          metrics={sheetMetrics}
          metadata={resolvedMetadata}
          visibleMedia={Array.from(media)}
        />
      ) : (
        <rect x={0} y={0} width={sheetMetrics.width} height={sheetMetrics.height} fill="#fbfbf7" />
      )}

      {resolvedLayers.architecture ? (
        <ArchitectureLayer model={model} activeLevelId={activeLevelId} projection={projection} />
      ) : null}

      {resolvedLayers.engineering ? (
        <EngineeringRoutesLayer
          model={model}
          activeLevelId={activeLevelId}
          projection={projection}
          visibleMedia={media}
          showArrows={resolvedLayers.arrows}
          showLabels={resolvedLayers.pipeLabels}
        />
      ) : null}

      {resolvedLayers.equipment ? (
        <EquipmentSymbolsLayer
          model={model}
          activeLevelId={activeLevelId}
          projection={projection}
          showLabels={resolvedLayers.equipmentLabels}
        />
      ) : null}

      {resolvedLayers.labels ? (
        <LabelsLayer model={model} activeLevelId={activeLevelId} projection={projection} />
      ) : null}
    </svg>
  );
});

export default EngineeringPlanView;
