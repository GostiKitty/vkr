import { create } from "zustand";

export type ExpertiseExportMode = "strict-expertise" | "demo" | "vkr-brief";
export type SolarGainsMode = "auto-if-available" | "manual" | "omit";
export type MissingDataHandlingMode = "clarify" | "hide" | "require";
export type ExpertiseYesNo = "" | "yes" | "no";

export interface ExpertiseReportInputs {
  projectName: string;
  objectAddress: string;
  projectCipher: string;
  documentStage: string;
  issueCity: string;
  issueYear: string;
  customerOrg: string;
  developerOrg: string;
  developedBy: string;
  checkedBy: string;
  normControl: string;
  chiefEngineer: string;
  designBasis: string;
  contractNumber: string;
  buildingPurpose: string;
  functionalClass: string;
  floorsCount: string;
  heatedArea: string;
  heatedVolume: string;
  operationMode: string;
  roomsCount: string;
  modelNote: string;
  modelVersion: string;
  climateCity: string;
  outdoorDesignTemperatureC: string;
  outdoorHeatingAverageC: string;
  heatingDurationDays: string;
  gsop: string;
  humidityZone: string;
  operationCondition: string;
  indoorDesignTemperatureC: string;
  indoorRelativeHumidityPercent: string;
  ventilationAch: string;
  infiltrationAch: string;
  mechanicalVentilation: ExpertiseYesNo;
  heatRecoveryEfficiencyPercent: string;
  daySetpointC: string;
  nightSetpointC: string;
  calculationScenario: string;
  internalGains: string;
  solarGainsMode: SolarGainsMode;
  solarGainsManualValue: string;
  operationOrg: string;
  journalName: string;
  inspectionFrequency: string;
  temperatureControlRule: string;
  operationResponsible: string;
  operationNotes: string;
  exportMode: ExpertiseExportMode;
  showAssumptionsBlock: boolean;
  showTechnicalIdsInAppendix: boolean;
  showIncompleteFields: boolean;
  handleMissingDataMode: MissingDataHandlingMode;
}

export type ExpertiseInputKey = keyof ExpertiseReportInputs;

export interface ExpertiseInputFieldOption {
  value: string;
  label: string;
}

export interface ExpertiseInputFieldDefinition {
  key: ExpertiseInputKey;
  label: string;
  kind: "text" | "textarea" | "select" | "toggle";
  placeholder?: string;
  options?: ExpertiseInputFieldOption[];
  helpText?: string;
}

export interface ExpertiseInputSectionDefinition {
  id: string;
  title: string;
  fields: ExpertiseInputFieldDefinition[];
}

export const DEFAULT_EXPERTISE_REPORT_INPUTS: ExpertiseReportInputs = {
  projectName: "",
  objectAddress: "",
  projectCipher: "",
  documentStage: "",
  issueCity: "",
  issueYear: "",
  customerOrg: "",
  developerOrg: "",
  developedBy: "",
  checkedBy: "",
  normControl: "",
  chiefEngineer: "",
  designBasis: "",
  contractNumber: "",
  buildingPurpose: "",
  functionalClass: "",
  floorsCount: "",
  heatedArea: "",
  heatedVolume: "",
  operationMode: "",
  roomsCount: "",
  modelNote: "",
  modelVersion: "",
  climateCity: "",
  outdoorDesignTemperatureC: "",
  outdoorHeatingAverageC: "",
  heatingDurationDays: "",
  gsop: "",
  humidityZone: "",
  operationCondition: "",
  indoorDesignTemperatureC: "",
  indoorRelativeHumidityPercent: "",
  ventilationAch: "",
  infiltrationAch: "",
  mechanicalVentilation: "",
  heatRecoveryEfficiencyPercent: "",
  daySetpointC: "",
  nightSetpointC: "",
  calculationScenario: "",
  internalGains: "",
  solarGainsMode: "auto-if-available",
  solarGainsManualValue: "",
  operationOrg: "",
  journalName: "",
  inspectionFrequency: "",
  temperatureControlRule: "",
  operationResponsible: "",
  operationNotes: "",
  exportMode: "demo",
  showAssumptionsBlock: true,
  showTechnicalIdsInAppendix: true,
  showIncompleteFields: true,
  handleMissingDataMode: "clarify",
};

