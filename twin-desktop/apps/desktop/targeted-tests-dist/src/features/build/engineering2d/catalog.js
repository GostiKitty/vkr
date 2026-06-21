import { createEmptyEngineeringSystems, } from "../../../entities/engineering/types";
import { createId } from "../../../shared/utils/id";
export const ENGINEERING_EQUIPMENT_LABELS = {
    heatExchanger: "Теплообменник",
    pump: "Насос",
    filter: "Фильтр",
    valve: "Клапан запорный",
    checkValve: "Клапан обратный",
    controlValve: "Клапан регулирующий",
    expansionTank: "Расширительный бак",
    manifold: "Коллектор",
    heatMeter: "Теплосчётчик",
    automationCabinet: "Шкаф автоматики",
    sensorTemperature: "Датчик температуры",
    sensorPressure: "Датчик давления",
    // АВОК СТО НП 1.05-2006
    gateValve: "Задвижка",
    ballValve: "Кран шаровой",
    threeWayValve: "Кран трёхходовой",
    balancingValve: "Клапан балансировочный",
    safetyValve: "Клапан предохранительный",
    pressureRegulator: "Регулятор перепада давления",
    thermostaticValve: "Терморегулятор радиаторный",
    flowMeter: "Расходомер",
    convector: "Конвектор",
    sensorFlow: "Датчик расхода",
    sensorHumidity: "Датчик влажности",
    airHandlingUnit: "Установка приточно-вытяжная",
    ductFan: "Вентилятор",
    roofFan: "Вентилятор крышный",
    airDamper: "Клапан жалюзийный многостворчатый",
    fireDamper: "Клапан противопожарный",
    airFilter: "Фильтр воздушный",
    silencer: "Шумоглушитель",
    airHeater: "Подогреватель",
    airCooler: "Охладитель",
    airHumidifier: "Увлажнитель воздуха",
    airDehumidifier: "Осушитель воздуха",
    supplyDiffuser: "Устройство для входа/выхода приточного воздуха",
    exhaustGrille: "Устройство для входа/выхода удаляемого воздуха",
};
ENGINEERING_EQUIPMENT_LABELS.airFlowRegulatorConst = "Регулирующий клапан с постоянным расходом";
ENGINEERING_EQUIPMENT_LABELS.airFlowRegulatorVar = "Регулирующий клапан с переменным расходом";
ENGINEERING_EQUIPMENT_LABELS.airCheckValve = "Клапан обратный воздушный";
export const ENGINEERING_AIR_EQUIPMENT_TYPES = [
    "airHandlingUnit",
    "ductFan",
    "roofFan",
    "airDamper",
    "airCheckValve",
    "fireDamper",
    "airFilter",
    "airFlowRegulatorConst",
    "airFlowRegulatorVar",
    "silencer",
    "airHeater",
    "airCooler",
    "airHumidifier",
    "airDehumidifier",
    "supplyDiffuser",
    "exhaustGrille",
];
export const ENGINEERING_AIR_INLINE_TYPES = [
    "ductFan",
    "roofFan",
    "airDamper",
    "airCheckValve",
    "fireDamper",
    "airFilter",
    "airFlowRegulatorConst",
    "airFlowRegulatorVar",
    "silencer",
    "airHeater",
    "airCooler",
    "airHumidifier",
    "airDehumidifier",
];
const ENGINEERING_AIR_PORT_MEDIA = new Set(["airSupply", "airExhaust"]);
export const EQUIPMENT_VARIANTS = {
    valve: [
        { key: "throughput", label: "Проходной" },
        { key: "angular", label: "Угловой" },
    ],
    checkValve: [
        { key: "throughput", label: "Проходной" },
        { key: "angular", label: "Угловой" },
    ],
    controlValve: [
        { key: "throughput", label: "Проходной" },
        { key: "angular", label: "Угловой" },
        { key: "triple", label: "Тройной" },
    ],
    safetyValve: [
        { key: "throughput", label: "Проходной" },
        { key: "angular", label: "Угловой" },
    ],
    thermostaticValve: [
        { key: "throughput", label: "Проходной" },
        { key: "mixing", label: "Смесительный" },
    ],
    pump: [
        { key: "general", label: "Нерегулируемый" },
        { key: "variable", label: "Регулируемый" },
        { key: "centrifugal", label: "Центробежный" },
    ],
    ballValve: [
        { key: "throughput", label: "Проходной" },
        { key: "angular", label: "Угловой" },
    ],
};
export const EQUIPMENT_VARIANT_DEFAULT = {
    valve: "throughput",
    checkValve: "throughput",
    controlValve: "throughput",
    safetyValve: "throughput",
    thermostaticValve: "throughput",
    pump: "general",
    ballValve: "throughput",
};
export const ENGINEERING_MEDIUM_LABELS = {
    supply: "Подача",
    return: "Обратка",
    dhw: "ГВС",
    coldWater: "ХВС",
    drain: "Дренаж",
    electric: "Электропитание",
    signal: "Сигнал",
    airSupply: "Приток",
    airExhaust: "Вытяжка",
};
export const ENGINEERING_MEDIUM_STYLES = {
    supply: { stroke: "#d45a1c", outline: "rgba(212,90,28,0.18)", width: 3.4 },
    return: { stroke: "#2f6fdb", outline: "rgba(47,111,219,0.18)", width: 3.4 },
    dhw: { stroke: "#ef8e1a", outline: "rgba(239,142,26,0.18)", width: 3.2 },
    coldWater: { stroke: "#36a7e7", outline: "rgba(54,167,231,0.18)", width: 3.2 },
    drain: { stroke: "#8f98a3", outline: "rgba(143,152,163,0.14)", dashArray: "9 6", width: 2.8 },
    electric: { stroke: "#9a67ea", outline: "rgba(154,103,234,0.14)", dashArray: "4 5", width: 2.1 },
    signal: { stroke: "#10a37f", outline: "rgba(16,163,127,0.14)", dashArray: "4 5", width: 2.1 },
    airSupply: { stroke: "#0f8f7f", outline: "rgba(15,143,127,0.14)", width: 3.1 },
    airExhaust: { stroke: "#5f6b7a", outline: "rgba(95,107,122,0.14)", dashArray: "8 5", width: 3.0 },
};
export function isEngineeringAirMedium(medium) {
    return medium === "airSupply" || medium === "airExhaust";
}
export function readEngineeringAirflowM3H(parameters) {
    const airflow = parameters.airflowM3H;
    if (typeof airflow === "number" && Number.isFinite(airflow)) {
        return Math.max(0, airflow);
    }
    const flowRate = parameters.flowRateM3H;
    if (typeof flowRate === "number" && Number.isFinite(flowRate)) {
        return Math.max(0, flowRate);
    }
    return null;
}
function readEngineeringParameterNumber(parameters, key) {
    const value = parameters[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function resolveEngineeringAirPipeTemperatureC(medium, fromEquipment, toEquipment) {
    const candidates = medium === "airSupply"
        ? [
            readEngineeringParameterNumber(fromEquipment.parameters, "supplyTemperatureC"),
            readEngineeringParameterNumber(fromEquipment.parameters, "temperatureC"),
            readEngineeringParameterNumber(toEquipment.parameters, "supplyTemperatureC"),
            readEngineeringParameterNumber(toEquipment.parameters, "temperatureC"),
        ]
        : [
            readEngineeringParameterNumber(fromEquipment.parameters, "temperatureC"),
            readEngineeringParameterNumber(toEquipment.parameters, "temperatureC"),
        ];
    for (const candidate of candidates) {
        if (candidate != null) {
            return candidate;
        }
    }
    return null;
}
function readEngineeringAirPipeSection(parameters) {
    const sectionWidthMm = readEngineeringParameterNumber(parameters, "sectionWidthMm");
    const sectionHeightMm = readEngineeringParameterNumber(parameters, "sectionHeightMm");
    if (sectionWidthMm != null && sectionHeightMm != null && sectionWidthMm > 0 && sectionHeightMm > 0) {
        const hydraulicDiameterMm = Math.round((2 * sectionWidthMm * sectionHeightMm) / (sectionWidthMm + sectionHeightMm));
        return {
            shape: "rectangular",
            widthMm: Math.round(sectionWidthMm),
            heightMm: Math.round(sectionHeightMm),
            hydraulicDiameterMm: Math.max(1, hydraulicDiameterMm),
        };
    }
    const diameterMm = readEngineeringParameterNumber(parameters, "diameterMm") ?? readEngineeringParameterNumber(parameters, "neckDiameterMm");
    if (diameterMm != null && diameterMm > 0) {
        return {
            shape: "round",
            diameterMm: Math.round(diameterMm),
        };
    }
    return null;
}
function resolveEngineeringAirPipeSectionAreaMm2(section) {
    if (section.shape === "rectangular") {
        return section.widthMm * section.heightMm;
    }
    return (Math.PI * section.diameterMm * section.diameterMm) / 4;
}
function resolvePreferredEngineeringAirPipeSection(fromSection, toSection) {
    if (!fromSection) {
        return toSection;
    }
    if (!toSection) {
        return fromSection;
    }
    const fromAreaMm2 = resolveEngineeringAirPipeSectionAreaMm2(fromSection);
    const toAreaMm2 = resolveEngineeringAirPipeSectionAreaMm2(toSection);
    return toAreaMm2 < fromAreaMm2 ? toSection : fromSection;
}
function buildEngineeringAirPipeSectionMetadata(section, prefix = "") {
    if (!section) {
        return {};
    }
    const areaMm2 = resolveEngineeringAirPipeSectionAreaMm2(section);
    const shapeKey = prefix ? `${prefix}SectionShape` : "sectionShape";
    const areaKey = prefix ? `${prefix}SectionAreaMm2` : "sectionAreaMm2";
    if (section.shape === "rectangular") {
        const widthKey = prefix ? `${prefix}SectionWidthMm` : "sectionWidthMm";
        const heightKey = prefix ? `${prefix}SectionHeightMm` : "sectionHeightMm";
        const hydraulicKey = prefix ? `${prefix}HydraulicDiameterMm` : "hydraulicDiameterMm";
        return {
            [shapeKey]: "rectangular",
            [widthKey]: section.widthMm,
            [heightKey]: section.heightMm,
            [hydraulicKey]: section.hydraulicDiameterMm,
            [areaKey]: areaMm2,
        };
    }
    const diameterKey = prefix ? `${prefix}SectionDiameterMm` : "sectionDiameterMm";
    return {
        [shapeKey]: "round",
        [diameterKey]: section.diameterMm,
        [areaKey]: areaMm2,
    };
}
function resolveEngineeringAirConnectionFlowRateM3H(fromEquipment, toEquipment, fallbackFlowRate) {
    const fromAirflowM3H = readEngineeringAirflowM3H(fromEquipment.parameters);
    const toAirflowM3H = readEngineeringAirflowM3H(toEquipment.parameters);
    const fromPositiveAirflowM3H = fromAirflowM3H != null && fromAirflowM3H > 0 ? fromAirflowM3H : null;
    const toPositiveAirflowM3H = toAirflowM3H != null && toAirflowM3H > 0 ? toAirflowM3H : null;
    if (fromPositiveAirflowM3H != null && toPositiveAirflowM3H != null) {
        return Math.min(fromPositiveAirflowM3H, toPositiveAirflowM3H);
    }
    return fromPositiveAirflowM3H ?? toPositiveAirflowM3H ?? fallbackFlowRate;
}
function resolveEngineeringAirPipeSectionForConnection(fromEquipment, toEquipment) {
    return resolvePreferredEngineeringAirPipeSection(readEngineeringAirPipeSection(fromEquipment.parameters), readEngineeringAirPipeSection(toEquipment.parameters));
}
function resolveEngineeringPipeValuesForConnection(medium, fromEquipment, toEquipment) {
    const defaults = defaultPipeValuesForMedium(medium);
    if (!isEngineeringAirMedium(medium)) {
        return {
            ...defaults,
            metadata: {},
        };
    }
    const fromSection = readEngineeringAirPipeSection(fromEquipment.parameters);
    const toSection = readEngineeringAirPipeSection(toEquipment.parameters);
    const section = resolvePreferredEngineeringAirPipeSection(fromSection, toSection);
    const fromSectionAreaMm2 = fromSection ? resolveEngineeringAirPipeSectionAreaMm2(fromSection) : null;
    const toSectionAreaMm2 = toSection ? resolveEngineeringAirPipeSectionAreaMm2(toSection) : null;
    return {
        ...defaults,
        diameter: section?.shape === "rectangular"
            ? section.hydraulicDiameterMm
            : section?.shape === "round"
                ? section.diameterMm
                : defaults.diameter,
        temperature: resolveEngineeringAirPipeTemperatureC(medium, fromEquipment, toEquipment) ??
            defaults.temperature,
        flowRate: resolveEngineeringAirConnectionFlowRateM3H(fromEquipment, toEquipment, defaults.flowRate),
        metadata: {
            ...buildEngineeringAirPipeSectionMetadata(section),
            ...buildEngineeringAirPipeSectionMetadata(fromSection, "source"),
            ...buildEngineeringAirPipeSectionMetadata(toSection, "target"),
            ...(fromSectionAreaMm2 != null && toSectionAreaMm2 != null && fromSectionAreaMm2 > 0 && toSectionAreaMm2 > 0
                ? {
                    sectionTransitionRatio: Math.max(fromSectionAreaMm2, toSectionAreaMm2) / Math.min(fromSectionAreaMm2, toSectionAreaMm2),
                }
                : null),
        },
    };
}
const EQUIPMENT_PRESETS = {
    heatExchanger: {
        label: ENGINEERING_EQUIPMENT_LABELS.heatExchanger,
        width: 1.4,
        height: 2.2,
        ports: [
            { id: "primary-in", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "primary-out", xNorm: -0.5, yNorm: 0, direction: "left", medium: "return" },
            { id: "secondary-out", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
            { id: "secondary-in", xNorm: 0.5, yNorm: 0, direction: "right", medium: "return" },
        ],
        parameters: {
            heatExchangerVariant: "fixedStraight",
            powerKW: 350,
            primaryTemperatureC: 95,
            secondaryTemperatureC: 70,
            flowRateM3H: 12,
            pressureDropKPa: 35,
        },
    },
    pump: {
        label: ENGINEERING_EQUIPMENT_LABELS.pump,
        width: 1.2,
        height: 1.2,
        ports: [
            // Контур насоса в рендере: r = 0.42 * min(width,height) -> порты ставим на эту окружность.
            { id: "inlet", xNorm: -0.42, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.42, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { flowRateM3H: 8, headM: 18, powerKW: 2.2, efficiency: 0.75 },
    },
    filter: {
        label: ENGINEERING_EQUIPMENT_LABELS.filter,
        width: 1.5,
        height: 0.95,
        ports: [
            // Порты ставим в точки входа/выхода на боковых "плечиках" контура.
            { id: "inlet", xNorm: -0.17, yNorm: -0.03, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.17, yNorm: -0.03, direction: "right", medium: "supply" },
            { id: "drain", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "drain" },
        ],
        parameters: { diameterMm: 80, pressureDropKPa: 8, contaminationPercent: 12 },
    },
    valve: {
        label: ENGINEERING_EQUIPMENT_LABELS.valve,
        width: 1.1,
        height: 0.8,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { diameterMm: 65, kv: 40, state: "open" },
    },
    checkValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.checkValve,
        width: 1.0,
        height: 0.75,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { diameterMm: 50, state: "open" },
    },
    controlValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.controlValve,
        width: 1.25,
        height: 1.2,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
            { id: "signal", xNorm: 0, yNorm: -0.5, direction: "top", medium: "signal" },
        ],
        parameters: { diameterMm: 65, kv: 25, state: "regulating" },
    },
    expansionTank: {
        label: ENGINEERING_EQUIPMENT_LABELS.expansionTank,
        width: 1.35,
        height: 1,
        ports: [{ id: "connection", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "return" }],
        parameters: { volumeL: 300, pressureBar: 3 },
    },
    manifold: {
        label: ENGINEERING_EQUIPMENT_LABELS.manifold,
        width: 2.6,
        height: 0.75,
        ports: [
            { id: "main-in", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "main-out", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
            { id: "branch-1", xNorm: -0.2, yNorm: -0.5, direction: "top", medium: "supply" },
            { id: "branch-2", xNorm: 0, yNorm: -0.5, direction: "top", medium: "supply" },
            { id: "branch-3", xNorm: 0.2, yNorm: -0.5, direction: "top", medium: "supply" },
        ],
        parameters: { diameterMm: 100, branchCount: 3 },
    },
    heatMeter: {
        label: ENGINEERING_EQUIPMENT_LABELS.heatMeter,
        width: 1.65,
        height: 0.95,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
            { id: "signal", xNorm: 0, yNorm: -0.5, direction: "top", medium: "signal" },
        ],
        parameters: { flowRateM3H: 10, supplyTemperatureC: 95, returnTemperatureC: 70, heatPowerKW: 320 },
    },
    automationCabinet: {
        label: ENGINEERING_EQUIPMENT_LABELS.automationCabinet,
        width: 1.4,
        height: 1.8,
        ports: [
            { id: "power", xNorm: -0.5, yNorm: 0.2, direction: "left", medium: "electric" },
            { id: "signal-1", xNorm: 0.5, yNorm: -0.2, direction: "right", medium: "signal" },
            { id: "signal-2", xNorm: 0.5, yNorm: 0.2, direction: "right", medium: "signal" },
        ],
        parameters: { voltageV: 380, signalChannels: 8 },
    },
    sensorTemperature: {
        label: ENGINEERING_EQUIPMENT_LABELS.sensorTemperature,
        width: 0.65,
        height: 0.65,
        ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
        parameters: { measuredValueC: 70 },
    },
    sensorPressure: {
        label: ENGINEERING_EQUIPMENT_LABELS.sensorPressure,
        width: 0.65,
        height: 0.65,
        ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
        parameters: { measuredValueBar: 3.2 },
    },
    // ── АВОК СТО НП 1.05-2006 ──────────────────────────────────────────────────
    gateValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.gateValve,
        width: 1.0,
        height: 1.05,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { diameterMm: 65, state: "open" },
    },
    ballValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.ballValve,
        width: 0.9,
        height: 0.9,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { diameterMm: 50, state: "open" },
    },
    threeWayValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.threeWayValve,
        width: 1.1,
        height: 1.2,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
            { id: "branch", xNorm: 0, yNorm: -0.5, direction: "top", medium: "supply" },
        ],
        parameters: { diameterMm: 50, state: "open" },
    },
    balancingValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.balancingValve,
        width: 1.0,
        height: 1.05,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { diameterMm: 65, kv: 15, state: "open" },
    },
    safetyValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.safetyValve,
        width: 1.0,
        height: 1.2,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { diameterMm: 32, setpressureBar: 6 },
    },
    pressureRegulator: {
        label: ENGINEERING_EQUIPMENT_LABELS.pressureRegulator,
        width: 1.25,
        height: 1.5,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
            { id: "signal", xNorm: 0, yNorm: -0.5, direction: "top", medium: "signal" },
        ],
        parameters: { diameterMm: 65, setpointKPa: 20 },
    },
    thermostaticValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.thermostaticValve,
        width: 1.0,
        height: 1.35,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
        ],
        parameters: { diameterMm: 15, setpointC: 20 },
    },
    flowMeter: {
        label: ENGINEERING_EQUIPMENT_LABELS.flowMeter,
        width: 1.5,
        height: 0.9,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "supply" },
            { id: "signal", xNorm: 0, yNorm: -0.5, direction: "top", medium: "signal" },
        ],
        parameters: { diameterMm: 50, flowRateM3H: 5, variant: "electromagnetic" },
    },
    convector: {
        label: ENGINEERING_EQUIPMENT_LABELS.convector,
        width: 1.4,
        height: 0.85,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "supply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "return" },
        ],
        parameters: { nominalPowerW: 1000, designTemperatureC: 70 },
    },
    airHandlingUnit: {
        label: ENGINEERING_EQUIPMENT_LABELS.airHandlingUnit,
        width: 2.8,
        height: 1.4,
        ports: [
            { id: "exhaust-in", xNorm: -0.5, yNorm: 0.2, direction: "left", medium: "airExhaust" },
            { id: "supply-out", xNorm: 0.5, yNorm: -0.2, direction: "right", medium: "airSupply" },
            { id: "power", xNorm: 0, yNorm: -0.5, direction: "top", medium: "electric" },
        ],
        parameters: { airflowM3H: 1200, heatRecoveryEfficiency: 0.75, supplyTemperatureC: 18, pressurePa: 600, powerKW: 4 },
    },
    ductFan: {
        label: ENGINEERING_EQUIPMENT_LABELS.ductFan,
        width: 1.3,
        height: 1,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
            { id: "power", xNorm: 0, yNorm: -0.5, direction: "top", medium: "electric" },
        ],
        parameters: { airflowM3H: 1200, pressurePa: 450, powerKW: 1.1, airMedium: "airSupply" },
    },
    roofFan: {
        label: ENGINEERING_EQUIPMENT_LABELS.roofFan,
        width: 1.35,
        height: 1.1,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airExhaust" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airExhaust" },
            { id: "power", xNorm: 0, yNorm: -0.5, direction: "top", medium: "electric" },
        ],
        parameters: { airflowM3H: 1800, pressurePa: 550, powerKW: 1.5, airMedium: "airExhaust" },
    },
    airDamper: {
        label: ENGINEERING_EQUIPMENT_LABELS.airDamper,
        width: 1.2,
        height: 0.8,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: { sectionWidthMm: 600, sectionHeightMm: 300, state: "open", pressureDropPa: 20, airMedium: "airSupply" },
    },
    airCheckValve: {
        label: ENGINEERING_EQUIPMENT_LABELS.airCheckValve,
        width: 1.2,
        height: 0.8,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: { sectionWidthMm: 600, sectionHeightMm: 300, state: "open", pressureDropPa: 25, airMedium: "airSupply" },
    },
    fireDamper: {
        label: ENGINEERING_EQUIPMENT_LABELS.fireDamper,
        width: 1.2,
        height: 0.8,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: { sectionWidthMm: 600, sectionHeightMm: 300, state: "open", pressureDropPa: 30, airMedium: "airSupply" },
    },
    airFilter: {
        label: ENGINEERING_EQUIPMENT_LABELS.airFilter,
        width: 1.4,
        height: 0.9,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: {
            sectionWidthMm: 600,
            sectionHeightMm: 300,
            pressureDropPa: 90,
            contaminationPercent: 0,
            airMedium: "airSupply",
        },
    },
    airFlowRegulatorConst: {
        label: ENGINEERING_EQUIPMENT_LABELS.airFlowRegulatorConst,
        width: 1.35,
        height: 0.85,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: {
            airflowM3H: 600,
            sectionWidthMm: 400,
            sectionHeightMm: 200,
            pressureDropPa: 50,
            airMedium: "airSupply",
        },
    },
    airFlowRegulatorVar: {
        label: ENGINEERING_EQUIPMENT_LABELS.airFlowRegulatorVar,
        width: 1.35,
        height: 0.85,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: {
            airflowM3H: 600,
            sectionWidthMm: 400,
            sectionHeightMm: 200,
            pressureDropPa: 45,
            damperPositionPercent: 100,
            airMedium: "airSupply",
        },
    },
    silencer: {
        label: ENGINEERING_EQUIPMENT_LABELS.silencer,
        width: 1.8,
        height: 0.8,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: { sectionWidthMm: 600, sectionHeightMm: 300, pressureDropPa: 45, airMedium: "airSupply" },
    },
    airHeater: {
        label: ENGINEERING_EQUIPMENT_LABELS.airHeater,
        width: 1.6,
        height: 0.9,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: { airflowM3H: 1200, powerKW: 18, supplyTemperatureC: 20, pressureDropPa: 80, airMedium: "airSupply" },
    },
    airCooler: {
        label: ENGINEERING_EQUIPMENT_LABELS.airCooler,
        width: 1.6,
        height: 0.9,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: { airflowM3H: 1200, coolingPowerKW: 12, supplyTemperatureC: 14, pressureDropPa: 75, airMedium: "airSupply" },
    },
    airHumidifier: {
        label: ENGINEERING_EQUIPMENT_LABELS.airHumidifier,
        width: 1.6,
        height: 0.9,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: {
            airflowM3H: 1200,
            humidificationCapacityKgH: 15,
            powerKW: 3,
            supplyTemperatureC: 19,
            pressureDropPa: 65,
            airMedium: "airSupply",
        },
    },
    airDehumidifier: {
        label: ENGINEERING_EQUIPMENT_LABELS.airDehumidifier,
        width: 1.6,
        height: 0.9,
        ports: [
            { id: "inlet", xNorm: -0.5, yNorm: 0, direction: "left", medium: "airSupply" },
            { id: "outlet", xNorm: 0.5, yNorm: 0, direction: "right", medium: "airSupply" },
        ],
        parameters: {
            airflowM3H: 1200,
            moistureRemovalKgH: 8,
            powerKW: 2.5,
            supplyTemperatureC: 16,
            pressureDropPa: 70,
            airMedium: "airSupply",
        },
    },
    supplyDiffuser: {
        label: ENGINEERING_EQUIPMENT_LABELS.supplyDiffuser,
        width: 0.8,
        height: 0.8,
        ports: [{ id: "supply", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "airSupply" }],
        parameters: { airflowM3H: 300, supplyTemperatureC: 18, pressureDropPa: 35 },
    },
    exhaustGrille: {
        label: ENGINEERING_EQUIPMENT_LABELS.exhaustGrille,
        width: 0.95,
        height: 0.7,
        ports: [{ id: "exhaust", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "airExhaust" }],
        parameters: { airflowM3H: 300, pressureDropPa: 25 },
    },
    sensorFlow: {
        label: ENGINEERING_EQUIPMENT_LABELS.sensorFlow,
        width: 0.65,
        height: 0.65,
        ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
        parameters: { flowRateM3H: 5 },
    },
    sensorHumidity: {
        label: ENGINEERING_EQUIPMENT_LABELS.sensorHumidity,
        width: 0.65,
        height: 0.65,
        ports: [{ id: "signal", xNorm: 0, yNorm: 0.5, direction: "bottom", medium: "signal" }],
        parameters: { relativeHumidityPercent: 50 },
    },
};
export function getEngineeringEquipmentPreset(type) {
    return EQUIPMENT_PRESETS[type];
}
export function buildEngineeringPorts(type, width, height) {
    return getEngineeringEquipmentPreset(type).ports.map((port) => ({
        id: port.id,
        x: port.xNorm * width,
        y: port.yNorm * height,
        direction: port.direction,
        medium: port.medium,
    }));
}
function resolveInlineAirMedium(type, parameters) {
    if (!ENGINEERING_AIR_INLINE_TYPES.includes(type)) {
        return null;
    }
    return parameters.airMedium === "airExhaust" ? "airExhaust" : "airSupply";
}
function applyEquipmentPortMediumRules(equipment) {
    const overrideMedium = resolveInlineAirMedium(equipment.type, equipment.parameters);
    if (!overrideMedium) {
        return equipment;
    }
    return {
        ...equipment,
        ports: equipment.ports.map((port) => ENGINEERING_AIR_PORT_MEDIA.has(port.medium) ? { ...port, medium: overrideMedium } : port),
    };
}
export function normalizeEngineeringRotation(rotation) {
    const numeric = typeof rotation === "number" && Number.isFinite(rotation) ? rotation : 0;
    const normalized = ((Math.round(numeric / 90) * 90) % 360 + 360) % 360;
    return normalized;
}
export function createEngineeringEquipmentInstance(type, center, options = {}) {
    const preset = getEngineeringEquipmentPreset(type);
    return applyEquipmentPortMediumRules({
        id: options.id ?? createId("eng-eqp"),
        type,
        name: options.name?.trim() || preset.label,
        x: center.x,
        y: center.y,
        width: preset.width,
        height: preset.height,
        rotation: normalizeEngineeringRotation(options.rotation),
        ports: buildEngineeringPorts(type, preset.width, preset.height),
        parameters: { ...preset.parameters, ...(options.parameters ?? {}) },
        metadata: { ...(options.metadata ?? {}) },
        levelId: options.levelId ?? null,
    });
}
export function overrideEquipmentPortMedium(equipment, medium) {
    return {
        ...equipment,
        ports: equipment.ports.map((port) => ({ ...port, medium })),
    };
}
export function normalizeEngineeringEquipment(equipment) {
    const preset = getEngineeringEquipmentPreset(equipment.type);
    const width = typeof equipment.width === "number" && Number.isFinite(equipment.width) ? Math.max(0.4, equipment.width) : preset.width;
    const height = typeof equipment.height === "number" && Number.isFinite(equipment.height) ? Math.max(0.4, equipment.height) : preset.height;
    const basePorts = buildEngineeringPorts(equipment.type, width, height);
    const providedPorts = Array.isArray(equipment.ports) ? equipment.ports : [];
    const providedPortMap = new Map(providedPorts.map((port) => [port.id, port]));
    const extraPorts = providedPorts.filter((port) => !basePorts.some((basePort) => basePort.id === port.id));
    return applyEquipmentPortMediumRules({
        id: equipment.id,
        type: equipment.type,
        name: typeof equipment.name === "string" && equipment.name.trim() ? equipment.name.trim() : preset.label,
        x: typeof equipment.x === "number" && Number.isFinite(equipment.x) ? equipment.x : 0,
        y: typeof equipment.y === "number" && Number.isFinite(equipment.y) ? equipment.y : 0,
        width,
        height,
        rotation: normalizeEngineeringRotation(equipment.rotation),
        ports: [
            ...basePorts.map((port) => {
                const override = providedPortMap.get(port.id);
                return {
                    ...port,
                    direction: override?.direction ?? port.direction,
                    medium: override?.medium ?? port.medium,
                };
            }),
            ...extraPorts.map((port) => ({
                id: port.id,
                x: typeof port.x === "number" && Number.isFinite(port.x) ? port.x : 0,
                y: typeof port.y === "number" && Number.isFinite(port.y) ? port.y : 0,
                direction: port.direction,
                medium: port.medium,
            })),
        ],
        parameters: { ...preset.parameters, ...(equipment.parameters ?? {}) },
        metadata: { ...(equipment.metadata ?? {}) },
        levelId: equipment.levelId ?? null,
    });
}
export function getEngineeringPort(equipment, portId) {
    return equipment.ports.find((port) => port.id === portId) ?? null;
}
export function getEngineeringPortWorldPosition(equipment, port) {
    const radians = (normalizeEngineeringRotation(equipment.rotation) * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        x: equipment.x + port.x * cos - port.y * sin,
        y: equipment.y + port.x * sin + port.y * cos,
    };
}
export function rotateEngineeringDirection(direction, rotation) {
    const order = ["top", "right", "bottom", "left"];
    const index = order.indexOf(direction);
    const turns = normalizeEngineeringRotation(rotation) / 90;
    return order[(index + turns) % order.length] ?? direction;
}
function directionVector(direction) {
    switch (direction) {
        case "left":
            return { x: -1, y: 0 };
        case "right":
            return { x: 1, y: 0 };
        case "top":
            return { x: 0, y: -1 };
        case "bottom":
        default:
            return { x: 0, y: 1 };
    }
}
function advancePoint(point, direction, distance) {
    const vector = directionVector(direction);
    return {
        x: point.x + vector.x * distance,
        y: point.y + vector.y * distance,
    };
}
function dedupePolylinePoints(points) {
    const deduped = [];
    points.forEach((point) => {
        const previous = deduped[deduped.length - 1];
        if (previous && Math.hypot(previous.x - point.x, previous.y - point.y) < 1e-6) {
            return;
        }
        deduped.push(point);
    });
    return deduped;
}
export function buildEngineeringPipeRoute(start, startDirection, end, endDirection) {
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const lead = Math.max(0.28, Math.min(0.9, distance * 0.22));
    const startLead = advancePoint(start, startDirection, lead);
    const endLead = advancePoint(end, endDirection, lead);
    const startHorizontal = startDirection === "left" || startDirection === "right";
    const endHorizontal = endDirection === "left" || endDirection === "right";
    const midPoints = [];
    if (startHorizontal && endHorizontal) {
        const midX = (startLead.x + endLead.x) / 2;
        midPoints.push({ x: midX, y: startLead.y }, { x: midX, y: endLead.y });
    }
    else if (!startHorizontal && !endHorizontal) {
        const midY = (startLead.y + endLead.y) / 2;
        midPoints.push({ x: startLead.x, y: midY }, { x: endLead.x, y: midY });
    }
    else {
        midPoints.push({ x: startLead.x, y: endLead.y });
    }
    return dedupePolylinePoints([start, startLead, ...midPoints, endLead, end]);
}
function defaultPipeValuesForMedium(medium) {
    switch (medium) {
        case "supply":
            return { diameter: 80, insulation: 40, temperature: 95, flowRate: 12 };
        case "return":
            return { diameter: 80, insulation: 40, temperature: 70, flowRate: 12 };
        case "dhw":
            return { diameter: 50, insulation: 30, temperature: 60, flowRate: 5 };
        case "coldWater":
            return { diameter: 40, insulation: 13, temperature: 10, flowRate: 4 };
        case "drain":
            return { diameter: 32, insulation: 0, temperature: null, flowRate: 2 };
        case "airSupply":
            return { diameter: 250, insulation: 25, temperature: null, flowRate: 1200 };
        case "airExhaust":
            return { diameter: 250, insulation: 10, temperature: null, flowRate: 1200 };
        case "electric":
            return { diameter: 10, insulation: 0, temperature: null, flowRate: null };
        case "signal":
        default:
            return { diameter: 8, insulation: 0, temperature: null, flowRate: null };
    }
}
export function areEngineeringPortsCompatible(left, right) {
    return left.medium === right.medium;
}
export function createEngineeringPipeConnection(input) {
    const fromPort = getEngineeringPort(input.fromEquipment, input.fromPortId);
    const toPort = getEngineeringPort(input.toEquipment, input.toPortId);
    if (!fromPort || !toPort || !areEngineeringPortsCompatible(fromPort, toPort)) {
        return null;
    }
    const medium = fromPort.medium;
    const startDirection = rotateEngineeringDirection(fromPort.direction, input.fromEquipment.rotation);
    const endDirection = rotateEngineeringDirection(toPort.direction, input.toEquipment.rotation);
    const start = getEngineeringPortWorldPosition(input.fromEquipment, fromPort);
    const end = getEngineeringPortWorldPosition(input.toEquipment, toPort);
    const defaults = resolveEngineeringPipeValuesForConnection(medium, input.fromEquipment, input.toEquipment);
    return {
        id: input.id ?? createId("eng-pipe"),
        fromEquipmentId: input.fromEquipment.id,
        fromPortId: fromPort.id,
        toEquipmentId: input.toEquipment.id,
        toPortId: toPort.id,
        points: buildEngineeringPipeRoute(start, startDirection, end, endDirection),
        medium,
        diameter: defaults.diameter,
        insulation: defaults.insulation,
        temperature: defaults.temperature,
        flowRate: defaults.flowRate,
        metadata: { ...(defaults.metadata ?? {}), ...(input.metadata ?? {}) },
        levelId: input.levelId ?? input.fromEquipment.levelId ?? input.toEquipment.levelId ?? null,
    };
}
export function normalizeEngineeringPipe(pipe) {
    const defaults = defaultPipeValuesForMedium(pipe.medium);
    return {
        id: pipe.id,
        fromEquipmentId: pipe.fromEquipmentId,
        fromPortId: pipe.fromPortId,
        toEquipmentId: pipe.toEquipmentId,
        toPortId: pipe.toPortId,
        points: Array.isArray(pipe.points) ? pipe.points.map((point) => ({ x: point?.x ?? 0, y: point?.y ?? 0 })) : [],
        medium: pipe.medium,
        diameter: typeof pipe.diameter === "number" && Number.isFinite(pipe.diameter) ? Math.max(1, pipe.diameter) : defaults.diameter,
        insulation: typeof pipe.insulation === "number" && Number.isFinite(pipe.insulation) ? Math.max(0, pipe.insulation) : defaults.insulation,
        temperature: typeof pipe.temperature === "number" && Number.isFinite(pipe.temperature) ? pipe.temperature : defaults.temperature,
        flowRate: typeof pipe.flowRate === "number" && Number.isFinite(pipe.flowRate) ? pipe.flowRate : defaults.flowRate,
        metadata: { ...(pipe.metadata ?? {}) },
        levelId: pipe.levelId ?? null,
    };
}
export function rebuildEngineeringPipeGeometry(pipe, systems) {
    const fromEquipment = systems.equipment.find((equipment) => equipment.id === pipe.fromEquipmentId);
    const toEquipment = systems.equipment.find((equipment) => equipment.id === pipe.toEquipmentId);
    if (!fromEquipment || !toEquipment) {
        return pipe;
    }
    const next = createEngineeringPipeConnection({
        id: pipe.id,
        levelId: pipe.levelId ?? fromEquipment.levelId ?? toEquipment.levelId ?? null,
        fromEquipment,
        fromPortId: pipe.fromPortId,
        toEquipment,
        toPortId: pipe.toPortId,
        metadata: pipe.metadata,
    });
    if (!next) {
        return pipe;
    }
    return {
        ...next,
        diameter: pipe.diameter,
        insulation: pipe.insulation,
        temperature: pipe.temperature,
        flowRate: pipe.flowRate,
    };
}
export function normalizeEngineeringSystems(systems) {
    const base = systems ?? createEmptyEngineeringSystems();
    const equipment = Array.isArray(base.equipment) ? base.equipment.map((item) => normalizeEngineeringEquipment(item)) : [];
    const rawPipes = Array.isArray(base.pipes) ? base.pipes.map((pipe) => normalizeEngineeringPipe(pipe)) : [];
    const normalized = { equipment, pipes: rawPipes };
    return {
        equipment,
        pipes: rawPipes.map((pipe) => rebuildEngineeringPipeGeometry(pipe, normalized)),
    };
}
export function rebuildEngineeringSystemsForEquipment(systems, equipmentId) {
    return {
        equipment: systems.equipment,
        pipes: systems.pipes.map((pipe) => {
            if (pipe.fromEquipmentId !== equipmentId && pipe.toEquipmentId !== equipmentId) {
                return pipe;
            }
            return rebuildEngineeringPipeGeometry(pipe, systems);
        }),
    };
}
export function getEngineeringEquipmentAtPoint(point, equipment, padding = 0) {
    const radians = (-normalizeEngineeringRotation(equipment.rotation) * Math.PI) / 180;
    const dx = point.x - equipment.x;
    const dy = point.y - equipment.y;
    const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
    const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
    return Math.abs(localX) <= equipment.width / 2 + padding && Math.abs(localY) <= equipment.height / 2 + padding;
}
export function findEngineeringPortAtPoint(point, equipment, tolerance = 0.22) {
    for (const item of equipment) {
        for (const port of item.ports) {
            const position = getEngineeringPortWorldPosition(item, port);
            if (Math.hypot(position.x - point.x, position.y - point.y) <= tolerance) {
                return { equipment: item, port, position };
            }
        }
    }
    return null;
}
/**
 * Точечное переопределение медиа-среды отдельных портов оборудования.
 * Используется для настройки портов теплообменника ГВС, водомера ХВС и т.п.
 */
