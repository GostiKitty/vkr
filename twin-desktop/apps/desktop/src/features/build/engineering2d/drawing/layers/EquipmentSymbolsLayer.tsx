import React, { useMemo } from "react";
import type { BuildingModel } from "../../../../../entities/geometry/types";
import {
  renderEngineeringEquipmentSymbol,
  resolveEngineeringEquipmentRenderRotation,
  resolveEngineeringEquipmentRenderSize,
} from "../../render";
import type { PlanProjection } from "../geometry";
import { ENGINEERING_EQUIPMENT_LABELS } from "../../catalog";

interface EquipmentSymbolsLayerProps {
  model: BuildingModel;
  activeLevelId: string | null;
  projection: PlanProjection;
  showLabels: boolean;
}

const EquipmentSymbolsLayer: React.FC<EquipmentSymbolsLayerProps> = ({ model, activeLevelId, projection, showLabels }) => {
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
  const equipmentRenderRotationById = useMemo(() => {
    const rotationById = new Map<string, number>();
    equipment.forEach((eq) => {
      rotationById.set(eq.id, resolveEngineeringEquipmentRenderRotation(eq, levelPipes));
    });
    return rotationById;
  }, [equipment, levelPipes]);

  return (
    <g data-layer="equipment-symbols">
      {equipment.map((eq) => {
        const center = projection.project({ x: eq.x, y: eq.y });
        const renderRotation = equipmentRenderRotationById.get(eq.id) ?? eq.rotation;
        const symbolSize = resolveEngineeringEquipmentRenderSize(
          eq.type,
          eq.width * projection.scale,
          eq.height * projection.scale,
          "schematic"
        );
        return (
          <g key={eq.id}>
            {renderEngineeringEquipmentSymbol(
              {
                type: eq.type,
                rotation: renderRotation,
                width: symbolSize.width,
                height: symbolSize.height,
                ports: eq.ports,
                parameters: eq.parameters,
              },
              center,
              { showPorts: false, sizeMode: "schematic" }
            )}
            {showLabels ? (
              <g transform={`translate(${center.x} ${center.y + symbolSize.height / 2 + 14})`}>
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
