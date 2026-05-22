import { useEffect } from "react";
import { useBuildStore } from "../../build/build.store";
import { isVideoDemoProjectModel } from "../../build/demoVideoProject";
import { loadReportMeta } from "../../build/reports/reportMetaPersistence";
import { useTwinStore } from "../../../entities/twin/twin.store";
import { useProjectStore } from "../../../entities/project/project.store";
import { useWorkflowStore } from "../../../entities/workflow/workflow.store";
import {
  isDownloadReportCommand,
  isExportReportCommand,
  useWorkspaceStore,
} from "../../../entities/workspace/workspace.store";
import { downloadAllReportDocuments, exportReportDocument } from "./exportReportDocument";
import { buildReportBaseData } from "./data/buildReportBaseData";
import { prepareExportReportInput } from "./prepareExportReportInput";
import { loadExpertiseInputs, useExpertiseInputsStore } from "./store/expertiseInputs.store";
import type { ReportExportKind } from "./types";

const EXPORT_COMMAND_TO_KIND: Record<string, ReportExportKind> = {
  "export-project-ov-ts": "project-ov-ts",
  "export-thermal-protection": "thermal-protection",
  "export-energy-passport": "energy-passport",
  "export-operation-passport": "operation-technical-passport",
  "export-engineering-summary": "engineering-summary",
};

const DOWNLOAD_COMMAND_TO_KIND: Record<string, ReportExportKind> = {
  "download-project-ov-ts": "project-ov-ts",
  "download-thermal-protection": "thermal-protection",
  "download-energy-passport": "energy-passport",
  "download-operation-passport": "operation-technical-passport",
  "download-engineering-summary": "engineering-summary",
};

/**
 * Глобальный слушатель команд выгрузки документов.
 *
 * Поддерживает три набора команд:
 *  - export-*           — открыть HTML в новом окне (для печати в PDF);
 *  - download-*         — скачать HTML как файл;
 *  - download-all-exports — пакетное скачивание 5 документов;
 *  - apply-demo-defaults / clear-demo-defaults — включить/выключить профиль
 *    проектных допущений; следующие выгрузки используют значения по умолчанию.
 *
 * Не влияет на BuildingModel, расчётное ядро и 3D — только подготовка HTML.
 */
export function ReportExportListener() {
  const command = useWorkspaceStore((state) => state.command);
  const nonce = useWorkspaceStore((state) => state.commandNonce);
  const consumeProjectCommand = useWorkspaceStore((state) => state.consumeProjectCommand);
  const setApplyDemoDefaults = useWorkspaceStore((state) => state.setApplyDemoDefaults);
  const applyDemoDefaults = useWorkspaceStore((state) => state.applyDemoDefaults);
  const setWorkspaceMode = useWorkspaceStore((state) => state.setMode);
  const openInputsPanel = useExpertiseInputsStore((state) => state.openPanel);

  useEffect(() => {
    if (!command) {
      return;
    }
    try {
      if (
        shouldPromptDemoDefaults(command, applyDemoDefaults) &&
        isDemoProjectContext()
      ) {
        const decision = askAboutDemoDefaults();
        if (decision === "enable") {
          setApplyDemoDefaults(true);
        } else if (decision === "cancel") {
          return;
        }
      }
      const strictGuardBase = shouldCheckStrictCompleteness(command)
        ? buildCurrentExportBase(applyDemoDefaults)
        : null;
      if (
        strictGuardBase &&
        !canProceedWithStrictExport(strictGuardBase, () => {
          setWorkspaceMode("results");
          openInputsPanel();
        })
      ) {
        return;
      }
      if (command === "apply-demo-defaults") {
        setApplyDemoDefaults(true);
      } else if (command === "clear-demo-defaults") {
        setApplyDemoDefaults(false);
      } else if (command === "download-all-exports") {
        downloadAllReportDocuments();
      } else if (isDownloadReportCommand(command)) {
        const kind = DOWNLOAD_COMMAND_TO_KIND[command];
        if (kind) {
          exportReportDocument(kind, { openInWindow: false, download: true });
        }
      } else if (isExportReportCommand(command)) {
        const kind = EXPORT_COMMAND_TO_KIND[command];
        if (kind) {
          exportReportDocument(kind);
        }
      } else {
        // Команда не для нашего слушателя — выходим без consume, чтобы
        // другие слушатели смогли её обработать.
        return;
      }
    } catch (error) {
      console.error("Не удалось обработать команду выгрузки", error);
    } finally {
      consumeProjectCommand(nonce);
    }
  }, [
    applyDemoDefaults,
    command,
    consumeProjectCommand,
    nonce,
    openInputsPanel,
    setApplyDemoDefaults,
    setWorkspaceMode,
  ]);

  return null;
}

