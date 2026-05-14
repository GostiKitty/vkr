import type { AdjacencyResult } from "../../graph/adjacency";
import type { BuildingModel } from "../../../entities/geometry/types";
import { computeWallProperties } from "../../../entities/material/types";
import { buildGeometryRenderModel } from "../../geometry/bimPipeline";
import { createThermalFieldModel } from "../field";
import { buildThermalPhysicsModel } from "../physics";
import type { ThermalSimulationOptions, ThermalSimulationResult } from "../solver";
import { DEFAULT_ENGINEERING_OPTIONS, DEFAULT_SURFACE_RESISTANCE_PROFILE, ENGINEERING_METHODS } from "./constants";
import { getEnvelopeElementLabel, getRoomDisplayName } from "./display";
import { buildComfortSummary, buildDetailedFieldResult, buildFastFieldSummary } from "./fieldSolver";
import { buildPresentationSummary } from "./presentation";
import { clamp, effectiveAirCapacitance, formatFormulaSubstitution, roundNumber, ventilationHeatLossW } from "./units";
import { validateEngineeringInputs } from "./validation";
import { buildZoneInsights } from "./zoneAnalysis";
import { runSp50ComplianceAnalysis } from "../sp50/analysis";
import type {
  EngineeringAnalysisResult,
  EngineeringConfidenceSummary,
  EngineeringInputSource,
  EngineeringOptions,
  ResolvedEngineeringOptions,
  EngineeringScenarioResult,
  EngineeringSensitivityEntry,
  EnvelopeElementKind,
  EnvelopeElementResult,
  HeatGainResult,
  RoomBalanceResult,
} from "./types";

interface EquivalentForecastContext {
  ua_W_K: number;
  passiveDayGainW: number;
  passiveNightGainW: number;
  heatingCapacityW: number;
  initialTemperatureC: number;
  effectiveCapacitance_J_K: number;
  options: ThermalSimulationOptions;
}

interface EngineeringStateOverrides {
  outdoorTemperatureC?: number;
  infiltrationACH?: number;
  ventilationACH?: number;
  windowU_W_m2K?: number;
  doorU_W_m2K?: number;
  floorU_W_m2K?: number;
  roofU_W_m2K?: number;
  radiatorPowerMultiplier?: number;
  equipmentGainMultiplier?: number;
  wallResistanceDelta_m2K_W?: number;
  includeField?: boolean;
}

interface EngineeringEvaluationState {
  engineeringOptions: ResolvedEngineeringOptions;
  targetTemperatureC: number;
  outdoorTemperatureC: number;
  solarGainFactor: number;
  physics: ReturnType<typeof buildThermalPhysicsModel>;
  fieldRoomTemperaturesC: Record<string, number>;
  fastFieldModel: ReturnType<typeof createThermalFieldModel> | null;
  rooms: RoomBalanceResult[];
  envelope: EnvelopeElementResult[];
  gains: HeatGainResult[];
  balance: EngineeringAnalysisResult["balance"];
}

export function runEngineeringThermalAnalysis(
  model: BuildingModel,
  adjacency: AdjacencyResult,
  options: ThermalSimulationOptions,
  simulationResult: ThermalSimulationResult | null
): EngineeringAnalysisResult {
  void adjacency;
  const startedAt = performance.now();
  const engineeringOptions = mergeEngineeringOptions(options.engineering);
  const validation = validateEngineeringInputs(model, engineeringOptions);
  const evaluation = evaluateEngineeringState(model, options, engineeringOptions, simulationResult, { includeField: true });
  const {
    physics,
    rooms,
    envelope,
    gains,
    balance,
    targetTemperatureC,
    outdoorTemperatureC,
    fieldRoomTemperaturesC,
    fastFieldModel,
  } = evaluation;
  const fastField = fastFieldModel ? buildFastFieldSummary(fastFieldModel, engineeringOptions) : null;
  const detailedField = buildDetailedFieldResult(
    model,
    physics,
    engineeringOptions,
    outdoorTemperatureC,
    fieldRoomTemperaturesC
  );

  if (detailedField && !detailedField.converged) {
    validation.push({
      id: "field-not-converged",
      severity: "warning",
      scope: "Температурное поле",
      message: "Итерационный решатель поля не достиг заданного допуска.",
      recommendation: "Увеличьте число итераций, укрупните шаг сетки или перейдите в быстрый режим.",
    });
  }

  const fieldView = detailedField ?? fastField;
  if (fieldView && Object.keys(fieldRoomTemperaturesC).length) {
    const anchorValues = Object.values(fieldRoomTemperaturesC).filter((value) => Number.isFinite(value));
    const anchorMean = anchorValues.length ? anchorValues.reduce((sum, value) => sum + value, 0) / anchorValues.length : targetTemperatureC;
    if (fieldView.minTemperatureC < anchorMean - 6 || fieldView.maxTemperatureC > anchorMean + 6) {
      validation.push({
        id: "field-range-suspicious",
        severity: "warning",
        scope: "Температурное поле",
        message: "Локальные экстремумы поля заметно отклоняются от средней температуры помещения.",
        recommendation: "Проверьте сетку, наружные условия и наличие отопительных приборов в модели.",
      });
    }
  }

  const comfort = buildComfortSummary(fieldView, targetTemperatureC);
  const zoneInsights = buildZoneInsights(model, physics, fieldView);
  const scenarios = buildScenarioResults(model, options, engineeringOptions, evaluation, simulationResult);
  const sensitivity = buildSensitivityResults(model, options, engineeringOptions, evaluation);
  const inputs = buildInputSources(model, engineeringOptions, envelope);
  const confidence = buildConfidenceSummary(inputs, validation);
  const sp50 = runSp50ComplianceAnalysis({
    model,
    envelope,
    defaultIndoorTemperatureC: targetTemperatureC,
    defaultOutdoorTemperatureC: outdoorTemperatureC,
  });
  const presentation = buildPresentationSummary({
    timestampIso: new Date().toISOString(),
    options: engineeringOptions,
    inputs,
    validation,
    envelope,
    gains,
    rooms,
    balance,
    fastField,
    detailedField,
    zoneInsights,
    comfort,
    scenarios,
    sensitivity,
    methodology: ENGINEERING_METHODS,
    confidence,
    sp50,
    performanceMs: performance.now() - startedAt,
  });
  const timestampIso = new Date().toISOString();
  const performanceMs = performance.now() - startedAt;

  return {
    timestampIso,
    options: engineeringOptions,
    inputs,
    validation,
    envelope,
    gains,
    rooms,
    balance,
    fastField,
    detailedField,
    zoneInsights,
    presentation,
    comfort,
    scenarios,
    sensitivity,
    methodology: ENGINEERING_METHODS,
    confidence,
    sp50,
    performanceMs,
  };
}

function resolveFieldRoomTemperatures(
  roomBalances: ReturnType<typeof buildThermalPhysicsModel>["roomBalances"],
  simulationResult: ThermalSimulationResult | null,
  analysisTimeHours: number,
  fallbackTemperatureC: number
): Record<string, number> {
  const fromSimulation =
    simulationResult?.timeline.reduce<typeof simulationResult.timeline[number] | null>((best, frame) => {
      if (!best) {
        return frame;
      }
      return Math.abs(frame.timeHours - analysisTimeHours) < Math.abs(best.timeHours - analysisTimeHours) ? frame : best;
    }, null) ?? null;

  const temperatures: Record<string, number> = {};
  Array.from(roomBalances.entries()).forEach(([roomId, balance]) => {
    const simulatedTemperatureC = fromSimulation?.rooms[roomId]?.temperatureC;
    temperatures[roomId] =
      typeof simulatedTemperatureC === "number" && Number.isFinite(simulatedTemperatureC)
        ? simulatedTemperatureC
        : balance.airTemperatureC;
  });

  if (!Object.keys(temperatures).length) {
    return {};
  }

  const values = Object.values(temperatures).filter((value): value is number => Number.isFinite(value));
  const anchor = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallbackTemperatureC;
  Object.keys(temperatures).forEach((roomId) => {
    temperatures[roomId] = clamp(temperatures[roomId], anchor - 3.5, anchor + 3.5);
  });
  return temperatures;
}

