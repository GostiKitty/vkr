import { buildThermalPhysicsModel } from "./physics";
const DEFAULT_OUTDOOR_TEMPERATURE_C = 4;
const DEFAULT_SETPOINT_C = 21;
export function buildPreviewThermalFrame(model, options = {}) {
    const outdoorTemperatureC = options.outdoorTemperatureC ?? DEFAULT_OUTDOOR_TEMPERATURE_C;
    const physics = buildThermalPhysicsModel(model, {
        ...options,
        outdoorTemperatureC,
        setpointTemperatureC: options.setpointTemperatureC ?? DEFAULT_SETPOINT_C,
    });
    const rooms = {};
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
