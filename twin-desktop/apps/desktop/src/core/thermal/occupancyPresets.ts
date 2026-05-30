import type { Sp50BuildingCategory } from "../../entities/geometry/types";
import type { ScenarioConfig } from "../../entities/workflow/workflow.store";
import { sp50InternalGainDensity_W_m2 } from "./sp50/energyCharacteristic";

/** Типовой суточный профиль занятости для RC-модели (доля 0…1). */
export type OccupancyPresetId =
  | "residential"
  | "office"
  | "public"
  | "education"
  | "medical"
  | "industrial"
  | "storage";

export type OccupancyPresetSelection = OccupancyPresetId | "custom";

export interface OccupancyPresetDefinition {
  id: OccupancyPresetId;
  label: string;
  dayFraction: number;
  nightFraction: number;
  /** Удельные теплопоступления при полной занятости, Вт/м². */
  dayGain_W_m2: number;
  nightGain_W_m2: number;
  /** Краткая ссылка на нормативную базу. */
  sp50Reference: string;
  description: string;
}

const BACKGROUND_GAIN_RATIO = 0.22;

function gainsFromSp50Category(category: Sp50BuildingCategory | null): { dayGain_W_m2: number; nightGain_W_m2: number } {
  const dayGain_W_m2 = sp50InternalGainDensity_W_m2(category);
  const nightGain_W_m2 = Math.max(1, Math.round(dayGain_W_m2 * BACKGROUND_GAIN_RATIO * 10) / 10);
  return { dayGain_W_m2, nightGain_W_m2 };
}

const RESIDENTIAL_GAINS = gainsFromSp50Category("residential");
const OFFICE_GAINS = gainsFromSp50Category("administrative");
const PUBLIC_GAINS = gainsFromSp50Category("public");
const EDUCATION_GAINS = gainsFromSp50Category("educational");
const MEDICAL_GAINS = gainsFromSp50Category("medical");
const INDUSTRIAL_GAINS = gainsFromSp50Category("industrialDry");
const STORAGE_GAINS = gainsFromSp50Category("storage");

export const OCCUPANCY_PRESETS: Record<OccupancyPresetId, OccupancyPresetDefinition> = {
  residential: {
    id: "residential",
    label: "Жилое",
    dayFraction: 1,
    nightFraction: 0.25,
    ...RESIDENTIAL_GAINS,
    sp50Reference: "СП 50.13330.2024, табл. Д.2; типовой суточный профиль жилых",
    description: "Вечерняя и выходная занятость выше, ночью остаются фоновые нагрузки и часть жильцов.",
  },
  office: {
    id: "office",
    label: "Офис / административное",
    dayFraction: 1,
    nightFraction: 0.05,
    ...OFFICE_GAINS,
    sp50Reference: "СП 50.13330.2024, табл. Д.2; будний дневной режим",
    description: "Основная активность в рабочие часы уставки «день», ночью — уборка и техника.",
  },
  public: {
    id: "public",
    label: "Общественное",
    dayFraction: 0.9,
    nightFraction: 0.2,
    ...PUBLIC_GAINS,
    sp50Reference: "СП 50.13330.2024, табл. Д.2; прерывистый режим посещения",
    description: "Пики посещаемости днём и в вечерние часы, ночью сниженная, но ненулевая доля.",
  },
  education: {
    id: "education",
    label: "Образование / детские",
    dayFraction: 1,
    nightFraction: 0.08,
    ...EDUCATION_GAINS,
    sp50Reference: "СП 50.13330.2024, табл. Д.2; учебный дневной цикл",
    description: "Занятость в часы уставки «день», ночью — дежурные системы и охрана.",
  },
  medical: {
    id: "medical",
    label: "Медицинское (круглосуточно)",
    dayFraction: 0.85,
    nightFraction: 0.55,
    ...MEDICAL_GAINS,
    sp50Reference: "СП 50.13330.2024, табл. Д.2; непрерывная эксплуатация",
    description: "Сниженная, но существенная ночная занятость персоналом и пациентами.",
  },
  industrial: {
    id: "industrial",
    label: "Производство / сельское",
    dayFraction: 0.75,
    nightFraction: 0.35,
    ...INDUSTRIAL_GAINS,
    sp50Reference: "СП 50.13330.2024, табл. Д.2; сменный или длительный режим",
    description: "Смены и технологическое оборудование повышают ночную долю относительно офиса.",
  },
  storage: {
    id: "storage",
    label: "Склад / низкая активность",
    dayFraction: 0.35,
    nightFraction: 0.1,
    ...STORAGE_GAINS,
    sp50Reference: "СП 50.13330.2024, табл. Д.2; эпизодическая эксплуатация",
    description: "Редкие визиты и фоновые системы; низкие доли занятости суток.",
  },
};

