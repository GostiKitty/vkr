import { useEffect, useState } from "react";
import { probeEngineHealth } from "../entities/settings/engine.health";
import { isWebProductionRuntime } from "../shared/runtime/webProduction";
import { openWebDemoProject } from "./webDemoProject";

export function WebDemoStartupBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [engineOnline, setEngineOnline] = useState(false);

  useEffect(() => {
    if (!isWebProductionRuntime()) {
      return;
    }
    let cancelled = false;
    void probeEngineHealth().then((online) => {
      if (!cancelled) {
        setEngineOnline(online);
        setChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isWebProductionRuntime() || dismissed || !checked || engineOnline) {
    return null;
  }

  return (
    <div className="ui-engine-banner border-b border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]">
      <div className="mx-auto flex max-w-[min(100%,96rem)] flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:px-8">
        <div>
          <p className="text-base font-semibold text-[color:var(--warning-fg)]">Локальный расчётный backend недоступен в web-демо</p>
          <p className="text-[color:var(--warning-fg)] opacity-90">
            Импорт IFC и серверные расчёты требуют запущенный движок на вашем компьютере. Конструктор и локальный демо-проект
            работают в браузере без backend.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => openWebDemoProject()} className="ui-btn-primary px-4 py-2 text-sm">
            Загрузить демо-проект
          </button>
          <button type="button" onClick={() => setDismissed(true)} className="ui-btn-secondary px-4 py-2 text-sm">
            Скрыть
          </button>
        </div>
      </div>
    </div>
  );
}

export default WebDemoStartupBanner;