function buildSolarGainFactor(options: ResolvedEngineeringOptions): number {
  return (options.solarIrradianceW_m2 * options.solarTransmittance * options.solarShadingFactor) / 115;
}

function evaluateEngineeringState(
  model: BuildingModel,
  options: ThermalSimulationOptions,
  engineeringOptions: ResolvedEngineeringOptions,
  simulationResult: ThermalSimulationResult | null,
  overrides: EngineeringStateOverrides = {}
): EngineeringEvaluationState {
  const resolvedOptions: ResolvedEngineeringOptions = {
    ...engineeringOptions,
    ventilationACH: overrides.ventilationACH ?? engineeringOptions.ventilationACH,
    windowU_W_m2K: overrides.windowU_W_m2K ?? engineeringOptions.windowU_W_m2K,
    doorU_W_m2K: overrides.doorU_W_m2K ?? engineeringOptions.doorU_W_m2K,
    floorU_W_m2K: overrides.floorU_W_m2K ?? engineeringOptions.floorU_W_m2K,
    roofU_W_m2K: overrides.roofU_W_m2K ?? engineeringOptions.roofU_W_m2K,
    radiatorPowerMultiplier: overrides.radiatorPowerMultiplier ?? engineeringOptions.radiatorPowerMultiplier,
    equipmentGainMultiplier: overrides.equipmentGainMultiplier ?? engineeringOptions.equipmentGainMultiplier,
  };
  const targetTemperatureC = resolveTargetTemperature(options, resolvedOptions.analysisTimeHours, resolvedOptions.targetTemperatureC);
  const outdoorTemperatureC = overrides.outdoorTemperatureC ?? options.outdoor.baseC + (options.outdoor.seasonalOffsetC ?? 0);
  const solarGainFactor = buildSolarGainFactor(resolvedOptions);
  const renderGeometry = buildGeometryRenderModel(model);
  const infiltrationACH = overrides.infiltrationACH ?? options.infiltrationACH ?? 0.5;
  const physics = buildThermalPhysicsModel(
    model,
    {
      outdoorTemperatureC,
      timeHours: resolvedOptions.analysisTimeHours,
      setpointTemperatureC: targetTemperatureC,
      lightingGain_W_m2: resolvedOptions.lightingGain_W_m2,
      occupancyGain_W_m2: resolvedOptions.occupancyGain_W_m2,
      infiltrationACH,
      ventilationACH: resolvedOptions.ventilationACH,
      supplyAirTemperatureC: resolvedOptions.supplyAirTemperatureC,
      radiatorPowerMultiplier: resolvedOptions.radiatorPowerMultiplier,
      equipmentGainMultiplier: resolvedOptions.equipmentGainMultiplier,
      transientBlend: resolvedOptions.mode === "quick" ? 0.82 : 1,
      solarGainFactor,
    },
    renderGeometry
  );
  const fieldRoomTemperaturesC = overrides.includeField
    ? resolveFieldRoomTemperatures(physics.roomBalances, simulationResult, resolvedOptions.analysisTimeHours, targetTemperatureC)
    : {};
  const fastFieldModel = overrides.includeField
    ? createThermalFieldModel(
        model,
        {
          roomTemperaturesC: fieldRoomTemperaturesC,
          outdoorTemperatureC,
          timeHours: resolvedOptions.analysisTimeHours,
          setpointTemperatureC: targetTemperatureC,
          windFactor: 1,
          solarGainFactor,
          lightingGain_W_m2: resolvedOptions.lightingGain_W_m2,
          occupancyGain_W_m2: resolvedOptions.occupancyGain_W_m2,
          infiltrationACH,
          ventilationACH: resolvedOptions.ventilationACH,
          supplyAirTemperatureC: resolvedOptions.supplyAirTemperatureC,
          radiatorPowerMultiplier: resolvedOptions.radiatorPowerMultiplier,
          equipmentGainMultiplier: resolvedOptions.equipmentGainMultiplier,
          transientBlend: resolvedOptions.mode === "quick" ? 0.82 : 1,
          detailScale: resolvedOptions.mode === "quick" ? 0.8 : 1,
        },
        renderGeometry,
        physics
      )
    : null;
  const rooms = buildRoomBalances(model, physics);
  const envelope = buildEnvelopeResults(
    model,
    physics,
    resolvedOptions,
    targetTemperatureC,
    outdoorTemperatureC,
    overrides.wallResistanceDelta_m2K_W ?? 0
  );
  const gains = buildGainResults(model, physics);
  const balance = buildBalanceSummary(
    rooms,
    envelope,
    gains,
    { ...options, infiltrationACH },
    resolvedOptions,
    targetTemperatureC,
    outdoorTemperatureC
  );

  return {
    engineeringOptions: resolvedOptions,
    targetTemperatureC,
    outdoorTemperatureC,
    solarGainFactor,
    physics,
    fieldRoomTemperaturesC,
    fastFieldModel,
    rooms,
    envelope,
    gains,
    balance,
  };
}

function mergeEngineeringOptions(options: EngineeringOptions | undefined): ResolvedEngineeringOptions {
  return {
    ...DEFAULT_ENGINEERING_OPTIONS,
    ...options,
    surfaceResistances: {
      ...DEFAULT_SURFACE_RESISTANCE_PROFILE,
      ...(options?.surfaceResistances ?? {}),
    },
    grid: {
      ...DEFAULT_ENGINEERING_OPTIONS.grid,
      ...(options?.grid ?? {}),
    },
    scenarioDraft: {
      ...DEFAULT_ENGINEERING_OPTIONS.scenarioDraft,
      ...(options?.scenarioDraft ?? {}),
    },
  };
}

function resolveTargetTemperature(options: ThermalSimulationOptions, analysisTimeHours: number, explicitTarget: number): number {
  if (Number.isFinite(explicitTarget)) {
    return explicitTarget;
  }
  const hour = ((analysisTimeHours % 24) + 24) % 24;
  const isDay =
    options.setpoints.dayStartHour < options.setpoints.nightStartHour
      ? hour >= options.setpoints.dayStartHour && hour < options.setpoints.nightStartHour
      : hour >= options.setpoints.dayStartHour || hour < options.setpoints.nightStartHour;
  return isDay ? options.setpoints.day : options.setpoints.night;
}

function buildRoomBalances(model: BuildingModel, physics: ReturnType<typeof buildThermalPhysicsModel>): RoomBalanceResult[] {
  return Array.from(physics.roomBalances.values())
    .map((balance) => ({
      roomId: balance.roomId,
      roomName: getRoomDisplayName(model, balance.roomId),
      levelId: balance.levelId,
      areaM2: balance.areaM2,
      volumeM3: balance.volumeM3,
      airTemperatureC: balance.airTemperatureC,
      setpointC: balance.setpointC,
      heatingDeliveredW: balance.heatingDeliveredW,
      heatingCapacityW: balance.heatingCapacityW,
      lightingGainW: balance.lightingGainW,
      occupancyGainW: balance.occupancyGainW,
      equipmentGainW: balance.equipmentGainW,
      pipeGainW: balance.pipeGainW,
      solarGainW: balance.solarGainW,
      ventilationLossW: balance.ventilationLossW,
      transmissionLossW: balance.envelopeLossW,
      adjacentExchangeW: balance.adjacentExchangeW,
      passiveBalanceW:
        balance.lightingGainW +
        balance.occupancyGainW +
        balance.equipmentGainW +
        balance.pipeGainW +
        balance.solarGainW -
        balance.ventilationLossW -
        balance.envelopeLossW,
    }))
    .sort((left, right) => right.transmissionLossW - left.transmissionLossW);
}

