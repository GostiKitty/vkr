export const DEFAULT_THERMAL_DISPLAY_OPTIONS = {
    outdoorTemperatureC: 4,
    windFactor: 1,
    solarGainFactor: 0.45,
    lightingGain_W_m2: 2.6,
    occupancyGain_W_m2: 1.4,
    infiltrationACH: 0.45,
    ventilationACH: 0.18,
    supplyAirTemperatureC: null,
    radiatorPowerMultiplier: 1,
    equipmentGainMultiplier: 1,
    mode: "steady",
    showSurfaceField: true,
    surfaceFieldMode: "surfaceTemperature",
    showHeatSources: false,
    showThermalBridges: false,
    showFloorField: true,
    showWallSurfaces: true,
    showContours: true,
    showVolumeTint: false,
    showLegend: true,
    showTooltip: true,
    surfaceFieldOpacity: 0.52,
};
export function buildThermalFieldOptions(display, simulation, frame) {
    const timeHours = frame?.timeHours ?? 12;
    const outdoorTemperatureC = frame?.outdoorTemperatureC ?? display.outdoorTemperatureC;
    const dayStart = simulation.setpoints.dayStartHour;
    const nightStart = simulation.setpoints.nightStartHour;
    const hour = ((timeHours % 24) + 24) % 24;
    const isDay = dayStart < nightStart
        ? hour >= dayStart && hour < nightStart
        : hour >= dayStart || hour < nightStart;
    return {
        outdoorTemperatureC,
        timeHours,
        setpointTemperatureC: isDay ? simulation.setpoints.day : simulation.setpoints.night,
        windFactor: display.windFactor,
        solarGainFactor: display.solarGainFactor,
        lightingGain_W_m2: display.lightingGain_W_m2,
        occupancyGain_W_m2: display.occupancyGain_W_m2,
        infiltrationACH: display.infiltrationACH,
        ventilationACH: display.ventilationACH,
        supplyAirTemperatureC: display.supplyAirTemperatureC,
        radiatorPowerMultiplier: display.radiatorPowerMultiplier,
        equipmentGainMultiplier: display.equipmentGainMultiplier,
        transientBlend: display.mode === "steady" ? 1 : 0.64,
    };
}
