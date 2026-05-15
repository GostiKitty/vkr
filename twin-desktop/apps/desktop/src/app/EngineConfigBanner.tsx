import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { navigate } from "./router";

export function EngineConfigBanner() {
  const baseUrl = useEngineSettingsStore((state) => state.baseUrl);

  if (baseUrl.trim()) {
    return null;
  }

  return (
    <div className="ui-engine-banner border-b">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Движок не настроен</p>
          <p className="opacity-90">
            Укажите переменную окружения VITE_ENGINE_BASE или задайте адрес в разделе «Настройки», чтобы включить импорт IFC и расчёты на сервере.
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
