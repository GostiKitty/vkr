import { useEffect, useState } from "react";
import { useProjectStore } from "../entities/project/project.store";
import { navigate } from "./router";
import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { probeEngineHealth } from "../entities/settings/engine.health";
import { useTheme } from "../shared/theme";
import { IconMoon, IconSun } from "../shared/ui";
import { formatProjectDisplayLabel } from "../shared/utils/projectLabels";
import {
  WORKSPACE_MODES,
  useWorkspaceStore,
  type WorkspaceProjectCommand,
} from "../entities/workspace/workspace.store";
import { BuildToolIcon } from "../features/build/components/buildToolIcons";

const EXPORT_DOCUMENT_MENU: ReadonlyArray<{
  label: string;
  printCommand: WorkspaceProjectCommand;
  downloadCommand: WorkspaceProjectCommand;
}> = [
  {
    label: "Раздел 5 ОВ/ТС",
    printCommand: "export-project-ov-ts",
    downloadCommand: "download-project-ov-ts",
  },
  {
    label: "Расчёт тепловой защиты здания",
    printCommand: "export-thermal-protection",
    downloadCommand: "download-thermal-protection",
  },
  {
    label: "Энергетический паспорт здания",
    printCommand: "export-energy-passport",
    downloadCommand: "download-energy-passport",
  },
  {
    label: "Эксплуатационно-технический паспорт",
    printCommand: "export-operation-passport",
    downloadCommand: "download-operation-passport",
  },
  {
    label: "Краткое инженерное заключение",
    printCommand: "export-engineering-summary",
    downloadCommand: "download-engineering-summary",
  },
];

interface TopBarProps {
  currentPath: string;
}

type EngineStatus = "online" | "offline" | "checking";

function ThemeSwitcher() {
  const { preference, resolved, setPreference } = useTheme();

  const isLightActive = preference === "light" || (preference === "system" && resolved === "light");
  const isDarkActive = preference === "dark" || (preference === "system" && resolved === "dark");

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-1 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--surface-elevated)_80%,transparent)]"
      title="Тема оформления"
    >
      <button
        type="button"
        onClick={() => setPreference("light")}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
          isLightActive
            ? "bg-[color:var(--surface-elevated)] text-[color:var(--accent-base)] shadow-[var(--shadow-control)] ring-1 ring-[color:var(--border-soft)]"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)]/70 hover:text-[color:var(--text-base)]"
        }`}
        aria-label="Светлая тема"
        aria-pressed={isLightActive}
      >
        <span className="inline-flex">
          <IconSun size={16} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => setPreference("dark")}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
          isDarkActive
            ? "bg-[color:var(--surface-elevated)] text-[color:var(--accent-base)] shadow-[var(--shadow-control)] ring-1 ring-[color:var(--border-soft)]"
            : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-elevated)]/70 hover:text-[color:var(--text-base)]"
        }`}
        aria-label="Тёмная тема"
        aria-pressed={isDarkActive}
      >
        <span className="inline-flex">
          <IconMoon size={16} />
        </span>
      </button>
    </div>
  );
}

function EngineStatusChip({
  status,
  configured,
}: {
  status: EngineStatus;
  configured: boolean;
}) {
  const dot =
    !configured || status === "offline"
      ? "bg-[color:var(--danger-fg)]"
      : status === "online"
        ? "bg-[color:var(--success-fg)]"
        : "bg-[color:var(--warning-fg)]";

  const title = !configured
    ? "Движок не настроен"
    : status === "checking"
      ? "Проверка доступности…"
      : status === "online"
        ? "Движок доступен"
        : "Движок недоступен";

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-2.5 py-1 text-xs text-[color:var(--text-muted)] sm:inline-flex"
      title={title}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="max-w-[7rem] truncate font-medium">Движок</span>
    </span>
  );
}