function buildEnvelopeResults(
  model: BuildingModel,
  physics: ReturnType<typeof buildThermalPhysicsModel>,
  options: ResolvedEngineeringOptions,
  targetTemperatureC: number,
  outdoorTemperatureC: number,
  wallResistanceDelta_m2K_W = 0
): EnvelopeElementResult[] {
  const externalResults = physics.surfaces
    .filter((surface) => surface.kind === "external")
    .flatMap((surface): EnvelopeElementResult[] => {
      const roomId = surface.positiveRoomId ?? surface.negativeRoomId;
      if (!roomId) {
        return [];
      }
      const roomName = getRoomDisplayName(model, roomId);
      const wallProps = computeWallProperties(surface.wall.layers, surface.wall.wallAssemblyId);
      const layerResistance = Math.max(0, (wallProps?.rValue ?? 1 / 1.4) + wallResistanceDelta_m2K_W);
      const totalResistance =
        options.surfaceResistances.internal_m2K_W +
        layerResistance +
        options.surfaceResistances.external_m2K_W;
      const wallU = 1 / Math.max(totalResistance, 1e-6);
      const deltaTC = targetTemperatureC - outdoorTemperatureC;
      const base = {
        roomId,
        roomName,
        levelId: surface.levelId,
        orientation: surface.orientation,
        boundaryTemperatureC: outdoorTemperatureC,
        internalTemperatureC: targetTemperatureC,
        deltaTC,
      };
      const results: EnvelopeElementResult[] = [];

      if (surface.opaqueAreaM2 > 0) {
        const heatFluxW = wallU * surface.opaqueAreaM2 * deltaTC;
        results.push({
          id: `wall-${surface.wallId}`,
          label: getEnvelopeElementLabel("wall", surface.orientation, roomName),
          kind: "wall",
          areaM2: surface.opaqueAreaM2,
          layerResistance_m2K_W: layerResistance,
          internalSurfaceResistance_m2K_W: options.surfaceResistances.internal_m2K_W,
          externalSurfaceResistance_m2K_W: options.surfaceResistances.external_m2K_W,
          totalResistance_m2K_W: totalResistance,
          uValue_W_m2K: wallU,
          heatFluxW,
          heatFluxDensity_W_m2: heatFluxW / Math.max(surface.opaqueAreaM2, 1e-6),
          assumed: !wallProps,
          formulaBreakdown: {
            formula: "Q = U · A · ΔT",
            substitution: formatFormulaSubstitution(wallU, surface.opaqueAreaM2, deltaTC, heatFluxW),
            units: "Вт/(м²·К) · м² · К = Вт",
            applicability: "Стационарная теплопередача через непрозрачное ограждение.",
          },
          assumptions: wallProps ? [] : ["Состав стены отсутствует, поэтому использовано типовое значение U."],
          ...base,
        });
      }

      if (surface.windowAreaM2 > 0) {
        const heatFluxW = options.windowU_W_m2K * surface.windowAreaM2 * deltaTC;
        results.push({
          id: `window-${surface.wallId}`,
          label: getEnvelopeElementLabel("window", surface.orientation, roomName),
          kind: "window",
          areaM2: surface.windowAreaM2,
          layerResistance_m2K_W: 0,
          internalSurfaceResistance_m2K_W: 0,
          externalSurfaceResistance_m2K_W: 0,
          totalResistance_m2K_W: 1 / Math.max(options.windowU_W_m2K, 1e-6),
          uValue_W_m2K: options.windowU_W_m2K,
          heatFluxW,
          heatFluxDensity_W_m2: heatFluxW / Math.max(surface.windowAreaM2, 1e-6),
          assumed: true,
          formulaBreakdown: {
            formula: "Q = U_window · A · ΔT",
            substitution: formatFormulaSubstitution(options.windowU_W_m2K, surface.windowAreaM2, deltaTC, heatFluxW),
            units: "Вт/(м²·К) · м² · К = Вт",
            applicability: "Оценка по общему U окна без послойной модели стеклопакета.",
          },
          assumptions: ["U окна задан интегрально, так как стеклопакет в модели не описан послойно."],
          ...base,
        });
      }

      if (surface.doorAreaM2 > 0) {
        const heatFluxW = options.doorU_W_m2K * surface.doorAreaM2 * deltaTC;
        results.push({
          id: `door-${surface.wallId}`,
          label: getEnvelopeElementLabel("door", surface.orientation, roomName),
          kind: "door",
          areaM2: surface.doorAreaM2,
          layerResistance_m2K_W: 0,
          internalSurfaceResistance_m2K_W: 0,
          externalSurfaceResistance_m2K_W: 0,
          totalResistance_m2K_W: 1 / Math.max(options.doorU_W_m2K, 1e-6),
          uValue_W_m2K: options.doorU_W_m2K,
          heatFluxW,
          heatFluxDensity_W_m2: heatFluxW / Math.max(surface.doorAreaM2, 1e-6),
          assumed: true,
          formulaBreakdown: {
            formula: "Q = U_door · A · ΔT",
            substitution: formatFormulaSubstitution(options.doorU_W_m2K, surface.doorAreaM2, deltaTC, heatFluxW),
            units: "Вт/(м²·К) · м² · К = Вт",
            applicability: "Оценка по интегральному U двери.",
          },
          assumptions: ["U двери задан как инженерное допущение."],
          ...base,
        });
      }

      return results;
    });

  const roomBased = Array.from(physics.roomBalances.values()).flatMap((balance): EnvelopeElementResult[] => {
    const roomName = getRoomDisplayName(model, balance.roomId);
    const floorDelta = targetTemperatureC - options.groundTemperatureC;
    const roofDelta = targetTemperatureC - outdoorTemperatureC;
    const floorHeatFluxW = options.floorU_W_m2K * balance.areaM2 * floorDelta;
    const roofHeatFluxW = options.roofU_W_m2K * balance.areaM2 * roofDelta;
    return [
      {
        id: `floor-${balance.roomId}`,
        label: getEnvelopeElementLabel("floor", null, roomName),
        roomId: balance.roomId,
        roomName,
        levelId: balance.levelId,
        kind: "floor",
        orientation: null,
        areaM2: balance.areaM2,
        boundaryTemperatureC: options.groundTemperatureC,
        internalTemperatureC: targetTemperatureC,
        deltaTC: floorDelta,
        layerResistance_m2K_W: 0,
        internalSurfaceResistance_m2K_W: 0,
        externalSurfaceResistance_m2K_W: 0,
        totalResistance_m2K_W: 1 / Math.max(options.floorU_W_m2K, 1e-6),
        uValue_W_m2K: options.floorU_W_m2K,
        heatFluxW: floorHeatFluxW,
        heatFluxDensity_W_m2: floorHeatFluxW / Math.max(balance.areaM2, 1e-6),
        assumed: true,
        formulaBreakdown: {
          formula: "Q = U_floor · A · (T_in - T_ground)",
          substitution: formatFormulaSubstitution(options.floorU_W_m2K, balance.areaM2, floorDelta, floorHeatFluxW),
          units: "Вт/(м²·К) · м² · К = Вт",
          applicability: "Инженерная оценка пола при отсутствии явной конструкции.",
        },
        assumptions: ["U пола и температура грунта заданы как инженерные допущения."],
      },
      {
        id: `roof-${balance.roomId}`,
        label: getEnvelopeElementLabel("roof", null, roomName),
        roomId: balance.roomId,
        roomName,
        levelId: balance.levelId,
        kind: "roof",
        orientation: null,
        areaM2: balance.areaM2,
        boundaryTemperatureC: outdoorTemperatureC,
        internalTemperatureC: targetTemperatureC,
        deltaTC: roofDelta,
        layerResistance_m2K_W: 0,
        internalSurfaceResistance_m2K_W: 0,
        externalSurfaceResistance_m2K_W: 0,
        totalResistance_m2K_W: 1 / Math.max(options.roofU_W_m2K, 1e-6),
        uValue_W_m2K: options.roofU_W_m2K,
        heatFluxW: roofHeatFluxW,
        heatFluxDensity_W_m2: roofHeatFluxW / Math.max(balance.areaM2, 1e-6),
        assumed: true,
        formulaBreakdown: {
          formula: "Q = U_roof · A · (T_in - T_out)",
          substitution: formatFormulaSubstitution(options.roofU_W_m2K, balance.areaM2, roofDelta, roofHeatFluxW),
          units: "Вт/(м²·К) · м² · К = Вт",
          applicability: "Инженерная оценка покрытия при отсутствии послойной модели.",
        },
        assumptions: ["U покрытия используется как инженерное допущение до загрузки фактической конструкции."],
      },
    ];
  });

  return [...externalResults, ...roomBased].sort((left, right) => right.heatFluxW - left.heatFluxW);
}