export default ReportExportListener;

function shouldPromptDemoDefaults(command: string, applyDemoDefaults: boolean): boolean {
  if (applyDemoDefaults) {
    return false;
  }
  return (
    command === "download-all-exports" ||
    isExportReportCommand(command) ||
    isDownloadReportCommand(command)
  );
}

function isDemoProjectContext(): boolean {
  const buildState = useBuildStore.getState();
  const projectState = useProjectStore.getState();
  return (
    isVideoDemoProjectModel(buildState.model) ||
    (typeof projectState.projectId === "string" &&
      projectState.projectId.startsWith("local:demo"))
  );
}

function askAboutDemoDefaults(): "enable" | "as-is" | "cancel" {
  if (typeof window === "undefined") {
    return "as-is";
  }
  const enable = window.confirm(
    "Проектные данные для демо-дома не включены. В документах могут остаться незаполненные поля. Включить проектные данные?\n\nOK — Включить и скачать\nОтмена — выбрать другой вариант"
  );
  if (enable) {
    return "enable";
  }
  const asIs = window.confirm(
    "Скачать документы без включения проектных данных?\n\nOK — Скачать как есть\nОтмена — отмена"
  );
  return asIs ? "as-is" : "cancel";
}

function shouldCheckStrictCompleteness(command: string): boolean {
  return (
    command === "download-all-exports" ||
    isExportReportCommand(command) ||
    isDownloadReportCommand(command)
  );
}

function buildCurrentExportBase(applyDemoDefaults: boolean) {
  const buildState = useBuildStore.getState();
  const projectState = useProjectStore.getState();
  const twinState = useTwinStore.getState();
  const workflowState = useWorkflowStore.getState();
  const projectId = projectState.projectId ?? null;
  const projectKey = buildState.projectKey || projectId || "local-project";
  const prepared = prepareExportReportInput(
    {
      model: buildState.model,
      projectId,
      scenarioConfig: workflowState.scenarioConfig ?? null,
      thermalResult: twinState.lastThermalResult ?? null,
      monteCarloResult: workflowState.monteCarloResult ?? null,
      reportMeta: loadReportMeta(projectKey),
      generatedAt: new Date(),
      expertiseInputs: loadExpertiseInputs(projectKey),
    },
    { applyDemoDefaults }
  );
  return buildReportBaseData({
    ...prepared.input,
    appliedAssumptions: prepared.appliedAssumptions,
  });
}

function canProceedWithStrictExport(
  base: ReturnType<typeof buildReportBaseData>,
  openInputsPanel: () => void
): boolean {
  if (
    base.expertise.exportMode !== "strict-expertise" ||
    base.expertise.readiness.criticalMissing.length === 0
  ) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  const fields = base.expertise.readiness.criticalMissing
    .map((field) => `• ${field.label}`)
    .join("\n");
  const fillNow = window.confirm(
    `Для формирования комплекта требуется заполнить следующие поля:\n\n${fields}\n\nНажмите OK, чтобы открыть форму заполнения.`
  );
  if (fillNow) {
    openInputsPanel();
    return false;
  }
  return window.confirm(
    "Сформировать документы с пометкой «требует уточнения» для незаполненных полей?"
  );
}
