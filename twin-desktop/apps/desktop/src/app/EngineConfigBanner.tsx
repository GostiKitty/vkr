import { useEffect, useState } from "react";
import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { probeEngineHealth } from "../entities/settings/engine.health";
import { isWebProductionRuntime } from "../shared/runtime/webProduction";
import { openWebDemoProject } from "./webDemoProject";
import { navigate } from "./router";

type BannerMode = "unconfigured" | "offline" | "hidden";

export function EngineConfigBanner() {
  const baseUrl = useEngineSettingsStore((state) => state.baseUrl);
  const [mode, setMode] = useState<BannerMode>(() => (baseUrl.trim() ? "hidden" : "unconfigured"));

  useEffect(() => {
    let cancelled = false;

    const evaluate = async () => {
      if (!baseUrl.trim()) {
        setMode("unconfigured");
        return;
      }
      const online = await probeEngineHealth();
      if (!cancelled) {
        setMode(online ? "hidden" : "offline");
      }
    };

    void evaluate();
    const intervalId = window.setInterval(() => {
      void evaluate();
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [baseUrl]);

  if (mode === "hidden") {
    return null;
  }

  const isUnconfigured = mode === "unconfigured";
  const isWebDemo = isWebProductionRuntime();

  if (isWebDemo && isUnconfigured) {
    return null;
  }

  return (
    <div className="ui-engine-banner border-b">
      <div className="mx-auto flex max-w-[min(100%,96rem)] flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:px-8">
        <div>
          <p className="text-base font-semibold">
            {isWebDemo
              ? "Локальный расчётный backend недоступен в web-демо"
              : isUnconfigured
                ? "Сервер не настроен"
                : "Сервер недоступен"}
          </p>
          <p className="opacity-90">
            {isWebDemo
              ? "Импорт IFC и серверные операции доступны в desktop-версии с Python-движком. В браузере можно работать с демо-проектом и локальными расчётами в конструкторе."
              : isUnconfigured
                ? "Укажите адрес в разделе «Настройки», чтобы включить импорт IFC и серверные операции. Локальный демо-проект работает и без сервера."
                : "Запустите сервер и проверьте адрес подключения. Локальные расчёты в конструкторе доступны даже без него."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {isWebDemo ? (
            <button type="button" onClick={() => openWebDemoProject()} className="ui-btn-primary px-4 py-2 text-sm">
              Загрузить демо-проект
            </button>
          ) : null}
          {!isWebDemo ? (
            <button type="button" onClick={() => navigate("/settings")} className="ui-btn-secondary px-4 py-2 text-sm">
              Открыть настройки
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default EngineConfigBanner;