function buildGainResults(model: BuildingModel, physics: ReturnType<typeof buildThermalPhysicsModel>): HeatGainResult[] {
  const result: HeatGainResult[] = [];
  physics.roomBalances.forEach((balance) => {
    const roomName = getRoomDisplayName(model, balance.roomId);
    const entries: HeatGainResult[] = [
      {
        id: `heating-${balance.roomId}`,
        label: "Отопительные приборы",
        kind: "heating",
        roomId: balance.roomId,
        roomName,
        powerW: balance.heatingDeliveredW,
        participationFactor: 1,
        effectivePowerW: balance.heatingDeliveredW,
        scheduleLabel: "По требованию уставки",
        assumptions: [],
      },
      {
        id: `lighting-${balance.roomId}`,
        label: "Освещение",
        kind: "lighting",
        roomId: balance.roomId,
        roomName,
        powerW: balance.lightingGainW,
        participationFactor: 1,
        effectivePowerW: balance.lightingGainW,
        scheduleLabel: "Постоянно в расчетном срезе",
        assumptions: [],
      },
      {
        id: `occupancy-${balance.roomId}`,
        label: "Люди",
        kind: "occupancy",
        roomId: balance.roomId,
        roomName,
        powerW: balance.occupancyGainW,
        participationFactor: 1,
        effectivePowerW: balance.occupancyGainW,
        scheduleLabel: "Постоянно в расчетном срезе",
        assumptions: [],
      },
      {
        id: `equipment-${balance.roomId}`,
        label: "Оборудование",
        kind: "equipment",
        roomId: balance.roomId,
        roomName,
        powerW: balance.equipmentGainW,
        participationFactor: 1,
        effectivePowerW: balance.equipmentGainW,
        scheduleLabel: "По состоянию инженерного оборудования",
        assumptions: [],
      },
      {
        id: `pipes-${balance.roomId}`,
        label: "Трубопроводы",
        kind: "pipes",
        roomId: balance.roomId,
        roomName,
        powerW: balance.pipeGainW,
        participationFactor: 1,
        effectivePowerW: balance.pipeGainW,
        scheduleLabel: "По тепловыделению сетей",
        assumptions: [],
      },
      {
        id: `solar-${balance.roomId}`,
        label: "Солнечные притоки",
        kind: "solar",
        roomId: balance.roomId,
        roomName,
        powerW: balance.solarGainW,
        participationFactor: 1,
        effectivePowerW: balance.solarGainW,
        scheduleLabel: "По ориентации и коэффициенту солнечных притоков",
        assumptions: ["Упрощенный расчет по ориентации фасада без трассировки затенения."],
      },
    ];
    entries.forEach((entry) => {
      if (entry.effectivePowerW > 0.1) {
        result.push(entry);
      }
    });
  });
  return result.sort((left, right) => right.effectivePowerW - left.effectivePowerW);
}

function buildBalanceSummary(
  rooms: RoomBalanceResult[],
  envelope: EnvelopeElementResult[],
  gains: HeatGainResult[],
  simulationOptions: ThermalSimulationOptions,
  options: ResolvedEngineeringOptions,
  targetTemperatureC: number,
  outdoorTemperatureC: number
) {
  const wallLossW = sumEnvelope(envelope, "wall");
  const windowLossW = sumEnvelope(envelope, "window");
  const doorLossW = sumEnvelope(envelope, "door");
  const floorLossW = sumEnvelope(envelope, "floor");
  const roofLossW = sumEnvelope(envelope, "roof");
  const transmissionLossW = wallLossW + windowLossW + doorLossW + floorLossW + roofLossW;
  const infiltrationLossW = rooms.reduce(
    (sum, room) => sum + ventilationHeatLossW(room.volumeM3, simulationOptions.infiltrationACH ?? 0.5, targetTemperatureC - outdoorTemperatureC),
    0
  );
  const ventilationLossW = rooms.reduce(
    (sum, room) =>
      sum + ventilationHeatLossW(room.volumeM3, options.ventilationACH, targetTemperatureC - (options.supplyAirTemperatureC ?? outdoorTemperatureC)),
    0
  );
  const internalGainsW = gains
    .filter((entry) => entry.kind !== "solar" && entry.kind !== "heating" && entry.kind !== "pipes")
    .reduce((sum, entry) => sum + entry.effectivePowerW, 0);
  const solarGainW = gains.filter((entry) => entry.kind === "solar").reduce((sum, entry) => sum + entry.effectivePowerW, 0);
  const passiveGainsW = internalGainsW + solarGainW;
  const heatingDeliveredW = gains.filter((entry) => entry.kind === "heating").reduce((sum, entry) => sum + entry.effectivePowerW, 0);
  const installedHeatingCapacityW = rooms.reduce((sum, room) => sum + room.heatingCapacityW, 0);
  const totalLossW = transmissionLossW + infiltrationLossW + ventilationLossW;
  const totalUA_W_K = totalLossW / Math.max(targetTemperatureC - outdoorTemperatureC, 1e-6);
  const effectiveCapacitance_J_K = rooms.reduce(
    (sum, room) => sum + effectiveAirCapacitance(room.volumeM3, options.effectiveMassFactor),
    0
  );

  return {
    transmissionLossW,
    floorLossW,
    roofLossW,
    windowLossW,
    wallLossW,
    doorLossW,
    ventilationLossW,
    infiltrationLossW,
    totalLossW,
    passiveGainsW,
    solarGainW,
    internalGainsW,
    heatingDeliveredW,
    installedHeatingCapacityW,
    netBalanceW: passiveGainsW - totalLossW,
    requiredHeatingW: Math.max(0, totalLossW - passiveGainsW),
    surplusW: Math.max(0, passiveGainsW - totalLossW),
    totalUA_W_K,
    effectiveCapacitance_J_K,
  };
}