export function TopBar({ currentPath }: TopBarProps) {
  const projectId = useProjectStore((state) => state.projectId);
  const engineBase = useEngineSettingsStore((state) => state.baseUrl);
  const workspaceMode = useWorkspaceStore((state) => state.mode);
  const setWorkspaceMode = useWorkspaceStore((state) => state.setMode);
  const dispatchProjectCommand = useWorkspaceStore((state) => state.dispatchProjectCommand);
  const applyDemoDefaults = useWorkspaceStore((state) => state.applyDemoDefaults);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("checking");
  const projectLabel = formatProjectDisplayLabel(projectId, { fallback: "Без проекта" });
  const isDemoProject = typeof projectId === "string" && projectId.startsWith("local:demo");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!engineBase) {
        setEngineStatus("offline");
        return;
      }
      const online = await probeEngineHealth();
      if (!cancelled) {
        setEngineStatus(online ? "online" : "offline");
      }
    };

    void check();
    const intervalId = window.setInterval(() => {
      void check();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [engineBase]);

  const handleWorkspaceMode = (mode: typeof workspaceMode) => {
    setWorkspaceMode(mode);
    if (currentPath !== "/build") {
      navigate("/build");
    }
  };

  const handleProjectCommand = (command: WorkspaceProjectCommand) => {
    if (command === "export-report") {
      setWorkspaceMode("results");
    }
    dispatchProjectCommand(command);
    if (currentPath !== "/build") {
      navigate("/build");
    }
  };

  const handleExportDocument = (command: WorkspaceProjectCommand) => {
    dispatchProjectCommand(command);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/95 shadow-[var(--shadow-control)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 max-w-[min(100%,96rem)] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-6 xl:px-8">
        <button
          type="button"
          onClick={() => navigate("/build")}
          className="group flex shrink-0 items-center gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-[color:var(--surface-muted)]"
          title="Гнёздышко — рабочая среда"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-sm font-bold text-[color:var(--accent-base)]">
            Г
          </span>
          <span className="hidden font-semibold tracking-tight text-[color:var(--text-base)] sm:inline">
            Гнёздышко
          </span>
        </button>

        <div className="hidden min-w-0 max-w-[12rem] flex-col leading-tight 2xl:flex">
          <span className="truncate text-xs text-[color:var(--text-soft)]">Проект</span>
          <span className="truncate text-sm font-semibold text-[color:var(--text-base)]" title={projectLabel}>
            {projectLabel}
          </span>
        </div>

        <details className="group relative shrink-0">
          <summary className="ui-control flex cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Проект
            <span className="text-[10px] text-[color:var(--text-soft)]">▾</span>
          </summary>
          <div className="ui-panel absolute left-0 top-[calc(100%+0.5rem)] z-50 grid w-64 gap-1 p-2 shadow-[var(--shadow-popover)]">
            {[
              ["import-ifc", "Импорт IFC"],
              ["new-project", "Создать новый проект"],
              ["open-project", "Открыть проект"],
              ["open-demo", "Открыть демонстрационный проект"],
              ["save", "Сохранить"],
            ].map(([command, label]) => (
              <button
                key={command}
                type="button"
                onClick={() => handleProjectCommand(command as WorkspaceProjectCommand)}
                className="rounded-xl px-3 py-2 text-left text-sm font-medium text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-base)]"
              >
                {label}
              </button>
            ))}
          </div>
        </details>

        <details className="group relative shrink-0">
          <summary
            className="ui-control flex cursor-pointer list-none items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold [&::-webkit-details-marker]:hidden"
            title="Выберите тип документа для выгрузки"
          >
            Выгрузка документов
            <span className="text-[10px] text-[color:var(--text-soft)]">▾</span>
          </summary>
          <div className="ui-panel absolute left-0 top-[calc(100%+0.5rem)] z-50 grid w-[26rem] gap-1.5 p-3 shadow-[var(--shadow-popover)]">
            <div className="flex flex-col gap-1 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[color:var(--text-base)]">
                  Проектные допущения для демо
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    applyDemoDefaults
                      ? "bg-[color:var(--accent-soft)] text-[color:var(--accent-base)]"
                      : "bg-[color:var(--surface-elevated)] text-[color:var(--text-soft)]"
                  }`}
                >
                  {applyDemoDefaults ? "Включено" : "Выключено"}
                </span>
              </div>
              <p className="text-[color:var(--text-soft)]">
                Если данные демо-дома не заполнены полностью, выгрузка может подставить значения по
                проектному допущению; каждое такое поле отмечается сноской «*» и попадает в раздел
                «Принятые проектные допущения».
              </p>
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={!isDemoProject}
                  title={
                    isDemoProject
                      ? "Подставить демо-допущения в пустые поля"
                      : "Доступно только для демонстрационного проекта"
                  }
                  onClick={() => handleExportDocument("apply-demo-defaults")}
                  className="flex-1 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-2 py-1 text-xs font-medium text-[color:var(--text-base)] transition hover:bg-[color:var(--surface-base)] disabled:opacity-50"
                >
                  Заполнить проектные данные для демо-дома
                </button>
                <button
                  type="button"
                  disabled={!applyDemoDefaults}
                  title="Отключить подстановку демо-допущений"
                  onClick={() => handleExportDocument("clear-demo-defaults")}
                  className="rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-xs font-medium text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)] disabled:opacity-50"
                >
                  Сбросить
                </button>
              </div>
            </div>

            <div className="my-1 h-px bg-[color:var(--border-soft)]" />

            {EXPORT_DOCUMENT_MENU.map((item) => (
              <div key={item.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-1.5">
                <span className="px-2 text-sm font-medium text-[color:var(--text-base)]">
                  {item.label}
                </span>
                <button
                  type="button"
                  onClick={() => handleExportDocument(item.downloadCommand)}
                  title="Скачать HTML-файл"
                  className="rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-xs font-medium text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-base)]"
                >
                  Скачать HTML
                </button>
                <button
                  type="button"
                  onClick={() => handleExportDocument(item.printCommand)}
                  title="Открыть документ для печати в PDF (через диалог браузера)"
                  className="rounded-lg border border-[color:var(--border-soft)] px-2 py-1 text-xs font-medium text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--text-base)]"
                >
                  Печать / PDF
                </button>
              </div>
            ))}

            <div className="my-1 h-px bg-[color:var(--border-soft)]" />

            <button
              type="button"
              onClick={() => handleExportDocument("download-all-exports")}
              title="Сохранить все 5 документов как набор HTML-файлов (01-…, 02-…, …)."
              className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-sm font-semibold text-[color:var(--text-base)] transition hover:bg-[color:var(--surface-base)]"
            >
              Скачать все документы
            </button>
            <p className="px-1 text-[10px] text-[color:var(--text-soft)]">
              Прямой PDF-экспорта в приложении нет: «Печать / PDF» открывает документ и использует
              системный диалог «Сохранить как PDF» в браузере.
            </p>
          </div>
        </details>

        <nav
          className="flex flex-wrap items-center gap-1"
          aria-label="Режимы рабочего пространства"
        >
          {WORKSPACE_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleWorkspaceMode(mode.id)}
              title={mode.title}
              data-testid={`workspace-tab-${mode.id}`}
              aria-current={currentPath === "/build" && workspaceMode === mode.id ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                currentPath === "/build" && workspaceMode === mode.id ? "ui-control-active shadow-sm" : "ui-control"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => navigate("/formulas")}
            className={`hidden rounded-full px-3 py-1.5 text-sm font-medium transition lg:inline-flex ${
              currentPath === "/formulas" ? "ui-control-active shadow-sm" : "ui-control"
            }`}
          >
            Формулы и допущения
          </button>

          <button
            type="button"
            onClick={() => navigate("/settings")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              currentPath === "/settings" ? "ui-control-active shadow-sm" : "ui-control"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <BuildToolIcon name="sliders" className="h-4 w-4" />
              Настройки
            </span>
          </button>

          <EngineStatusChip status={engineStatus} configured={Boolean(engineBase)} />

          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}

export default TopBar;
