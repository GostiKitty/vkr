import type { BuildingModel } from "../../entities/geometry/types";
import { buildResolvedGeometryRenderModel } from "../geometry/bimPipeline";
import { buildThermalPhysicsModel, type ThermalPhysicsOptions } from "./physics";
import type { ThermalTimelinePoint } from "./solver";

const DEFAULT_OUTDOOR_TEMPERATURE_C = 4;
const DEFAULT_SETPOINT_C = 21;

export interface PreviewThermalOptions
  extends Omit<ThermalPhysicsOptions, "fixedRoomTemperaturesC" | "outdoorTemperatureC"> {
  timeHours?: number;
  outdoorTemperatureC?: number;
  setpointTemperatureC?: number;
}

export function buildPreviewThermalFrame(
  model: BuildingModel,
  options: PreviewThermalOptions = {}
): ThermalTimelinePoint {
  const outdoorTemperatureC = options.outdoorTemperatureC ?? DEFAULT_OUTDOOR_TEMPERATURE_C;
  const renderGeometry = buildResolvedGeometryRenderModel(model, null);
  const physics = buildThermalPhysicsModel(
    model,
    {
      ...options,
      outdoorTemperatureC,
      setpointTemperatureC: options.setpointTemperatureC ?? DEFAULT_SETPOINT_C,
    },
    renderGeometry
  );

  const rooms: ThermalTimelinePoint["rooms"] = {};
  physics.roomBalances.forEach((balance) => {
    rooms[balance.roomId] = {
      temperatureC: balance.airTemperatureC,
      heatingPowerW: balance.heatingDeliveredW,
      setpointC: balance.setpointC,
    };
  });

  return {
    timeHours: options.timeHours ?? 12,
    outdoorTemperatureC,
    rooms,
  };
}
