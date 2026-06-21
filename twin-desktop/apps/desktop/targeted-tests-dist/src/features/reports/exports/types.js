/**
 * Типы единой системы выгрузки документов.
 *
 * НЕ ВЛИЯЮТ на расчётное ядро, BuildingModel, 3D, Monte Carlo и физику.
 * Это слой подготовки данных и генерации HTML/PDF.
 */
/**
 * Маркер шаблона ставится первой строкой в HTML-документе и используется в QA-проверках.
 */
export const REPORT_EXPORT_TEMPLATE_MARKER = {
    "project-ov-ts": "<!-- Export template: project-ov-ts v1 -->",
    "thermal-protection": "<!-- Export template: thermal-protection v1 -->",
    "energy-passport": "<!-- Export template: energy-passport v1 -->",
    "operation-technical-passport": "<!-- Export template: operation-technical-passport v1 -->",
    "engineering-summary": "<!-- Export template: engineering-summary v1 -->",
};
export const REPORT_EXPORT_TITLE = {
    "project-ov-ts": "Раздел 5. ОВ/ТС",
    "thermal-protection": "Расчёт тепловой защиты здания",
    "energy-passport": "Энергетический паспорт проекта здания",
    "operation-technical-passport": "Паспорт проектных теплотехнических характеристик",
    "engineering-summary": "Инженерное заключение",
};
export const REPORT_EXPORT_FILE_PREFIX = {
    "project-ov-ts": "razdel-5-ov-ts",
    "thermal-protection": "thermal-protection",
    "energy-passport": "energy-passport-project",
    "operation-technical-passport": "project-thermal-characteristics-passport",
    "engineering-summary": "engineering-summary",
};
/**
 * Команды воркспейса, которые соответствуют каждой выгрузке. Используются вместо
 * единственного "export-report".
 */
export const REPORT_EXPORT_WORKSPACE_COMMAND = {
    "project-ov-ts": "export-project-ov-ts",
    "thermal-protection": "export-thermal-protection",
    "energy-passport": "export-energy-passport",
    "operation-technical-passport": "export-operation-passport",
    "engineering-summary": "export-engineering-summary",
};
export const REPORT_DOWNLOAD_WORKSPACE_COMMAND = {
    "project-ov-ts": "download-project-ov-ts",
    "thermal-protection": "download-thermal-protection",
    "energy-passport": "download-energy-passport",
    "operation-technical-passport": "download-operation-passport",
    "engineering-summary": "download-engineering-summary",
};
