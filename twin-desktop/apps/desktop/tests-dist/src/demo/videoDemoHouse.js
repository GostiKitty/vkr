import { createEmptyBuildingModel } from "../entities/geometry/types";
const LEVEL_ID = "video-level-1";
const EXT_WALL_THICKNESS_M = 0.34;
const INT_WALL_THICKNESS_M = 0.16;
const DEFAULT_LEVEL_HEIGHT_M = 3;
export const VIDEO_DEMO_ROOM_IDS = {
    living: "video-room-living",
    bedroom: "video-room-bedroom",
    kitchen: "video-room-kitchen",
    utility: "video-room-utility",
};
export const VIDEO_DEMO_ROOM_TEMPERATURES = {
    [VIDEO_DEMO_ROOM_IDS.living]: 21.5,
    [VIDEO_DEMO_ROOM_IDS.bedroom]: 20.0,
    [VIDEO_DEMO_ROOM_IDS.kitchen]: 22.0,
    [VIDEO_DEMO_ROOM_IDS.utility]: 19.0,
};
const VIDEO_DEMO_ROOM_SETPOINTS = {
    [VIDEO_DEMO_ROOM_IDS.living]: 22.0,
    [VIDEO_DEMO_ROOM_IDS.bedroom]: 20.5,
    [VIDEO_DEMO_ROOM_IDS.kitchen]: 22.5,
    [VIDEO_DEMO_ROOM_IDS.utility]: 19.5,
};
const VIDEO_DEMO_ROOM_HEATING_W = {
    [VIDEO_DEMO_ROOM_IDS.living]: 1400,
    [VIDEO_DEMO_ROOM_IDS.bedroom]: 1080,
    [VIDEO_DEMO_ROOM_IDS.kitchen]: 930,
    [VIDEO_DEMO_ROOM_IDS.utility]: 620,
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
    { materialId: "mineral_wool", thickness_m: 0.22 },
    { materialId: "plywood", thickness_m: 0.018 },
];
const FLOOR_LAYERS = [
    { materialId: "reinforced_concrete", thickness_m: 0.18 },
    { materialId: "xps", thickness_m: 0.1 },
    { materialId: "cement_sand_plaster", thickness_m: 0.05 },
];
const WINDOW_LAYERS = [{ materialId: "window_block", thickness_m: 0.04 }];
const DOOR_LAYERS = [
    { materialId: "wood", thickness_m: 0.04 },
    { materialId: "eps", thickness_m: 0.05 },
    { materialId: "plywood", thickness_m: 0.01 },
];
const HOURS = Array.from({ length: 25 }, (_, index) => index);
function cloneDeep(value) {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}
function createWall(id, a, b, options) {
    return {
        id,
        levelId: LEVEL_ID,
        a,
        b,
        thickness_m: options.thickness_m,
        height_m: DEFAULT_LEVEL_HEIGHT_M,
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
function buildThermalProtection() {
    const envelope = [
        {
            id: "video-ext-walls",
            label: "Наружные стены",
            constructionType: "wall",
            areaM2: 105.6,
            conditionedAreaM2: 96,
            conditionedVolumeM3: 288,
            layers: EXTERIOR_WALL_LAYERS,
            riskZones: ["углы фасада", "примыкания окон", "примыкание входной двери"],
        },
        {
            id: "video-windows",
            label: "Окна",
            constructionType: "window",
            areaM2: 12.3,
            layers: WINDOW_LAYERS,
            riskZones: ["оконные откосы", "нижняя зона подоконника"],
        },
        {
            id: "video-door",
            label: "Наружная дверь",
            constructionType: "door",
            areaM2: 2.1,
            layers: DOOR_LAYERS,
            riskZones: ["примыкание коробки", "порог"],
        },
        {
            id: "video-roof",
            label: "Покрытие",
            constructionType: "covering",
            areaM2: 96,
            layers: ROOF_LAYERS,
            riskZones: ["узлы примыкания кровли"],
        },
        {
            id: "video-floor",
            label: "Пол по грунту",
            constructionType: "floorOnGround",
            areaM2: 96,
            layers: FLOOR_LAYERS,
            riskZones: ["контур у наружных стен"],
        },
    ];
    return {
        buildingCategory: "residential",
        storeys: 1,
        heatedAreaM2: 96,
        heatedVolumeM3: 288,
        residentialAreaM2: 79,
        occupiedAreaM2: 90,
        operationCondition: "B",
        moistureMode: "normal",
        climate: {
            city: "Москва",
            climateRegion: "IIБ",
            indoorTemperatureC: 20,
            indoorRelativeHumidityPercent: 50,
            outdoorHeatingPeriodAverageC: -3.1,
            heatingPeriodDurationDays: 214,
            outdoorDesignTemperatureC: -26,
            julyAverageTemperatureC: 19.7,
            summerOutdoorAmplitudeC: 9.8,
            summerWindSpeedM_s: 3.4,
            humidityZone: "normal",
            solarRadiationZone: "central",
            solarRadiationImax_W_m2: 670,
            solarRadiationIavg_W_m2: 305,
        },
        envelope,
    };
}
function buildVideoDemoModelInternal() {
    const model = createEmptyBuildingModel();
    const walls = [
        createWall("video-wall-south-left", { x: 0, y: 0 }, { x: 6.2, y: 0 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-south-right", { x: 6.2, y: 0 }, { x: 12, y: 0 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-east-lower", { x: 12, y: 0 }, { x: 12, y: 4.6 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-east-upper", { x: 12, y: 4.6 }, { x: 12, y: 8 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-north-right", { x: 12, y: 8 }, { x: 8.9, y: 8 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-north-left", { x: 8.9, y: 8 }, { x: 0, y: 8 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-west-upper", { x: 0, y: 8 }, { x: 0, y: 4.6 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-west-lower", { x: 0, y: 4.6 }, { x: 0, y: 0 }, { thickness_m: EXT_WALL_THICKNESS_M, layers: EXTERIOR_WALL_LAYERS }),
        createWall("video-wall-living-bedroom", { x: 6.2, y: 0 }, { x: 6.2, y: 4.6 }, { thickness_m: INT_WALL_THICKNESS_M, layers: INTERIOR_WALL_LAYERS }),
        createWall("video-wall-living-kitchen", { x: 0, y: 4.6 }, { x: 6.2, y: 4.6 }, { thickness_m: INT_WALL_THICKNESS_M, layers: INTERIOR_WALL_LAYERS }),
        createWall("video-wall-center", { x: 6.2, y: 4.6 }, { x: 8.9, y: 4.6 }, { thickness_m: INT_WALL_THICKNESS_M, layers: INTERIOR_WALL_LAYERS }),
        createWall("video-wall-bedroom-utility", { x: 8.9, y: 4.6 }, { x: 12, y: 4.6 }, { thickness_m: INT_WALL_THICKNESS_M, layers: INTERIOR_WALL_LAYERS }),
        createWall("video-wall-kitchen-utility", { x: 8.9, y: 4.6 }, { x: 8.9, y: 8 }, { thickness_m: INT_WALL_THICKNESS_M, layers: INTERIOR_WALL_LAYERS }),
    ];
    const wallMap = buildWallMap(walls);
    const doors = [
        {
            id: "video-door-entry",
            anchor: buildWallAnchor(wallMap.get("video-wall-south-left"), 2.6),
            width_m: 1.0,
            height_m: 2.1,
            sill_m: 0,
        },
        {
            id: "video-door-living-bedroom",
            anchor: buildWallAnchor(wallMap.get("video-wall-living-bedroom"), 1.8),
            width_m: 0.9,
            height_m: 2.05,
            sill_m: 0,
        },
        {
            id: "video-door-living-kitchen",
            anchor: buildWallAnchor(wallMap.get("video-wall-living-kitchen"), 2.4),
            width_m: 0.9,
            height_m: 2.05,
            sill_m: 0,
        },
        {
            id: "video-door-kitchen-utility",
            anchor: buildWallAnchor(wallMap.get("video-wall-kitchen-utility"), 1.45),
            width_m: 0.8,
            height_m: 2.0,
            sill_m: 0,
        },
    ];
    const windows = [
        {
            id: "video-window-living-south",
            anchor: buildWallAnchor(wallMap.get("video-wall-south-left"), 4.4),
            width_m: 1.6,
            height_m: 1.5,
            sill_m: 0.9,
        },
        {
            id: "video-window-living-west",
            anchor: buildWallAnchor(wallMap.get("video-wall-west-lower"), 1.7),
            width_m: 1.5,
            height_m: 1.5,
            sill_m: 0.9,
        },
        {
            id: "video-window-bedroom-south",
            anchor: buildWallAnchor(wallMap.get("video-wall-south-right"), 2.1),
            width_m: 1.4,
            height_m: 1.5,
            sill_m: 0.9,
        },
        {
            id: "video-window-bedroom-east",
            anchor: buildWallAnchor(wallMap.get("video-wall-east-lower"), 1.2),
            width_m: 1.5,
            height_m: 1.5,
            sill_m: 0.9,
        },
        {
            id: "video-window-kitchen-north",
            anchor: buildWallAnchor(wallMap.get("video-wall-north-left"), 2.2),
            width_m: 1.5,
            height_m: 1.5,
            sill_m: 0.95,
        },
        {
            id: "video-window-utility-east",
            anchor: buildWallAnchor(wallMap.get("video-wall-east-upper"), 1.3),
            width_m: 0.9,
            height_m: 1.2,
            sill_m: 1.2,
        },
    ];
    const pipes = [
        {
            id: "video-pipe-supply",
            levelId: LEVEL_ID,
            path: [
                { x: 10.7, y: 6.5 },
                { x: 10.0, y: 6.5 },
                { x: 10.0, y: 5.0 },
                { x: 8.9, y: 5.0 },
                { x: 8.9, y: 7.25 },
                { x: 3.0, y: 7.25 },
                { x: 3.0, y: 4.95 },
                { x: 6.2, y: 4.95 },
                { x: 6.2, y: 1.05 },
                { x: 10.7, y: 1.05 },
            ],
            type: "heating_supply",
            heatingSystemId: "video-heating",
            systemType: "heating",
            heatingSystemKind: "two_pipe",
            flowRole: "supply",
            circuitRole: "supply",
            segmentClass: "main",
            flowDirection: "forward",
            markingColor: "gost_supply",
            heatCarrier: "water",
            diameter_mm: 25,
            innerDiameter_mm: 21,
            material: "steel",
            insulationThickness_mm: 20,
            insulationConductivity_W_mK: 0.04,
            roughness_mm: 0.1,
            fluidTemperatureC: 68,
            designIndoorTemperatureC: 21,
            designOutdoorTemperatureC: -26,
            temperatureDropC: 18,
            flowRate_kg_s: 0.12,
            designVelocity_m_s: 0.6,
            pressurePa: 11000,
            pressureDropPa: 380,
            heatLossW: 72,
            connectedEquipmentIds: [
                "video-boiler",
                "video-pump",
                "video-radiator-living",
                "video-radiator-bedroom",
                "video-radiator-kitchen",
            ],
        },
        {
            id: "video-pipe-return",
            levelId: LEVEL_ID,
            path: [
                { x: 10.7, y: 0.75 },
                { x: 6.2, y: 0.75 },
                { x: 6.2, y: 4.25 },
                { x: 3.35, y: 4.25 },
                { x: 3.35, y: 7.0 },
                { x: 8.55, y: 7.0 },
                { x: 8.55, y: 4.8 },
                { x: 9.7, y: 4.8 },
                { x: 9.7, y: 6.5 },
                { x: 10.7, y: 6.5 },
            ],
            type: "heating_return",
            heatingSystemId: "video-heating",
            systemType: "heating",
            heatingSystemKind: "two_pipe",
            flowRole: "return",
            circuitRole: "return",
            segmentClass: "main",
            flowDirection: "forward",
            markingColor: "gost_return",
            heatCarrier: "water",
            diameter_mm: 25,
            innerDiameter_mm: 21,
            material: "steel",
            insulationThickness_mm: 20,
            insulationConductivity_W_mK: 0.04,
            roughness_mm: 0.1,
            fluidTemperatureC: 50,
            designIndoorTemperatureC: 21,
            designOutdoorTemperatureC: -26,
            temperatureDropC: 18,
            flowRate_kg_s: 0.12,
            designVelocity_m_s: 0.52,
            pressurePa: 9000,
            pressureDropPa: 340,
            heatLossW: 61,
            connectedEquipmentIds: [
                "video-boiler",
                "video-pump",
                "video-radiator-living",
                "video-radiator-bedroom",
                "video-radiator-kitchen",
            ],
        },
    ];
    const equipment = [
        {
            id: "video-boiler",
            type: "boiler",
            position: { x: 10.7, y: 6.5 },
            levelId: LEVEL_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: {
                nominalPowerW: 18000,
                efficiency: 0.93,
                supplyTemperatureC: 68,
                returnTemperatureC: 50,
                designFlow_kg_s: 0.12,
                assignedSystemId: "video-heating",
            },
            connectedNetworkIds: ["video-pipe-supply", "video-pipe-return"],
        },
        {
            id: "video-pump",
            type: "pump",
            position: { x: 10.0, y: 6.5 },
            levelId: LEVEL_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.utility,
            state: "on",
            params: {
                headPa: 22000,
                designFlow_kg_s: 0.12,
                efficiency: 0.72,
                assignedSystemId: "video-heating",
            },
            connectedNetworkIds: ["video-pipe-supply", "video-pipe-return"],
        },
        {
            id: "video-radiator-living",
            type: "radiator",
            position: { x: 4.55, y: 0.82 },
            levelId: LEVEL_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.living,
            state: "on",
            params: {
                nominalPowerW: 1800,
                designFlow_kg_s: 0.04,
                supplyTemperatureC: 68,
                returnTemperatureC: 50,
                connectionType: "side",
                assignedSystemId: "video-heating",
            },
            connectedNetworkIds: ["video-pipe-supply", "video-pipe-return"],
        },
        {
            id: "video-radiator-bedroom",
            type: "radiator",
            position: { x: 8.4, y: 0.82 },
            levelId: LEVEL_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.bedroom,
            state: "on",
            params: {
                nominalPowerW: 1500,
                designFlow_kg_s: 0.035,
                supplyTemperatureC: 68,
                returnTemperatureC: 50,
                connectionType: "side",
                assignedSystemId: "video-heating",
            },
            connectedNetworkIds: ["video-pipe-supply", "video-pipe-return"],
        },
        {
            id: "video-radiator-kitchen",
            type: "radiator",
            position: { x: 2.5, y: 7.18 },
            levelId: LEVEL_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.kitchen,
            state: "on",
            params: {
                nominalPowerW: 1200,
                designFlow_kg_s: 0.03,
                supplyTemperatureC: 68,
                returnTemperatureC: 50,
                connectionType: "side",
                assignedSystemId: "video-heating",
            },
            connectedNetworkIds: ["video-pipe-supply", "video-pipe-return"],
        },
    ];
    const sensors = [
        {
            id: "video-sensor-living-temp",
            type: "temperature",
            position: { x: 3.4, y: 2.25 },
            levelId: LEVEL_ID,
            roomId: VIDEO_DEMO_ROOM_IDS.living,
            value: VIDEO_DEMO_ROOM_TEMPERATURES[VIDEO_DEMO_ROOM_IDS.living],
            unit: "°C",
            status: "normal",
            history: [
                { timestamp: 0, value: 21.3 },
                { timestamp: 1, value: 21.4 },
                { timestamp: 2, value: 21.5 },
            ],
        },
    ];
    return {
        ...model,
        levels: [{ id: LEVEL_ID, name: "Уровень 1", elevation_m: 0, height_m: DEFAULT_LEVEL_HEIGHT_M }],
        rooms: [
            {
                id: VIDEO_DEMO_ROOM_IDS.living,
                name: "Гостиная",
                levelId: LEVEL_ID,
                polygon: [
                    { x: 0, y: 0 },
                    { x: 6.2, y: 0 },
                    { x: 6.2, y: 4.6 },
                    { x: 0, y: 4.6 },
                ],
            },
            {
                id: VIDEO_DEMO_ROOM_IDS.bedroom,
                name: "Спальня",
                levelId: LEVEL_ID,
                polygon: [
                    { x: 6.2, y: 0 },
                    { x: 12, y: 0 },
                    { x: 12, y: 4.6 },
                    { x: 6.2, y: 4.6 },
                ],
            },
            {
                id: VIDEO_DEMO_ROOM_IDS.kitchen,
                name: "Кухня",
                levelId: LEVEL_ID,
                polygon: [
                    { x: 0, y: 4.6 },
                    { x: 8.9, y: 4.6 },
                    { x: 8.9, y: 8 },
                    { x: 0, y: 8 },
                ],
            },
            {
                id: VIDEO_DEMO_ROOM_IDS.utility,
                name: "Санузел и техпомещение",
                levelId: LEVEL_ID,
                polygon: [
                    { x: 8.9, y: 4.6 },
                    { x: 12, y: 4.6 },
                    { x: 12, y: 8 },
                    { x: 8.9, y: 8 },
                ],
            },
        ],
        walls,
        roofs: [
            {
                id: "video-roof-1",
                levelId: LEVEL_ID,
                name: "Плоская кровля",
                kind: "flat",
                boundary: [
                    { x: 0.1, y: 0.1 },
                    { x: 11.9, y: 0.1 },
                    { x: 11.9, y: 7.9 },
                    { x: 0.1, y: 7.9 },
                ],
                elevationBase_m: DEFAULT_LEVEL_HEIGHT_M,
                thickness_m: 0.26,
                layers: ROOF_LAYERS,
                heatedSide: "below",
                assemblyId: "video-roof",
            },
        ],
        floorSlabs: [
            {
                id: "video-slab-1",
                levelId: LEVEL_ID,
                name: "Плита пола",
                kind: "ground",
                boundary: [
                    { x: 0, y: 0 },
                    { x: 12, y: 0 },
                    { x: 12, y: 8 },
                    { x: 0, y: 8 },
                ],
                elevation_m: 0,
                thickness_m: 0.25,
                layers: FLOOR_LAYERS,
                heatedSide: "above",
                assemblyId: "video-floor",
            },
        ],
        doors,
        windows,
        pipes,
        ducts: [],
        equipment,
        sensors,
        meta: {
            demoScenarioId: "video-demo-house",
            demoScenarioName: "Демонстрационный дом",
        },
        thermalProtection: buildThermalProtection(),
    };
}
export function buildVideoDemoHouseModel() {
    return cloneDeep(buildVideoDemoModelInternal());
}
export const videoDemoHouse = buildVideoDemoHouseModel();
export function buildVideoDemoThermalResult(model = videoDemoHouse) {
    const roomEntries = model.rooms.map((room) => {
        const baseTemperature = VIDEO_DEMO_ROOM_TEMPERATURES[room.id] ?? 20;
        const baseHeating = VIDEO_DEMO_ROOM_HEATING_W[room.id] ?? 800;
        const setpoint = VIDEO_DEMO_ROOM_SETPOINTS[room.id] ?? baseTemperature;
        return {
            room,
            baseTemperature,
            baseHeating,
            setpoint,
            phaseOffset: room.id.length * 0.37,
        };
    });
    const timeline = HOURS.map((timeHours) => {
        const normalizedHour = (timeHours / 24) * Math.PI * 2;
        const outdoorTemperatureC = -11 + Math.sin(normalizedHour - 0.8) * 3 + Math.cos(normalizedHour * 0.5) * 0.8;
        const rooms = Object.fromEntries(roomEntries.map(({ room, baseTemperature, baseHeating, setpoint, phaseOffset }) => {
            const temperatureC = Number((baseTemperature + Math.sin(normalizedHour + phaseOffset) * 0.22).toFixed(2));
            const heatingPowerW = Number((baseHeating * (0.94 + Math.cos(normalizedHour + phaseOffset) * 0.06)).toFixed(1));
            return [
                room.id,
                {
                    temperatureC,
                    heatingPowerW,
                    setpointC: setpoint,
                },
            ];
        }));
        return {
            timeHours,
            outdoorTemperatureC: Number(outdoorTemperatureC.toFixed(2)),
            rooms,
        };
    });
    const roomResults = Object.fromEntries(roomEntries.map(({ room }) => {
        const roomTimeline = timeline.map((frame) => ({
            timeHours: frame.timeHours,
            temperatureC: frame.rooms[room.id]?.temperatureC ?? 20,
            heatingPowerW: frame.rooms[room.id]?.heatingPowerW ?? 0,
        }));
        const totalHeatingWh = roomTimeline.slice(0, -1).reduce((sum, point) => sum + point.heatingPowerW, 0);
        return [
            room.id,
            {
                roomId: room.id,
                timeline: roomTimeline,
                dailyEnergyKWh: Number((totalHeatingWh / 1000).toFixed(2)),
                discomfortHours: 0,
            },
        ];
    }));
    const peakLoadW = timeline.reduce((peak, frame) => Math.max(peak, Object.values(frame.rooms).reduce((sum, payload) => sum + payload.heatingPowerW, 0)), 0);
    const totalEnergyKWh = Number((timeline
        .slice(0, -1)
        .reduce((sum, frame) => sum +
        Object.values(frame.rooms).reduce((roomsSum, payload) => roomsSum + payload.heatingPowerW, 0), 0) /
        1000).toFixed(2));
    return {
        timeline,
        rooms: roomResults,
        summary: {
            peakLoadKW: Number((peakLoadW / 1000).toFixed(2)),
            totalEnergyKWh,
            discomfortHours: 0,
        },
    };
}