export const EXPERTISE_INPUT_SECTIONS: ExpertiseInputSectionDefinition[] = [
  {
    id: "project",
    title: "А. Реквизиты проекта",
    fields: [
      { key: "projectName", label: "Наименование объекта", kind: "text" },
      { key: "objectAddress", label: "Адрес объекта", kind: "text" },
      { key: "projectCipher", label: "Шифр проекта", kind: "text" },
      { key: "documentStage", label: "Стадия проектирования", kind: "text", placeholder: "П" },
      { key: "issueCity", label: "Город выпуска", kind: "text" },
      { key: "issueYear", label: "Год выпуска", kind: "text", placeholder: "2026" },
      { key: "customerOrg", label: "Заказчик", kind: "text" },
      { key: "developerOrg", label: "Проектная организация / разработчик", kind: "text" },
      { key: "developedBy", label: "Разработал", kind: "text" },
      { key: "checkedBy", label: "Проверил", kind: "text" },
      { key: "normControl", label: "Нормоконтроль", kind: "text" },
      { key: "chiefEngineer", label: "ГИП", kind: "text" },
      { key: "designBasis", label: "Основание для проектирования", kind: "textarea" },
      { key: "contractNumber", label: "Номер договора / задания", kind: "text" },
    ],
  },
  {
    id: "building",
    title: "Б. Назначение и характеристики здания",
    fields: [
      { key: "buildingPurpose", label: "Назначение здания", kind: "text" },
      { key: "functionalClass", label: "Класс функциональной пожарной опасности", kind: "text" },
      { key: "floorsCount", label: "Этажность", kind: "text" },
      { key: "heatedArea", label: "Отапливаемая площадь", kind: "text" },
      { key: "heatedVolume", label: "Отапливаемый объём", kind: "text" },
      { key: "operationMode", label: "Режим эксплуатации", kind: "text" },
      { key: "roomsCount", label: "Количество помещений", kind: "text" },
      { key: "modelNote", label: "Примечание к цифровой модели", kind: "textarea" },
      {
        key: "modelVersion",
        label: "Версия расчётной модели",
        kind: "text",
        placeholder: "текущая версия цифровой модели",
      },
    ],
  },
  {
    id: "climate",
    title: "В. Климатические условия",
    fields: [
      { key: "climateCity", label: "Город / климатическая база", kind: "text" },
      { key: "outdoorDesignTemperatureC", label: "Расчётная наружная температура для отопления", kind: "text" },
      { key: "outdoorHeatingAverageC", label: "Средняя температура отопительного периода", kind: "text" },
      { key: "heatingDurationDays", label: "Продолжительность отопительного периода", kind: "text" },
      { key: "gsop", label: "ГСОП", kind: "text" },
      { key: "humidityZone", label: "Зона влажности", kind: "text" },
      { key: "operationCondition", label: "Условия эксплуатации по СП 50", kind: "text", placeholder: "Б" },
      { key: "indoorDesignTemperatureC", label: "Внутренняя температура", kind: "text" },
      { key: "indoorRelativeHumidityPercent", label: "Относительная влажность", kind: "text" },
    ],
  },
  {
    id: "engineering",
    title: "Г. Инженерные условия",
    fields: [
      { key: "ventilationAch", label: "Расчётная кратность вентиляции", kind: "text" },
      { key: "infiltrationAch", label: "Расчётная кратность инфильтрации", kind: "text" },
      {
        key: "mechanicalVentilation",
        label: "Наличие механической вентиляции",
        kind: "select",
        options: [
          { value: "", label: "не выбрано" },
          { value: "yes", label: "да" },
          { value: "no", label: "нет" },
        ],
      },
      { key: "heatRecoveryEfficiencyPercent", label: "Коэффициент рекуперации, %", kind: "text" },
      { key: "daySetpointC", label: "Дневная уставка температуры", kind: "text" },
      { key: "nightSetpointC", label: "Ночная уставка температуры", kind: "text" },
      { key: "calculationScenario", label: "Расчётный сценарий", kind: "text" },
      { key: "internalGains", label: "Внутренние теплопоступления", kind: "text" },
      {
        key: "solarGainsMode",
        label: "Солнечные теплопоступления",
        kind: "select",
        options: [
          { value: "auto-if-available", label: "Автоматически, если расчёт доступен" },
          { value: "manual", label: "Задать вручную" },
          { value: "omit", label: "Не учитывать, требуется уточнение" },
        ],
      },
      {
        key: "solarGainsManualValue",
        label: "qrad вручную",
        kind: "text",
        placeholder: "Вт/(м³·К)",
      },
    ],
  },
  {
    id: "operation",
    title: "Д. Эксплуатационный паспорт",
    fields: [
      { key: "operationOrg", label: "Эксплуатирующая организация", kind: "text" },
      { key: "journalName", label: "Журнал эксплуатации", kind: "text" },
      { key: "inspectionFrequency", label: "Периодичность осмотров", kind: "text" },
      { key: "temperatureControlRule", label: "Контроль температурного режима", kind: "textarea" },
      { key: "operationResponsible", label: "Ответственный за эксплуатацию", kind: "text" },
      { key: "operationNotes", label: "Примечания по эксплуатации", kind: "textarea" },
    ],
  },
  {
    id: "mode",
    title: "Е. Экспертный режим вывода",
    fields: [
      {
        key: "exportMode",
        label: "Режим комплекта",
        kind: "select",
        options: [
          { value: "strict-expertise", label: "Строгий комплект для экспертизы" },
          { value: "demo", label: "Демонстрационный комплект" },
          { value: "vkr-brief", label: "Краткий комплект для ВКР" },
        ],
      },
      { key: "showAssumptionsBlock", label: "Показывать блок проектных допущений", kind: "toggle" },
      { key: "showTechnicalIdsInAppendix", label: "Показывать технические ID в приложениях", kind: "toggle" },
      { key: "showIncompleteFields", label: "Показывать неполные поля", kind: "toggle" },
      {
        key: "handleMissingDataMode",
        label: "Если данных нет",
        kind: "select",
        options: [
          { value: "clarify", label: "показывать «требует уточнения»" },
          { value: "hide", label: "скрывать строку" },
          { value: "require", label: "требовать заполнения перед выгрузкой" },
        ],
      },
    ],
  },
];

