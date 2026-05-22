import { useEffect, useState } from "react";
import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { probeEngineHealth } from "../entities/settings/engine.health";
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

  return (
    <div className="ui-engine-banner border-b">
      <div className="mx-auto flex max-w-[min(100%,96rem)] flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 xl:px-8">
        <div>
          <p className="font-semibold">{isUnconfigured ? "Движок не настроен" : "Движок недоступен"}</p>
          <p className="opacity-90">
            {isUnconfigured
              ? "Укажите адрес в разделе «Настройки», чтобы включить импорт IFC и расчёты на сервере. Локальный демо-проект работает без движка."
              : "Запустите движок: в каталоге twin-desktop/engine выполните pip install -r requirements.txt, затем npm run dev:engine (или полный npm run dev). URL по умолчанию: http://127.0.0.1:8010. Локальные расчёты в конструкторе доступны без движка."}
          </p>
        </div>
        <button type="button" onClick={() => navigate("/settings")} className="ui-btn-secondary shrink-0 px-4 py-1.5 text-xs">
          Открыть настройки
        </button>
      </div>
    </div>
  );
}

export default EngineConfigBanner;