/*
function buildScenarioResultsLegacy(
  options: ThermalSimulationOptions,
  engineeringOptions: ResolvedEngineeringOptions,
  balance: EngineeringAnalysisResult["balance"],
  rooms: RoomBalanceResult[],
  simulationResult: ThermalSimulationResult | null
): EngineeringScenarioResult[] {
  const totalArea = rooms.reduce((sum, room) => sum + room.areaM2, 0);
  const initialTemperatureC = simulationResult?.timeline[0]
    ? averageRoomTemperatures(simulationResult.timeline[0].rooms)
    : rooms.reduce((sum, room) => sum + room.airTemperatureC, 0) / Math.max(rooms.length, 1);
  const baselineContext: EquivalentForecastContext = {
    ua_W_K: balance.totalUA_W_K,
    passiveDayGainW: options.internalGains.dayGain_W_m2 * totalArea + balance.solarGainW,
    passiveNightGainW: options.internalGains.nightGain_W_m2 * totalArea + balance.solarGainW * 0.15,
    heatingCapacityW: Math.max(balance.requiredHeatingW * 1.15, balance.heatingDeliveredW, 500),
    initialTemperatureC,
    effectiveCapacitance_J_K: Math.max(balance.effectiveCapacitance_J_K, 1e5),
    options,
  };

  const variants = [
    {
      id: "baseline",
      label: "Базовый вариант",
      description: "Текущие входные данные без модификаций.",
      assumptions: ["Эквивалентный прогноз по суммарным UA и C_eff."],
      modifier: { outdoorShiftC: 0, uaFactor: 1, heatingFactor: 1, passiveFactor: 1 },
    },
    {
      id: "colder-outdoor",
      label: "Наружная температура -5 °C",
      description: "Проверка чувствительности к похолоданию.",
      assumptions: ["Меняется только наружная температура."],
      modifier: { outdoorShiftC: -5, uaFactor: 1, heatingFactor: 1, passiveFactor: 1 },
    },
    {
      id: "window-upgrade",
      label: "Замена окон",
      description: "Эффект более теплого остекления.",
      assumptions: ["Потери через окна масштабируются через коэффициент U окна."],
      modifier: {
        outdoorShiftC: 0,
        uaFactor: 1 - (1 - engineeringOptions.scenarioDraft.windowUScale) * clamp(balance.windowLossW / Math.max(balance.totalLossW, 1), 0, 1),
        heatingFactor: 1,
        passiveFactor: 1,
      },
    },
    {
      id: "wall-insulation",
      label: "Утепление стен",
      description: "Снижение теплопередачи непрозрачной оболочки.",
      assumptions: ["Сопротивление наружных стен повышается как инженерная поправка."],
      modifier: {
        outdoorShiftC: 0,
        uaFactor: 1 - clamp(balance.wallLossW / Math.max(balance.totalLossW, 1), 0, 1) * 0.28,
        heatingFactor: 1,
        passiveFactor: 1,
      },
    },
    {
      id: "higher-ventilation",
      label: "Повышенный воздухообмен",
      description: "Рост кратности вентиляции и инфильтрации.",
      assumptions: ["Потери на воздух масштабируются без изменения тепловой массы."],
      modifier: {
        outdoorShiftC: 0,
        uaFactor:
          1 +
          clamp(
            (engineeringOptions.scenarioDraft.ventilationMultiplier - 1) *
              (balance.ventilationLossW + balance.infiltrationLossW) /
              Math.max(balance.totalLossW, 1),
            -0.9,
            3
          ),
        heatingFactor: 1,
        passiveFactor: 1,
      },
    },
    {
      id: "custom",
      label: engineeringOptions.scenarioDraft.name,
      description: "Пользовательская комбинация изменений оболочки и оборудования.",
      assumptions: [
        "Эквивалентный прогноз пересчитывается по суммарным UA и C_eff.",
        "Утепление учитывается как инженерная поправка к суммарной теплопередаче.",
      ],
      modifier: {
        outdoorShiftC: engineeringOptions.scenarioDraft.outdoorDeltaC,
        uaFactor: clamp(
          1 -
            0.22 * clamp(engineeringOptions.scenarioDraft.insulationResistanceDelta_m2K_W / 1.2, 0, 3) -
            (1 - engineeringOptions.scenarioDraft.windowUScale) * 0.18 +
            (engineeringOptions.scenarioDraft.ventilationMultiplier - 1) * 0.26,
          0.35,
          2.4
        ),
        heatingFactor: engineeringOptions.scenarioDraft.radiatorPowerMultiplier,
        passiveFactor: engineeringOptions.scenarioDraft.equipmentGainMultiplier,
      },
    },
  ];

  const baselinePoints = simulateEquivalentForecast(baselineContext, 0, 1, 1, 1);
  const baselineSummary = summarizeScenario(baselinePoints, options.timestepMinutes ?? 10);

  return variants.map((variant) => {
    const points = simulateEquivalentForecast(
      baselineContext,
      variant.modifier.outdoorShiftC,
      variant.modifier.uaFactor,
      variant.modifier.heatingFactor,
      variant.modifier.passiveFactor
    );
    const summary = summarizeScenario(points, options.timestepMinutes ?? 10);
    return {
      id: variant.id,
      label: variant.label,
      description: variant.description,
      assumptions: variant.assumptions,
      points,
      summary,
      delta: {
        peakHeatingKW: summary.peakHeatingKW - baselineSummary.peakHeatingKW,
        totalHeatingKWh: summary.totalHeatingKWh - baselineSummary.totalHeatingKWh,
        finalTemperatureC: summary.finalTemperatureC - baselineSummary.finalTemperatureC,
      },
    };
  });
}

function simulateEquivalentForecastLegacy(
  context: EquivalentForecastContext,
  outdoorShiftC: number,
  uaFactor: number,
  heatingFactor: number,
  passiveFactor: number
) {
  const timestepMinutes = Math.max(1, context.options.timestepMinutes ?? 10);
  const timestepSeconds = timestepMinutes * 60;
  const timestepHours = timestepMinutes / 60;
  const durationHours = context.options.duration === "7d" ? 24 * 7 : 24;
  const points: EngineeringScenarioResult["points"] = [];
  let indoorTemperatureC = context.initialTemperatureC;

  for (let timeHours = 0; timeHours <= durationHours + 1e-6; timeHours += timestepHours) {
    const hourOfDay = ((timeHours % 24) + 24) % 24;
    const isDay =
      context.options.setpoints.dayStartHour < context.options.setpoints.nightStartHour
        ? hourOfDay >= context.options.setpoints.dayStartHour && hourOfDay < context.options.setpoints.nightStartHour
        : hourOfDay >= context.options.setpoints.dayStartHour || hourOfDay < context.options.setpoints.nightStartHour;
    const setpointTemperatureC = isDay ? context.options.setpoints.day : context.options.setpoints.night;
    const passiveGainsW = (isDay ? context.passiveDayGainW : context.passiveNightGainW) * passiveFactor;
    const outdoorTemperatureC =
      context.options.outdoor.baseC +
      (context.options.outdoor.amplitudeC ?? 0) * Math.sin(((timeHours + (context.options.outdoor.phaseShiftHours ?? 0)) / 24) * Math.PI * 2) +
      (context.options.outdoor.seasonalOffsetC ?? 0) +
      outdoorShiftC;
    const lossesW = context.ua_W_K * uaFactor * Math.max(indoorTemperatureC - outdoorTemperatureC, 0);
    const passivePredictedC = indoorTemperatureC + (timestepSeconds / context.effectiveCapacitance_J_K) * (passiveGainsW - lossesW);
    const requiredHeatingW = Math.max(0, ((setpointTemperatureC - passivePredictedC) * context.effectiveCapacitance_J_K) / timestepSeconds);
    const heatingPowerW = Math.min(context.heatingCapacityW * heatingFactor, requiredHeatingW);
    indoorTemperatureC = passivePredictedC + (timestepSeconds / context.effectiveCapacitance_J_K) * heatingPowerW;

    points.push({
      timeHours,
      outdoorTemperatureC,
      setpointTemperatureC,
      indoorTemperatureC,
      heatingPowerW,
      lossPowerW: lossesW,
      passiveGainsW,
    });
  }

  return points;
}

function summarizeScenarioLegacy(points: EngineeringScenarioResult["points"], timestepMinutes: number) {
  const temperatures = points.map((point) => point.indoorTemperatureC);
  const warmupPoint = points.find((point) => point.indoorTemperatureC >= point.setpointTemperatureC - 0.2) ?? null;
  return {
    peakHeatingKW: Math.max(...points.map((point) => point.heatingPowerW)) / 1000,
    totalHeatingKWh: points.reduce((sum, point) => sum + point.heatingPowerW * (timestepMinutes / 60), 0) / 1000,
    minTemperatureC: Math.min(...temperatures),
    maxTemperatureC: Math.max(...temperatures),
    finalTemperatureC: points[points.length - 1]?.indoorTemperatureC ?? 0,
    warmupHoursToTarget: warmupPoint ? warmupPoint.timeHours : null,
  };
}

function buildSensitivityResultsLegacy(
  options: ThermalSimulationOptions,
  engineeringOptions: ResolvedEngineeringOptions,
  balance: EngineeringAnalysisResult["balance"]
): EngineeringSensitivityEntry[] {
  const items = [
    {
      id: "u-envelope",
      parameter: "U оболочки",
      unit: "%",
      baseValue: 100,
      perturbedValue: 110,
      deltaHeatingW: balance.transmissionLossW * 0.1,
      explanation: "В стационарной формуле Q = U·A·ΔT потери почти линейно масштабируются по U.",
    },
    {
      id: "outdoor-temperature",
      parameter: "Наружная температура",
      unit: "°C",
      baseValue: options.outdoor.baseC,
      perturbedValue: options.outdoor.baseC - 1,
      deltaHeatingW: balance.totalUA_W_K,
      explanation: "Снижение наружной температуры на 1 °C увеличивает нагрузку примерно на суммарное UA здания.",
    },
    {
      id: "ventilation",
      parameter: "Кратность воздухообмена",
      unit: "1/ч",
      baseValue: engineeringOptions.ventilationACH,
      perturbedValue: engineeringOptions.ventilationACH * 1.1,
      deltaHeatingW: (balance.ventilationLossW + balance.infiltrationLossW) * 0.1,
      explanation: "Потери на воздух пропорциональны расходу, поэтому чувствительность близка к линейной.",
    },
    {
      id: "radiators",
      parameter: "Мощность отопления",
      unit: "%",
      baseValue: engineeringOptions.radiatorPowerMultiplier * 100,
      perturbedValue: engineeringOptions.radiatorPowerMultiplier * 110,
      deltaHeatingW: -balance.requiredHeatingW * 0.08,
      explanation: "Рост установленной мощности уменьшает дефицит тепла, но не уменьшает теплопотери оболочки.",
    },
    {
      id: "insulation",
      parameter: "Дополнительное утепление",
      unit: "м²·К/Вт",
      baseValue: 0,
      perturbedValue: 0.5,
      deltaHeatingW: -balance.wallLossW * 0.12,
      explanation: "Добавочное сопротивление сильнее всего влияет на непрозрачную наружную оболочку.",
    },
  ];
  const maxImpact = Math.max(...items.map((entry) => Math.abs(entry.deltaHeatingW)), 1);
  return items
    .map((entry) => ({
      ...entry,
      deltaHeatingPercent: (entry.deltaHeatingW / Math.max(balance.requiredHeatingW, 1)) * 100,
      normalizedImpact: Math.abs(entry.deltaHeatingW) / maxImpact,
    }))
    .sort((left, right) => right.normalizedImpact - left.normalizedImpact);
}
*/

