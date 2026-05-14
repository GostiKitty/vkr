import React, { useCallback, useState } from "react";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
export function SettingsPage() {
    const baseUrl = useEngineSettingsStore((state) => state.baseUrl);
    const setBaseUrl = useEngineSettingsStore((state) => state.setBaseUrl);
    const resetToDefault = useEngineSettingsStore((state) => state.resetToDefault);
    const [value, setValue] = useState(baseUrl);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState("idle");
    const handleSave = useCallback(() => {
        setBaseUrl(value);
        notifyInfo("Базовый URL сохранён.");
    }, [setBaseUrl, value]);
    const handleReset = useCallback(() => {
        resetToDefault();
        const next = useEngineSettingsStore.getState().baseUrl;
        setValue(next);
        notifyInfo("URL сброшен к значению по умолчанию.");
    }, [resetToDefault]);
    const handleTest = useCallback(async () => {
        const target = value.trim().replace(/\/+$/, "");
        if (!target) {
            notifyError("Введите URL перед тестом.");
            return;
        }
        setTesting(true);
        setTestResult("idle");
        try {
            const endpoints = ["/health", "/docs"];
            let ok = false;
            let lastStatus;
            for (const endpoint of endpoints) {
                const response = await fetch(`${target}${endpoint}`, { method: "GET" });
                lastStatus = response.status;
                if (response.ok) {
                    ok = true;
                    break;
                }
                if (response.status !== 404) {
                    break;
                }
            }
            if (ok) {
                setTestResult("ok");
                notifyInfo("/health отвечает. Движок онлайн.");
            }
            else {
                setTestResult("error");
                notifyError(`Нет ответа от /health или /docs (последний статус ${lastStatus ?? "—"}). Проверьте URL или запустите backend.`);
            }
        }
        catch (error) {
            setTestResult("error");
            const message = error instanceof Error ? error.message : "нет подключения";
            notifyError(`Не удалось подключиться: ${message}. Проверьте адрес и сеть.`);
        }
        finally {
            setTesting(false);
        }
    }, [value]);
    return (<section className="space-y-6 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Настройки</p>
        <h1 className="text-3xl font-semibold text-slate-900">Движок Twin Engine</h1>
        <p className="text-sm text-slate-500">
          Укажите базовый URL backend-движка (FastAPI). Клиент сохранит значение локально и будет использовать его при всех
          запросах. Пример: http://127.0.0.1:8010
        </p>
      </header>

      <div className="space-y-4 rounded-3xl border border-slate-100 bg-white/80 p-5">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
          Базовый URL движка
          <input type="text" value={value} onChange={(event) => setValue(event.target.value)} placeholder="http://127.0.0.1:8010" className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base text-slate-900 shadow-inner focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"/>
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleSave} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800">
            Сохранить
          </button>
          <button type="button" onClick={handleReset} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500">
            Сбросить по умолчанию
          </button>
          <button type="button" onClick={handleTest} disabled={testing} className="rounded-full border border-emerald-300 px-5 py-2 text-sm font-semibold text-emerald-700 hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
            {testing ? "Проверяю..." : "Проверить подключение"}
          </button>
        </div>
        {testResult === "ok" && <p className="text-sm text-emerald-600">Движок отвечает на запросы.</p>}
        {testResult === "error" && (<p className="text-sm text-red-600">Не удалось подключиться. Проверьте адрес, порт или состояние сервера.</p>)}
      </div>

      <section className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-600">
        <h2 className="text-base font-semibold text-slate-900">Подсказка</h2>
        <p className="mt-2">
          Twin Studio проверяет только <code>/health</code> и при необходимости <code>/docs</code>. Убедитесь, что один из этих
          эндпоинтов включён в вашем FastAPI, либо настройте прокси.
        </p>
      </section>
    </section>);
}
export default SettingsPage;
