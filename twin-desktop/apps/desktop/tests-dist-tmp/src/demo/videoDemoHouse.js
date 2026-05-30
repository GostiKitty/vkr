import { createEmptyBuildingModel, } from "../entities/geometry/types";
import { applyEnvelopePresetToDoor, applyEnvelopePresetToWindow, resolveDefaultPresetId, } from "../entities/envelope/envelopePresets";
import { applyDefaultOpeningEnvelopeToModel, TYPICAL_INSULATED_DOOR_U_W_M2K, TYPICAL_PVC_WINDOW_G_VALUE, TYPICAL_PVC_WINDOW_U_W_M2K, windowEnvelopeSourceNote, } from "../shared/utils/openingThermalData";
import { polygonArea, segmentLength } from "../entities/geometry/geom";
import { resolveScenarioConfig } from "../entities/workflow/workflow.store";
import { DEFAULT_OPERATIONAL_SCENARIOS } from "../entities/networks/types";
import { runThermalSimulation } from "../core/thermal/solver";
import { getSp131CityClimate } from "../norms/sp131_2025/climate";
import { deriveVideoDemoExteriorWallThermalBridges, deriveVideoDemoFloorOnGroundThermalBridges, deriveVideoDemoRoofThermalBridges, envelopeFragmentHasThermalBridgeData, } from "./deriveExteriorWallThermalBridges";
const LEVEL_1_ID = "video-level-1";
const LEVEL_2_ID = "video-level-2";
const HEATING_SYSTEM_ID = "video-heating";
const EXT_WALL_THICKNESS_M = 0.34;
const INT_WALL_THICKNESS_M = 0.16;
const LEVEL_HEIGHT_M = 3;
const FOOTPRINT = { width: 14, depth: 10 };
export const VIDEO_DEMO_ROOM_IDS = {
    living: "video-room-living",
    bedroom: "video-room-bedroom",
    kitchen: "video-room-kitchen",
    utility: "video-room-utility",
    study: "video-room-study",
    nursery: "video-room-nursery",
    hall: "video-room-hall",
    bathroom: "video-room-bathroom",
};
export const VIDEO_DEMO_ROOM_TEMPERATURES = {
    [VIDEO_DEMO_ROOM_IDS.living]: 21.6,
    [VIDEO_DEMO_ROOM_IDS.bedroom]: 20.4,
    [VIDEO_DEMO_ROOM_IDS.kitchen]: 22.1,
    [VIDEO_DEMO_ROOM_IDS.utility]: 19.2,
    [VIDEO_DEMO_ROOM_IDS.study]: 21.2,
    [VIDEO_DEMO_ROOM_IDS.nursery]: 22.4,
    [VIDEO_DEMO_ROOM_IDS.hall]: 20.8,
    [VIDEO_DEMO_ROOM_IDS.bathroom]: 24.0,
};
const EXTERIOR_WALL_LAYERS = [
    { materialId: "cement_sand_plaster", thickness_m: 0.02 },
    { materialId: "aerated_concrete", thickness_m: 0.3 },
    { materialId: "mineral_wool", thickness_m: 0.12 },
    { materialId: "gypsum_plaster", thickness_m: 0.015 },
];
const INTERIOR_WALL_LAYERS = [
    { materialId: "gypsum_board", thickness_m: 0.0125 },
    { materialId: "mineral_wool", thickness_m: 0.08 },
    { materialId: "gypsum_board", thickness_m: 0.0125 },
];
const ROOF_LAYERS = [
    { materialId: "gypsum_board", thickness_m: 0.0125 },
    { materialId: "mineral_wool", thickness_m: 0.24 },
    { materialId: "plywood", thickness_m: 0.018 },
];
const FLOOR_GROUND_LAYERS = [
    { materialId: "reinforced_concrete", thickness_m: 0.18 },
    { materialId: "xps", thickness_m: 0.1 },
    { materialId: "cement_sand_plaster", thickness_m: 0.05 },
];
const FLOOR_INTER_LAYERS = [
    { materialId: "reinforced_concrete", thickness_m: 0.2 },
    { materialId: "mineral_wool", thickness_m: 0.06 },
    { materialId: "cement_sand_plaster", thickness_m: 0.04 },
];
const WINDOW_LAYERS = [{ materialId: "pvc_double_glazed_unit_equivalent", thickness_m: 0.07 }];
const DEMO_WINDOW_PRESET_ID = resolveDefaultPresetId("window");
const DEMO_DOOR_PRESET_ID = resolveDefaultPresetId("door");
const DOOR_LAYERS = [
    { materialId: "wood", thickness_m: 0.04 },
    { materialId: "eps", thickness_m: 0.05 },
    { materialId: "plywood", thickness_m: 0.01 },
];
const FOOTPRINT_BOUNDARY = [
    { x: 0, y: 0 },
    { x: FOOTPRINT.width, y: 0 },
    { x: FOOTPRINT.width, y: FOOTPRINT.depth },
    { x: 0, y: FOOTPRINT.depth },
];
function cloneDeep(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
function createWall(id, levelId, a, b, options) {
    return {
        id,
        levelId,
        a,
        b,
        thickness_m: options.thickness_m,
        height_m: LEVEL_HEIGHT_M,
        wallAssemblyId: options.wallAssemblyId,
        layers: options.layers,
    };
}
function buildWallMap(walls) {
    return new Map(walls.map((wall) => [wall.id, wall]));
}
function buildWallAnchor(wall, offset_m) {
    const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
    const safeLength = length > 1e-6 ? length : 1;
    return {
        wallId: wall.id,
        t: Math.min(Math.max(offset_m / safeLength, 0), 1),
        offset_m,
    };
}
function buildLevelWalls(levelId, prefix) {
    const ext = {
        thickness_m: EXT_WALL_THICKNESS_M,
        layers: EXTERIOR_WALL_LAYERS,
        wallAssemblyId: "video-exterior-wall",
    };
    const interior = {
        thickness_m: INT_WALL_THICKNESS_M,
        layers: INTERIOR_WALL_LAYERS,
        wallAssemblyId: "video-interior-wall",
    };
    const w = FOOTPRINT.width;
    const d = FOOTPRINT.depth;
    const midX = w / 2;
    const midY = d / 2;
    // Периметр режем в узлах пересечения с осями — иначе контурный детектор видит только внешний контур.
    return [
        createWall(`${prefix}-south-west`, levelId, { x: 0, y: 0 }, { x: midX, y: 0 }, ext),
        createWall(`${prefix}-south-east`, levelId, { x: midX, y: 0 }, { x: w, y: 0 }, ext),
        createWall(`${prefix}-east-south`, levelId, { x: w, y: 0 }, { x: w, y: midY }, ext),
        createWall(`${prefix}-east-north`, levelId, { x: w, y: midY }, { x: w, y: d }, ext),
        createWall(`${prefix}-north-east`, levelId, { x: w, y: d }, { x: midX, y: d }, ext),
        createWall(`${prefix}-north-west`, levelId, { x: midX, y: d }, { x: 0, y: d }, ext),
        createWall(`${prefix}-west-north`, levelId, { x: 0, y: d }, { x: 0, y: midY }, ext),
        createWall(`${prefix}-west-south`, levelId, { x: 0, y: midY }, { x: 0, y: 0 }, ext),
        createWall(`${prefix}-center-vert-lower`, levelId, { x: midX, y: 0 }, { x: midX, y: midY }, interior),
        createWall(`${prefix}-center-vert-upper`, levelId, { x: midX, y: midY }, { x: midX, y: d }, interior),
        createWall(`${prefix}-center-horiz-left`, levelId, { x: 0, y: midY }, { x: midX, y: midY }, interior),
        createWall(`${prefix}-center-horiz-right`, levelId, { x: midX, y: midY }, { x: w, y: midY }, interior),
    ];
}
function buildLevelRooms(levelId) {
    const w = FOOTPRINT.width / 2;
    const d = FOOTPRINT.depth / 2;
    const rooms = levelId === LEVEL_1_ID
        ? [
            { id: VIDEO_DEMO_ROOM_IDS.living, name: "Гостиная", polygon: rect(0, 0, w, d) },
            { id: VIDEO_DEMO_ROOM_IDS.bedroom, name: "Спальня", polygon: rect(w, 0, w, d) },
            { id: VIDEO_DEMO_ROOM_IDS.kitchen, name: "Кухня", polygon: rect(0, d, w, d) },
            { id: VIDEO_DEMO_ROOM_IDS.utility, name: "Тепловой пункт", polygon: rect(w, d, w, d) },
        ]
        : [
            { id: VIDEO_DEMO_ROOM_IDS.study, name: "Кабинет", polygon: rect(0, 0, w, d) },
            { id: VIDEO_DEMO_ROOM_IDS.nursery, name: "Детская", polygon: rect(w, 0, w, d) },
            { id: VIDEO_DEMO_ROOM_IDS.hall, name: "Холл", polygon: rect(0, d, w, d) },
            { id: VIDEO_DEMO_ROOM_IDS.bathroom, name: "Санузел", polygon: rect(w, d, w, d) },
        ];
    return rooms.map((room) => ({ ...room, levelId }));
}
function rect(x, y, width, height) {
    return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
    ];
}
function roomAreaM2(room) {
    return Math.abs(polygonArea(room.polygon));
}
function wallAreaM2(wall) {
    return Math.max(0, segmentLength(wall.a, wall.b) * Math.max(0, wall.height_m));
}
function slabAreaM2(slab) {
    return Math.abs(polygonArea(slab.boundary));
}
function roofAreaM2(roof) {
    const projectedArea = Math.abs(polygonArea(roof.boundary));
    const risePerMeter = roof.slope?.risePerMeter ?? 0;
    return projectedArea * Math.sqrt(1 + risePerMeter * risePerMeter);
}
function openingAreaM2(opening) {
    return Math.max(0, opening.width_m) * Math.max(0, opening.height_m);
}
function buildRoomOverrides() {
    return {
        [VIDEO_DEMO_ROOM_IDS.living]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "ground",
            roofContactType: "interfloor",
            purpose: "Гостиная",
        },
        [VIDEO_DEMO_ROOM_IDS.bedroom]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "ground",
            roofContactType: "interfloor",
            purpose: "Спальня",
        },
        [VIDEO_DEMO_ROOM_IDS.kitchen]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "ground",
            roofContactType: "interfloor",
            purpose: "Кухня",
        },
        [VIDEO_DEMO_ROOM_IDS.utility]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "ground",
            roofContactType: "interfloor",
            purpose: "Тепловой пункт",
        },
        [VIDEO_DEMO_ROOM_IDS.study]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "interfloor",
            roofContactType: "outdoor",
            purpose: "Кабинет",
        },
        [VIDEO_DEMO_ROOM_IDS.nursery]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "interfloor",
            roofContactType: "outdoor",
            purpose: "Детская",
        },
        [VIDEO_DEMO_ROOM_IDS.hall]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "interfloor",
            roofContactType: "outdoor",
            purpose: "Холл",
        },
        [VIDEO_DEMO_ROOM_IDS.bathroom]: {
            heightM: LEVEL_HEIGHT_M,
            heated: true,
            floorContactType: "interfloor",
            roofContactType: "outdoor",
            purpose: "Санузел",
        },
    };
}
export function buildVideoDemoScenarioConfig() {
    return {
        climate: {
            baseC: -10,
            amplitudeC: 4,
            seasonalOffsetC: 0,
            manual: {
                outdoorDesignTemperatureC: null,
                outdoorHeatingAverageC: null,
                heatingDurationDays: null,
            },
        },
        setpoints: {
            day: 21,
            night: 18,
            dayStartHour: 6,
            nightStartHour: 22,
        },
        internalGains: {
            dayGain_W_m2: 5.5,
            nightGain_W_m2: 1,
        },
        occupancy: {
            dayFraction: 1,
            nightFraction: 0.2,
        },
        ventilation: {
            infiltrationACH: 0.2,
            ventilationACH: 0.35,
            heatRecoveryFactor: 0.7,
            mechanicalVentilationEnabled: true,
        },
        climateCityId: "moscow",
        geometry: {
            roomOverrides: buildRoomOverrides(),
        },
        materials: {
            homogeneityCoefficient: null,
            windowUValue_W_m2K: TYPICAL_PVC_WINDOW_U_W_M2K,
            doorUValue_W_m2K: TYPICAL_INSULATED_DOOR_U_W_M2K,
            windowGValue: TYPICAL_PVC_WINDOW_G_VALUE,
            shadingFactor: 0.9,
        },
        operation: {
            duration: "24h",
            timestepMinutes: 10,
        },
        comfort: {
            relativeHumidityPercent: 50,
            comfortMinC: 20,
            comfortMaxC: 26,
            comfortCategory: "II",
            measuredMrtC: null,
            measuredSurfaceTemperatureC: null,
        },
        engineeringSystems: {
            heatingEnabled: true,
            heatingMode: "ideal",
            supplyTemperatureC: 70,
            returnTemperatureC: 50,
            massFlowKgS: 0.18,
            fluidType: "water",
            installedCapacityW: 28000,
            emitterType: "радиаторы + фанкойл",
            pipeDiameterMm: 32,
            pipeLengthM: null,
            pipeInsulated: true,
            pipeFluidTemperatureC: 62,
        },
        ecology: {
            energySource: "централизованное теплоснабжение",
            emissionFactorKgPerKWh: 0.23,
        },
        economy: {
            tariffRubPerKWh: 3.4,
            capexRub: 950000,
            analysisPeriodYears: 15,
            discountRatePercent: 10,
            annualTariffGrowthPercent: 5,
            annualMaintenanceCostRub: 25000,
            insulationCostRub: null,
            windowsCostRub: null,
            equipmentCostRub: null,
        },
        validation: {
            roomId: null,
            measuredSeries: [],
            measuredEnergyKWh: null,
            periodLabel: "нет данных",
            availabilityStatus: "unavailable",
            dataOrigin: "synthetic",
            note: "В демонстрационной модели есть только synthetic/demo sensors; реальных измерений для калибровки нет.",
        },
    };
}
function buildVideoDemoThermalOptions(scenarioConfig = buildVideoDemoScenarioConfig()) {
    const resolved = resolveScenarioConfig(scenarioConfig);
    return {
        duration: resolved.operation?.duration ?? "24h",
        timestepMinutes: resolved.operation?.timestepMinutes ?? 10,
        heatingMode: resolved.engineeringSystems?.heatingMode ?? "ideal",
        heatingCapacityW: resolved.engineeringSystems?.installedCapacityW ?? null,
        outdoor: {
            baseC: resolved.climate.baseC,
            amplitudeC: resolved.climate.amplitudeC,
            seasonalOffsetC: resolved.climate.seasonalOffsetC,
            phaseShiftHours: -4,
        },
        setpoints: {
            day: resolved.setpoints.day,
            night: resolved.setpoints.night,
            dayStartHour: resolved.setpoints.dayStartHour,
            nightStartHour: resolved.setpoints.nightStartHour,
            // Плавный разгон за 60 мин — убирает пик мощности при утреннем прогреве
            setpointRampMinutes: 60,
        },
        internalGains: {
            dayGain_W_m2: resolved.internalGains.dayGain_W_m2,
            nightGain_W_m2: resolved.internalGains.nightGain_W_m2,
        },
        occupancy: {
            dayFraction: resolved.occupancy.dayFraction,
            nightFraction: resolved.occupancy.nightFraction,
            dayStartHour: resolved.setpoints.dayStartHour,
            nightStartHour: resolved.setpoints.nightStartHour,
        },
        infiltrationACH: resolved.ventilation.infiltrationACH,
        ventilationACH: resolved.ventilation.mechanicalVentilationEnabled ? resolved.ventilation.ventilationACH : 0,
        heatRecoveryFactor: resolved.ventilation.heatRecoveryFactor,
        initialTemperatureC: resolved.setpoints.night,
    };
}
function buildOpenings(levelId, prefix, walls) {
    const wallMap = buildWallMap(walls);
    const doors = levelId === LEVEL_1_ID
        ? [
            {
                id: `${prefix}-door-entry`,
                anchor: buildWallAnchor(wallMap.get(`${prefix}-south-west`), 2.4),
                width_m: 1.0,
                height_m: 2.1,
                sill_m: 0,
            },
            {
                id: `${prefix}-door-living-bedroom`,
                anchor: buildWallAnchor(wallMap.get(`${prefix}-center-vert-lower`), 1.6),
                width_m: 0.9,
                height_m: 2.05,
                sill_m: 0,
            },
            {
                id: `${prefix}-door-kitchen-utility`,
                anchor: buildWallAnchor(wallMap.get(`${prefix}-center-horiz-right`), 1.5),
                width_m: 0.85,
                height_m: 2.0,
                sill_m: 0,
            },
        ]
        : [
            {
                id: `${prefix}-door-stair`,
                anchor: buildWallAnchor(wallMap.get(`${prefix}-center-horiz-left`), 2.2),
                width_m: 0.9,
                height_m: 2.05,
                sill_m: 0,
            },
        ];
    const windows = levelId === LEVEL_1_ID
        ? [
            { id: `${prefix}-win-living`, anchor: buildWallAnchor(wallMap.get(`${prefix}-south-west`), 4.8), width_m: 1.8, height_m: 1.5, sill_m: 0.9 },
            { id: `${prefix}-win-bedroom`, anchor: buildWallAnchor(wallMap.get(`${prefix}-east-south`), 1.4), width_m: 1.5, height_m: 1.5, sill_m: 0.9 },
            { id: `${prefix}-win-kitchen`, anchor: buildWallAnchor(wallMap.get(`${prefix}-north-west`), 2.2), width_m: 1.4, height_m: 1.4, sill_m: 0.95 },
            { id: `${prefix}-win-utility`, anchor: buildWallAnchor(wallMap.get(`${prefix}-east-north`), 2.2), width_m: 0.9, height_m: 1.2, sill_m: 1.2 },
        ]
        : [
            { id: `${prefix}-win-study`, anchor: buildWallAnchor(wallMap.get(`${prefix}-south-west`), 4.6), width_m: 1.6, height_m: 1.5, sill_m: 0.9 },
            { id: `${prefix}-win-nursery`, anchor: buildWallAnchor(wallMap.get(`${prefix}-east-south`), 1.3), width_m: 1.5, height_m: 1.5, sill_m: 0.9 },
            { id: `${prefix}-win-hall`, anchor: buildWallAnchor(wallMap.get(`${prefix}-west-north`), 1.8), width_m: 1.2, height_m: 1.4, sill_m: 0.95 },
            { id: `${prefix}-win-bathroom`, anchor: buildWallAnchor(wallMap.get(`${prefix}-north-east`), 3.2), width_m: 0.8, height_m: 1.1, sill_m: 1.25 },
        ];
    return {
        doors: doors.map((door) => applyEnvelopePresetToDoor(door, DEMO_DOOR_PRESET_ID)),
        windows: windows.map((window) => applyEnvelopePresetToWindow(window, DEMO_WINDOW_PRESET_ID)),
    };
}
function buildPipeDefaults(id, levelId, path, type, fluidTemperatureC, connectedEquipmentIds) {
    const isSupply = type === "heating_supply";
    return {
        id,
        levelId,
        path,
        type,
        heatingSystemId: HEATING_SYSTEM_ID,
        systemType: "heating",
        heatingSystemKind: "two_pipe",
        flowRole: isSupply ? "supply" : "return",
        circuitRole: isSupply ? "supply" : "return",
        segmentClass: path.length > 4 ? "main" : "branch",
        flowDirection: "forward",
        markingColor: isSupply ? "gost_supply" : "gost_return",
        heatCarrier: "water",
        diameter_mm: isSupply ? 32 : 28,
        innerDiameter_mm: isSupply ? 28 : 24,
        material: "steel",
        insulationThickness_mm: 20,
        insulationConductivity_W_mK: 0.04,
        roughness_mm: 0.1,
        fluidTemperatureC,
        designIndoorTemperatureC: 21,
        designOutdoorTemperatureC: -26,
        temperatureDropC: 18,
        flowRate_kg_s: 0.18,
        designVelocity_m_s: isSupply ? 0.62 : 0.54,
        pressurePa: isSupply ? 12000 : 9000,
        pressureDropPa: isSupply ? 420 : 360,
        heatLossW: isSupply ? 84 : 68,
        connectedEquipmentIds,
    };
}
function buildHeatingNetworks() {
    const l1SupplyEquipment = [
        "video-heat-exchanger",
        "video-pump",
        "video-elevator",
        "video-dirt-separator",
        "video-expansion-tank",
        "video-boiler",
        "video-radiator-living",
        "video-radiator-bedroom",
        "video-radiator-kitchen",
    ];
    const l2SupplyEquipment = ["video-radiator-study", "video-radiator-nursery", "video-fancoil-hall"];
    const l1ReturnEquipment = [...l1SupplyEquipment];
    const l2ReturnEquipment = [...l2SupplyEquipment, "video-fancoil-hall"];
    return [
        buildPipeDefaults("video-pipe-supply-l1", LEVEL_1_ID, [
            { x: 12.2, y: 8.2 },
            { x: 11.2, y: 8.2 },
            { x: 11.2, y: 6.4 },
            { x: 9.8, y: 6.4 },
            { x: 3.4, y: 6.4 },
            { x: 3.4, y: 2.4 },
            { x: 9.6, y: 2.4 },
            { x: 12.8, y: 2.4 },
            { x: 12.8, y: 5.0 },
        ], "heating_supply", 72, l1SupplyEquipment),
        buildPipeDefaults("video-pipe-return-l1", LEVEL_1_ID, [
            { x: 12.4, y: 7.4 },
            { x: 10.6, y: 7.4 },
            { x: 10.6, y: 5.6 },
            { x: 8.8, y: 5.6 },
            { x: 2.8, y: 5.6 },
            { x: 2.8, y: 1.8 },
            { x: 9.2, y: 1.8 },
            { x: 12.0, y: 1.8 },
            { x: 12.0, y: 7.4 },
        ], "heating_return", 52, l1ReturnEquipment),
        buildPipeDefaults("video-pipe-supply-l2", LEVEL_2_ID, [
            { x: 12.8, y: 5.0 },
            { x: 12.8, y: 7.6 },
            { x: 9.8, y: 7.6 },
            { x: 3.6, y: 7.6 },
            { x: 3.6, y: 2.2 },
            { x: 10.2, y: 2.2 },
        ], "heating_supply", 68, l2SupplyEquipment),
        buildPipeDefaults("video-pipe-return-l2", LEVEL_2_ID, [
            { x: 12.6, y: 6.8 },
            { x: 10.4, y: 6.8 },
            { x: 10.4, y: 4.8 },
            { x: 4.2, y: 4.8 },
            { x: 4.2, y: 1.6 },
            { x: 9.8, y: 1.6 },
            { x: 12.6, y: 6.8 },
        ], "heating_return", 50, l2ReturnEquipment),
        buildPipeDefaults("video-pipe-riser-supply", LEVEL_1_ID, [
            { x: 12.8, y: 5.0 },
            { x: 12.8, y: 5.0 },
        ], "heating_supply", 70, ["video-pump", "video-heat-exchanger"]),
        buildPipeDefaults("video-pipe-riser-return", LEVEL_2_ID, [
            { x: 12.6, y: 6.8 },
            { x: 12.6, y: 6.8 },
        ], "heating_return", 48, ["video-expansion-tank", "video-pump"]),
    ];
}
function buildVentilationNetworks() {
    const mainDuctPath = [
        { x: 11.4, y: 8.0 },
        { x: 11.4, y: 5.2 },
        { x: 7.0, y: 5.2 },
        { x: 3.2, y: 5.2 },
        { x: 3.2, y: 2.4 },
        { x: 9.8, y: 2.4 },
    ];
    const branchDuctPath = [
        { x: 7.0, y: 5.2 },
        { x: 7.0, y: 7.4 },
        { x: 10.6, y: 7.4 },
    ];
    const connected = ["video-ahu", "video-diffuser-living", "video-diffuser-study", "video-diffuser-nursery", "video-fancoil-hall"];
    return [
        {
            id: "video-duct-main",
            levelId: LEVEL_1_ID,
            path: mainDuctPath,
            section: { shape: "rectangular", width_mm: 320, height_mm: 200 },
            airflow_m3_s: 0.42,
            airVelocity_m_s: 3.8,
            connectedEquipmentIds: connected,
        },
        {
            id: "video-duct-branch-l2",
            levelId: LEVEL_2_ID,
            path: branchDuctPath,
            section: { shape: "rectangular", width_mm: 220, height_mm: 160 },
            airflow_m3_s: 0.24,
            airVelocity_m_s: 3.2,
            connectedEquipmentIds: ["video-diffuser-study", "video-diffuser-nursery", "video-fancoil-hall"],
        },
    ];
}
function buildEquipment() {
    const pipeIdsL1 = ["video-pipe-supply-l1", "video-pipe-return-l1", "video-pipe-riser-supply"];
    const pipeIdsL2 = ["video-pipe-supply-l2", "video-pipe-return-l2", "video-pipe-riser-return"];
    const ductIds = ["video-duct-main", "video-duct-branch-l2"];
    return [
        {
            id: "video-heat-exchanger",
            type: "heat_exchanger",
            position: { x: 12.2, y: 8.2 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: {
                nominalPowerW: 185000,
                designFlow_kg_s: 0.18,
                supplyTemperatureC: 85,
                returnTemperatureC: 58,
                pressureDropPa: 32000,
                efficiency: 0.97,
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: pipeIdsL1,
        },
        {
            id: "video-pump",
            type: "pump",
            position: { x: 11.2, y: 8.2 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: { headPa: 28000, designFlow_kg_s: 0.18, efficiency: 0.74, assignedSystemId: HEATING_SYSTEM_ID },
            connectedNetworkIds: pipeIdsL1,
        },
        {
            id: "video-elevator",
            type: "elevator",
            position: { x: 11.6, y: 7.2 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: {
                designFlow_kg_s: 0.18,
                pressureDropPa: 14000,
                supplyTemperatureC: 85,
                returnTemperatureC: 65,
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: pipeIdsL1,
        },
        {
            id: "video-dirt-separator",
            type: "dirt_separator",
            position: { x: 12.6, y: 7.0 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: { designFlow_kg_s: 0.18, pressureDropPa: 7000, assignedSystemId: HEATING_SYSTEM_ID },
            connectedNetworkIds: pipeIdsL1,
        },
        {
            id: "video-expansion-tank",
            type: "expansion_tank",
            position: { x: 10.4, y: 7.6 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: { pressureDropPa: 1800, assignedSystemId: HEATING_SYSTEM_ID },
            connectedNetworkIds: ["video-pipe-return-l1", "video-pipe-riser-return"],
        },
        {
            id: "video-boiler",
            type: "boiler",
            position: { x: 9.6, y: 8.4 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "off",
            params: {
                nominalPowerW: 28000,
                efficiency: 0.91,
                supplyTemperatureC: 75,
                returnTemperatureC: 52,
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: pipeIdsL1,
        },
        {
            id: "video-radiator-living",
            type: "radiator",
            position: { x: 3.4, y: 0.9 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.living,
            state: "on",
            params: {
                nominalPowerW: 1800,
                designFlow_kg_s: 0.045,
                supplyTemperatureC: 72,
                returnTemperatureC: 52,
                connectionType: "side",
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: ["video-pipe-supply-l1", "video-pipe-return-l1"],
        },
        {
            id: "video-radiator-bedroom",
            type: "radiator",
            position: { x: 10.8, y: 0.9 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.bedroom,
            state: "on",
            params: {
                nominalPowerW: 1500,
                designFlow_kg_s: 0.038,
                supplyTemperatureC: 72,
                returnTemperatureC: 52,
                connectionType: "side",
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: ["video-pipe-supply-l1", "video-pipe-return-l1"],
        },
        {
            id: "video-radiator-kitchen",
            type: "radiator",
            position: { x: 2.6, y: 7.1 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.kitchen,
            state: "on",
            params: {
                nominalPowerW: 1200,
                designFlow_kg_s: 0.032,
                supplyTemperatureC: 70,
                returnTemperatureC: 52,
                connectionType: "side",
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: ["video-pipe-supply-l1", "video-pipe-return-l1"],
        },
        {
            id: "video-radiator-study",
            type: "radiator",
            position: { x: 3.6, y: 0.9 },
            levelId: LEVEL_2_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.study,
            state: "on",
            params: {
                nominalPowerW: 1400,
                designFlow_kg_s: 0.036,
                supplyTemperatureC: 68,
                returnTemperatureC: 50,
                connectionType: "side",
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: pipeIdsL2,
        },
        {
            id: "video-radiator-nursery",
            type: "radiator",
            position: { x: 10.6, y: 0.9 },
            levelId: LEVEL_2_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.nursery,
            state: "on",
            params: {
                nominalPowerW: 1450,
                designFlow_kg_s: 0.037,
                supplyTemperatureC: 68,
                returnTemperatureC: 50,
                connectionType: "side",
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: pipeIdsL2,
        },
        {
            id: "video-fancoil-hall",
            type: "fancoil",
            position: { x: 3.8, y: 7.2 },
            levelId: LEVEL_2_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.hall,
            state: "on",
            params: {
                nominalPowerW: 2100,
                designAirflow_m3_s: 0.18,
                designFlow_kg_s: 0.04,
                connectionType: "bottom",
                assignedSystemId: HEATING_SYSTEM_ID,
            },
            connectedNetworkIds: [...pipeIdsL2, ...ductIds],
        },
        {
            id: "video-ahu",
            type: "ahu",
            position: { x: 11.4, y: 8.0 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: { designAirflow_m3_s: 0.42, efficiency: 0.7, supplyTemperatureC: 20 },
            connectedNetworkIds: ductIds,
        },
        {
            id: "video-diffuser-living",
            type: "diffuser",
            position: { x: 3.2, y: 2.4 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.living,
            state: "on",
            params: { designAirflow_m3_s: 0.1 },
            connectedNetworkIds: ["video-duct-main"],
        },
        {
            id: "video-diffuser-study",
            type: "diffuser",
            position: { x: 3.4, y: 2.2 },
            levelId: LEVEL_2_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.study,
            state: "on",
            params: { designAirflow_m3_s: 0.08 },
            connectedNetworkIds: ductIds,
        },
        {
            id: "video-diffuser-nursery",
            type: "diffuser",
            position: { x: 10.4, y: 2.2 },
            levelId: LEVEL_2_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.nursery,
            state: "on",
            params: { designAirflow_m3_s: 0.08 },
            connectedNetworkIds: ductIds,
        },
    ];
}
function buildSensors() {
    return [
        {
            id: "video-sensor-living-temp",
            type: "temperature",
            position: { x: 4.2, y: 2.6 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.living,
            value: VIDEO_DEMO_ROOM_TEMPERATURES[VIDEO_DEMO_ROOM_IDS.living],
            unit: "°C",
            status: "normal",
            history: [
                { timestamp: 0, value: 21.4 },
                { timestamp: 1, value: 21.5 },
                { timestamp: 2, value: 21.6 },
            ],
        },
        {
            id: "video-sensor-kitchen-humidity",
            type: "humidity",
            position: { x: 2.4, y: 7.8 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.kitchen,
            value: 48,
            unit: "%",
            status: "normal",
            history: [{ timestamp: 0, value: 47 }, { timestamp: 1, value: 48 }],
        },
        {
            id: "video-sensor-study-co2",
            type: "co2",
            position: { x: 4.6, y: 2.1 },
            levelId: LEVEL_2_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.study,
            value: 780,
            unit: "ppm",
            status: "normal",
            history: [{ timestamp: 0, value: 760 }, { timestamp: 1, value: 780 }],
        },
        {
            id: "video-sensor-tp-pressure",
            type: "pressure",
            position: { x: 11.8, y: 7.6 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            value: 118000,
            unit: "Па",
            status: "normal",
            history: [{ timestamp: 0, value: 116000 }, { timestamp: 1, value: 118000 }],
        },
        {
            id: "video-sensor-supply-flow",
            type: "flow",
            position: { x: 12.0, y: 8.0 },
            levelId: LEVEL_1_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            value: 0.18,
            unit: "кг/с",
            status: "normal",
            history: [{ timestamp: 0, value: 0.17 }, { timestamp: 1, value: 0.18 }],
        },
        {
            id: "video-sensor-bathroom-temp",
            type: "temperature",
            position: { x: 11.6, y: 8.4 },
            levelId: LEVEL_2_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.bathroom,
            value: VIDEO_DEMO_ROOM_TEMPERATURES[VIDEO_DEMO_ROOM_IDS.bathroom],
            unit: "°C",
            status: "warning",
            history: [
                { timestamp: 0, value: 23.6 },
                { timestamp: 1, value: 24.0 },
            ],
        },
    ];
}
export function buildVideoDemoThermalProtection(model) {
    const climate = getSp131CityClimate("moscow");
    const heatedAreaM2 = model.rooms.reduce((sum, room) => sum + roomAreaM2(room), 0);
    const heatedVolumeM3 = heatedAreaM2 * LEVEL_HEIGHT_M;
    const utilityAreaM2 = roomAreaM2(model.rooms.find((room) => room.id === VIDEO_DEMO_ROOM_IDS.utility) ?? model.rooms[0]);
    const wallMap = new Map(model.walls.map((wall) => [wall.id, wall]));
    const exteriorWallAreaM2 = model.walls
        .filter((wall) => wall.wallAssemblyId === "video-exterior-wall")
        .reduce((sum, wall) => sum + wallAreaM2(wall), 0);
    const windowAreaM2 = model.windows.reduce((sum, window) => sum + openingAreaM2(window), 0);
    const exteriorDoorAreaM2 = model.doors.reduce((sum, door) => {
        const hostingWall = door.anchor.wallId ? wallMap.get(door.anchor.wallId) ?? null : null;
        return hostingWall?.wallAssemblyId === "video-exterior-wall" ? sum + openingAreaM2(door) : sum;
    }, 0);
    const roofArea = (model.roofs ?? []).reduce((sum, roof) => sum + roofAreaM2(roof), 0);
    const groundFloorArea = (model.floorSlabs ?? [])
        .filter((slab) => slab.kind === "ground")
        .reduce((sum, slab) => sum + slabAreaM2(slab), 0);
    const operationCondition = "B";
    const exteriorWallFragment = {
        id: "video-ext-walls",
        label: "Наружные стены",
        constructionType: "wall",
        areaM2: Number(exteriorWallAreaM2.toFixed(2)),
        conditionedAreaM2: Number(heatedAreaM2.toFixed(2)),
        conditionedVolumeM3: Number(heatedVolumeM3.toFixed(2)),
        layers: EXTERIOR_WALL_LAYERS,
        riskZones: ["углы фасада", "примыкания окон", "узел входной двери"],
    };
    if (!envelopeFragmentHasThermalBridgeData(exteriorWallFragment)) {
        exteriorWallFragment.heterogeneity = deriveVideoDemoExteriorWallThermalBridges(model, {
            layers: EXTERIOR_WALL_LAYERS,
            operationCondition,
            storeys: 2,
            levelHeightM: LEVEL_HEIGHT_M,
            grossWallAreaM2: exteriorWallAreaM2,
        });
    }
    const envelope = [
        exteriorWallFragment,
        {
            id: "video-windows",
            label: "Окна",
            constructionType: "window",
            areaM2: Number(windowAreaM2.toFixed(2)),
            layers: WINDOW_LAYERS,
            riskZones: ["откосы", "подоконные зоны"],
            metadata: {
                presetId: DEMO_WINDOW_PRESET_ID,
                presetLabel: "Окно ПВХ, 2-камерный СП",
                sourceType: "preset",
                sourceNote: windowEnvelopeSourceNote(),
                runtimeU_W_m2K: TYPICAL_PVC_WINDOW_U_W_M2K,
            },
        },
        {
            id: "video-door-entry",
            label: "Наружная дверь",
            constructionType: "door",
            areaM2: Number(exteriorDoorAreaM2.toFixed(2)),
            layers: DOOR_LAYERS,
            riskZones: ["порог", "коробка"],
            metadata: {
                presetId: DEMO_DOOR_PRESET_ID,
                presetLabel: "Входная утеплённая",
                sourceType: "preset",
                sourceNote: "Утеплённая входная дверь; U≈1,2 Вт/(м²·К) по типовому паспорту.",
                runtimeU_W_m2K: TYPICAL_INSULATED_DOOR_U_W_M2K,
            },
        },
        (() => {
            const roofFragment = {
                id: "video-roof",
                label: "Скатная кровля",
                constructionType: "covering",
                areaM2: Number(roofArea.toFixed(2)),
                layers: ROOF_LAYERS,
                riskZones: ["конёк", "примыкание к стенам"],
            };
            if (!envelopeFragmentHasThermalBridgeData(roofFragment)) {
                roofFragment.heterogeneity = deriveVideoDemoRoofThermalBridges({
                    roofLayers: ROOF_LAYERS,
                    wallLayers: EXTERIOR_WALL_LAYERS,
                    operationCondition,
                    footprintWidthM: FOOTPRINT.width,
                    footprintDepthM: FOOTPRINT.depth,
                    risePerMeter: model.roofs?.[0]?.slope?.risePerMeter ?? 0.16,
                });
            }
            return roofFragment;
        })(),
        (() => {
            const floorFragment = {
                id: "video-floor-ground",
                label: "Пол по грунту",
                constructionType: "floorOnGround",
                areaM2: Number(groundFloorArea.toFixed(2)),
                layers: FLOOR_GROUND_LAYERS,
                riskZones: ["контур наружных стен"],
            };
            if (!envelopeFragmentHasThermalBridgeData(floorFragment)) {
                floorFragment.heterogeneity = deriveVideoDemoFloorOnGroundThermalBridges({
                    floorLayers: FLOOR_GROUND_LAYERS,
                    wallLayers: EXTERIOR_WALL_LAYERS,
                    operationCondition,
                    footprintWidthM: FOOTPRINT.width,
                    footprintDepthM: FOOTPRINT.depth,
                });
            }
            return floorFragment;
        })(),
    ];
    return {
        buildingCategory: "residential",
        storeys: 2,
        heatedAreaM2: Number(heatedAreaM2.toFixed(2)),
        heatedVolumeM3: Number(heatedVolumeM3.toFixed(2)),
        residentialAreaM2: Number((heatedAreaM2 - utilityAreaM2).toFixed(2)),
        occupiedAreaM2: Number(heatedAreaM2.toFixed(2)),
        operationCondition,
        moistureMode: "normal",
        climate: {
            city: climate?.label ?? "Москва",
            climateRegion: "IIБ",
            indoorTemperatureC: 20,
            indoorRelativeHumidityPercent: 50,
            outdoorHeatingPeriodAverageC: climate?.outdoorHeatingPeriodAverageC,
            heatingPeriodDurationDays: climate?.heatingPeriodDurationDays,
            outdoorDesignTemperatureC: climate?.outdoorDesignTemperatureC,
            humidityZone: "normal",
        },
        energyVentilation: {
            ventilationACH: 0.35,
            infiltrationACH: 0.2,
            heatRecoveryFactor: 0.7,
        },
        envelope,
    };
}
function buildVideoDemoModelInternal() {
    const model = createEmptyBuildingModel();
    const wallsL1 = buildLevelWalls(LEVEL_1_ID, "video-l1");
    const wallsL2 = buildLevelWalls(LEVEL_2_ID, "video-l2");
    const openingsL1 = buildOpenings(LEVEL_1_ID, "video-l1", wallsL1);
    const openingsL2 = buildOpenings(LEVEL_2_ID, "video-l2", wallsL2);
    const preparedModel = {
        ...model,
        levels: [
            { id: LEVEL_1_ID, name: "1 этаж", elevation_m: 0, height_m: LEVEL_HEIGHT_M },
            { id: LEVEL_2_ID, name: "2 этаж", elevation_m: LEVEL_HEIGHT_M, height_m: LEVEL_HEIGHT_M },
        ],
        rooms: [...buildLevelRooms(LEVEL_1_ID), ...buildLevelRooms(LEVEL_2_ID)],
        walls: [...wallsL1, ...wallsL2],
        roofs: [
            {
                id: "video-roof-main",
                levelId: LEVEL_2_ID,
                name: "Скатная кровля",
                kind: "pitched",
                boundary: [...FOOTPRINT_BOUNDARY],
                elevationBase_m: LEVEL_HEIGHT_M * 2,
                thickness_m: 0.28,
                slope: { directionDeg: 90, risePerMeter: 0.16 },
                layers: ROOF_LAYERS,
                heatedSide: "below",
                assemblyId: "video-roof",
            },
        ],
        floorSlabs: [
            {
                id: "video-slab-ground",
                levelId: LEVEL_1_ID,
                name: "Плита по грунту",
                kind: "ground",
                boundary: [...FOOTPRINT_BOUNDARY],
                elevation_m: 0,
                thickness_m: 0.26,
                layers: FLOOR_GROUND_LAYERS,
                heatedSide: "above",
                assemblyId: "video-floor-ground",
            },
            {
                id: "video-slab-interfloor",
                levelId: LEVEL_1_ID,
                name: "Межэтажное перекрытие",
                kind: "interfloor",
                boundary: [...FOOTPRINT_BOUNDARY],
                elevation_m: LEVEL_HEIGHT_M,
                thickness_m: 0.24,
                layers: FLOOR_INTER_LAYERS,
                heatedSide: "below",
                assemblyId: "video-floor-inter",
            },
        ],
        doors: [...openingsL1.doors, ...openingsL2.doors],
        windows: [...openingsL1.windows, ...openingsL2.windows],
        pipes: buildHeatingNetworks(),
        ducts: buildVentilationNetworks(),
        equipment: buildEquipment(),
        sensors: buildSensors(),
        scenarios: DEFAULT_OPERATIONAL_SCENARIOS,
        activeScenarioId: DEFAULT_OPERATIONAL_SCENARIOS[0]?.id ?? null,
        events: [
            {
                id: "video-event-tp-ready",
                type: "equipment_fault",
                severity: "info",
                title: "Тепловой пункт готов к показу",
                message: "Демонстрационный дом включает ТП по СП 41-101-95, двухтрубное отопление на 2 этажа, вентиляцию и телеметрию.",
                timestamp: Date.now(),
                relatedId: "video-heat-exchanger",
                relatedKind: "equipment",
                levelId: LEVEL_1_ID,
                acknowledged: false,
            },
        ],
        meta: {
            demoScenarioId: "video-demo-house",
            demoScenarioName: "Демонстрационный дом · 2 этажа",
            demoProjectAddress: "Россия, г. Москва, демонстрационный объект",
            climateSource: "src/norms/sp131_2025/climate.ts#moscow",
            materialSource: "src/norms/sp50_2024/materialThermalProperties.ts",
            validationStatus: "unavailable",
            validationSource: "synthetic-demo-sensors",
            showcaseFeatures: [
                "geometry",
                "pitched-roof",
                "heating-networks",
                "thermal-point",
                "ventilation",
                "sensors",
                "sp50",
                "3d",
            ],
        },
    };
    preparedModel.thermalProtection = buildVideoDemoThermalProtection(preparedModel);
    return applyDefaultOpeningEnvelopeToModel(preparedModel);
}
export function buildVideoDemoHouseModel() {
    return cloneDeep(buildVideoDemoModelInternal());
}
export const videoDemoHouse = buildVideoDemoHouseModel();
export function buildVideoDemoThermalResult(model = videoDemoHouse, scenarioConfig = buildVideoDemoScenarioConfig()) {
    return runThermalSimulation(model, buildVideoDemoThermalOptions(scenarioConfig));
}