function buildScenarioResults(
  model: BuildingModel,
  options: ThermalSimulationOptions,
  engineeringOptions: ResolvedEngineeringOptions,
  baselineState: EngineeringEvaluationState,
  simulationResult: ThermalSimulationResult | null
): EngineeringScenarioResult[] {
  const initialTemperatureC = simulationResult?.timeline[0]
    ? averageRoomTemperatures(simulationResult.timeline[0].rooms)
    : baselineState.rooms.reduce((sum, room) => sum + room.airTemperatureC, 0) / Math.max(baselineState.rooms.length, 1);
  const baselineContext = buildEquivalentForecastContext(baselineState, options, initialTemperatureC);
  const variants: Array<{
    id: string;
    label: string;
    description: string;
    assumptions: string[];
    overrides: EngineeringStateOverrides;
  }> = [
    {
      id: "baseline",
      label: "Базовый вариант",
      description: "Текущие входные данные без изменений.",
      assumptions: [
        "Прогноз считается по сосредоточенной RC-модели первого порядка.",
        "UA, C_eff и теплопритоки берутся из базового инженерного пересчета.",
      ],
      overrides: {},
    },
    {
      id: "colder-outdoor",
      label: "Наружная температура -5 °C",
      description: "Проверка чувствительности к похолоданию.",
      assumptions: ["Меняется только температура наружной среды, остальные параметры сохраняются."],
      overrides: { outdoorTemperatureC: baselineState.outdoorTemperatureC - 5 },
    },
    {
      id: "window-upgrade",
      label: "Замена окон",
      description: "Эффект более теплого остекления.",
      assumptions: ["U-значение окон уменьшается на заданный множитель, затем потери через окна пересчитываются по Q = U·A·ΔT."],
      overrides: { windowU_W_m2K: engineeringOptions.windowU_W_m2K * engineeringOptions.scenarioDraft.windowUScale },
    },
    {
      id: "wall-insulation",
      label: "Утепление стен",
      description: "Снижение теплопередачи непрозрачной оболочки.",
      assumptions: [
        "К сопротивлению наружных стен добавляется дополнительное ΔR.",
        "После этого U пересчитывается по U = 1 / R_total.",
      ],
      overrides: { wallResistanceDelta_m2K_W: engineeringOptions.scenarioDraft.insulationResistanceDelta_m2K_W },
    },
    {
      id: "higher-ventilation",
      label: "Повышенный воздухообмен",
      description: "Рост кратности вентиляции и инфильтрации.",
      assumptions: ["Потери на воздух заново считаются по Q_vent = ρ·c_p·L·ΔT при измененном L = n·V/3600."],
      overrides: {
        ventilationACH: engineeringOptions.ventilationACH * engineeringOptions.scenarioDraft.ventilationMultiplier,
        infiltrationACH: (options.infiltrationACH ?? 0.5) * engineeringOptions.scenarioDraft.ventilationMultiplier,
      },
    },
    {
      id: "custom",
      label: engineeringOptions.scenarioDraft.name,
      description: "Пользовательская комбинация изменений оболочки и оборудования.",
      assumptions: [
        "Сценарий сочетает изменение наружной температуры, U окон, R стен, кратности воздухообмена и мощности источников.",
        "После изменения все метрики пересчитываются заново одной и той же инженерной моделью.",
      ],
      overrides: {
        outdoorTemperatureC: baselineState.outdoorTemperatureC + engineeringOptions.scenarioDraft.outdoorDeltaC,
        windowU_W_m2K: engineeringOptions.windowU_W_m2K * engineeringOptions.scenarioDraft.windowUScale,
        wallResistanceDelta_m2K_W: engineeringOptions.scenarioDraft.insulationResistanceDelta_m2K_W,
        ventilationACH: engineeringOptions.ventilationACH * engineeringOptions.scenarioDraft.ventilationMultiplier,
        infiltrationACH: (options.infiltrationACH ?? 0.5) * engineeringOptions.scenarioDraft.ventilationMultiplier,
        radiatorPowerMultiplier: engineeringOptions.radiatorPowerMultiplier * engineeringOptions.scenarioDraft.radiatorPowerMultiplier,
        equipmentGainMultiplier: engineeringOptions.equipmentGainMultiplier * engineeringOptions.scenarioDraft.equipmentGainMultiplier,
      },
    },
  ];

  const baselinePoints = simulateEquivalentForecast(baselineContext, 0);
  const baselineSummary = summarizeScenario(baselinePoints, options.timestepMinutes ?? 10);

  return variants.map((variant) => {
    const state =
      variant.id === "baseline"
        ? baselineState
        : evaluateEngineeringState(model, options, engineeringOptions, null, variant.overrides);
    const context = buildEquivalentForecastContext(state, options, initialTemperatureC);
    const outdoorShiftC =
      (variant.overrides.outdoorTemperatureC ?? baselineState.outdoorTemperatureC) - baselineState.outdoorTemperatureC;
    const points = simulateEquivalentForecast(context, outdoorShiftC);
    const summary = summarizeScenario(points, options.timestepMinutes ?? 10);
    return {
      id: variant.id,
      label: variant.label,
      description: variant.description,
      assumptions: variant.assumptions,
      points,
      summary,
      delta: {
        peakHeatingKW: summary.peakHeatingKW - baselineSummary.peakHeatingKW,
        totalHeatingKWh: summary.totalHeatingKWh - baselineSummary.totalHeatingKWh,
        finalTemperatureC: summary.finalTemperatureC - baselineSummary.finalTemperatureC,
      },
    };
  });
}

