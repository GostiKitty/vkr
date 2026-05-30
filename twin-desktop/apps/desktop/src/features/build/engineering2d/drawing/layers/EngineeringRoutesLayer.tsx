import React, { useMemo } from "react";
import type { BuildingModel } from "../../../../../entities/geometry/types";
import type {
  EngineeringMedium,
  EngineeringPipe,
  EngineeringPipePoint,
} from "../../../../../entities/engineering/types";
import { MEDIUM_PALETTE } from "../drawingTheme";
import { getPipeStrokeStyle } from "../engineeringLineStyles";
import { distributeFlowArrows } from "../flowArrows";
import { offsetPolyline, pickPipeLabelSegment, normalizeLabelAngle, type PlanProjection } from "../geometry";
import { buildPipeLabel } from "../pipeLabels";

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
  const allPipes = model.engineeringSystems?.pipes ?? [];
  const pipes = useMemo(
    () =>
      allPipes.filter(
        (pipe) =>
          (activeLevelId == null || pipe.levelId === activeLevelId) &&
          visibleMedia.has(pipe.medium) &&
          pipe.points.length >= 2
      ),
    [allPipes, activeLevelId, visibleMedia]
  );

  const offsetsById = useMemo(() => pairOffset(pipes), [pipes]);

  return (
    <g data-layer="engineering-routes">
      {/* Halo подложка под трубами для читаемости */}
      <g data-sublayer="halo" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {pipes.map((pipe) => {
          const style = getPipeStrokeStyle(pipe.medium, pipe.diameter);
          const offset = offsetsById.get(pipe.id) ?? 0;
          const offsetPoints = offset !== 0 ? offsetPolyline(pipe.points, offset) : pipe.points;
          const projected = projectPoints(offsetPoints, projection);
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
          const offset = offsetsById.get(pipe.id) ?? 0;
          const offsetPoints = offset !== 0 ? offsetPolyline(pipe.points, offset) : pipe.points;
          const projected = projectPoints(offsetPoints, projection);
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
            const offset = offsetsById.get(pipe.id) ?? 0;
            const offsetPoints = offset !== 0 ? offsetPolyline(pipe.points, offset) : pipe.points;
            const projected = projectPoints(offsetPoints, projection);
            const reverse = pipe.medium === "return" || pipe.medium === "drain";
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
            const offset = offsetsById.get(pipe.id) ?? 0;
            const offsetPoints = offset !== 0 ? offsetPolyline(pipe.points, offset) : pipe.points;
            const projected = projectPoints(offsetPoints, projection);
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