export const OCCUPANCY_PRESET_OPTIONS: Array<{ value: OccupancyPresetSelection; label: string }> = [
  ...Object.values(OCCUPANCY_PRESETS).map((preset) => ({ value: preset.id, label: preset.label })),
  { value: "custom", label: "Свои значения" },
];

export function getOccupancyPreset(id: OccupancyPresetId): OccupancyPresetDefinition {
  return OCCUPANCY_PRESETS[id];
}

export function occupancyPresetFromBuildingCategory(
  category: Sp50BuildingCategory | null | undefined
): OccupancyPresetId | null {
  if (!category) {
    return null;
  }
  switch (category) {
    case "residential":
      return "residential";
    case "administrative":
      return "office";
    case "public":
      return "public";
    case "educational":
    case "preschool":
      return "education";
    case "medical":
      return "medical";
    case "industrialDry":
    case "industrialWet":
    case "industrialHighHeat":
    case "agricultural":
      return "industrial";
    case "storage":
      return "storage";
    default:
      return "residential";
  }
}

export function applyOccupancyPresetToConfig(draft: ScenarioConfig, presetId: OccupancyPresetId): void {
  const preset = getOccupancyPreset(presetId);
  draft.occupancyPresetId = presetId;
  draft.occupancy = {
    dayFraction: preset.dayFraction,
    nightFraction: preset.nightFraction,
  };
  draft.internalGains = {
    dayGain_W_m2: preset.dayGain_W_m2,
    nightGain_W_m2: preset.nightGain_W_m2,
  };
}

export function markOccupancyAsCustom(draft: ScenarioConfig): void {
  draft.occupancyPresetId = "custom";
}

export function isOccupancyControlledByPreset(config: ScenarioConfig | null | undefined): boolean {
  const id = config?.occupancyPresetId;
  return id != null && id !== "custom";
}

const VALUE_EPS = 1e-4;

function valuesMatchPreset(config: ScenarioConfig, presetId: OccupancyPresetId): boolean {
  const preset = getOccupancyPreset(presetId);
  const { occupancy, internalGains } = config;
  return (
    Math.abs(occupancy.dayFraction - preset.dayFraction) <= VALUE_EPS &&
    Math.abs(occupancy.nightFraction - preset.nightFraction) <= VALUE_EPS &&
    Math.abs(internalGains.dayGain_W_m2 - preset.dayGain_W_m2) <= VALUE_EPS &&
    Math.abs(internalGains.nightGain_W_m2 - preset.nightGain_W_m2) <= VALUE_EPS
  );
}

export function inferOccupancyPresetFromValues(config: ScenarioConfig): OccupancyPresetId | "custom" {
  for (const preset of Object.values(OCCUPANCY_PRESETS)) {
    if (valuesMatchPreset(config, preset.id)) {
      return preset.id;
    }
  }
  return "custom";
}

export function resolveOccupancyPresetSelection(
  config: ScenarioConfig | null | undefined,
  resolved: ScenarioConfig
): OccupancyPresetSelection {
  const explicit = config?.occupancyPresetId;
  if (explicit === "custom") {
    return "custom";
  }
  if (explicit && explicit in OCCUPANCY_PRESETS) {
    return explicit;
  }
  return inferOccupancyPresetFromValues(resolved);
}

export function occupancyPresetReferenceLabel(selection: OccupancyPresetSelection): string | null {
  if (selection === "custom") {
    return null;
  }
  return getOccupancyPreset(selection).sp50Reference;
}
