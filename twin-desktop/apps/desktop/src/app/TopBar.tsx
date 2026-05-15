import { useEffect, useState } from "react";
import { useProjectStore } from "../entities/project/project.store";
import { navigate } from "./router";
import { useDebugConsoleStore } from "../entities/debug/debugConsole.store";
import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { probeEngineHealth } from "../entities/settings/engine.health";
import { QuickImportButton } from "../features/model/QuickImportButton";
import { useTheme, type ThemePreference } from "../shared/theme";
import { IconMonitor, IconMoon, IconSun } from "../shared/ui";

interface TopBarProps {
  currentPath: string;
}

type EngineStatus = "online" | "offline" | "checking";

const navLinks = [
  { path: "/", label: "Студия" },
  { path: "/build", label: "Конструирование" },
  { path: "/formulas", label: "Формулы" },
  { path: "/settings", label: "Настройки" },
];

const formatProjectKind = (value: "local" | "engine" | null | undefined): string => {
  if (value === "engine") {
    return "серверный";
  }
  return "локальный";
};

function ThemeSwitcher() {
  const { preference, setPreference, resolved } = useTheme();

  const cycle = (next: ThemePreference) => {
    setPreference(next);
  };

  return (
    <div
      className="group flex items-center gap-0.5 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-0.5 shadow-sm"
      title="Тема оформления"
    >
      <button
        type="button"
        onClick={() => cycle("light")}
        className={`rounded-full p-2 transition ${preference === "light" ? "ui-control-active shadow-sm" : "text-[color:var(--text-muted)] hover:text-[color:var(--text-base)]"}`}
        aria-label="Светлая тема"
      >
        <span className="ui-icon-tap inline-flex">
          <IconSun size={18} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => cycle("dark")}
        className={`rounded-full p-2 transition ${preference === "dark" ? "ui-control-active shadow-sm" : "text-[color:var(--text-muted)] hover:text-[color:var(--text-base)]"}`}
        aria-label="Тёмная тема"
      >
        <span className="ui-icon-tap inline-flex">
          <IconMoon size={18} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => cycle("system")}
        className={`rounded-full p-2 transition ${preference === "system" ? "ui-control-active shadow-sm" : "text-[color:var(--text-muted)] hover:text-[color:var(--text-base)]"}`}
        aria-label="Как в системе"
      >
        <span className="ui-icon-tap inline-flex">
          <IconMonitor size={18} />
        </span>
      </button>
      <span className="hidden px-2 text-[10px] font-medium uppercase tracking-wide text-[color:var(--text-soft)] sm:inline">
        {resolved === "dark" ? "тёмная" : "светлая"}
      </span>
    </div>
  );
}

export function TopBar({ currentPath }: TopBarProps) {
  const projectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const engineBase = useEngineSettingsStore((state) => state.baseUrl);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("checking");
  const openDebug = useDebugConsoleStore((state) => state.open);

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

  const statusText = !engineBase
    ? "Движок не настроен"
    : engineStatus === "checking"
      ? "Проверка доступности…"
      : engineStatus === "online"
        ? "Движок доступен"
        : "Движок недоступен";

  const statusDot =
    !engineBase || engineStatus === "offline"
      ? "bg-[color:var(--danger-fg)]"
      : engineStatus === "online"
        ? "bg-[color:var(--success-fg)]"
        : "bg-[color:var(--warning-fg)]";

  return (
    <div className="sticky top-0 z-40 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/90 shadow-[var(--shadow-control)] backdrop-blur-xl transition-[box-shadow,background-color] duration-300 ease-out">
      <div className="mx-auto flex max-w-[min(100%,96rem)] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 xl:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="min-w-0">
            <span className="block text-lg font-semibold tracking-tight text-[color:var(--text-base)]">Гнёздышко</span>
            <span className="block text-xs text-[color:var(--text-muted)]">
              Цифровой двойник здания: модель → сценарий → расчёт → карта температур → риски → отчёт
            </span>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {navLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  currentPath === link.path ? "ui-control-active shadow-sm" : "ui-control"
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>
          <QuickImportButton variant="topbar" />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--text-muted)]">
          <ThemeSwitcher />
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDot}`} />
            <span className="text-[color:var(--text-muted)]">{statusText}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-[color:var(--text-soft)]">Режим</span>
            <strong className="text-[color:var(--text-base)]">{formatProjectKind(projectKind)}</strong>
          </span>
          <span className="hidden items-center gap-2 lg:inline-flex">
            <span className="text-[color:var(--text-soft)]">Проект</span>
            <strong className="max-w-[10rem] truncate font-mono text-xs text-[color:var(--text-base)]">{projectId ?? "—"}</strong>
          </span>
          <button
            type="button"
            onClick={openDebug}
            className="ui-control rounded-full px-3 py-1 text-xs font-semibold"
          >
            Консоль
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopBar;
