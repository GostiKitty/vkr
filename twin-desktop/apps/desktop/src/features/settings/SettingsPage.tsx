import { useCallback, useState } from "react";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";

export function SettingsPage() {
  const baseUrl = useEngineSettingsStore((state) => state.baseUrl);
  const setBaseUrl = useEngineSettingsStore((state) => state.setBaseUrl);
  const resetToDefault = useEngineSettingsStore((state) => state.resetToDefault);
  const [value, setValue] = useState(baseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "error">("idle");

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
      let lastStatus: number | undefined;
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
      } else {
        setTestResult("error");
        notifyError(`Нет ответа от /health или /docs (последний статус ${lastStatus ?? "—"}). Проверьте URL или запустите backend.`);
      }
    } catch (error) {
      setTestResult("error");
      const message = error instanceof Error ? error.message : "нет подключения";
      notifyError(`Не удалось подключиться: ${message}. Проверьте адрес и сеть.`);
    } finally {
      setTesting(false);
    }
  }, [value]);

  return (
    <section className="ui-panel mx-auto max-w-[min(100%,48rem)] space-y-6 p-6 sm:p-7">
      <header className="space-y-2">
        <p className="ui-kicker">Настройки</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text-base)]">Движок расчёта</h1>
        <p className="text-sm text-[color:var(--text-muted)]">
          Базовый URL backend (FastAPI). Значение хранится локально и используется для импорта IFC и серверных запросов. Пример:{" "}
          <span className="font-mono text-[color:var(--text-base)]">http://127.0.0.1:8010</span>
        </p>
      </header>

      <div className="ui-section space-y-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-[color:var(--text-muted)]">
          Базовый URL движка
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="http://127.0.0.1:8010"
            className="ui-field px-4 py-2 text-base shadow-inner"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleSave} className="ui-btn-primary px-5 py-2 text-sm">
            Сохранить
          </button>
          <button type="button" onClick={handleReset} className="ui-btn-secondary px-5 py-2 text-sm">
            Сбросить по умолчанию
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-full border border-[color:var(--success-border)] bg-[color:var(--success-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--success-fg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {testing ? "Проверяю…" : "Проверить подключение"}
          </button>
        </div>
        {testResult === "ok" && <p className="text-sm text-[color:var(--success-fg)]">Движок отвечает на запросы.</p>}
        {testResult === "error" && (
          <p className="text-sm text-[color:var(--danger-fg)]">Не удалось подключиться. Проверьте адрес, порт или состояние сервера.</p>
        )}
      </div>

      <section className="ui-panel-muted p-4 text-sm text-[color:var(--text-muted)]">
        <h2 className="text-base font-semibold text-[color:var(--text-base)]">Подсказка</h2>
        <p className="mt-2 leading-relaxed">
          Студия проверяет <code className="rounded bg-[color:var(--surface-strong)] px-1.5 py-0.5 font-mono text-xs">/health</code> и при
          необходимости <code className="rounded bg-[color:var(--surface-strong)] px-1.5 py-0.5 font-mono text-xs">/docs</code>. Убедитесь, что один из
          эндпоинтов доступен в FastAPI или настройте прокси.
        </p>
      </section>
    </section>
  );
}

export default SettingsPage;
