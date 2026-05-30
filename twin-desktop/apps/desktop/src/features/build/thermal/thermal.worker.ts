import { createThermalFieldModel, type ThermalFieldBuildOptions } from "../../../core/thermal/field";
import { buildPreviewThermalFrame } from "../../../core/thermal/preview";
import type { PreparedThermalAnalysis, ThermalWorkerRequest, ThermalWorkerResponse } from "./workerContracts";

function prepareThermalAnalysis({
  model,
  fieldOptions,
  frame,
}: Omit<ThermalWorkerRequest, "requestId">): PreparedThermalAnalysis {
  const startedAt = performance.now();
  const previewFrame = buildPreviewThermalFrame(model, fieldOptions);
  const effectiveFrame = frame ?? previewFrame;
  const roomTemperaturesC = Object.fromEntries(
    Object.entries(effectiveFrame.rooms).map(([roomId, payload]) => [roomId, payload.temperatureC])
  );
  const field = createThermalFieldModel(model, {
    ...(fieldOptions as ThermalFieldBuildOptions),
    outdoorTemperatureC: effectiveFrame.outdoorTemperatureC,
    roomTemperaturesC,
  });
  const sampleCount = field.rooms.reduce((sum, room) => sum + room.samplePoints.length, 0);
  return {
    previewFrame,
    effectiveFrame,
    field,
    stats: {
      computeMs: performance.now() - startedAt,
      sampleCount,
      sourceCount: field.sources.length,
      boundaryCount: field.boundaries.length,
    },
  };
}

self.onmessage = (event: MessageEvent<ThermalWorkerRequest>) => {
  try {
    const result = prepareThermalAnalysis(event.data);
    const response: ThermalWorkerResponse = {
      requestId: event.data.requestId,
      ok: true,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: ThermalWorkerResponse = {
      requestId: event.data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : "Не удалось подготовить тепловое поле.",
    };
    self.postMessage(response);
  }
};

export {};