function buildEquivalentForecastContext(
  state: EngineeringEvaluationState,
  options: ThermalSimulationOptions,
  initialTemperatureC: number
): EquivalentForecastContext {
  return {
    ua_W_K: Math.max(state.balance.totalUA_W_K, 0),
    passiveDayGainW: state.balance.internalGainsW + state.balance.solarGainW,
    passiveNightGainW: state.balance.internalGainsW,
    heatingCapacityW: Math.max(state.balance.installedHeatingCapacityW, 0),
    initialTemperatureC,
    effectiveCapacitance_J_K: Math.max(state.balance.effectiveCapacitance_J_K, 1e5),
    options,
  };
}

function simulateEquivalentForecast(context: EquivalentForecastContext, outdoorShiftC: number) {
  const timestepMinutes = Math.max(1, context.options.timestepMinutes ?? 10);
  const timestepSeconds = timestepMinutes * 60;
  const timestepHours = timestepMinutes / 60;
  const durationHours = context.options.duration === "7d" ? 24 * 7 : 24;
  const totalSteps = Math.round(durationHours / timestepHours);
  const points: EngineeringScenarioResult["points"] = [];
  let indoorTemperatureC = context.initialTemperatureC;

  for (let step = 0; step <= totalSteps; step += 1) {
    const timeHours = step * timestepHours;
    const hourOfDay = ((timeHours % 24) + 24) % 24;
    const isDay =
      context.options.setpoints.dayStartHour < context.options.setpoints.nightStartHour
        ? hourOfDay >= context.options.setpoints.dayStartHour && hourOfDay < context.options.setpoints.nightStartHour
        : hourOfDay >= context.options.setpoints.dayStartHour || hourOfDay < context.options.setpoints.nightStartHour;
    const setpointTemperatureC = isDay ? context.options.setpoints.day : context.options.setpoints.night;
    const passiveGainsW = isDay ? context.passiveDayGainW : context.passiveNightGainW;
    const outdoorTemperatureC =
      context.options.outdoor.baseC +
      (context.options.outdoor.amplitudeC ?? 0) * Math.sin(((timeHours + (context.options.outdoor.phaseShiftHours ?? 0)) / 24) * Math.PI * 2) +
      (context.options.outdoor.seasonalOffsetC ?? 0) +
      outdoorShiftC;
    const lossPowerW = context.ua_W_K * (indoorTemperatureC - outdoorTemperatureC);
    const requiredHeatingW = Math.max(
      0,
      ((setpointTemperatureC - indoorTemperatureC) * context.effectiveCapacitance_J_K) / timestepSeconds + lossPowerW - passiveGainsW
    );
    const heatingPowerW = Math.min(context.heatingCapacityW, requiredHeatingW);

    points.push({
      timeHours,
      outdoorTemperatureC,
      setpointTemperatureC,
      indoorTemperatureC,
      heatingPowerW,
      lossPowerW,
      passiveGainsW,
    });

    if (step === totalSteps) {
      break;
    }

    indoorTemperatureC =
      indoorTemperatureC +
      (timestepSeconds / context.effectiveCapacitance_J_K) * (passiveGainsW + heatingPowerW - lossPowerW);
  }

  return points;
}

function summarizeScenario(points: EngineeringScenarioResult["points"], timestepMinutes: number) {
  const temperatures = points.map((point) => point.indoorTemperatureC);
  const warmupPoint = points.find((point) => point.indoorTemperatureC >= point.setpointTemperatureC - 0.2) ?? null;
  const activePoints = points.slice(0, -1);
  return {
    peakHeatingKW: Math.max(...points.map((point) => point.heatingPowerW)) / 1000,
    totalHeatingKWh: activePoints.reduce((sum, point) => sum + point.heatingPowerW * (timestepMinutes / 60), 0) / 1000,
    minTemperatureC: Math.min(...temperatures),
    maxTemperatureC: Math.max(...temperatures),
    finalTemperatureC: points[points.length - 1]?.indoorTemperatureC ?? 0,
    warmupHoursToTarget: warmupPoint ? warmupPoint.timeHours : null,
  };
}

