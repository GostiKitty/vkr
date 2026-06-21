import type { BuildingModel } from "../../../entities/geometry/types";
import type { EngineeringEquipment, EngineeringEquipmentParameters, EngineeringEquipmentType, EngineeringPipe } from "../../../entities/engineering/types";
import {
  ENGINEERING_EQUIPMENT_LABELS,
  ENGINEERING_MEDIUM_LABELS,
} from "../engineering2d/catalog";

const ROTATION_OPTIONS = ["0", "90", "180", "270"].map((value) => ({ value, label: `${value}°` }));
const VALVE_STATE_OPTIONS = [
  { value: "open", label: "Открыт" },
  { value: "closed", label: "Закрыт" },
  { value: "regulating", label: "Регулируемый" },
];
const FIRE_DAMPER_STATE_OPTIONS = [
  { value: "open", label: "Открыт" },
  { value: "closed", label: "Закрыт" },
];
const FLOW_METER_VARIANT_OPTIONS = [
  { value: "electromagnetic", label: "Электромагнитный" },
  { value: "ultrasonic", label: "Ультразвуковой" },
  { value: "turbine", label: "Турбинный" },
  { value: "vortex", label: "Вихревой" },
];
const AIR_MEDIUM_OPTIONS = [
  { value: "airSupply", label: "Приток" },
  { value: "airExhaust", label: "Вытяжка" },
];

interface EngineeringEquipmentFormProps {
  equipment: EngineeringEquipment;
  onUpdateEngineeringEquipment: (equipmentId: string, patch: Partial<EngineeringEquipment>) => void;
}

interface EngineeringPipeFormProps {
  model: BuildingModel;
  pipe: EngineeringPipe;
  onUpdateEngineeringPipe: (pipeId: string, patch: Partial<EngineeringPipe>) => void;
}

function buildAirMediumEquipmentPatch(
  equipment: EngineeringEquipment,
  airMedium: "airSupply" | "airExhaust"
): Partial<EngineeringEquipment> {
  return {
    parameters: { ...equipment.parameters, airMedium },
    ports: equipment.ports.map((port) =>
      port.medium === "airSupply" || port.medium === "airExhaust" ? { ...port, medium: airMedium } : port
    ),
  };
}

