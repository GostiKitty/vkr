/**
 * Публичный фасад системы выгрузки документов.
 */

export {
  REPORT_EXPORT_FILE_PREFIX,
  REPORT_EXPORT_TEMPLATE_MARKER,
  REPORT_EXPORT_TITLE,
  REPORT_EXPORT_WORKSPACE_COMMAND,
  type ReportExportDocumentMeta,
  type ReportExportKind,
  type ReportExportWorkspaceCommand,
} from "./types";

export {
  buildReportBaseData,
  type ReportBaseData,
  type BuildReportBaseDataInput,
} from "./data/buildReportBaseData";
export { buildProjectOvTsData, type ProjectOvTsData } from "./data/buildProjectOvTsData";
export {
  buildThermalProtectionData,
  type ThermalProtectionData,
} from "./data/buildThermalProtectionData";
export {
  buildEnergyPassportData,
  type EnergyPassportData,
  type EnergyPassportSection,
  type EnergyPassportRow,
} from "./data/buildEnergyPassportData";
export {
  buildOperationPassportData,
  type OperationPassportData,
} from "./data/buildOperationPassportData";
export {
  buildEngineeringSummaryData,
  type EngineeringSummaryData,
} from "./data/buildEngineeringSummaryData";

export { generateProjectOvTsHtml } from "./generators/projectOvTs";
export { generateThermalProtectionHtml } from "./generators/thermalProtection";
export { generateEnergyPassportHtml } from "./generators/energyPassport";
export { generateOperationTechnicalPassportHtml } from "./generators/operationTechnicalPassport";
export { generateEngineeringSummaryHtml } from "./generators/engineeringSummary";

export {
  exportReportDocument,
  renderReportHtml,
  downloadAllReportDocuments,
  REPORT_EXPORT_BUNDLE_FILENAME,
  ALL_REPORT_EXPORT_KINDS,
  type ExportReportOptions,
  type ExportReportResult,
} from "./exportReportDocument";

export {
  DEMO_HOUSE_DESIGN_DEFAULTS,
  DEMO_DEFAULT_FOOTNOTE,
  ASSUMPTIONS_SECTION_TITLE,
  SOLAR_GAIN_METHODOLOGY_ASSUMPTION,
  applyDemoDesignDefaults,
  type DemoHouseDesignDefaults,
  type AssumptionEntry,
  type AssumptionSource,
} from "./defaults/demoHouseDesignDefaults";

export {
  BASE_GOST_REPORT_CSS,
  DEMO_DEFAULT_VALUE_MARK,
  escapeHtml,
  formatArea,
  formatNumber,
  formatStatus,
  formatVolume,
  renderAssumptionsBlock,
  renderBibliography,
  renderDataTable,
  renderGostStamp,
  renderGostTitlePage,
  renderSignatureBlock,
  renderToc,
  REPORT_EXPORT_RC_DISCLAIMER,
  textOrNoData,
  textOrNotSet,
  wrapHtmlDocument,
} from "./helpers";
