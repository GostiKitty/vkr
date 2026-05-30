import React from "react";
import type { BuildingModel } from "../../../../../entities/geometry/types";
import { polygonArea, polygonCentroid, type PlanProjection } from "../geometry";

interface LabelsLayerProps {
  model: BuildingModel;
  activeLevelId: string | null;
  projection: PlanProjection;
}

function roomNumber(index: number, levelIdx: number): string {
  return `${levelIdx + 1}.${(index + 1).toString().padStart(2, "0")}`;
}

const LabelsLayer: React.FC<LabelsLayerProps> = ({ model, activeLevelId, projection }) => {
  const levelIndex = activeLevelId
    ? Math.max(0, model.levels.findIndex((l) => l.id === activeLevelId))
    : 0;
  const rooms = model.rooms.filter((r) => activeLevelId == null || r.levelId === activeLevelId);

  return (
    <g data-layer="labels">
      {rooms.map((room, idx) => {
        const centroid = polygonCentroid(room.polygon);
        if (!centroid) return null;
        const area = polygonArea(room.polygon);
        const projected = projection.project(centroid);
        const number = roomNumber(idx, levelIndex);
        const name = (room.name || "").trim();
        return (
          <g key={room.id} transform={`translate(${projected.x} ${projected.y})`}>
            <text
              x={0}
              y={-8}
              textAnchor="middle"
              fontFamily="'Inter','Segoe UI',sans-serif"
              fontSize={12}
              fontWeight={700}
              fill="#1f2937"
            >
              {number}
            </text>
            {name ? (
              <text
                x={0}
                y={6}
                textAnchor="middle"
                fontFamily="'Inter','Segoe UI',sans-serif"
                fontSize={10}
                fill="#4b5563"
              >
                {name}
              </text>
            ) : null}
            {area > 0 ? (
              <text
                x={0}
                y={name ? 20 : 8}
                textAnchor="middle"
                fontFamily="'IBM Plex Mono','JetBrains Mono','Consolas',monospace"
                fontSize={9}
                fill="#7a8597"
              >
                {area.toFixed(1)} м²
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

export default LabelsLayer;
