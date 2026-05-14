import React, { useEffect, useState } from "react";
import { useProjectStore } from "../entities/project/project.store";
import { navigate } from "./router";
import { useDebugConsoleStore } from "../entities/debug/debugConsole.store";
import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { probeEngineHealth } from "../entities/settings/engine.health";
import { QuickImportButton } from "../features/model/QuickImportButton";
const navLinks = [
    { path: "/", label: "Twin режим" },
    { path: "/build", label: "Режим сборки" },
    { path: "/formulas", label: "Теория" },
    { path: "/settings", label: "Настройки" },
];
export function TopBar({ currentPath }) {
    const projectId = useProjectStore((state) => state.projectId);
    const engineBase = useEngineSettingsStore((state) => state.baseUrl);
    const [engineStatus, setEngineStatus] = useState("checking");
    const openDebug = useDebugConsoleStore((state) => state.open);
    useEffect(() => {
        let cancelled = false;
        let checking = false;
        const check = async () => {
            if (checking) {
                return;
            }
            checking = true;
            const online = await probeEngineHealth();
            if (!cancelled) {
                setEngineStatus(online ? "online" : "offline");
            }
            checking = false;
        };
        check();
        const interval = window.setInterval(check, 10000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);
    const statusText = !engineBase
        ? "URL движка не задан — откройте «Настройки»"
        : engineStatus === "checking"
            ? "Проверяю подключение к /health…"
            : engineStatus === "online"
                ? "Движок онлайн"
                : "Движок офлайн — проверьте сервис или URL";
    const statusColor = !engineBase
        ? "bg-slate-400"
        : engineStatus === "online"
            ? "bg-emerald-500"
            : engineStatus === "offline"
                ? "bg-red-500"
                : "bg-amber-400";
    return (<div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold text-slate-900">Digital Twin Studio</span>
          <nav className="flex gap-2">
            {navLinks.map((link) => (<button key={link.path} type="button" onClick={() => navigate(link.path)} className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${currentPath === link.path
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}>
                {link.label}
              </button>))}
          </nav>
          <QuickImportButton variant="topbar"/>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`}/>
            {statusText}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-slate-400">ID проекта:</span>
            <strong className="text-slate-900">{projectId ?? "—"}</strong>
          </span>
          <button type="button" onClick={openDebug} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-500">
            Консоль
          </button>
        </div>
      </div>
    </div>);
}
export default TopBar;