const STORAGE_KEY = "twin-desktop.expertise-report-inputs";

function sanitizeLoadedInputs(
  candidate: Partial<ExpertiseReportInputs> | null | undefined
): ExpertiseReportInputs {
  return {
    ...DEFAULT_EXPERTISE_REPORT_INPUTS,
    ...candidate,
    solarGainsMode:
      candidate?.solarGainsMode === "manual" || candidate?.solarGainsMode === "omit"
        ? candidate.solarGainsMode
        : "auto-if-available",
    mechanicalVentilation:
      candidate?.mechanicalVentilation === "yes" || candidate?.mechanicalVentilation === "no"
        ? candidate.mechanicalVentilation
        : "",
    exportMode:
      candidate?.exportMode === "strict-expertise" ||
      candidate?.exportMode === "vkr-brief"
        ? candidate.exportMode
        : "demo",
    handleMissingDataMode:
      candidate?.handleMissingDataMode === "hide" ||
      candidate?.handleMissingDataMode === "require"
        ? candidate.handleMissingDataMode
        : "clarify",
    showAssumptionsBlock: candidate?.showAssumptionsBlock ?? true,
    showTechnicalIdsInAppendix: candidate?.showTechnicalIdsInAppendix ?? true,
    showIncompleteFields: candidate?.showIncompleteFields ?? true,
  };
}

export function loadExpertiseInputs(projectKey: string): ExpertiseReportInputs {
  if (typeof window === "undefined" || !projectKey) {
    return { ...DEFAULT_EXPERTISE_REPORT_INPUTS };
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${projectKey}`);
    if (!raw) {
      return { ...DEFAULT_EXPERTISE_REPORT_INPUTS };
    }
    return sanitizeLoadedInputs(JSON.parse(raw) as Partial<ExpertiseReportInputs>);
  } catch {
    return { ...DEFAULT_EXPERTISE_REPORT_INPUTS };
  }
}

export function saveExpertiseInputs(
  projectKey: string,
  inputs: ExpertiseReportInputs
): void {
  if (typeof window === "undefined" || !projectKey) {
    return;
  }
  try {
    window.localStorage.setItem(
      `${STORAGE_KEY}:${projectKey}`,
      JSON.stringify(inputs)
    );
  } catch {
    // ignore quota/privacy failures
  }
}

interface ExpertiseInputsState {
  isPanelOpen: boolean;
  completenessSummaryOpen: boolean;
  inputsByProject: Record<string, ExpertiseReportInputs>;
  openPanel: () => void;
  closePanel: () => void;
  openCompletenessSummary: () => void;
  closeCompletenessSummary: () => void;
  getInputs: (projectKey: string) => ExpertiseReportInputs;
  hydrateProject: (projectKey: string) => void;
  setField: <K extends ExpertiseInputKey>(
    projectKey: string,
    key: K,
    value: ExpertiseReportInputs[K]
  ) => void;
  replaceInputs: (projectKey: string, next: ExpertiseReportInputs) => void;
  resetProject: (projectKey: string) => void;
}

export const useExpertiseInputsStore = create<ExpertiseInputsState>((set, get) => ({
  isPanelOpen: false,
  completenessSummaryOpen: false,
  inputsByProject: {},
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  openCompletenessSummary: () => set({ completenessSummaryOpen: true }),
  closeCompletenessSummary: () => set({ completenessSummaryOpen: false }),
  getInputs: (projectKey) => {
    const existing = get().inputsByProject[projectKey];
    return existing ? { ...existing } : loadExpertiseInputs(projectKey);
  },
  hydrateProject: (projectKey) =>
    set((state) => ({
      inputsByProject: {
        ...state.inputsByProject,
        [projectKey]: state.inputsByProject[projectKey] ?? loadExpertiseInputs(projectKey),
      },
    })),
  setField: (projectKey, key, value) =>
    set((state) => {
      const current = state.inputsByProject[projectKey] ?? loadExpertiseInputs(projectKey);
      const next = { ...current, [key]: value } as ExpertiseReportInputs;
      saveExpertiseInputs(projectKey, next);
      return {
        inputsByProject: {
          ...state.inputsByProject,
          [projectKey]: next,
        },
      };
    }),
  replaceInputs: (projectKey, next) =>
    set((state) => {
      saveExpertiseInputs(projectKey, next);
      return {
        inputsByProject: {
          ...state.inputsByProject,
          [projectKey]: { ...next },
        },
      };
    }),
  resetProject: (projectKey) =>
    set((state) => {
      const next = { ...DEFAULT_EXPERTISE_REPORT_INPUTS };
      saveExpertiseInputs(projectKey, next);
      return {
        inputsByProject: {
          ...state.inputsByProject,
          [projectKey]: next,
        },
      };
    }),
}));
