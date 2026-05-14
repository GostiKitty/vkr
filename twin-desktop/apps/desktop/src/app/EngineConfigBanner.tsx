import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { navigate } from "./router";

export function EngineConfigBanner() {
  const baseUrl = useEngineSettingsStore((state) => state.baseUrl);

  if (baseUrl.trim()) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Движок не настроен</p>
          <p className="text-amber-800">
            Укажите `VITE_ENGINE_BASE` или задайте адрес в разделе «Настройки», чтобы включить импорт IFC и расчёты.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="rounded-full border border-amber-300 px-4 py-1.5 text-xs font-semibold text-amber-900 hover:border-amber-400"
        >
          Открыть настройки
        </button>
      </div>
    </div>
  );
}

export default EngineConfigBanner;
