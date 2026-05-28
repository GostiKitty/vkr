import { useEffect, useState } from "react";
import {
  BUILD_PANEL_SIDE_LABELS,
  BUILD_TOOLS_PLACEMENT_LABELS,
  useBuildUiStore,
  type BuildPanelSide,
  type BuildToolsPlacement,
} from "../../entities/build/buildUi.store";
import { notifyInfo } from "../../entities/notifications/notification.store";
import { navigate } from "../../app/router";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { probeEngineHealth } from "../../entities/settings/engine.health";
import { useTheme } from "../../shared/theme";
import { IconMoon, IconSun } from "../../shared/ui";

type EngineStatus = "online" | "offline" | "checking";

export function SettingsPage() {
  const panelSide = useBuildUiStore((state) => state.panelSide);
  const setPanelSide = useBuildUiStore((state) => state.setPanelSide);
  const toolsPlacement = useBuildUiStore((state) => state.toolsPlacement);
  const setToolsPlacement = useBuildUiStore((state) => state.setToolsPlacement);
  const engineBase = useEngineSettingsStore((state) => state.baseUrl.trim());
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("checking");
  const { preference, resolved, setPreference } = useTheme();
  const isLightActive = preference === "light" || (preference === "system" && resolved === "light");
  const isDarkActive = preference === "dark" || (preference === "system" && resolved === "dark");

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

  const engineDotClass =
    !engineBase || engineStatus === "offline"
      ? "bg-[color:var(--danger-fg)]"
      : engineStatus === "online"
        ? "bg-[color:var(--success-fg)]"
        : "bg-[color:var(--warning-fg)]";
  const engineStatusText = !engineBase
    ? "Сервер не настроен"
    : engineStatus === "checking"
      ? "Проверка доступности..."
      : engineStatus === "online"
        ? "Сервер доступен"
        : "Сервер недоступен";

  return (
    <section className="mx-auto max-w-[min(100%,72rem)] space-y-6">
      <section className="ui-panel space-y-4 p-5 sm:p-6">
        <div>
          <p className="ui-soft-kicker">Визуализация</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Рабочая область</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Положение панели инструментов, проводника и инспектора в режимах План, 3D, Сети и Результаты.
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
          <p className="ui-soft-kicker">Внешний вид</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Тема оформления</h2>
          <div
            className="inline-flex h-9 items-center gap-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-1"
            title="Тема оформления"
          >
            <button
              type="button"
              onClick={() => setPreference("light")}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
                isLightActive
                  ? "bg-[color:var(--surface-elevated)] text-[color:var(--accent-base)] shadow-[var(--shadow-control)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text-base)]"
              }`}
              aria-label="Светлая тема"
              aria-pressed={isLightActive}
            >
              <IconSun size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPreference("dark")}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition ${
                isDarkActive
                  ? "bg-[color:var(--surface-elevated)] text-[color:var(--accent-base)] shadow-[var(--shadow-control)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--text-base)]"
              }`}
              aria-label="Тёмная тема"
              aria-pressed={isDarkActive}
            >
              <IconMoon size={16} />
            </button>
          </div>
        </div>

        <div className="ui-panel space-y-3 p-5">
          <p className="ui-soft-kicker">Подключение</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Сервер движка</h2>
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-1.5 text-sm text-[color:var(--text-muted)]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${engineDotClass}`} />
            <span className="font-medium">{engineStatusText}</span>
          </div>
        </div>

        <div className="ui-panel space-y-3 p-5">
          <p className="ui-soft-kicker">Расчётные допущения</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Сценарий и формулы</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Температуры, ACH, внутренние теплопоступления и климат редактируются рядом с формулами, чтобы инженерные параметры не смешивались с темой интерфейса.
          </p>
          <button type="button" onClick={() => navigate("/formulas")} className="ui-btn-secondary px-4 py-2 text-sm">
            Открыть формулы и допущения
          </button>
        </div>

        <div className="ui-panel space-y-3 p-5">
          <p className="ui-soft-kicker">Единицы измерения</p>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Метрическая система</h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Текущая среда использует м, м², м³, °C, Вт, кВт и кВт·ч. Переключатель единиц можно добавить без изменения расчётного ядра.
          </p>
        </div>
      </section>
    </section>
  );
}

export default SettingsPage;