export function EngineeringEquipmentForm({
  equipment,
  onUpdateEngineeringEquipment,
}: EngineeringEquipmentFormProps) {
  const updateParameters = (patch: EngineeringEquipmentParameters) => {
    onUpdateEngineeringEquipment(equipment.id, {
      parameters: { ...equipment.parameters, ...patch },
    });
  };

  return (
    <div className="space-y-3">
      <TextField
        label="Название"
        value={equipment.name}
        onChange={(value) => onUpdateEngineeringEquipment(equipment.id, { name: value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={equipment.x} step={0.1} onChange={(value) => onUpdateEngineeringEquipment(equipment.id, { x: value })} />
        <NumberField label="Y" value={equipment.y} step={0.1} onChange={(value) => onUpdateEngineeringEquipment(equipment.id, { y: value })} />
        <NumberField label="Ширина" value={equipment.width} step={0.1} onChange={(value) => onUpdateEngineeringEquipment(equipment.id, { width: value })} />
        <NumberField label="Высота" value={equipment.height} step={0.1} onChange={(value) => onUpdateEngineeringEquipment(equipment.id, { height: value })} />
      </div>
      <SelectField
        label="Поворот"
        value={String(equipment.rotation)}
        options={ROTATION_OPTIONS}
        onChange={(value) => onUpdateEngineeringEquipment(equipment.id, { rotation: Number(value) })}
      />
      <button
        type="button"
        onClick={() => onUpdateEngineeringEquipment(equipment.id, { rotation: ((equipment.rotation + 90) % 360) as number })}
        className="ui-btn-secondary w-full rounded-[12px] px-3 py-2 text-sm font-semibold"
      >
        Повернуть на 90°
      </button>
      <EngineeringEquipmentParameterFields
        equipment={equipment}
        onPatch={updateParameters}
        onUpdateEquipment={onUpdateEngineeringEquipment}
      />
    </div>
  );
}

function EngineeringEquipmentParameterFields({
  equipment,
  onPatch,
  onUpdateEquipment,
}: {
  equipment: EngineeringEquipment;
  onPatch: (patch: EngineeringEquipmentParameters) => void;
  onUpdateEquipment: (equipmentId: string, patch: Partial<EngineeringEquipment>) => void;
}) {
  switch (equipment.type) {
    case "pump":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход, м³/ч" value={toNumber(equipment.parameters.flowRateM3H)} step={0.1} onChange={(value) => onPatch({ flowRateM3H: value })} />
          <NumberField label="Напор, м" value={toNumber(equipment.parameters.headM)} step={0.1} onChange={(value) => onPatch({ headM: value })} />
          <NumberField label="Мощность, кВт" value={toNumber(equipment.parameters.powerKW)} step={0.1} onChange={(value) => onPatch({ powerKW: value })} />
          <NumberField label="КПД" value={toNumber(equipment.parameters.efficiency)} step={0.01} onChange={(value) => onPatch({ efficiency: value })} />
        </div>
      );
    case "heatExchanger":
      return (
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Тип теплообменника"
            value={String(equipment.parameters.heatExchangerVariant ?? "fixedStraight")}
            options={[
              { value: "fixedStraight", label: "с неподвижными трубными решетками при давлении в трубах и межтрубном пространстве выше атмосферного" },
              { value: "fixedLowIntertube", label: "Кожухотрубный (низкое межтрубное давление)" },
              { value: "fixedCompensator", label: "С температурным компенсатором" },
              { value: "floatingHead", label: "С плавающей головкой" },
              { value: "uTube", label: "С U-образными трубами" },
              { value: "packedGland", label: "С сальником" },
              { value: "vaporFloating", label: "С паровым пространством и плавающей головкой" },
              { value: "vaporUTube", label: "С паровым пространством и U-трубами" },
              { value: "coiledAtmospheric", label: "Витой (атмосферный)" },
            ]}
            onChange={(value) => {
              onPatch({ heatExchangerVariant: value });
              if (value === "fixedStraight") {
                // Этот вариант должен быть строго вертикальным как на ГОСТ-образце.
                onUpdateEquipment(equipment.id, { width: 1.4, height: 2.2, rotation: 0 });
              }
            }}
          />
          <NumberField label="Мощность, кВт" value={toNumber(equipment.parameters.powerKW)} step={1} onChange={(value) => onPatch({ powerKW: value })} />
          <NumberField label="Расход, м³/ч" value={toNumber(equipment.parameters.flowRateM3H)} step={0.1} onChange={(value) => onPatch({ flowRateM3H: value })} />
          <NumberField label="Первичный контур, °C" value={toNumber(equipment.parameters.primaryTemperatureC)} step={0.5} onChange={(value) => onPatch({ primaryTemperatureC: value })} />
          <NumberField label="Вторичный контур, °C" value={toNumber(equipment.parameters.secondaryTemperatureC)} step={0.5} onChange={(value) => onPatch({ secondaryTemperatureC: value })} />
          <NumberField label="Потери давления, кПа" value={toNumber(equipment.parameters.pressureDropKPa)} step={0.5} onChange={(value) => onPatch({ pressureDropKPa: value })} />
        </div>
      );
    case "valve":
    case "gateValve":
    case "ballValve":
    case "checkValve":
    case "threeWayValve":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <SelectField
            label="Состояние"
            value={String(equipment.parameters.state ?? "open")}
            options={VALVE_STATE_OPTIONS}
            onChange={(value) => onPatch({ state: value })}
          />
        </div>
      );
    case "controlValve":
    case "balancingValve":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <NumberField label="Kv" value={toNumber(equipment.parameters.kv)} step={0.1} onChange={(value) => onPatch({ kv: value })} />
          <SelectField
            label="Состояние"
            value={String(equipment.parameters.state ?? "open")}
            options={VALVE_STATE_OPTIONS}
            onChange={(value) => onPatch({ state: value })}
          />
        </div>
      );
    case "filter":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <NumberField label="Потери давления, кПа" value={toNumber(equipment.parameters.pressureDropKPa)} step={0.1} onChange={(value) => onPatch({ pressureDropKPa: value })} />
          <NumberField label="Загрязнение, %" value={toNumber(equipment.parameters.contaminationPercent)} step={1} onChange={(value) => onPatch({ contaminationPercent: value })} />
        </div>
      );
    case "expansionTank":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Объем, л" value={toNumber(equipment.parameters.volumeL)} step={1} onChange={(value) => onPatch({ volumeL: value })} />
          <NumberField label="Давление, бар" value={toNumber(equipment.parameters.pressureBar)} step={0.1} onChange={(value) => onPatch({ pressureBar: value })} />
        </div>
      );
    case "manifold":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <NumberField label="Отводов" value={toNumber(equipment.parameters.branchCount)} step={1} onChange={(value) => onPatch({ branchCount: value })} />
        </div>
      );
    case "heatMeter":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход, м³/ч" value={toNumber(equipment.parameters.flowRateM3H)} step={0.1} onChange={(value) => onPatch({ flowRateM3H: value })} />
          <NumberField label="Подача, °C" value={toNumber(equipment.parameters.supplyTemperatureC)} step={0.1} onChange={(value) => onPatch({ supplyTemperatureC: value })} />
          <NumberField label="Обратка, °C" value={toNumber(equipment.parameters.returnTemperatureC)} step={0.1} onChange={(value) => onPatch({ returnTemperatureC: value })} />
          <NumberField label="Тепловая мощность, кВт" value={toNumber(equipment.parameters.heatPowerKW)} step={0.5} onChange={(value) => onPatch({ heatPowerKW: value })} />
        </div>
      );
    case "pressureRegulator":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <NumberField label="Настройка, кПа" value={toNumber(equipment.parameters.setpointKPa)} step={0.5} onChange={(value) => onPatch({ setpointKPa: value })} />
        </div>
      );
    case "safetyValve":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <NumberField label="Давление срабатывания, бар" value={toNumber(equipment.parameters.setpressureBar)} step={0.1} onChange={(value) => onPatch({ setpressureBar: value })} />
        </div>
      );
    case "thermostaticValve":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <NumberField label="Уставка, °C" value={toNumber(equipment.parameters.setpointC)} step={0.5} onChange={(value) => onPatch({ setpointC: value })} />
        </div>
      );
    case "flowMeter":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Диаметр, мм" value={toNumber(equipment.parameters.diameterMm)} step={1} onChange={(value) => onPatch({ diameterMm: value })} />
          <NumberField label="Расход, м³/ч" value={toNumber(equipment.parameters.flowRateM3H)} step={0.1} onChange={(value) => onPatch({ flowRateM3H: value })} />
          <SelectField
            label="Тип"
            value={String(equipment.parameters.variant ?? "electromagnetic")}
            options={FLOW_METER_VARIANT_OPTIONS}
            onChange={(value) => onPatch({ variant: value })}
          />
        </div>
      );
    case "convector":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Мощность, Вт" value={toNumber(equipment.parameters.nominalPowerW)} step={50} onChange={(value) => onPatch({ nominalPowerW: value })} />
          <NumberField label="Температура, °C" value={toNumber(equipment.parameters.designTemperatureC)} step={0.5} onChange={(value) => onPatch({ designTemperatureC: value })} />
          <NumberField label="Расход, м³/ч" value={toNumber(equipment.parameters.flowRateM3H)} step={0.1} onChange={(value) => onPatch({ flowRateM3H: value })} />
        </div>
      );
    case "airHandlingUnit":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Рекуперация" value={toNumber(equipment.parameters.heatRecoveryEfficiency)} step={0.01} onChange={(value) => onPatch({ heatRecoveryEfficiency: value })} />
          <NumberField label="Температура притока, °C" value={toNumber(equipment.parameters.supplyTemperatureC)} step={0.5} onChange={(value) => onPatch({ supplyTemperatureC: value })} />
          <NumberField label="Расп. давление, Па" value={toNumber(equipment.parameters.pressurePa)} step={10} onChange={(value) => onPatch({ pressurePa: value })} />
          <NumberField label="Мощность, кВт" value={toNumber(equipment.parameters.powerKW)} step={0.1} onChange={(value) => onPatch({ powerKW: value })} />
        </div>
      );
    case "ductFan":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Давление, Па" value={toNumber(equipment.parameters.pressurePa)} step={10} onChange={(value) => onPatch({ pressurePa: value })} />
          <NumberField label="Мощность, кВт" value={toNumber(equipment.parameters.powerKW)} step={0.1} onChange={(value) => onPatch({ powerKW: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "roofFan":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Р Р°СЃС…РѕРґ РІРѕР·РґСѓС…Р°, РјВі/С‡" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Р”Р°РІР»РµРЅРёРµ, РџР°" value={toNumber(equipment.parameters.pressurePa)} step={10} onChange={(value) => onPatch({ pressurePa: value })} />
          <NumberField label="РњРѕС‰РЅРѕСЃС‚СЊ, РєР’С‚" value={toNumber(equipment.parameters.powerKW)} step={0.1} onChange={(value) => onPatch({ powerKW: value })} />
          <SelectField
            label="РЎСЂРµРґР°"
            value={String(equipment.parameters.airMedium ?? "airExhaust")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airDamper":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Ширина, мм" value={toNumber(equipment.parameters.sectionWidthMm)} step={10} onChange={(value) => onPatch({ sectionWidthMm: value })} />
          <NumberField label="Высота, мм" value={toNumber(equipment.parameters.sectionHeightMm)} step={10} onChange={(value) => onPatch({ sectionHeightMm: value })} />
          <SelectField
            label="Состояние"
            value={String(equipment.parameters.state ?? "open")}
            options={VALVE_STATE_OPTIONS}
            onChange={(value) => onPatch({ state: value })}
          />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airCheckValve":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="РЁРёСЂРёРЅР°, РјРј" value={toNumber(equipment.parameters.sectionWidthMm)} step={10} onChange={(value) => onPatch({ sectionWidthMm: value })} />
          <NumberField label="Р’С‹СЃРѕС‚Р°, РјРј" value={toNumber(equipment.parameters.sectionHeightMm)} step={10} onChange={(value) => onPatch({ sectionHeightMm: value })} />
          <SelectField
            label="РЎРѕСЃС‚РѕСЏРЅРёРµ"
            value={String(equipment.parameters.state ?? "open")}
            options={FIRE_DAMPER_STATE_OPTIONS}
            onChange={(value) => onPatch({ state: value })}
          />
          <NumberField label="РџРѕС‚РµСЂРё РґР°РІР»РµРЅРёСЏ, РџР°" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="РЎСЂРµРґР°"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "fireDamper":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Ширина, мм" value={toNumber(equipment.parameters.sectionWidthMm)} step={10} onChange={(value) => onPatch({ sectionWidthMm: value })} />
          <NumberField label="Высота, мм" value={toNumber(equipment.parameters.sectionHeightMm)} step={10} onChange={(value) => onPatch({ sectionHeightMm: value })} />
          <SelectField
            label="Состояние"
            value={String(equipment.parameters.state ?? "open")}
            options={FIRE_DAMPER_STATE_OPTIONS}
            onChange={(value) => onPatch({ state: value })}
          />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airFilter":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Ширина, мм" value={toNumber(equipment.parameters.sectionWidthMm)} step={10} onChange={(value) => onPatch({ sectionWidthMm: value })} />
          <NumberField label="Высота, мм" value={toNumber(equipment.parameters.sectionHeightMm)} step={10} onChange={(value) => onPatch({ sectionHeightMm: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <NumberField label="Загрязнение, %" value={toNumber(equipment.parameters.contaminationPercent)} step={5} onChange={(value) => onPatch({ contaminationPercent: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airFlowRegulatorConst":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Ширина, мм" value={toNumber(equipment.parameters.sectionWidthMm)} step={10} onChange={(value) => onPatch({ sectionWidthMm: value })} />
          <NumberField label="Высота, мм" value={toNumber(equipment.parameters.sectionHeightMm)} step={10} onChange={(value) => onPatch({ sectionHeightMm: value })} />
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airFlowRegulatorVar":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Ширина, мм" value={toNumber(equipment.parameters.sectionWidthMm)} step={10} onChange={(value) => onPatch({ sectionWidthMm: value })} />
          <NumberField label="Высота, мм" value={toNumber(equipment.parameters.sectionHeightMm)} step={10} onChange={(value) => onPatch({ sectionHeightMm: value })} />
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Положение, %" value={toNumber(equipment.parameters.damperPositionPercent)} step={5} onChange={(value) => onPatch({ damperPositionPercent: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "silencer":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Ширина, мм" value={toNumber(equipment.parameters.sectionWidthMm)} step={10} onChange={(value) => onPatch({ sectionWidthMm: value })} />
          <NumberField label="Высота, мм" value={toNumber(equipment.parameters.sectionHeightMm)} step={10} onChange={(value) => onPatch({ sectionHeightMm: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airHeater":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Мощность, кВт" value={toNumber(equipment.parameters.powerKW)} step={0.1} onChange={(value) => onPatch({ powerKW: value })} />
          <NumberField label="Температура притока, °C" value={toNumber(equipment.parameters.supplyTemperatureC)} step={0.5} onChange={(value) => onPatch({ supplyTemperatureC: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airCooler":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Холодопроизводительность, кВт" value={toNumber(equipment.parameters.coolingPowerKW)} step={0.1} onChange={(value) => onPatch({ coolingPowerKW: value })} />
          <NumberField label="Температура притока, °C" value={toNumber(equipment.parameters.supplyTemperatureC)} step={0.5} onChange={(value) => onPatch({ supplyTemperatureC: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airHumidifier":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Производительность, кг/ч" value={toNumber(equipment.parameters.humidificationCapacityKgH)} step={0.5} onChange={(value) => onPatch({ humidificationCapacityKgH: value })} />
          <NumberField label="Мощность, кВт" value={toNumber(equipment.parameters.powerKW)} step={0.1} onChange={(value) => onPatch({ powerKW: value })} />
          <NumberField label="Температура притока, °C" value={toNumber(equipment.parameters.supplyTemperatureC)} step={0.5} onChange={(value) => onPatch({ supplyTemperatureC: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "airDehumidifier":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Осушение, кг/ч" value={toNumber(equipment.parameters.moistureRemovalKgH)} step={0.5} onChange={(value) => onPatch({ moistureRemovalKgH: value })} />
          <NumberField label="Мощность, кВт" value={toNumber(equipment.parameters.powerKW)} step={0.1} onChange={(value) => onPatch({ powerKW: value })} />
          <NumberField label="Температура притока, °C" value={toNumber(equipment.parameters.supplyTemperatureC)} step={0.5} onChange={(value) => onPatch({ supplyTemperatureC: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
          <SelectField
            label="Среда"
            value={String(equipment.parameters.airMedium ?? "airSupply")}
            options={AIR_MEDIUM_OPTIONS}
            onChange={(value) => onUpdateEquipment(equipment.id, buildAirMediumEquipmentPatch(equipment, value as "airSupply" | "airExhaust"))}
          />
        </div>
      );
    case "supplyDiffuser":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Температура притока, °C" value={toNumber(equipment.parameters.supplyTemperatureC)} step={0.5} onChange={(value) => onPatch({ supplyTemperatureC: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
        </div>
      );
    case "exhaustGrille":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Расход воздуха, м³/ч" value={toNumber(equipment.parameters.airflowM3H)} step={10} onChange={(value) => onPatch({ airflowM3H: value })} />
          <NumberField label="Потери давления, Па" value={toNumber(equipment.parameters.pressureDropPa)} step={5} onChange={(value) => onPatch({ pressureDropPa: value })} />
        </div>
      );
    case "automationCabinet":
      return (
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Напряжение, В" value={toNumber(equipment.parameters.voltageV)} step={1} onChange={(value) => onPatch({ voltageV: value })} />
          <NumberField label="Каналы" value={toNumber(equipment.parameters.signalChannels)} step={1} onChange={(value) => onPatch({ signalChannels: value })} />
        </div>
      );
    case "sensorTemperature":
      return <NumberField label="Температура, °C" value={toNumber(equipment.parameters.measuredValueC)} step={0.1} onChange={(value) => onPatch({ measuredValueC: value })} />;
    case "sensorPressure":
      return <NumberField label="Давление, бар" value={toNumber(equipment.parameters.measuredValueBar)} step={0.1} onChange={(value) => onPatch({ measuredValueBar: value })} />;
    case "sensorFlow":
      return <NumberField label="Расход, м³/ч" value={toNumber(equipment.parameters.flowRateM3H)} step={0.1} onChange={(value) => onPatch({ flowRateM3H: value })} />;
    case "sensorHumidity":
      return <NumberField label="Влажность, %" value={toNumber(equipment.parameters.relativeHumidityPercent)} step={1} onChange={(value) => onPatch({ relativeHumidityPercent: value })} />;
    default:
      return null;
  }
}

export function EngineeringPipeForm({
  model,
  pipe,
  onUpdateEngineeringPipe,
}: EngineeringPipeFormProps) {
  const equipmentLookup = new Map((model.engineeringSystems?.equipment ?? []).map((item) => [item.id, item]));
  const fromEquipment = equipmentLookup.get(pipe.fromEquipmentId);
  const toEquipment = equipmentLookup.get(pipe.toEquipmentId);
  return (
    <div className="space-y-3">
      <InfoCard
        rows={[
          { label: "От", value: fromEquipment?.name ?? pipe.fromEquipmentId },
          { label: "До", value: toEquipment?.name ?? pipe.toEquipmentId },
          { label: "Точек", value: String(pipe.points.length) },
        ]}
      />
      <SelectField
        label="Среда"
        value={pipe.medium}
        options={Object.entries(ENGINEERING_MEDIUM_LABELS).map(([value, label]) => ({ value, label }))}
        onChange={(value) => onUpdateEngineeringPipe(pipe.id, { medium: value as EngineeringPipe["medium"] })}
      />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Диаметр, мм" value={pipe.diameter} step={1} onChange={(value) => onUpdateEngineeringPipe(pipe.id, { diameter: value })} />
        <NumberField label="Изоляция, мм" value={pipe.insulation} step={1} onChange={(value) => onUpdateEngineeringPipe(pipe.id, { insulation: value })} />
        <NumberField label="Температура, °C" value={pipe.temperature ?? 0} step={0.5} onChange={(value) => onUpdateEngineeringPipe(pipe.id, { temperature: value })} />
        <NumberField label="Расход" value={pipe.flowRate ?? 0} step={0.1} onChange={(value) => onUpdateEngineeringPipe(pipe.id, { flowRate: value })} />
      </div>
      <HintCard text="Трасса трубопровода пересчитывается автоматически при повороте и перемещении подключенного оборудования." />
    </div>
  );
}

export function EngineeringDraftCard({
  tool,
  equipmentType,
}: {
  tool: "engineeringEquipment" | "engineeringPipe";
  equipmentType: EngineeringEquipmentType;
}) {
  if (tool === "engineeringPipe") {
    return (
      <div className="space-y-3">
        <InfoCard rows={[{ label: "Режим", value: "Соединение порт-к-порту" }]} />
        <HintCard text="Кликните по порту первого элемента, затем по порту второго. Маршрут построится автоматически с ортогональными коленами." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InfoCard
        rows={[
          { label: "Тип", value: ENGINEERING_EQUIPMENT_LABELS[equipmentType] },
          { label: "Размещение", value: "Клик по плану" },
        ]}
      />
      <HintCard text="Блок будет привязан к сетке, если шаг сетки включен. После установки можно перемещать, удалять и поворачивать на 90°." />
    </div>
  );
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
}) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-soft)]">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
        className="ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]"
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-soft)]">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-soft)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoCard({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="ui-panel-muted rounded-[16px] p-3 text-xs text-[color:var(--text-muted)]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
          <span className="uppercase tracking-wide text-[color:var(--text-soft)]">{row.label}</span>
          <span className="text-right font-semibold text-[color:var(--text-base)]">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function HintCard({ text }: { text: string }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--info-border)] bg-[color:var(--info-bg)] px-3 py-3 text-sm text-[color:var(--text-muted)]">
      {text}
    </div>
  );
}
