import { polygonContainsPoint } from "../../../entities/geometry/geom";
import type { BuildingModel } from "../../../entities/geometry/types";
import type { EngineeringEquipment, EngineeringPipe } from "../../../entities/engineering/types";
import {
  resolveNetworkSystemType,
  type BuildingEventType,
  type DuctNetwork,
  type Equipment,
  type EquipmentType,
  type PipeNetwork,
  type PipeSystemType,
  type SensorDevice,
} from "../../../entities/networks/types";
import { buildHeatingModelSnapshot, summarizeDucts, type SmartModelSnapshot } from "../../../core/networks/index";
import { polylineLength } from "../../../core/networks/utils";

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  radiator: "Радиатор",
  fancoil: "Фанкойл",
  ahu: "Приточная установка",
  pump: "Насос",
  boiler: "Котел",
  heat_exchanger: "Теплообменник",
  elevator: "Элеваторный узел",
  expansion_tank: "Расширительный бак",
  dirt_separator: "Грязевик",
  diffuser: "Диффузор",
  sensor: "Датчик",
};

const PIPE_TYPE_LABELS: Record<PipeSystemType, string> = {
  heating_supply: "Подача отопления",
  heating_return: "Обратка отопления",
  dhw: "ГВС",
  chw: "ХВС",
};

const PIPE_FAMILY_LABELS = {
  heating: "Отопление",
  water: "Водяные контуры",
  ventilation: "Вентиляционные трубные линии",
  custom: "Спецсети",
} as const;

const SENSOR_LABELS: Record<SensorDevice["type"], string> = {
  temperature: "Температура",
  humidity: "Влажность",
  co2: "CO2",
  pressure: "Давление",
  flow: "Расход",
  leak: "Протечка",
};

const SENSOR_UNITS: Record<SensorDevice["type"], string> = {
  temperature: "°C",
  humidity: "%",
  co2: "ppm",
  pressure: "Па",
  flow: "л/с",
  leak: "сигнал",
};

const EVENT_LABELS: Record<BuildingEventType, string> = {
  leak: "Протечка",
  equipment_fault: "Сбой оборудования",
  overheat: "Перегрев",
  network_break: "Проблема сети",
  co2_high: "Высокий CO2",
};

const ENGINEERING_AIR_MEDIA = new Set(["airSupply", "airExhaust"]);

function isEngineeringAirPipe(pipe: EngineeringPipe): boolean {
  return ENGINEERING_AIR_MEDIA.has(pipe.medium);
}

function readEngineeringAirPipeFlowM3s(pipe: Pick<EngineeringPipe, "flowRate">): number {
  return typeof pipe.flowRate === "number" && Number.isFinite(pipe.flowRate) ? Math.max(0, pipe.flowRate) / 3600 : 0;
}