function overridePortMediums(equipment, overrides) {
    return {
        ...equipment,
        ports: equipment.ports.map((port) => ({
            ...port,
            medium: overrides[port.id] ?? port.medium,
        })),
    };
}
export function createTypicalCtpEngineeringSystems(levelId, origin = { x: 0, y: 0 }) {
    const supplyHeader = createEngineeringEquipmentInstance("manifold", { x: origin.x + 0.8, y: origin.y + 0.2 }, {
        levelId,
        name: "Ввод теплосети",
        metadata: { template: "typical-ctp" },
    });
    const filter = createEngineeringEquipmentInstance("filter", { x: origin.x + 3.4, y: origin.y + 0.2 }, {
        levelId,
        name: "Грязевик",
        metadata: { template: "typical-ctp" },
    });
    const heatMeter = createEngineeringEquipmentInstance("heatMeter", { x: origin.x + 5.8, y: origin.y + 0.2 }, {
        levelId,
        name: "Узел учета тепла",
        metadata: { template: "typical-ctp" },
    });
    const controlValve = createEngineeringEquipmentInstance("controlValve", { x: origin.x + 8.2, y: origin.y + 0.2 }, {
        levelId,
        name: "Регулирующий клапан",
        metadata: { template: "typical-ctp" },
    });
    const heatingHx = createEngineeringEquipmentInstance("heatExchanger", { x: origin.x + 11.5, y: origin.y - 1.2 }, {
        levelId,
        name: "Теплообменник отопления",
        metadata: { template: "typical-ctp" },
    });
    const heatingPump = createEngineeringEquipmentInstance("pump", { x: origin.x + 14.7, y: origin.y - 1.2 }, {
        levelId,
        name: "Насос отопления",
        metadata: { template: "typical-ctp" },
    });
    const heatingHeader = createEngineeringEquipmentInstance("manifold", { x: origin.x + 17.7, y: origin.y - 1.2 }, {
        levelId,
        name: "Подача отопления",
        metadata: { template: "typical-ctp" },
    });
    const heatingReturn = overrideEquipmentPortMedium(createEngineeringEquipmentInstance("manifold", { x: origin.x + 17.7, y: origin.y + 2.8 }, {
        levelId,
        name: "Обратка отопления",
        rotation: 180,
        metadata: { template: "typical-ctp" },
    }), "return");
    const dhwHx = createEngineeringEquipmentInstance("heatExchanger", { x: origin.x + 11.5, y: origin.y + 2.4 }, {
        levelId,
        name: "Теплообменник ГВС",
        metadata: { template: "typical-ctp" },
    });
    const dhwPump = createEngineeringEquipmentInstance("pump", { x: origin.x + 14.7, y: origin.y + 2.4 }, {
        levelId,
        name: "Насос ГВС",
        metadata: { template: "typical-ctp" },
    });
    const expansionTank = createEngineeringEquipmentInstance("expansionTank", { x: origin.x + 14.7, y: origin.y + 5.4 }, {
        levelId,
        name: "Расширительный бак",
        metadata: { template: "typical-ctp" },
    });
    const automationCabinet = createEngineeringEquipmentInstance("automationCabinet", { x: origin.x + 20.8, y: origin.y + 0.8 }, {
        levelId,
        name: "Шкаф автоматики",
        metadata: { template: "typical-ctp" },
    });
    const returnHeader = overrideEquipmentPortMedium(createEngineeringEquipmentInstance("manifold", { x: origin.x + 3.4, y: origin.y + 6.2 }, {
        levelId,
        name: "Обратка теплосети",
        rotation: 180,
        metadata: { template: "typical-ctp" },
    }), "return");
    const equipment = [
        supplyHeader,
        filter,
        heatMeter,
        controlValve,
        heatingHx,
        heatingPump,
        heatingHeader,
        heatingReturn,
        dhwHx,
        dhwPump,
        expansionTank,
        automationCabinet,
        returnHeader,
    ];
    const pipeInputs = [
        [supplyHeader, "main-out", filter, "inlet"],
        [filter, "outlet", heatMeter, "inlet"],
        [heatMeter, "outlet", controlValve, "inlet"],
        [controlValve, "outlet", heatingHx, "primary-in"],
        [controlValve, "outlet", dhwHx, "primary-in"],
        [heatingHx, "primary-out", returnHeader, "main-in"],
        [dhwHx, "primary-out", returnHeader, "branch-1"],
        [heatingHx, "secondary-out", heatingPump, "inlet"],
        [heatingPump, "outlet", heatingHeader, "main-in"],
        [heatingReturn, "main-out", heatingHx, "secondary-in"],
        [heatingReturn, "branch-2", expansionTank, "connection"],
        [dhwHx, "secondary-out", dhwPump, "inlet"],
        [heatMeter, "signal", automationCabinet, "signal-1"],
        [controlValve, "signal", automationCabinet, "signal-2"],
    ];
    const pipes = pipeInputs
        .map(([fromEquipment, fromPortId, toEquipment, toPortId]) => createEngineeringPipeConnection({
        fromEquipment,
        fromPortId,
        toEquipment,
        toPortId,
        levelId,
        metadata: { template: "typical-ctp" },
    }))
        .filter((pipe) => Boolean(pipe));
    return { equipment, pipes };
}
/**
 * Одноступенчатая параллельная схема присоединения водоподогревателей ГВС
 * с зависимым присоединением систем отопления (по схеме из СП 41-101-95).
 *
 * Особенности схемы:
 *  - Зависимое присоединение отопления: теплоноситель из теплосети поступает
 *    в систему отопления напрямую через корректирующий подмешивающий насос
 *    (без теплообменника на контуре отопления).
 *  - Водоподогреватель ГВС присоединён параллельно контуру отопления к вводу
 *    теплосети (одноступенчатая параллельная схема).
 *  - Оборудование: теплосчётчик (9), грязевик, регулятор перепада давлений (4),
 *    регулирующий клапан отопления (6), корректирующий насос (8), обратные
 *    клапаны (7), водоподогреватель ГВС (1), насос ГВС (2), регулирующий
 *    клапан ГВС с электроприводом (3), водомер ХВС (5), датчики T/P (10/13),
 *    шкаф автоматики.
 */
