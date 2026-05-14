import { polygonArea, segmentLength } from "../../entities/geometry/geom";
import type { BuildingModel } from "../../entities/geometry/types";
import type { SensorDevice } from "../../entities/networks/types";
import type { AIRecommendation, AIWarning, ModelAnalysisResult, ModelAnalyzerOptions } from "./types";

const DEFAULT_OPTIONS: Required<ModelAnalyzerOptions> = {
  minVentilationFlowPerArea_m3_s_m2: 0.0015,
  minPipeVelocity_m_s: 0.25,
  maxPipeVelocity_m_s: 1.8,
  minPipePressurePa: 15_000,
  maxPipePressurePa: 350_000,
  minSensorPressurePa: 20,
  maxSensorPressurePa: 2_500,
};

export function analyzeEngineeringModel(
  model: BuildingModel,
  options: ModelAnalyzerOptions = {}
): ModelAnalysisResult {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const warnings: AIWarning[] = [];
  const recommendations: AIRecommendation[] = [];
  const timestamp = Date.now();

  model.rooms.forEach((room) => {
    const area = Math.abs(polygonArea(room.polygon));
    if (area <= 0) {
      return;
    }
    const roomEquipment = model.equipment.filter((item) => item.roomId === room.id);
    const airflow = roomEquipment.reduce((sum, item) => sum + (item.params.designAirflow_m3_s ?? 0), 0);
    const airflowPerArea = airflow / Math.max(area, 0.1);
    if (airflowPerArea < config.minVentilationFlowPerArea_m3_s_m2) {
      const warningId = `warn:ventilation:${room.id}`;
      warnings.push({
        id: warningId,
        code: "insufficient_ventilation",
        severity: "warning",
        title: `Insufficient ventilation in ${room.name}`,
        message: `Room airflow is below the configured minimum for its floor area.`,
        entityId: room.id,
        entityType: "room",
        metrics: {
          roomArea_m2: roundValue(area),
          airflow_m3_s: roundValue(airflow),
          airflowPerArea_m3_s_m2: roundValue(airflowPerArea),
          minimumRequired_m3_s_m2: config.minVentilationFlowPerArea_m3_s_m2,
        },
      });
      recommendations.push({
        id: `rec:ventilation:${room.id}`,
        priority: "high",
        title: `Increase ventilation for ${room.name}`,
        action: "Add or resize air terminals, or raise the design airflow for the room equipment.",
        rationale: `Current airflow per area is ${roundValue(airflowPerArea)} m3/s/m2.`,
        relatedWarningIds: [warningId],
      });
    }
  });

  model.pipes.forEach((pipe) => {
    if (!Number.isFinite(pipe.diameter_mm) || pipe.diameter_mm <= 0) {
      return;
    }
    const diameter_m = pipe.diameter_mm / 1000;
    const area_m2 = Math.PI * (diameter_m / 2) ** 2;
    const volumetricFlow_m3_s = Math.max(pipe.flowRate_kg_s, 0) / 1000;
    const velocity_m_s = area_m2 > 0 ? volumetricFlow_m3_s / area_m2 : 0;
    if (velocity_m_s < config.minPipeVelocity_m_s || velocity_m_s > config.maxPipeVelocity_m_s) {
      const warningId = `warn:pipe-diameter:${pipe.id}`;
      warnings.push({
        id: warningId,
        code: "incorrect_pipe_diameter",
        severity: velocity_m_s > config.maxPipeVelocity_m_s ? "critical" : "warning",
        title: `Pipe diameter mismatch for ${pipe.id}`,
        message: `Calculated water velocity is outside the acceptable operating range.`,
        entityId: pipe.id,
        entityType: "pipe",
        metrics: {
          diameter_mm: pipe.diameter_mm,
          flowRate_kg_s: roundValue(pipe.flowRate_kg_s),
          velocity_m_s: roundValue(velocity_m_s),
          pipeLength_m: roundValue(polylineLength(pipe.path)),
        },
      });
      recommendations.push({
        id: `rec:pipe-diameter:${pipe.id}`,
        priority: velocity_m_s > config.maxPipeVelocity_m_s ? "high" : "medium",
        title: `Review pipe sizing for ${pipe.id}`,
        action:
          velocity_m_s > config.maxPipeVelocity_m_s
            ? "Increase the pipe diameter or split the branch to reduce pressure losses."
            : "Reduce the pipe diameter or consolidate branches to avoid oversizing.",
        rationale: `Estimated flow velocity is ${roundValue(velocity_m_s)} m/s.`,
        relatedWarningIds: [warningId],
      });
    }

    if (pipe.pressurePa < config.minPipePressurePa || pipe.pressurePa > config.maxPipePressurePa) {
      const warningId = `warn:pipe-pressure:${pipe.id}`;
      warnings.push({
        id: warningId,
        code: "abnormal_pressure",
        severity: "critical",
        title: `Abnormal pipe pressure in ${pipe.id}`,
        message: `Pipe pressure is outside the expected engineering envelope.`,
        entityId: pipe.id,
        entityType: "pipe",
        metrics: {
          pressurePa: roundValue(pipe.pressurePa),
          minimumAllowedPa: config.minPipePressurePa,
          maximumAllowedPa: config.maxPipePressurePa,
          pipeLength_m: roundValue(polylineLength(pipe.path)),
        },
      });
      recommendations.push({
        id: `rec:pipe-pressure:${pipe.id}`,
        priority: "high",
        title: `Stabilize hydraulic pressure in ${pipe.id}`,
        action: "Check pump head, branch balancing, and losses along the system length.",
        rationale: `Measured pressure is ${roundValue(pipe.pressurePa)} Pa.`,
        relatedWarningIds: [warningId],
      });
    }
  });

  model.sensors
    .filter((sensor) => sensor.type === "pressure")
    .forEach((sensor) => {
      if (sensor.value === null) {
        return;
      }
      if (sensor.value < config.minSensorPressurePa || sensor.value > config.maxSensorPressurePa) {
        const warningId = `warn:sensor-pressure:${sensor.id}`;
        warnings.push(buildPressureSensorWarning(sensor, warningId, config));
        recommendations.push({
          id: `rec:sensor-pressure:${sensor.id}`,
          priority: "medium",
          title: `Verify pressure sensor ${sensor.id}`,
          action: "Inspect the nearby branch, confirm sensor calibration, and compare against design values.",
          rationale: `Sensor reading is ${roundValue(sensor.value)} ${sensor.unit || "Pa"}.`,
          relatedWarningIds: [warningId],
        });
      }
    });

  return {
    module: "modelAnalyzer",
    timestamp,
    warnings,
    recommendations: dedupeRecommendations(recommendations),
    summary: {
      roomCount: model.rooms.length,
      totalArea_m2: roundValue(model.rooms.reduce((sum, room) => sum + Math.abs(polygonArea(room.polygon)), 0)),
      totalPipeLength_m: roundValue(model.pipes.reduce((sum, pipe) => sum + polylineLength(pipe.path), 0)),
      totalDuctLength_m: roundValue(model.ducts.reduce((sum, duct) => sum + polylineLength(duct.path), 0)),
      averagePipePressurePa: roundValue(
        model.pipes.length ? model.pipes.reduce((sum, pipe) => sum + pipe.pressurePa, 0) / model.pipes.length : 0
      ),
      warningCount: warnings.length,
    },
  };
}

function buildPressureSensorWarning(
  sensor: SensorDevice,
  warningId: string,
  options: Required<ModelAnalyzerOptions>
): AIWarning {
  return {
    id: warningId,
    code: "abnormal_pressure",
    severity: "warning",
    title: `Abnormal pressure reading from ${sensor.id}`,
    message: `Pressure sensor reading is outside the configured monitoring range.`,
    entityId: sensor.id,
    entityType: "sensor",
    metrics: {
      pressurePa: roundValue(sensor.value ?? 0),
      minimumAllowedPa: options.minSensorPressurePa,
      maximumAllowedPa: options.maxSensorPressurePa,
    },
  };
}

function polylineLength(path: Array<{ x: number; y: number }>): number {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += segmentLength(path[index - 1], path[index]);
  }
  return length;
}

function dedupeRecommendations(recommendations: AIRecommendation[]): AIRecommendation[] {
  const seen = new Set<string>();
  return recommendations.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

function roundValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}
