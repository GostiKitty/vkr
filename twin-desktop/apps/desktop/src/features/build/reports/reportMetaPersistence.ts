export interface ReportMeta {
  projectCipher: string;
  buildingAddress: string;
  developerOrg: string;
  customerOrg: string;
  documentStage: string;
  /** Раздел ПД по ПП РФ № 87 (куда включается расчёт). */
  projectSection: string;
  /** Город на титульном листе (если пусто — из адреса объекта). */
  documentCity: string;
}

export const DEFAULT_REPORT_META: ReportMeta = {
  projectCipher: "",
  buildingAddress: "",
  developerOrg: "",
  customerOrg: "",
  documentStage: "проектная документация",
  projectSection:
    "Раздел 5. Сведения об инженерном оборудовании — подраздел «Отопление, вентиляция и кондиционирование воздуха, тепловые сети»",
  documentCity: "",
};

const STORAGE_KEY = "twin-desktop.expertise-report-meta";

export function loadReportMeta(projectKey: string): ReportMeta {
  if (typeof window === "undefined" || !projectKey) {
    return { ...DEFAULT_REPORT_META };
  }
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY}:${projectKey}`);
    if (!raw) {
      return { ...DEFAULT_REPORT_META };
    }
    const parsed = JSON.parse(raw) as Partial<ReportMeta>;
    return {
      projectCipher: parsed.projectCipher ?? "",
      buildingAddress: parsed.buildingAddress ?? "",
      developerOrg: parsed.developerOrg ?? "",
      customerOrg: parsed.customerOrg ?? "",
      documentStage: parsed.documentStage ?? DEFAULT_REPORT_META.documentStage,
      projectSection: parsed.projectSection ?? DEFAULT_REPORT_META.projectSection,
      documentCity: parsed.documentCity ?? "",
    };
  } catch {
    return { ...DEFAULT_REPORT_META };
  }
}

export function saveReportMeta(projectKey: string, meta: ReportMeta): void {
  if (typeof window === "undefined" || !projectKey) {
    return;
  }
  try {
    window.localStorage.setItem(`${STORAGE_KEY}:${projectKey}`, JSON.stringify(meta));
  } catch {
    // Ignore quota / privacy errors.
  }
}
