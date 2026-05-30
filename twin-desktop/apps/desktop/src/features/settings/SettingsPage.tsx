import {
  BUILD_PANEL_SIDE_LABELS,
  useBuildUiStore,
  type BuildPanelSide,
} from "../../entities/build/buildUi.store";
import { notifyInfo } from "../../entities/notifications/notification.store";
import { useTheme } from "../../shared/theme";
import { IconMoon, IconSun } from "../../shared/ui";

export function SettingsPage() {
  const panelSide = useBuildUiStore((state) => state.panelSide);
  const setPanelSide = useBuildUiStore((state) => state.setPanelSide);
  const { preference, resolved, setPreference } = useTheme();
  const isLightActive = preference === "light" || (preference === "system" && resolved === "light");
  const isDarkActive = preference === "dark" || (preference === "system" && resolved === "dark");

  return (
    <section className="mx-auto max-w-[min(100%,72rem)] space-y-6">
      <section className="ui-panel space-y-4 p-5 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold text-[color:var(--text-base)]">Рабочая область</h2>
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
      </section>
    </section>
  );
}

export default SettingsPage;
