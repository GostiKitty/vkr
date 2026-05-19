import { useCallback, useMemo, useState } from "react";
import {
  BUILD_PANEL_SIDE_LABELS,
  BUILD_TOOLS_PLACEMENT_LABELS,
  useBuildUiStore,
  type BuildPanelSide,
  type BuildToolsPlacement,
} from "../../entities/build/buildUi.store";
import { useDebugConsoleStore } from "../../entities/debug/debugConsole.store";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
import { navigate } from "../../app/router";

export function SettingsPage() {
  const openDebug = useDebugConsoleStore((state) => state.open);
  const showDeveloperTools = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).has("debug");
  }, []);

  const baseUrl = useEngineSettingsStore((state) => state.baseUrl);
  const setBaseUrl = useEngineSettingsStore((state) => state.setBaseUrl);
  const resetToDefault = useEngineSettingsStore((state) => state.resetToDefault);
  const panelSide = useBuildUiStore((state) => state.panelSide);
  const setPanelSide = useBuildUiStore((state) => state.setPanelSide);
  const toolsPlacement = useBuildUiStore((state) => state.toolsPlacement);
  const setToolsPlacement = useBuildUiStore((state) => state.setToolsPlacement);
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
    <section className="mx-auto max-w-[min(100%,72rem)] space-y-6">
      <header className="space-y-2">
        <p className="ui-kicker">Настройки</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--text-base)]">Настройки приложения</h1>
        <p className="text-sm text-[color:var(--text-muted)]">
          Проектные параметры, расчётные допущения, визуализация, интерфейс, экспорт и диагностика разделены по назначению.
        </p>
      </header>

      <section className="ui-panel space-y-4 p-5 sm:p-6">
        <div>
          <p className="ui-kicker">Настройки проекта</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Движок и импорт</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Базовый URL backend (FastAPI). Значение хранится локально и используется для импорта IFC и серверных запросов. Пример:{" "}
            <span className="font-mono text-[color:var(--text-base)]">http://127.0.0.1:8010</span>
          </p>
        </div>
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
      </section>

      <section className="ui-panel space-y-4 p-5 sm:p-6">
        <div>
          <p className="ui-kicker">Визуализация</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Рабочая область</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Положение панели инструментов, проводника и инспектора в режимах План, 3D, Сети и Теплокарта.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BUILD_PANEL_SIDE_LABELS) as BuildPanelSide[]).map((side) => (
            <button
              key={side}
              type="button"
              onClick={() => {
                setPanelSide(side);
                notifyInfo(`Панель инструментов: ${BUILD_PANEL_SIDE_LABELS[side]}.`);
              }}
              className={`ui-control rounded-full px-4 py-2 text-sm font-semibold transition ${
                panelSide === side
                  ? "ui-control-active border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)]"
                  : "border-[color:var(--border-soft)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
              }`}
            >
              {BUILD_PANEL_SIDE_LABELS[side]}
            </button>
          ))}
        </div>
        <div className="border-t border-[color:var(--border-soft)] pt-4">
          <h3 className="text-sm font-semibold text-[color:var(--text-base)]">Расположение быстрых инструментов</h3>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Верхняя панель освобождает проводник, левая панель оставляет классическую палитру, компактный режим показывает только основные действия.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(BUILD_TOOLS_PLACEMENT_LABELS) as BuildToolsPlacement[]).map((placement) => (
              <button
                key={placement}
                type="button"
                onClick={() => {
                  setToolsPlacement(placement);
                  notifyInfo(`Инструменты: ${BUILD_TOOLS_PLACEMENT_LABELS[placement]}.`);
                }}
                className={`ui-control rounded-full px-4 py-2 text-sm font-semibold transition ${
                  toolsPlacement === placement
                    ? "ui-control-active border-[color:var(--accent-muted)] bg-[color:var(--accent-soft)] text-[color:var(--text-base)]"
                    : "border-[color:var(--border-soft)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
                }`}
              >
                {BUILD_TOOLS_PLACEMENT_LABELS[placement]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="ui-panel space-y-3 p-5">
          <p className="ui-kicker">Расчётные допущения</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Сценарий и формулы</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Температуры, ACH, внутренние теплопоступления и климат редактируются рядом с формулами, чтобы инженерные параметры не смешивались с темой интерфейса.
          </p>
          <button type="button" onClick={() => navigate("/formulas")} className="ui-btn-secondary px-4 py-2 text-sm">
            Открыть формулы и допущения
          </button>
        </div>

        <div className="ui-panel space-y-3 p-5">
          <p className="ui-kicker">Единицы измерения</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Метрическая система</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Текущая среда использует м, м², м³, °C, Вт, кВт и кВт·ч. Переключатель единиц можно добавить без изменения расчётного ядра.
          </p>
        </div>

        <div className="ui-panel space-y-3 p-5">
          <p className="ui-kicker">Тема и интерфейс</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Внешний вид</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Переключатель темы вынесен в верхнюю панель. Здесь остаются настройки компоновки и подсказки интерфейса.
          </p>
        </div>

        <div className="ui-panel space-y-3 p-5">
          <p className="ui-kicker">Экспорт</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Отчёты и снимки</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Экспорт отчёта доступен из меню проекта и из режима «Результаты». Снимки видов хранятся в боковой панели проекта.
          </p>
        </div>
      </section>

      <section className="ui-panel space-y-3 p-5 sm:p-6">
        <p className="ui-kicker">Диагностика</p>
        <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Подключение и отладка</h2>
        <p className="text-sm text-[color:var(--text-muted)]">
          Приложение проверяет <code className="rounded bg-[color:var(--surface-strong)] px-1.5 py-0.5 font-mono text-xs">/health</code> и при
          необходимости <code className="rounded bg-[color:var(--surface-strong)] px-1.5 py-0.5 font-mono text-xs">/docs</code>. Убедитесь, что один из
          эндпоинтов доступен в FastAPI или настройте прокси.
        </p>
        <p className="text-sm text-[color:var(--text-muted)]">
          Консоль HTTP-запросов для отладки импорта и API.{" "}
          {showDeveloperTools ? "Режим ?debug=1 активен." : "Добавьте ?debug=1 к адресу для расширенных подсказок."}
        </p>
        <button type="button" onClick={openDebug} className="ui-control rounded-full px-4 py-2 text-sm font-medium">
          Открыть консоль отладки
        </button>
      </section>
    </section>
  );
}

export default SettingsPage;
