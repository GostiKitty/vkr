import React from "react";
import type { BuildingModel } from "../../../../../entities/geometry/types";
import { renderEngineeringEquipmentSymbol } from "../../render";
import type { PlanProjection } from "../geometry";
import { ENGINEERING_EQUIPMENT_LABELS } from "../../catalog";

interface EquipmentSymbolsLayerProps {
  model: BuildingModel;
  activeLevelId: string | null;
  projection: PlanProjection;
  showLabels: boolean;
}

const EquipmentSymbolsLayer: React.FC<EquipmentSymbolsLayerProps> = ({ model, activeLevelId, projection, showLabels }) => {
  const equipment = (model.engineeringSystems?.equipment ?? []).filter(
    (eq) => activeLevelId == null || eq.levelId === activeLevelId
  );

  return (
    <g data-layer="equipment-symbols">
      {equipment.map((eq) => {
        const center = projection.project({ x: eq.x, y: eq.y });
        const width = Math.max(28, eq.width * projection.scale);
        const height = Math.max(20, eq.height * projection.scale);
        return (
          <g key={eq.id}>
            {renderEngineeringEquipmentSymbol(
              {
                type: eq.type,
                rotation: eq.rotation,
                width,
                height,
                ports: eq.ports,
                parameters: eq.parameters,
              },
              center,
              { showPorts: false }
            )}
            {showLabels ? (
              <g transform={`translate(${center.x} ${center.y + height / 2 + 14})`}>
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontFamily="'Inter','Segoe UI',sans-serif"
                  fontSize={10}
                  fontWeight={600}
                  fill="#1f2937"
                >
                  {eq.name || ENGINEERING_EQUIPMENT_LABELS[eq.type]}
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

export default EquipmentSymbolsLayer;