function buildSensitivityResults(
  model: BuildingModel,
  options: ThermalSimulationOptions,
  engineeringOptions: ResolvedEngineeringOptions,
  baselineState: EngineeringEvaluationState
): EngineeringSensitivityEntry[] {
  const wallEntries = baselineState.envelope.filter((entry) => entry.kind === "wall");
  const weightedWallResistance =
    wallEntries.reduce((sum, entry) => sum + entry.totalResistance_m2K_W * entry.areaM2, 0) /
    Math.max(
      wallEntries.reduce((sum, entry) => sum + entry.areaM2, 0),
      1
    );
  const baseDeltaT = Math.max(baselineState.targetTemperatureC - baselineState.outdoorTemperatureC, 0.1);
  const baselineHeatingW = Math.max(baselineState.balance.requiredHeatingW, 1);
  const methodName = "Локальная чувствительность конечным возмущением";
  const formula = "S_x = (ΔY / Y) / (ΔX / X)";
  const items = [
    {
      id: "temperature-drive",
      parameter: "Температурный напор ΔT = T_in - T_out",
      unit: "K",
      baseValue: baseDeltaT,
      perturbedValue: baseDeltaT * 1.1,
      state: evaluateEngineeringState(model, options, engineeringOptions, null, {
        outdoorTemperatureC: baselineState.targetTemperatureC - baseDeltaT * 1.1,
      }),
      explanation: "Изменяется температурный напор оболочки, затем потери пересчитываются по Q = U·A·ΔT и Q_vent = ρ·c_p·L·ΔT.",
    },
    {
      id: "window-u",
      parameter: "Коэффициент теплопередачи окна U_window",
      unit: "Вт/(м²·К)",
      baseValue: engineeringOptions.windowU_W_m2K,
      perturbedValue: engineeringOptions.windowU_W_m2K * 1.1,
      state: evaluateEngineeringState(model, options, engineeringOptions, null, {
        windowU_W_m2K: engineeringOptions.windowU_W_m2K * 1.1,
      }),
      explanation: "Параметр окна меняется напрямую, а вклад окон пересчитывается по Q = U·A·ΔT.",
    },
    {
      id: "ventilation",
      parameter: "Кратность механической вентиляции",
      unit: "1/ч",
      baseValue: engineeringOptions.ventilationACH,
      perturbedValue: engineeringOptions.ventilationACH * 1.1,
      state: evaluateEngineeringState(model, options, engineeringOptions, null, {
        ventilationACH: engineeringOptions.ventilationACH * 1.1,
      }),
      explanation: "Изменяется расход приточного воздуха через L = n·V/3600, затем потери пересчитываются по Q_vent = ρ·c_p·L·ΔT.",
    },
    {
      id: "infiltration",
      parameter: "Кратность инфильтрации",
      unit: "1/ч",
      baseValue: options.infiltrationACH ?? 0.5,
      perturbedValue: (options.infiltrationACH ?? 0.5) * 1.1,
      state: evaluateEngineeringState(model, options, engineeringOptions, null, {
        infiltrationACH: (options.infiltrationACH ?? 0.5) * 1.1,
      }),
      explanation: "Меняется расход подсоса наружного воздуха, после чего потери на инфильтрацию пересчитываются той же формулой чувствительной теплоты воздуха.",
    },
    {
      id: "wall-resistance",
      parameter: "Сопротивление наружных стен R_wall,total",
      unit: "м²·К/Вт",
      baseValue: weightedWallResistance,
      perturbedValue: weightedWallResistance * 1.1,
      state: evaluateEngineeringState(model, options, engineeringOptions, null, {
        wallResistanceDelta_m2K_W: weightedWallResistance * 0.1,
      }),
      explanation: "К наружным стенам добавляется 10% к средневзвешенному сопротивлению, затем U пересчитывается как U = 1 / R_total.",
    },
    {
      id: "equipment-gains",
      parameter: "Теплопритоки от оборудования",
      unit: "отн.",
      baseValue: engineeringOptions.equipmentGainMultiplier,
      perturbedValue: engineeringOptions.equipmentGainMultiplier * 1.1,
      state: evaluateEngineeringState(model, options, engineeringOptions, null, {
        equipmentGainMultiplier: engineeringOptions.equipmentGainMultiplier * 1.1,
      }),
      explanation: "Изменяются внутренние теплопритоки от оборудования, после чего заново считается стационарный тепловой баланс помещения.",
    },
  ];
  const maxImpact = Math.max(
    ...items.map((entry) => Math.abs(entry.state.balance.requiredHeatingW - baselineState.balance.requiredHeatingW)),
    1
  );
  return items
    .map((entry) => {
      const deltaHeatingW = entry.state.balance.requiredHeatingW - baselineState.balance.requiredHeatingW;
      const relativeInputChange = (entry.perturbedValue - entry.baseValue) / Math.max(Math.abs(entry.baseValue), 1e-6);
      return {
        id: entry.id,
        parameter: entry.parameter,
        unit: entry.unit,
        baseValue: entry.baseValue,
        perturbedValue: entry.perturbedValue,
        deltaInputPercent: relativeInputChange * 100,
        deltaHeatingW,
        deltaHeatingPercent: (deltaHeatingW / baselineHeatingW) * 100,
        sensitivityIndex: (deltaHeatingW / baselineHeatingW) / Math.max(relativeInputChange, 1e-6),
        methodName,
        formula,
        normalizedImpact: Math.abs(deltaHeatingW) / maxImpact,
        explanation: entry.explanation,
      };
    })
    .sort((left, right) => right.normalizedImpact - left.normalizedImpact);
}

function buildInputSources(
  model: BuildingModel,
  options: ResolvedEngineeringOptions,
  envelope: EnvelopeElementResult[]
): EngineeringInputSource[] {
  return [
    {
      label: "Геометрия помещений и стен",
      origin: model.rooms.length && model.walls.length ? "user" : "default",
      editable: true,
      note: "Берется из BIM/редактора модели.",
    },
    {
      label: "Слои и теплопроводность стен",
      origin: envelope.some((entry) => entry.kind === "wall" && !entry.assumed) ? "user" : "default",
      editable: true,
      note: "Если слои стены отсутствуют, используется типовая сборка.",
    },
    {
      label: "U окон и дверей",
      origin: "default",
      editable: true,
      note: "В модели нет послойной конструкции окна, поэтому используется интегральный U из настроек.",
    },
    {
      label: "Пол и покрытие",
      origin: "default",
      editable: true,
      note: "Заданы как инженерные допущения, пока нет явных конструкций.",
    },
    {
      label: "Температура грунта",
      origin: "default",
      editable: true,
      note: `Используется ${roundNumber(options.groundTemperatureC, 1)} °C как типовое приближение.`,
    },
    {
      label: "Состояния оборудования и сетей",
      origin: model.equipment.length || model.pipes.length || model.ducts.length ? "user" : "default",
      editable: true,
      note: "Притоки от оборудования и труб берутся из текущей инженерной модели.",
    },
    {
      label: "Датчики",
      origin: model.sensors.some((sensor) => sensor.value !== null) ? "measured" : "default",
      editable: false,
      note: "Наличие датчиков полезно для последующей калибровки, но не заменяет расчетную модель.",
    },
  ];
}

function buildConfidenceSummary(
  inputs: EngineeringInputSource[],
  validation: EngineeringAnalysisResult["validation"]
): EngineeringConfidenceSummary {
  const defaultsUsed = inputs.filter((entry) => entry.origin === "default").length;
  const userInputs = inputs.filter((entry) => entry.origin === "user").length;
  const derivedInputs = inputs.filter((entry) => entry.origin === "derived").length;
  const measuredInputs = inputs.filter((entry) => entry.origin === "measured").length;
  const errorCount = validation.filter((entry) => entry.severity === "error").length;
  const warningCount = validation.filter((entry) => entry.severity === "warning").length;

  let level: EngineeringConfidenceSummary["level"] = "high";
  const rationale: string[] = [];
  if (errorCount > 0) {
    level = "low";
    rationale.push("Есть ошибки входных данных, которые ограничивают применимость расчета.");
  }
  if (defaultsUsed >= 3 || warningCount >= 3) {
    level = level === "low" ? "low" : "medium";
    rationale.push("Существенная часть параметров принята по умолчанию либо сопровождается предупреждениями.");
  }
  if (measuredInputs > 0 && errorCount === 0) {
    rationale.push("В модели присутствуют измеренные данные датчиков, что полезно для последующей калибровки.");
  }
  if (!rationale.length) {
    rationale.push("Основные геометрические и режимные параметры заданы явно, модель находится в области типовой инженерной применимости.");
  }

  return {
    level,
    defaultsUsed,
    userInputs,
    derivedInputs,
    measuredInputs,
    rationale,
  };
}

function sumEnvelope(envelope: EnvelopeElementResult[], kind: EnvelopeElementKind): number {
  return envelope.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.heatFluxW, 0);
}

function averageRoomTemperatures(
  rooms: Record<string, { temperatureC: number; heatingPowerW: number; setpointC: number }>
): number {
  const values = Object.values(rooms);
  return values.reduce((sum, room) => sum + room.temperatureC, 0) / Math.max(values.length, 1);
}
