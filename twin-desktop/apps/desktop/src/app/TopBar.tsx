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
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("checking");
  const projectLabel = formatProjectDisplayLabel(projectId, { fallback: "Без проекта" });

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
    dispatchProjectCommand(command);
    if (currentPath !== "/build") {
      navigate("/build");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/95 shadow-[var(--shadow-control)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-14 max-w-[min(100%,96rem)] flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 xl:px-8">
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
              ["export-report", "Экспорт отчёта"],
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

        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
