import React, { useMemo } from "react";
import type { BuildingModel } from "../../../../../entities/geometry/types";
import type {
  EngineeringMedium,
  EngineeringEquipment,
  EngineeringPipe,
  EngineeringPipePoint,
} from "../../../../../entities/engineering/types";
import { MEDIUM_PALETTE } from "../drawingTheme";
import { getPipeStrokeStyle } from "../engineeringLineStyles";
import { distributeFlowArrows } from "../flowArrows";
import { offsetPolyline, pickPipeLabelSegment, normalizeLabelAngle, type PlanProjection } from "../geometry";
import { buildPipeLabel } from "../pipeLabels";
import { resolveEngineeringEquipmentRenderRotation, resolveEngineeringRenderedPortPosition } from "../../render";

interface EngineeringRoutesLayerProps {
  model: BuildingModel;
  activeLevelId: string | null;
  projection: PlanProjection;
  visibleMedia: Set<EngineeringMedium>;
  showArrows: boolean;
  showLabels: boolean;
}

function projectPoints(points: EngineeringPipePoint[], projection: PlanProjection): EngineeringPipePoint[] {
  return points.map((p) => projection.project(p));
}

function polylineD(points: EngineeringPipePoint[]): string {
  if (!points.length) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

function resolveProjectedEquipmentPort(
  equipment: EngineeringEquipment | undefined,
  portId: string,
  projection: PlanProjection,
  rotationById: Map<string, number>
) {
  if (!equipment) {
    return null;
  }
  const renderRotation = rotationById.get(equipment.id) ?? equipment.rotation;
  return resolveEngineeringRenderedPortPosition(
    {
      type: equipment.type,
      width: equipment.width * projection.scale,
      height: equipment.height * projection.scale,
      rotation: renderRotation,
    },
    portId,
    projection.project({ x: equipment.x, y: equipment.y }),
    {
      sizeMode: "schematic",
      rotation: renderRotation,
    }
  );
}

/**
 * Группа труб с одинаковой геометрической трассой (подача рядом с обраткой),
 * чтобы развести их параллельным offset.
 */
function pairOffset(pipes: EngineeringPipe[]): Map<string, number> {
  const offsets = new Map<string, number>();
  const buckets = new Map<string, EngineeringPipe[]>();
  for (const pipe of pipes) {
    if (pipe.points.length < 2) continue;
    const key = `${Math.round(pipe.fromEquipmentId.length)}|${Math.round(pipe.toEquipmentId.length)}|${pipe.points.length}`;
    const list = buckets.get(key) ?? [];
    list.push(pipe);
    buckets.set(key, list);
  }
  for (const list of buckets.values()) {
    if (list.length < 2) {
      for (const p of list) offsets.set(p.id, 0);
      continue;
    }
    list.forEach((pipe, idx) => {
      const step = 0.18; // метров
      offsets.set(pipe.id, (idx - (list.length - 1) / 2) * step);
    });
  }
  return offsets;
}

const EngineeringRoutesLayer: React.FC<EngineeringRoutesLayerProps> = ({
  model,
  activeLevelId,
  projection,
  visibleMedia,
  showArrows,
  showLabels,
}) => {
  const allEquipment = model.engineeringSystems?.equipment ?? [];
  const allPipes = model.engineeringSystems?.pipes ?? [];
  const equipment = useMemo(
    () => allEquipment.filter((eq) => activeLevelId == null || eq.levelId === activeLevelId),
    [activeLevelId, allEquipment]
  );
  const levelPipes = useMemo(
    () => allPipes.filter((pipe) => activeLevelId == null || pipe.levelId === activeLevelId),
    [activeLevelId, allPipes]
  );
  const pipes = useMemo(
    () =>
      levelPipes.filter(
        (pipe) =>
          visibleMedia.has(pipe.medium) &&
          pipe.points.length >= 2
      ),
    [levelPipes, visibleMedia]
  );
  const equipmentById = useMemo(() => new Map(equipment.map((eq) => [eq.id, eq])), [equipment]);
  const equipmentRenderRotationById = useMemo(() => {
    const rotationById = new Map<string, number>();
    equipment.forEach((eq) => {
      rotationById.set(eq.id, resolveEngineeringEquipmentRenderRotation(eq, levelPipes));
    });
    return rotationById;
  }, [equipment, levelPipes]);

  const offsetsById = useMemo(() => pairOffset(pipes), [pipes]);
  const projectedPointsById = useMemo(() => {
    const pointsById = new Map<string, EngineeringPipePoint[]>();
    pipes.forEach((pipe) => {
      const offset = offsetsById.get(pipe.id) ?? 0;
      const offsetPoints = offset !== 0 ? offsetPolyline(pipe.points, offset) : pipe.points;
      const projected = projectPoints(offsetPoints, projection);
      const fromPoint = resolveProjectedEquipmentPort(
        equipmentById.get(pipe.fromEquipmentId),
        pipe.fromPortId,
        projection,
        equipmentRenderRotationById
      );
      const toPoint = resolveProjectedEquipmentPort(
        equipmentById.get(pipe.toEquipmentId),
        pipe.toPortId,
        projection,
        equipmentRenderRotationById
      );
      if (fromPoint && projected[0]) {
        projected[0] = fromPoint;
      }
      if (toPoint && projected[projected.length - 1]) {
        projected[projected.length - 1] = toPoint;
      }
      pointsById.set(pipe.id, projected);
    });
    return pointsById;
  }, [equipmentById, equipmentRenderRotationById, offsetsById, pipes, projection]);

  return (
    <g data-layer="engineering-routes">
      {/* Halo подложка под трубами для читаемости */}
      <g data-sublayer="halo" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {pipes.map((pipe) => {
          const style = getPipeStrokeStyle(pipe.medium, pipe.diameter);
          const projected = projectedPointsById.get(pipe.id) ?? [];
          return (
            <path
              key={`halo-${pipe.id}`}
              d={polylineD(projected)}
              stroke={style.halo}
              strokeWidth={style.haloWidth ?? style.strokeWidth + 1.4}
              strokeOpacity={0.85}
            />
          );
        })}
      </g>

      {/* Линии труб */}
      <g data-sublayer="lines" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {pipes.map((pipe) => {
          const style = getPipeStrokeStyle(pipe.medium, pipe.diameter);
          const projected = projectedPointsById.get(pipe.id) ?? [];
          return (
            <path
              key={`line-${pipe.id}`}
              d={polylineD(projected)}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={style.dasharray}
            />
          );
        })}
      </g>

      {/* Стрелки направления потока */}
      {showArrows ? (
        <g data-sublayer="arrows">
          {pipes.map((pipe) => {
            const palette = MEDIUM_PALETTE[pipe.medium];
            const projected = projectedPointsById.get(pipe.id) ?? [];
            const reverse = pipe.medium === "return" || pipe.medium === "drain" || pipe.medium === "airExhaust";
            const arrows = distributeFlowArrows(projected, 130, { reverse });
            return arrows.map((marker, idx) => (
              <g key={`arrow-${pipe.id}-${idx}`} transform={`translate(${marker.cx} ${marker.cy}) rotate(${marker.angleDeg})`}>
                <path
                  d="M -5 -3.2 L 4 0 L -5 3.2 Z"
                  fill={palette.ink}
                  stroke={palette.ink}
                  strokeWidth={0.4}
                  strokeLinejoin="round"
                />
              </g>
            ));
          })}
        </g>
      ) : null}

      {/* Подписи Ø / типа сети */}
      {showLabels ? (
        <g data-sublayer="pipe-labels">
          {pipes.map((pipe) => {
            const projected = projectedPointsById.get(pipe.id) ?? [];
            const segment = pickPipeLabelSegment(projected);
            if (!segment || segment.length < 56) return null;
            const labelInfo = buildPipeLabel(pipe);
            const angle = normalizeLabelAngle(segment.angleDeg);
            const nx = -Math.sin((segment.angleDeg * Math.PI) / 180);
            const ny = Math.cos((segment.angleDeg * Math.PI) / 180);
            const padding = 9;
            const cx = segment.midX + nx * padding;
            const cy = segment.midY + ny * padding;
            return (
              <g key={`label-${pipe.id}`} transform={`translate(${cx} ${cy}) rotate(${angle})`}>
                <rect
                  x={-labelInfo.text.length * 3.4 - 4}
                  y={-7}
                  width={labelInfo.text.length * 6.8 + 8}
                  height={14}
                  rx={3}
                  fill="rgba(251,251,247,0.92)"
                  stroke="rgba(31,41,55,0.18)"
                  strokeWidth={0.4}
                />
                <text
                  x={0}
                  y={0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="'IBM Plex Mono','JetBrains Mono','Consolas',monospace"
                  fontSize={9.5}
                  fontWeight={600}
                  fill={labelInfo.ink}
                >
                  {labelInfo.text}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}
    </g>
  );
};

export default EngineeringRoutesLayer;
