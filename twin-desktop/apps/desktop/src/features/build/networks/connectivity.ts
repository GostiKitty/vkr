import type { BuildingModel } from "../../../entities/geometry/types";
import { resolvePipeCircuitRole, type PipeNetwork } from "../../../entities/networks/types";
import { buildHeatingModelSnapshot } from "../../../core/networks/index";
import { getEquipmentDisplayName } from "../utils/entityLabels";

export interface NetworkConnectivityWarning {
  id: string;
  severity: "warning";
  targetKind: "pipe" | "duct" | "equipment";
  targetId: string;
  message: string;
}

export function buildNetworkConnectivityWarnings(model: BuildingModel): NetworkConnectivityWarning[] {
  const warnings: NetworkConnectivityWarning[] = [];
  const heatingModel = buildHeatingModelSnapshot(model);
  const connectedPipeIds = new Set(model.pipes.filter((pipe) => pipe.connectedEquipmentIds.length > 0).map((pipe) => pipe.id));

  model.pipes.forEach((pipe) => {
    if (!pipe.connectedEquipmentIds.length) {
      warnings.push({
        id: `pipe:${pipe.id}:orphan`,
        severity: "warning",
        targetKind: "pipe",
        targetId: pipe.id,
        message: `Труба ${pipe.id} не подключена к оборудованию.`,
      });
    }
  });

  model.ducts.forEach((duct) => {
    if (!duct.connectedEquipmentIds.length) {
      warnings.push({
        id: `duct:${duct.id}:orphan`,
        severity: "warning",
        targetKind: "duct",
        targetId: duct.id,
        message: `Воздуховод ${duct.id} не подключен к оборудованию.`,
      });
    }
  });

  model.equipment.forEach((equipment) => {
    if (!equipment.connectedNetworkIds.length) {
      const equipmentLabel = getEquipmentDisplayName(equipment.id, model.equipment);
      warnings.push({
        id: `equipment:${equipment.id}:orphan`,
        severity: "warning",
        targetKind: "equipment",
        targetId: equipment.id,
        message: `Оборудование ${equipmentLabel} не подключено к сети.`,
      });
    }
  });

  heatingModel.systems.forEach((system) => {
    if (!system.hasSupply) {
      warnings.push({
        id: `system:${system.id}:supply`,
        severity: "warning",
        targetKind: "pipe",
        targetId: system.branches[0]?.pipeId ?? system.id,
        message: `Контур ${system.name} не содержит подающую линию.`,
      });
    }
    if (!system.hasReturn) {
      warnings.push({
        id: `system:${system.id}:return`,
        severity: "warning",
        targetKind: "pipe",
        targetId: system.branches[0]?.pipeId ?? system.id,
        message: `Контур ${system.name} не содержит обратную линию.`,
      });
    }
  });

  model.pipes.forEach((pipe) => {
    const role = pipe.circuitRole ?? resolvePipeCircuitRole(pipe.type);
    if ((role === "supply" || role === "return") && !connectedPipeIds.has(pipe.id)) {
      warnings.push({
        id: `pipe:${pipe.id}:isolated-role`,
        severity: "warning",
        targetKind: "pipe",
        targetId: pipe.id,
        message: `Линия ${pipe.id} (${role === "supply" ? "подача" : "обратка"}) изолирована от оборудования.`,
      });
    }
  });

  return dedupeWarnings(warnings);
}

function dedupeWarnings(warnings: NetworkConnectivityWarning[]): NetworkConnectivityWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.targetKind}:${warning.targetId}:${warning.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function pipeHasDistinctRole(pipe: Pick<PipeNetwork, "type" | "circuitRole">, role: "supply" | "return"): boolean {
  return (pipe.circuitRole ?? resolvePipeCircuitRole(pipe.type)) === role;
}