function readEngineeringPipeMetadataNumber(metadata: Record<string, unknown> | undefined, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type EngineeringAirSection = {
  areaM2: number;
  hydraulicSizeM: number;
  label: string;
};

function resolveEngineeringAirSection(pipe: Pick<EngineeringPipe, "diameter" | "metadata">): EngineeringAirSection {
  const sectionShape = typeof pipe.metadata?.sectionShape === "string" ? pipe.metadata.sectionShape : null;
  const sectionWidthMm = readEngineeringPipeMetadataNumber(pipe.metadata, "sectionWidthMm");
  const sectionHeightMm = readEngineeringPipeMetadataNumber(pipe.metadata, "sectionHeightMm");
  if (sectionShape === "rectangular" && sectionWidthMm != null && sectionHeightMm != null && sectionWidthMm > 0 && sectionHeightMm > 0) {
    const widthM = sectionWidthMm / 1000;
    const heightM = sectionHeightMm / 1000;
    const hydraulicDiameterM = (2 * widthM * heightM) / (widthM + heightM);
    return {
      areaM2: widthM * heightM,
      hydraulicSizeM: Math.max(hydraulicDiameterM, 0.05),
      label: `${Math.round(sectionWidthMm)}×${Math.round(sectionHeightMm)} мм`,
    };
  }
  const sectionDiameterMm = readEngineeringPipeMetadataNumber(pipe.metadata, "sectionDiameterMm");
  const diameterMm = Math.max(sectionDiameterMm ?? pipe.diameter ?? 0, 0);
  const diameterM = Math.max(diameterMm / 1000, 0.1);
  return {
    areaM2: (Math.PI * diameterM * diameterM) / 4,
    hydraulicSizeM: diameterM,
    label: diameterMm > 0 ? `Ø${Math.round(diameterMm)} мм` : "Воздушная ветка",
  };
}

function resolveEngineeringAirSectionFromMetadata(
  metadata: Record<string, unknown> | undefined,
  prefix = ""
): EngineeringAirSection | null {
  const sectionShapeKey = prefix ? `${prefix}SectionShape` : "sectionShape";
  const sectionWidthKey = prefix ? `${prefix}SectionWidthMm` : "sectionWidthMm";
  const sectionHeightKey = prefix ? `${prefix}SectionHeightMm` : "sectionHeightMm";
  const sectionDiameterKey = prefix ? `${prefix}SectionDiameterMm` : "sectionDiameterMm";
  const sectionShape = typeof metadata?.[sectionShapeKey] === "string" ? metadata[sectionShapeKey] : null;
  const sectionWidthMm = readEngineeringPipeMetadataNumber(metadata, sectionWidthKey);
  const sectionHeightMm = readEngineeringPipeMetadataNumber(metadata, sectionHeightKey);
  if (sectionShape === "rectangular" && sectionWidthMm != null && sectionHeightMm != null && sectionWidthMm > 0 && sectionHeightMm > 0) {
    const widthM = sectionWidthMm / 1000;
    const heightM = sectionHeightMm / 1000;
    const hydraulicDiameterM = (2 * widthM * heightM) / (widthM + heightM);
    return {
      areaM2: widthM * heightM,
      hydraulicSizeM: Math.max(hydraulicDiameterM, 0.05),
      label: `${Math.round(sectionWidthMm)}×${Math.round(sectionHeightMm)} мм`,
    };
  }
  const sectionDiameterMm = readEngineeringPipeMetadataNumber(metadata, sectionDiameterKey);
  if (sectionShape === "round" && sectionDiameterMm != null && sectionDiameterMm > 0) {
    const diameterM = Math.max(sectionDiameterMm / 1000, 0.1);
    return {
      areaM2: (Math.PI * diameterM * diameterM) / 4,
      hydraulicSizeM: diameterM,
      label: `Ø${Math.round(sectionDiameterMm)} мм`,
    };
  }
  return null;
}

function getEngineeringAirSectionTransitionRatio(pipe: Pick<EngineeringPipe, "metadata">): number | null {
  const explicitRatio = readEngineeringPipeMetadataNumber(pipe.metadata, "sectionTransitionRatio");
  if (explicitRatio != null && explicitRatio > 0) {
    return explicitRatio;
  }
  const sourceSection = resolveEngineeringAirSectionFromMetadata(pipe.metadata, "source");
  const targetSection = resolveEngineeringAirSectionFromMetadata(pipe.metadata, "target");
  if (!sourceSection || !targetSection || sourceSection.areaM2 <= 0 || targetSection.areaM2 <= 0) {
    return null;
  }
  return Math.max(sourceSection.areaM2, targetSection.areaM2) / Math.min(sourceSection.areaM2, targetSection.areaM2);
}

function estimateEngineeringAirVelocityM3s(pipe: Pick<EngineeringPipe, "diameter" | "flowRate" | "metadata">): number {
  const airflow = readEngineeringAirPipeFlowM3s(pipe);
  const areaM2 = resolveEngineeringAirSection(pipe).areaM2;
  return airflow > 0 && areaM2 > 0 ? airflow / areaM2 : 0;
}

function describeEngineeringAirSection(pipe: Pick<EngineeringPipe, "diameter" | "metadata">): string {
  return resolveEngineeringAirSection(pipe).label;
}

function getEngineeringEquipmentLabel(equipment: EngineeringEquipment | null | undefined): string {
  if (!equipment) {
    return "Воздушный прибор";
  }
  const name = equipment.name.trim();
  return name || equipment.type;
}

function readEngineeringParameterNumber(parameters: Record<string, unknown> | undefined, key: string): number | null {
  const value = parameters?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readEngineeringEquipmentAirflowM3s(parameters: Record<string, unknown> | undefined): number {
  const airflowM3H =
    readEngineeringParameterNumber(parameters, "airflowM3H") ??
    readEngineeringParameterNumber(parameters, "designAirflowM3H") ??
    readEngineeringParameterNumber(parameters, "flowRateM3H");
  if (airflowM3H != null) {
    return Math.max(0, airflowM3H) / 3600;
  }
  const airflowM3S =
    readEngineeringParameterNumber(parameters, "airflowM3S") ??
    readEngineeringParameterNumber(parameters, "designAirflowM3S");
  return airflowM3S != null ? Math.max(0, airflowM3S) : 0;
}

function getEngineeringAirPipeFrictionLossPa(pipe: EngineeringPipe): number {
  const airflow = readEngineeringAirPipeFlowM3s(pipe);
  const hydraulicSize = resolveEngineeringAirSection(pipe).hydraulicSizeM;
  return (polylineLength(pipe.points) / hydraulicSize) * Math.max(airflow, 0.05) * 4;
}

function getEngineeringAirEquipmentPressureLossPa(equipment: EngineeringEquipment | null | undefined): number {
  if (!equipment) {
    return 0;
  }
  const explicitPressureDropPa =
    readEngineeringParameterNumber(equipment.parameters, "pressureDropPa") ??
    readEngineeringParameterNumber(equipment.parameters, "pressureLossPa");
  switch (equipment.type) {
    case "airDamper": {
      const state = String(equipment.parameters.state ?? "open");
      if (state === "closed") {
        return Math.max(explicitPressureDropPa ?? 0, 5000);
      }
      if (state === "regulating") {
        return explicitPressureDropPa ?? 120;
      }
      return explicitPressureDropPa ?? 20;
    }
    case "airCheckValve": {
      const state = String(equipment.parameters.state ?? "open");
      if (state === "closed") {
        return Math.max(explicitPressureDropPa ?? 0, 5000);
      }
      return explicitPressureDropPa ?? 25;
    }
    case "fireDamper": {
      const state = String(equipment.parameters.state ?? "open");
      if (state === "closed") {
        return Math.max(explicitPressureDropPa ?? 0, 5000);
      }
      return explicitPressureDropPa ?? 30;
    }
    case "airFilter": {
      const basePressureDropPa = explicitPressureDropPa ?? 90;
      const contaminationPercent = Math.min(
        100,
        Math.max(0, readEngineeringParameterNumber(equipment.parameters, "contaminationPercent") ?? 0)
      );
      return basePressureDropPa * (1 + contaminationPercent / 100);
    }
    case "airFlowRegulatorConst":
      return explicitPressureDropPa ?? 50;
    case "airFlowRegulatorVar": {
      const basePressureDropPa = explicitPressureDropPa ?? 45;
      const damperPositionPercent = Math.min(
        100,
        Math.max(0, readEngineeringParameterNumber(equipment.parameters, "damperPositionPercent") ?? 100)
      );
      if (damperPositionPercent <= 5) {
        return Math.max(basePressureDropPa, 5000);
      }
      return basePressureDropPa * (1 + ((100 - damperPositionPercent) / 100) * 1.8);
    }
    case "silencer":
      return explicitPressureDropPa ?? 45;
    case "airHeater":
      return explicitPressureDropPa ?? 80;
    case "airCooler":
      return explicitPressureDropPa ?? 75;
    case "airHumidifier":
      return explicitPressureDropPa ?? 65;
    case "airDehumidifier":
      return explicitPressureDropPa ?? 70;
    case "supplyDiffuser":
      return explicitPressureDropPa ?? 35;
    case "exhaustGrille":
      return explicitPressureDropPa ?? 25;
    case "filter":
      return explicitPressureDropPa ?? 90;
    default:
      return explicitPressureDropPa ?? 0;
  }
}

function getEngineeringAirEquipmentAvailablePressurePa(equipment: EngineeringEquipment | null | undefined): number {
  if (!equipment) {
    return 0;
  }
  if (equipment.type !== "airHandlingUnit" && equipment.type !== "ductFan" && equipment.type !== "roofFan") {
    return 0;
  }
  return Math.max(
    0,
    readEngineeringParameterNumber(equipment.parameters, "pressurePa") ??
      readEngineeringParameterNumber(equipment.parameters, "availablePressurePa") ??
      0
  );
}

type EngineeringAirRouteHydraulics = {
  sourceEquipmentId: string;
  availablePressurePa: number;
  segmentPressureDropPa: number;
  routePressureDropPa: number;
};

function pickPreferredEngineeringAirRoute(
  current: EngineeringAirRouteHydraulics | undefined,
  candidate: EngineeringAirRouteHydraulics
): EngineeringAirRouteHydraulics {
  if (!current) {
    return candidate;
  }
  const currentReserve = current.availablePressurePa - current.routePressureDropPa;
  const candidateReserve = candidate.availablePressurePa - candidate.routePressureDropPa;
  if (candidateReserve > currentReserve + 1e-6) {
    return candidate;
  }
  if (candidateReserve < currentReserve - 1e-6) {
    return current;
  }
  if (candidate.routePressureDropPa < current.routePressureDropPa - 1e-6) {
    return candidate;
  }
  return current;
}

function buildEngineeringAirRouteHydraulics(
  airPipes: EngineeringPipe[],
  engineeringEquipmentById: Map<string, EngineeringEquipment>
): Map<string, EngineeringAirRouteHydraulics> {
  const routeByPipeId = new Map<string, EngineeringAirRouteHydraulics>();
  const outgoingSupplyPipesByEquipmentId = new Map<string, EngineeringPipe[]>();
  const incomingExhaustPipesByEquipmentId = new Map<string, EngineeringPipe[]>();
  const frictionLossByPipeId = new Map(airPipes.map((pipe) => [pipe.id, getEngineeringAirPipeFrictionLossPa(pipe)] as const));

  airPipes.forEach((pipe) => {
    if (pipe.medium === "airSupply") {
      const bucket = outgoingSupplyPipesByEquipmentId.get(pipe.fromEquipmentId) ?? [];
      bucket.push(pipe);
      outgoingSupplyPipesByEquipmentId.set(pipe.fromEquipmentId, bucket);
      return;
    }
    if (pipe.medium === "airExhaust") {
      const bucket = incomingExhaustPipesByEquipmentId.get(pipe.toEquipmentId) ?? [];
      bucket.push(pipe);
      incomingExhaustPipesByEquipmentId.set(pipe.toEquipmentId, bucket);
    }
  });

  const registerRoute = (pipeId: string, candidate: EngineeringAirRouteHydraulics) => {
    routeByPipeId.set(pipeId, pickPreferredEngineeringAirRoute(routeByPipeId.get(pipeId), candidate));
  };

  engineeringEquipmentById.forEach((equipment) => {
    const availablePressurePa = getEngineeringAirEquipmentAvailablePressurePa(equipment);
    if (availablePressurePa <= 0) {
      return;
    }

    const bestSupplyLossByEquipmentId = new Map<string, number>([[equipment.id, 0]]);
    const traverseSupply = (equipmentId: string, routePressureDropPa: number) => {
      const outgoingPipes = outgoingSupplyPipesByEquipmentId.get(equipmentId) ?? [];
      outgoingPipes.forEach((pipe) => {
        const downstreamEquipment = engineeringEquipmentById.get(pipe.toEquipmentId);
        const segmentPressureDropPa =
          (frictionLossByPipeId.get(pipe.id) ?? 0) + getEngineeringAirEquipmentPressureLossPa(downstreamEquipment);
        const nextRoutePressureDropPa = routePressureDropPa + segmentPressureDropPa;
        registerRoute(pipe.id, {
          sourceEquipmentId: equipment.id,
          availablePressurePa,
          segmentPressureDropPa,
          routePressureDropPa: nextRoutePressureDropPa,
        });
        const previousBest = bestSupplyLossByEquipmentId.get(pipe.toEquipmentId);
        if (previousBest != null && previousBest <= nextRoutePressureDropPa + 1e-6) {
          return;
        }
        bestSupplyLossByEquipmentId.set(pipe.toEquipmentId, nextRoutePressureDropPa);
        traverseSupply(pipe.toEquipmentId, nextRoutePressureDropPa);
      });
    };

    const bestExhaustLossByEquipmentId = new Map<string, number>([[equipment.id, 0]]);
    const traverseExhaust = (equipmentId: string, routePressureDropPa: number) => {
      const incomingPipes = incomingExhaustPipesByEquipmentId.get(equipmentId) ?? [];
      incomingPipes.forEach((pipe) => {
        const upstreamEquipment = engineeringEquipmentById.get(pipe.fromEquipmentId);
        const segmentPressureDropPa =
          (frictionLossByPipeId.get(pipe.id) ?? 0) + getEngineeringAirEquipmentPressureLossPa(upstreamEquipment);
        const nextRoutePressureDropPa = routePressureDropPa + segmentPressureDropPa;
        registerRoute(pipe.id, {
          sourceEquipmentId: equipment.id,
          availablePressurePa,
          segmentPressureDropPa,
          routePressureDropPa: nextRoutePressureDropPa,
        });
        const previousBest = bestExhaustLossByEquipmentId.get(pipe.fromEquipmentId);
        if (previousBest != null && previousBest <= nextRoutePressureDropPa + 1e-6) {
          return;
        }
        bestExhaustLossByEquipmentId.set(pipe.fromEquipmentId, nextRoutePressureDropPa);
        traverseExhaust(pipe.fromEquipmentId, nextRoutePressureDropPa);
      });
    };

    traverseSupply(equipment.id, 0);
    traverseExhaust(equipment.id, 0);
  });

  return routeByPipeId;
}

function buildEngineeringAirSummary(model: BuildingModel) {
  const engineeringEquipment = model.engineeringSystems?.equipment ?? [];
  const engineeringEquipmentById = new Map(engineeringEquipment.map((item) => [item.id, item] as const));
  const airPipes = (model.engineeringSystems?.pipes ?? []).filter(isEngineeringAirPipe);
  const routeHydraulicsByPipeId = buildEngineeringAirRouteHydraulics(airPipes, engineeringEquipmentById);
  const branches = airPipes.map((pipe) => {
    const fromEquipment = engineeringEquipmentById.get(pipe.fromEquipmentId);
    const toEquipment = engineeringEquipmentById.get(pipe.toEquipmentId);
    const mediumLabel = pipe.medium === "airExhaust" ? "Вытяжка" : "Приток";
    const frictionPressureDropPa = getEngineeringAirPipeFrictionLossPa(pipe);
    const fallbackSegmentPressureDropPa =
      frictionPressureDropPa +
      (pipe.medium === "airExhaust"
        ? getEngineeringAirEquipmentPressureLossPa(fromEquipment)
        : getEngineeringAirEquipmentPressureLossPa(toEquipment));
    const hydraulics = routeHydraulicsByPipeId.get(pipe.id);
    const availablePressurePa =
      hydraulics?.availablePressurePa ??
      Math.max(
        getEngineeringAirEquipmentAvailablePressurePa(fromEquipment),
        getEngineeringAirEquipmentAvailablePressurePa(toEquipment)
      );
    const segmentPressureDropPa = hydraulics?.segmentPressureDropPa ?? fallbackSegmentPressureDropPa;
    const routePressureDropPa = hydraulics?.routePressureDropPa ?? segmentPressureDropPa;
    return {
      id: pipe.id,
      label: `${mediumLabel}: ${getEngineeringEquipmentLabel(fromEquipment)} → ${getEngineeringEquipmentLabel(toEquipment)}`,
      totalLength_m: polylineLength(pipe.points),
      airflow_m3_s: readEngineeringAirPipeFlowM3s(pipe),
      airVelocity_m_s: estimateEngineeringAirVelocityM3s(pipe),
      connectedEquipmentCount: [pipe.fromEquipmentId, pipe.toEquipmentId].filter(Boolean).length,
      sectionLabel: describeEngineeringAirSection(pipe),
      segmentPressureDropPa,
      estimatedPressureDropPa: routePressureDropPa,
      availablePressurePa,
      pressureReservePa: availablePressurePa > 0 ? availablePressurePa - routePressureDropPa : undefined,
    } satisfies DuctBranchPresentation;
  });
  const connectedEquipmentIds = new Set<string>();
  airPipes.forEach((pipe) => {
    if (pipe.fromEquipmentId) {
      connectedEquipmentIds.add(pipe.fromEquipmentId);
    }
    if (pipe.toEquipmentId) {
      connectedEquipmentIds.add(pipe.toEquipmentId);
    }
  });
  const airEquipmentCount = engineeringEquipment.filter((item) => item.ports.some((port) => ENGINEERING_AIR_MEDIA.has(port.medium))).length;
  const totalLength_m = branches.reduce((sum, branch) => sum + branch.totalLength_m, 0);
  const totalAirflow_m3_s = branches.reduce((sum, branch) => sum + branch.airflow_m3_s, 0);
  const averageAirVelocity_m_s =
    branches.length > 0 ? branches.reduce((sum, branch) => sum + branch.airVelocity_m_s, 0) / branches.length : 0;
  const estimatedPressureDropPa = branches.reduce((sum, branch) => sum + Math.max(0, branch.segmentPressureDropPa ?? 0), 0);
  return {
    branchCount: branches.length,
    connectedBranchCount: branches.filter((branch) => branch.connectedEquipmentCount > 0).length,
    totalLength_m,
    totalAirflow_m3_s,
    averageAirVelocity_m_s,
    estimatedPressureDropPa,
    branches,
    connectedEquipmentCount: connectedEquipmentIds.size,
    equipmentCount: airEquipmentCount,
  };
}

type EngineeringRoomAirBalance = {
  roomId: string;
  roomName: string;
  supplyAirflow_m3_s: number;
  exhaustAirflow_m3_s: number;
};

function buildEngineeringRoomAirBalances(model: BuildingModel): EngineeringRoomAirBalance[] {
  const balances = new Map<string, EngineeringRoomAirBalance>();
  const ensureBalance = (roomId: string, roomName: string): EngineeringRoomAirBalance => {
    const existing = balances.get(roomId);
    if (existing) {
      return existing;
    }
    const created: EngineeringRoomAirBalance = {
      roomId,
      roomName,
      supplyAirflow_m3_s: 0,
      exhaustAirflow_m3_s: 0,
    };
    balances.set(roomId, created);
    return created;
  };

  (model.engineeringSystems?.equipment ?? []).forEach((equipment) => {
    if (!equipment.levelId) {
      return;
    }
    if (equipment.type !== "supplyDiffuser" && equipment.type !== "exhaustGrille") {
      return;
    }
    const room = model.rooms.find(
      (entry) => entry.levelId === equipment.levelId && polygonContainsPoint({ x: equipment.x, y: equipment.y }, entry.polygon)
    );
    if (!room) {
      return;
    }
    const balance = ensureBalance(room.id, room.name);
    const airflowM3s = readEngineeringEquipmentAirflowM3s(equipment.parameters);
    if (equipment.type === "supplyDiffuser") {
      balance.supplyAirflow_m3_s += airflowM3s;
      return;
    }
    balance.exhaustAirflow_m3_s += airflowM3s;
  });

  return [...balances.values()].filter((entry) => entry.supplyAirflow_m3_s > 0 || entry.exhaustAirflow_m3_s > 0);
}

export interface NetworkOverviewMetric {
  label: string;
  value: string;
  detail: string;
}

export interface NetworkFamilySummary {
  id: string;
  label: string;
  count: number;
  connectedCount: number;
  totalLength_m: number;
}

export interface HeatingSystemPresentation {
  id: string;
  name: string;
  branchCount: number;
  totalLength_m: number;
  totalLoadW: number;
  totalHeatLossW: number;
  issueCount: number;
  connected: boolean;
  roomCount: number;
}

export interface DuctBranchPresentation {
  id: string;
  label: string;
  totalLength_m: number;
  airflow_m3_s: number;
  airVelocity_m_s: number;
  connectedEquipmentCount: number;
  sectionLabel: string;
  segmentPressureDropPa?: number;
  estimatedPressureDropPa?: number;
  availablePressurePa?: number;
  pressureReservePa?: number;
}

export interface NetworkWarningPresentation {
  id: string;
  severity: "warning" | "error";
  message: string;
}

export interface NetworkSuggestionPresentation {
  id: string;
  status: "compatible" | "rejected";
  title: string;
  detail: string;
  distance_m: number;
}

export interface SensorAlertPresentation {
  id: string;
  status: "warning" | "alarm";
  label: string;
  value: string;
}

export interface EventPresentation {
  id: string;
  severity: "info" | "warning" | "critical";
  label: string;
}

export interface NetworkSystemsPresentation {
  overview: NetworkOverviewMetric[];
  pipe: {
    branchCount: number;
    connectedBranchCount: number;
    totalLength_m: number;
    systemCount: number;
    connectedSystemCount: number;
    totalLoadW: number;
    totalHeatLossW: number;
    estimatedPressureDropPa: number;
    families: NetworkFamilySummary[];
    systems: HeatingSystemPresentation[];
  };
  duct: {
    branchCount: number;
    connectedBranchCount: number;
    totalLength_m: number;
    totalAirflow_m3_s: number;
    averageAirVelocity_m_s: number;
    estimatedPressureDropPa: number;
    branches: DuctBranchPresentation[];
  };
  diagnostics: {
    warnings: NetworkWarningPresentation[];
    suggestions: NetworkSuggestionPresentation[];
  };
  monitoring: {
    sensorAlerts: SensorAlertPresentation[];
    events: EventPresentation[];
  };
  methodology: {
    build: string[];
    calculate: string[];
    render: string[];
  };
}

export function buildNetworkSystemsPresentation(
  model: BuildingModel,
  snapshot: SmartModelSnapshot
): NetworkSystemsPresentation {
  const heatingSnapshot = buildHeatingModelSnapshot(model);
  const ductSummary = summarizeDucts(model.ducts);
  const engineeringAirSummary = buildEngineeringAirSummary(model);
  const networkStateById = new Map(snapshot.networkStates.map((entry) => [entry.networkId, entry] as const));
  const equipmentById = new Map(model.equipment.map((entry) => [entry.id, entry] as const));
  const sensorById = new Map(model.sensors.map((entry) => [entry.id, entry] as const));

  const connectedSimpleEquipmentCount = snapshot.equipmentStates.filter((entry) => entry.connectedNetworkIds.length > 0).length;
  const sensorAlerts = snapshot.sensorStates
    .filter(
      (
        entry
      ): entry is typeof entry & {
        status: "warning" | "alarm";
      } => entry.status !== "normal"
    )
    .slice(0, 4)
    .map((entry) => {
      const sensor = sensorById.get(entry.sensorId);
      const type = sensor?.type ?? "temperature";
      return {
        id: entry.sensorId,
        status: entry.status,
        label: SENSOR_LABELS[type],
        value:
          entry.value == null
            ? "—"
            : `${formatSensorValue(entry.value, type)} ${SENSOR_UNITS[type]}`.trim(),
      } satisfies SensorAlertPresentation;
    });

  const pipeFamilies = buildPipeFamilies(model.pipes, networkStateById);
  const heatingSystems = [...heatingSnapshot.systems]
    .sort((left, right) => right.totalLoadW - left.totalLoadW || right.totalLength_m - left.totalLength_m)
    .slice(0, 4)
    .map((system) => ({
      id: system.id,
      name: system.name,
      branchCount: system.branches.length,
      totalLength_m: system.totalLength_m,
      totalLoadW: system.totalLoadW,
      totalHeatLossW: system.totalHeatLossW,
      issueCount: system.issues.length,
      connected: system.connected,
      roomCount: system.roomIds.length,
    }));

  const ductBranches = [...model.ducts]
    .map((duct) => {
      const connectedEquipmentIds = networkStateById.get(duct.id)?.connectedEquipmentIds ?? duct.connectedEquipmentIds;
      return {
        id: duct.id,
        label: getDuctLabel(duct, model.ducts),
        totalLength_m: polylineLength(duct.path),
        airflow_m3_s: duct.airflow_m3_s,
        airVelocity_m_s: duct.airVelocity_m_s,
        connectedEquipmentCount: connectedEquipmentIds.length,
        sectionLabel: describeDuctSection(duct),
      } satisfies DuctBranchPresentation;
    })
    .concat(engineeringAirSummary.branches)
    .sort((left, right) => right.airflow_m3_s - left.airflow_m3_s || right.totalLength_m - left.totalLength_m)
    .slice(0, 4);

  const warnings = buildWarnings(model, snapshot, heatingSnapshot, equipmentById, engineeringAirSummary);
  const suggestions = snapshot.suggestedConnections.slice(0, 6).map((entry) => {
    const equipment = equipmentById.get(entry.equipmentId);
    const networkTitle =
      entry.networkKind === "pipe"
        ? getPipeLabel(model.pipes.find((pipe) => pipe.id === entry.networkId) ?? null, model.pipes)
        : getDuctLabel(model.ducts.find((duct) => duct.id === entry.networkId) ?? null, model.ducts);
    const equipmentTitle = equipment ? getEquipmentLabel(equipment, model.equipment) : "Оборудование";
    return {
      id: `${entry.status}:${entry.networkKind}:${entry.networkId}:${entry.equipmentId}`,
      status: entry.status,
      title: `${networkTitle} → ${equipmentTitle}`,
      detail:
        entry.status === "compatible"
          ? "Связь допустима по типу сети и найдена по геометрической близости на плане."
          : `Трасса рядом с оборудованием, но тип сети не подходит для «${equipmentTitle}».`,
      distance_m: entry.distance_m,
    } satisfies NetworkSuggestionPresentation;
  });

  const events = snapshot.events.slice(0, 4).map((entry) => ({
    id: entry.id,
    severity: entry.severity,
    label: EVENT_LABELS[entry.type] ?? "Событие сети",
  }));

  const connectedPipeCount = model.pipes.filter((pipe) => (networkStateById.get(pipe.id)?.connectedEquipmentIds.length ?? 0) > 0).length;
  const connectedDuctCount =
    model.ducts.filter((duct) => (networkStateById.get(duct.id)?.connectedEquipmentIds.length ?? 0) > 0).length +
    engineeringAirSummary.connectedBranchCount;
  const pipeTotalLength = model.pipes.reduce((sum, pipe) => sum + polylineLength(pipe.path), 0);
  const pipePressureDropPa = model.pipes.reduce((sum, pipe) => sum + Math.max(0, pipe.pressureDropPa ?? 0), 0);
  const totalAirBranchCount = model.ducts.length + engineeringAirSummary.branchCount;
  const totalAirLengthM = ductSummary.totalLength_m + engineeringAirSummary.totalLength_m;
  const totalAirflowM3s = ductSummary.totalAirflow_m3_s + engineeringAirSummary.totalAirflow_m3_s;
  const averageAirVelocityM3s =
    totalAirBranchCount > 0
      ? (ductSummary.averageAirVelocity_m_s * model.ducts.length +
          engineeringAirSummary.averageAirVelocity_m_s * engineeringAirSummary.branchCount) /
        totalAirBranchCount
      : 0;
  const totalAirPressureDropPa = ductSummary.estimatedPressureDropPa + engineeringAirSummary.estimatedPressureDropPa;
  const connectedEquipmentCount = connectedSimpleEquipmentCount + engineeringAirSummary.connectedEquipmentCount;
  const totalEquipmentCount = model.equipment.length + engineeringAirSummary.equipmentCount;
  const overview: NetworkOverviewMetric[] = [];
  if (model.pipes.length > 0) {
    overview.push({
      label: "Трубные сети",
      value: `${model.pipes.length}`,
      detail: `${formatNumber(pipeTotalLength, 1)} м трасс, ${pipeFamilies.length} семейства`,
    });
  }
  if (totalAirBranchCount > 0) {
    overview.push({
      label: "Воздушные сети",
      value: `${totalAirBranchCount}`,
      detail: `${formatNumber(totalAirLengthM, 1)} м, ${formatNumber(totalAirflowM3s, 2)} м³/с`,
    });
  }
  if (totalEquipmentCount > 0) {
    overview.push({
      label: "Подключения",
      value: `${connectedEquipmentCount}/${totalEquipmentCount}`,
      detail: `${connectedPipeCount} труб и ${connectedDuctCount} воздушных веток привязаны к оборудованию`,
    });
  }
  if (snapshot.events.length > 0 || sensorAlerts.length > 0) {
    overview.push({
      label: "Мониторинг",
      value: `${snapshot.events.length}`,
      detail: `${sensorAlerts.length} тревог датчиков, ${snapshot.roomStates.length} помещений в snapshot`,
    });
  }

  return {
    overview,
    pipe: {
      branchCount: model.pipes.length,
      connectedBranchCount: connectedPipeCount,
      totalLength_m: pipeTotalLength,
      systemCount: heatingSnapshot.systems.length,
      connectedSystemCount: heatingSnapshot.systems.filter((entry) => entry.connected).length,
      totalLoadW: heatingSnapshot.totalLoadW,
      totalHeatLossW: heatingSnapshot.systems.reduce((sum, entry) => sum + entry.totalHeatLossW, 0),
      estimatedPressureDropPa:
        pipePressureDropPa > 0
          ? pipePressureDropPa
          : heatingSnapshot.systems.reduce(
              (sum, system) => sum + system.branches.reduce((branchSum, branch) => branchSum + branch.pressureDropPa, 0),
              0
            ),
      families: pipeFamilies,
      systems: heatingSystems,
    },
    duct: {
      branchCount: totalAirBranchCount,
      connectedBranchCount: connectedDuctCount,
      totalLength_m: totalAirLengthM,
      totalAirflow_m3_s: totalAirflowM3s,
      averageAirVelocity_m_s: averageAirVelocityM3s,
      estimatedPressureDropPa: totalAirPressureDropPa,
      branches: ductBranches,
    },
    diagnostics: {
      warnings,
      suggestions,
    },
    monitoring: {
      sensorAlerts,
      events,
    },
    methodology: {
      build: [
        "Трассы труб и воздуховодов задаются полилиниями по этажам на 2D-плане.",
        "Концы веток привязываются к портам оборудования: радиаторы, насосы и теплообменники для труб; AHU, фанкойлы и диффузоры для воздуха.",
        "Smart snapshot автоматически находит ближайшие допустимые подключения и отдельно помечает несовместимые связи.",
      ],
      calculate: [
        "Для отопления строится граф «узлы → сегменты → ветви → контуры» с проверкой подачи, обратки, источника, длины, нагрузки, расхода, теплопотерь и Δp.",
        "Для остальных трубных линий вкладка собирает семейства, длины и связность, даже если это не теплосеть.",
        "Для воздуховодов считаются длина, расход воздуха, средняя скорость и упрощенная оценка потерь давления по сечению.",
      ],
      render: [
        "В плане показывается фактическая геометрия трасс на текущем уровне.",
        "В схеме линии читаются по роли: подача, обратка, нейтральная ветка или воздушный канал; направление можно показывать стрелками.",
        "Комбинированный режим совмещает инженерную схему и тепловую карту помещений.",
      ],
    },
  };
}

function buildPipeFamilies(
  pipes: PipeNetwork[],
  networkStateById: Map<string, SmartModelSnapshot["networkStates"][number]>
): NetworkFamilySummary[] {
  const buckets = new Map<string, NetworkFamilySummary>();
  pipes.forEach((pipe) => {
    const family = pipe.systemType ?? resolveNetworkSystemType(pipe.type);
    const existing = buckets.get(family) ?? {
      id: family,
      label: PIPE_FAMILY_LABELS[family],
      count: 0,
      connectedCount: 0,
      totalLength_m: 0,
    };
    existing.count += 1;
    existing.connectedCount += (networkStateById.get(pipe.id)?.connectedEquipmentIds.length ?? 0) > 0 ? 1 : 0;
    existing.totalLength_m += polylineLength(pipe.path);
    buckets.set(family, existing);
  });
  return [...buckets.values()].sort((left, right) => right.count - left.count || right.totalLength_m - left.totalLength_m);
}

function buildWarnings(
  model: BuildingModel,
  snapshot: SmartModelSnapshot,
  heatingSnapshot: ReturnType<typeof buildHeatingModelSnapshot>,
  equipmentById: Map<string, Equipment>,
  engineeringAirSummary: ReturnType<typeof buildEngineeringAirSummary>
): NetworkWarningPresentation[] {
  const warnings: NetworkWarningPresentation[] = [];
  const networkStateById = new Map(snapshot.networkStates.map((entry) => [entry.networkId, entry] as const));
  const engineeringAirEquipment = (model.engineeringSystems?.equipment ?? []).filter((item) =>
    item.ports.some((port) => ENGINEERING_AIR_MEDIA.has(port.medium))
  );
  const engineeringAirPipes = (model.engineeringSystems?.pipes ?? []).filter(isEngineeringAirPipe);
  const engineeringAirPipeById = new Map(engineeringAirPipes.map((pipe) => [pipe.id, pipe] as const));
  const engineeringAirPipeIdsByEquipmentId = new Map<string, Set<string>>();
  const seen = new Set<string>();
  const systemById = new Map(heatingSnapshot.systems.map((entry) => [entry.id, entry] as const));

  engineeringAirPipes.forEach((pipe) => {
      const fromIds = engineeringAirPipeIdsByEquipmentId.get(pipe.fromEquipmentId) ?? new Set<string>();
      fromIds.add(pipe.id);
      engineeringAirPipeIdsByEquipmentId.set(pipe.fromEquipmentId, fromIds);
      const toIds = engineeringAirPipeIdsByEquipmentId.get(pipe.toEquipmentId) ?? new Set<string>();
      toIds.add(pipe.id);
      engineeringAirPipeIdsByEquipmentId.set(pipe.toEquipmentId, toIds);
    });

  const pushWarning = (warning: NetworkWarningPresentation) => {
    if (seen.has(warning.id)) {
      return;
    }
    seen.add(warning.id);
    warnings.push(warning);
  };

  model.pipes.forEach((pipe) => {
    if ((networkStateById.get(pipe.id)?.connectedEquipmentIds.length ?? 0) === 0) {
      pushWarning({
        id: `pipe:${pipe.id}:orphan`,
        severity: "warning",
        message: `${getPipeLabel(pipe, model.pipes)} не привязан к оборудованию.`,
      });
    }
  });

  model.ducts.forEach((duct) => {
    if ((networkStateById.get(duct.id)?.connectedEquipmentIds.length ?? 0) === 0) {
      pushWarning({
        id: `duct:${duct.id}:orphan`,
        severity: "warning",
        message: `${getDuctLabel(duct, model.ducts)} не привязан к оборудованию.`,
      });
    }
  });

  engineeringAirEquipment.forEach((equipment) => {
    if ((engineeringAirPipeIdsByEquipmentId.get(equipment.id)?.size ?? 0) > 0) {
      return;
    }
    pushWarning({
      id: `eng-air-equipment:${equipment.id}:orphan`,
      severity: "warning",
      message: `${getEngineeringEquipmentLabel(equipment)} не подключен к воздушной сети.`,
    });
  });

  engineeringAirEquipment.forEach((equipment) => {
    if (equipment.type !== "airDamper" && equipment.type !== "airCheckValve" && equipment.type !== "fireDamper") {
      return;
    }
    if (String(equipment.parameters.state ?? "open") !== "closed") {
      return;
    }
    if ((engineeringAirPipeIdsByEquipmentId.get(equipment.id)?.size ?? 0) === 0) {
      return;
    }
    pushWarning({
      id: `eng-air-equipment:${equipment.id}:closed`,
      severity: "error",
      message: `${getEngineeringEquipmentLabel(equipment)} закрыт и перекрывает воздушную ветку.`,
    });
  });

  engineeringAirEquipment.forEach((equipment) => {
    if (equipment.type !== "airFlowRegulatorVar") {
      return;
    }
    const damperPositionPercent = Math.min(
      100,
      Math.max(0, readEngineeringParameterNumber(equipment.parameters, "damperPositionPercent") ?? 100)
    );
    if (damperPositionPercent > 5) {
      return;
    }
    if ((engineeringAirPipeIdsByEquipmentId.get(equipment.id)?.size ?? 0) === 0) {
      return;
    }
    pushWarning({
      id: `eng-air-equipment:${equipment.id}:throttled`,
      severity: "error",
      message: `${getEngineeringEquipmentLabel(equipment)} почти закрыт и ограничивает воздушную ветку.`,
    });
  });

  engineeringAirEquipment.forEach((equipment) => {
    if (equipment.type !== "airFilter") {
      return;
    }
    const contaminationPercent = Math.max(0, readEngineeringParameterNumber(equipment.parameters, "contaminationPercent") ?? 0);
    if (contaminationPercent < 80) {
      return;
    }
    pushWarning({
      id: `eng-air-equipment:${equipment.id}:contamination`,
      severity: "warning",
      message: `${getEngineeringEquipmentLabel(equipment)}: \u0437\u0430\u0433\u0440\u044f\u0437\u043d\u0435\u043d\u0438\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u0430 ${formatNumber(contaminationPercent, 0)}%.`,
    });
  });

  engineeringAirSummary.branches.forEach((branch) => {
    if (branch.airVelocity_m_s > 6) {
      pushWarning({
        id: `eng-air-branch:${branch.id}:velocity`,
        severity: "warning",
        message: `${branch.label}: скорость ${formatNumber(branch.airVelocity_m_s, 1)} м/с, проверьте сечение ${branch.sectionLabel}.`,
      });
    }
    const pipe = engineeringAirPipeById.get(branch.id);
    if (!pipe) {
      return;
    }
    const transitionRatio = getEngineeringAirSectionTransitionRatio(pipe);
    if (transitionRatio == null || transitionRatio < 1.8) {
      return;
    }
    const sourceSection = resolveEngineeringAirSectionFromMetadata(pipe.metadata, "source");
    const targetSection = resolveEngineeringAirSectionFromMetadata(pipe.metadata, "target");
    if (!sourceSection || !targetSection || sourceSection.label === targetSection.label) {
      return;
    }
    pushWarning({
      id: `eng-air-branch:${branch.id}:transition`,
      severity: "warning",
      message: `${branch.label}: резкое заужение ${sourceSection.label} → ${targetSection.label}.`,
    });
  });

  engineeringAirSummary.branches.forEach((branch) => {
    const availablePressurePa = Math.max(0, branch.availablePressurePa ?? 0);
    const estimatedPressureDropPa = Math.max(0, branch.estimatedPressureDropPa ?? 0);
    if (availablePressurePa <= 0 && estimatedPressureDropPa > 0) {
      pushWarning({
        id: `eng-air-branch:${branch.id}:missing-source`,
        severity: "warning",
        message: `${branch.label}: не найден источник давления для воздушной ветки.`,
      });
      return;
    }
    if (availablePressurePa <= 0 || estimatedPressureDropPa <= availablePressurePa * 1.05) {
      return;
    }
    pushWarning({
      id: `eng-air-branch:${branch.id}:pressure`,
      severity: "error",
      message: `${branch.label}: потери ${formatNumber(estimatedPressureDropPa, 0)} Па выше доступного давления ${formatNumber(availablePressurePa, 0)} Па.`,
    });
  });

  buildEngineeringRoomAirBalances(model).forEach((roomBalance) => {
    const supply = roomBalance.supplyAirflow_m3_s;
    const exhaust = roomBalance.exhaustAirflow_m3_s;
    const diff = Math.abs(supply - exhaust);
    const reference = Math.max(supply, exhaust, 1e-6);
    if (supply > 0 && exhaust <= 1e-6) {
      pushWarning({
        id: `eng-air-room:${roomBalance.roomId}:missing-exhaust`,
        severity: "warning",
        message: `${roomBalance.roomName}: есть приток без вытяжки.`,
      });
      return;
    }
    if (exhaust > 0 && supply <= 1e-6) {
      pushWarning({
        id: `eng-air-room:${roomBalance.roomId}:missing-supply`,
        severity: "warning",
        message: `${roomBalance.roomName}: есть вытяжка без притока.`,
      });
      return;
    }
    if (diff > Math.max(0.03, reference * 0.2)) {
      pushWarning({
        id: `eng-air-room:${roomBalance.roomId}:imbalance`,
        severity: "warning",
        message: `${roomBalance.roomName}: дисбаланс воздуха ${formatNumber(diff, 2)} м³/с.`,
      });
    }
  });

  snapshot.equipmentStates.forEach((state) => {
    if (state.connectedNetworkIds.length === 0) {
      const equipment = equipmentById.get(state.equipmentId);
      pushWarning({
        id: `equipment:${state.equipmentId}:orphan`,
        severity: "warning",
        message: `${equipment ? getEquipmentLabel(equipment, model.equipment) : "Оборудование"} не подключено к сети.`,
      });
    }
  });

  heatingSnapshot.systems.forEach((system) => {
    if (!system.hasSupply) {
      pushWarning({
        id: `system:${system.id}:missing-supply`,
        severity: "error",
        message: `${system.name}: отсутствует подающая линия.`,
      });
    }
    if (!system.hasReturn) {
      pushWarning({
        id: `system:${system.id}:missing-return`,
        severity: "error",
        message: `${system.name}: отсутствует обратная линия.`,
      });
    }
    if (!system.sourceEquipmentIds.length) {
      pushWarning({
        id: `system:${system.id}:missing-source`,
        severity: "warning",
        message: `${system.name}: не найден источник тепла или циркуляции.`,
      });
    }
    if (system.danglingNodeIds.length) {
      pushWarning({
        id: `system:${system.id}:dangling-node`,
        severity: "warning",
        message: `${system.name}: есть висячие узлы без продолжения сети.`,
      });
    }
  });

  heatingSnapshot.issues.forEach((issue) => {
    const system = systemById.get(issue.systemId);
    if (!system) {
      return;
    }
    if (issue.code === "missing_supply" || issue.code === "missing_return" || issue.code === "missing_source" || issue.code === "dangling_node") {
      return;
    }
    const message = formatHeatingIssue(issue, system.name, equipmentById, model);
    if (!message) {
      return;
    }
    pushWarning({
      id: `issue:${issue.code}:${issue.systemId}:${issue.branchId ?? issue.pipeId ?? issue.equipmentId ?? issue.nodeId ?? ""}`,
      severity: issue.severity,
      message,
    });
  });

  return warnings
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
    .slice(0, 8);
}

function formatHeatingIssue(
  issue: ReturnType<typeof buildHeatingModelSnapshot>["issues"][number],
  systemName: string,
  equipmentById: Map<string, Equipment>,
  model: BuildingModel
): string | null {
  switch (issue.code) {
    case "missing_dual_connection": {
      const equipment = issue.equipmentId ? equipmentById.get(issue.equipmentId) : null;
      const equipmentLabel = equipment ? getEquipmentLabel(equipment, model.equipment) : "Прибор";
      return `${systemName}: ${equipmentLabel} должен быть подключен и к подаче, и к обратке.`;
    }
    case "isolated_branch":
      return `${systemName}: обнаружена изолированная ветка без связи с основным контуром.`;
    case "missing_parameters":
      return `${systemName}: у участка ${issue.pipeId ?? issue.branchId ?? "сети"} не заполнены инженерные параметры.`;
    case "duplicate_segment":
      return `${systemName}: найдены дублирующиеся сегменты трассы.`;
    default:
      return null;
  }
}

function severityRank(value: "warning" | "error"): number {
  return value === "error" ? 2 : 1;
}

function getEquipmentLabel(equipment: Equipment | null, equipmentList: Equipment[]): string {
  if (!equipment) {
    return "Оборудование";
  }
  const base = EQUIPMENT_LABELS[equipment.type] ?? "Оборудование";
  const trimmedId = equipment.id.trim();
  if (trimmedId && !looksTechnicalId(trimmedId) && trimmedId.toLowerCase() !== equipment.type) {
    return `${base} ${trimmedId}`;
  }
  const siblings = equipmentList.filter((entry) => entry.type === equipment.type);
  if (siblings.length <= 1) {
    return base;
  }
  return `${base} ${siblings.findIndex((entry) => entry.id === equipment.id) + 1}`;
}

function getPipeLabel(pipe: PipeNetwork | null, pipes: PipeNetwork[]): string {
  if (!pipe) {
    return "Труба";
  }
  const base = PIPE_TYPE_LABELS[pipe.type] ?? "Труба";
  const siblings = pipes.filter((entry) => entry.type === pipe.type);
  if (siblings.length <= 1) {
    return base;
  }
  return `${base} ${siblings.findIndex((entry) => entry.id === pipe.id) + 1}`;
}

function getDuctLabel(duct: DuctNetwork | null, ducts: DuctNetwork[]): string {
  if (!duct) {
    return "Воздуховод";
  }
  if (!looksTechnicalId(duct.id)) {
    return `Воздуховод ${duct.id}`;
  }
  return `Воздуховод ${ducts.findIndex((entry) => entry.id === duct.id) + 1}`;
}

function describeDuctSection(duct: DuctNetwork): string {
  if (duct.section.shape === "round") {
    return `круглый Ø${Math.round(duct.section.diameter_mm ?? 160)} мм`;
  }
  return `прямоугольный ${Math.round(duct.section.width_mm ?? 400)}×${Math.round(duct.section.height_mm ?? 200)} мм`;
}

function looksTechnicalId(value: string): boolean {
  return /^(?:video|demo|eq|equipment|pipe|duct|sensor|network)[-_]/i.test(value) || /^[a-z]+[-_]\d+$/i.test(value);
}

function formatSensorValue(value: number, type: SensorDevice["type"]): string {
  const maximumFractionDigits = type === "co2" || type === "pressure" || type === "leak" ? 0 : 1;
  return formatNumber(value, maximumFractionDigits);
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}
