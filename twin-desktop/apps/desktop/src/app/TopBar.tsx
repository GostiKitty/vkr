import { useEffect, useState } from "react";
import { useProjectStore } from "../entities/project/project.store";
import { navigate } from "./router";
import { useDebugConsoleStore } from "../entities/debug/debugConsole.store";
import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { probeEngineHealth } from "../entities/settings/engine.health";
import { QuickImportButton } from "../features/model/QuickImportButton";

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
      ? "Проверка /health…"
      : engineStatus === "online"
        ? "Движок доступен"
        : "Движок недоступен";

  const statusColor = !engineBase
    ? "bg-slate-400"
    : engineStatus === "online"
      ? "bg-emerald-500"
      : engineStatus === "offline"
        ? "bg-red-500"
        : "bg-amber-400";

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold text-slate-900">Гнёздышко</span>
          <nav className="flex gap-2">
            {navLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  currentPath === link.path
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>
          <QuickImportButton variant="topbar" />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
            {statusText}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-slate-400">Режим:</span>
            <strong className="text-slate-900">{formatProjectKind(projectKind)}</strong>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-slate-400">ID проекта:</span>
            <strong className="text-slate-900">{projectId ?? "—"}</strong>
          </span>
          <button
            type="button"
            onClick={openDebug}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-500"
          >
            Консоль
          </button>
        </div>
      </div>
    </div>
  );
}

export default TopBar;