export function createItpParallelDhwDependentHeating(levelId, origin = { x: 0, y: 0 }) {
    const template = "itp-parallel-dhw-dependent";
    // ── Ввод теплосети (подача) ──────────────────────────────────────────────
    const supplyHeader = createEngineeringEquipmentInstance("manifold", { x: origin.x + 0.8, y: origin.y }, { levelId, name: "Ввод теплосети (подача)", metadata: { template } });
    // Грязевик на подаче
    const filterSupply = createEngineeringEquipmentInstance("filter", { x: origin.x + 3.4, y: origin.y }, { levelId, name: "Грязевик", metadata: { template } });
    // Теплосчётчик (поз. 9)
    const heatMeter = createEngineeringEquipmentInstance("heatMeter", { x: origin.x + 6.0, y: origin.y }, { levelId, name: "Теплосчётчик", metadata: { template } });
    // Регулятор перепада давлений (поз. 4) — смоделирован как управляющий клапан
    const dpRegulator = createEngineeringEquipmentInstance("controlValve", { x: origin.x + 8.6, y: origin.y }, { levelId, name: "Рег. перепада давл.", metadata: { template } });
    // ── Контур отопления (зависимое присоединение) ───────────────────────────
    // Регулятор подачи теплоты на отопление (поз. 6)
    const heatingControlValve = createEngineeringEquipmentInstance("controlValve", { x: origin.x + 12.0, y: origin.y - 2.4 }, { levelId, name: "Рег. подачи теплоты (отопление)", metadata: { template } });
    // Подача в систему отопления
    const heatingSupplyHeader = createEngineeringEquipmentInstance("manifold", { x: origin.x + 17.8, y: origin.y - 2.4 }, { levelId, name: "Подача отопления", metadata: { template } });
    // Обратка из системы отопления
    const heatingReturnHeader = overrideEquipmentPortMedium(createEngineeringEquipmentInstance("manifold", { x: origin.x + 17.8, y: origin.y + 1.4 }, { levelId, name: "Обратка отопления", rotation: 180, metadata: { template } }), "return");
    // Корректирующий подмешивающий насос (поз. 8)
    const correctingPump = overridePortMediums(createEngineeringEquipmentInstance("pump", { x: origin.x + 14.5, y: origin.y + 1.4 }, { levelId, name: "Корректирующий насос", metadata: { template } }), { inlet: "return", outlet: "return" });
    // Обратный клапан на обратке отопления (поз. 7)
    const heatingCheckValve = overridePortMediums(createEngineeringEquipmentInstance("checkValve", { x: origin.x + 11.5, y: origin.y + 1.4 }, { levelId, name: "Обр. клапан (отопление)", metadata: { template } }), { inlet: "return", outlet: "return" });
    // ── Контур ГВС (одноступенчатая параллельная схема) ─────────────────────
    // Регулирующий клапан ГВС с электроприводом (поз. 3)
    const dhwControlValve = createEngineeringEquipmentInstance("controlValve", { x: origin.x + 12.0, y: origin.y + 3.2 }, { levelId, name: "Рег. клапан ГВС (с эл. приводом)", metadata: { template } });
    // Водоподогреватель ГВС (поз. 1) — первичная сторона от теплосети,
    // вторичная — от ХВС (холодная вода → ГВС)
    const dhwHeatExchanger = overridePortMediums(createEngineeringEquipmentInstance("heatExchanger", { x: origin.x + 15.0, y: origin.y + 3.2 }, { levelId, name: "Водоподогреватель ГВС", metadata: { template } }), { "secondary-out": "dhw", "secondary-in": "coldWater" });
    // Водомер холодной воды (поз. 5) — на вводе ХВС к водоподогревателю
    const coldWaterMeter = overridePortMediums(createEngineeringEquipmentInstance("heatMeter", { x: origin.x + 15.0, y: origin.y + 6.0 }, { levelId, name: "Водомер ХВС", metadata: { template }, parameters: { flowRateM3H: 4 } }), { inlet: "coldWater", outlet: "coldWater" });
    // Циркуляционный насос ГВС (поз. 2)
    const dhwPump = overridePortMediums(createEngineeringEquipmentInstance("pump", { x: origin.x + 18.2, y: origin.y + 3.2 }, { levelId, name: "Насос ГВС (циркуляционный)", metadata: { template } }), { inlet: "dhw", outlet: "dhw" });
    // Обратный клапан на выходе ГВС (поз. 7)
    const dhwCheckValve = overridePortMediums(createEngineeringEquipmentInstance("checkValve", { x: origin.x + 20.2, y: origin.y + 3.2 }, { levelId, name: "Обр. клапан ГВС", metadata: { template } }), { inlet: "dhw", outlet: "dhw" });
    // Выход в систему ГВС
    const dhwSupplyHeader = overridePortMediums(createEngineeringEquipmentInstance("manifold", { x: origin.x + 22.2, y: origin.y + 3.2 }, { levelId, name: "В систему ГВС", metadata: { template } }), { "main-in": "dhw", "main-out": "dhw", "branch-1": "dhw", "branch-2": "dhw", "branch-3": "dhw" });
    // ── Обратка теплосети ────────────────────────────────────────────────────
    // Сборный коллектор обраток (из отопления + первичной стороны ГВС)
    const returnJunction = overrideEquipmentPortMedium(createEngineeringEquipmentInstance("manifold", { x: origin.x + 8.6, y: origin.y + 6.0 }, { levelId, name: "Сбор обраток", rotation: 180, metadata: { template } }), "return");
    // Обратка теплосети
    const returnOutlet = overrideEquipmentPortMedium(createEngineeringEquipmentInstance("manifold", { x: origin.x + 0.8, y: origin.y + 6.0 }, { levelId, name: "Обратка теплосети", rotation: 180, metadata: { template } }), "return");
    // ── Автоматика и датчики ─────────────────────────────────────────────────
    const automationCabinet = createEngineeringEquipmentInstance("automationCabinet", { x: origin.x + 22.2, y: origin.y + 0.8 }, { levelId, name: "Шкаф автоматики", metadata: { template } });
    // Датчик температуры на вводе подачи (поз. 10)
    const sensorTempSupply = createEngineeringEquipmentInstance("sensorTemperature", { x: origin.x + 0.8, y: origin.y - 1.5 }, { levelId, name: "Датчик T подачи", metadata: { template } });
    // Датчик давления на вводе (поз. 13)
    const sensorPressureSupply = createEngineeringEquipmentInstance("sensorPressure", { x: origin.x + 3.4, y: origin.y - 1.5 }, { levelId, name: "Датчик P подачи", metadata: { template } });
    const equipment = [
        supplyHeader,
        filterSupply,
        heatMeter,
        dpRegulator,
        heatingControlValve,
        heatingSupplyHeader,
        heatingReturnHeader,
        correctingPump,
        heatingCheckValve,
        dhwControlValve,
        dhwHeatExchanger,
        coldWaterMeter,
        dhwPump,
        dhwCheckValve,
        dhwSupplyHeader,
        returnJunction,
        returnOutlet,
        automationCabinet,
        sensorTempSupply,
        sensorPressureSupply,
    ];
    const pipeInputs = [
        // Цепочка подачи теплосети
        [supplyHeader, "main-out", filterSupply, "inlet"],
        [filterSupply, "outlet", heatMeter, "inlet"],
        [heatMeter, "outlet", dpRegulator, "inlet"],
        // Параллельные ветви от регулятора перепада давлений
        [dpRegulator, "outlet", heatingControlValve, "inlet"], // ветвь отопления
        [dpRegulator, "outlet", dhwControlValve, "inlet"], // ветвь ГВС (параллельно)
        // Контур отопления (зависимое присоединение)
        [heatingControlValve, "outlet", heatingSupplyHeader, "main-in"],
        [heatingReturnHeader, "main-out", correctingPump, "inlet"],
        [correctingPump, "outlet", heatingCheckValve, "inlet"],
        [heatingCheckValve, "outlet", returnJunction, "main-in"],
        // Контур ГВС (водоподогреватель, первичная сторона — от теплосети)
        [dhwControlValve, "outlet", dhwHeatExchanger, "primary-in"],
        [dhwHeatExchanger, "primary-out", returnJunction, "branch-1"],
        // Контур ГВС (вторичная сторона — ХВС → ГВС)
        [coldWaterMeter, "outlet", dhwHeatExchanger, "secondary-in"],
        [dhwHeatExchanger, "secondary-out", dhwPump, "inlet"],
        [dhwPump, "outlet", dhwCheckValve, "inlet"],
        [dhwCheckValve, "outlet", dhwSupplyHeader, "main-in"],
        // Обратка теплосети
        [returnJunction, "main-out", returnOutlet, "main-in"],
        // Сигнальные связи с шкафом автоматики
        [heatMeter, "signal", automationCabinet, "signal-1"],
        [dpRegulator, "signal", automationCabinet, "signal-2"],
    ];
    const pipes = pipeInputs
        .map(([fromEquipment, fromPortId, toEquipment, toPortId]) => createEngineeringPipeConnection({
        fromEquipment,
        fromPortId,
        toEquipment,
        toPortId,
        levelId,
        metadata: { template },
    }))
        .filter((pipe) => Boolean(pipe));
    return { equipment, pipes };
}
