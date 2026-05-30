import { useMemo } from "react";
import { navigate } from "./router";
import { routes } from "./routes";
import { useWorkspaceStore } from "../entities/workspace/workspace.store";
import { TherNestLogo } from "../shared/ui/TherNestLogo";

interface TopBarProps {
  currentPath: string;
}

export function TopBar({ currentPath }: TopBarProps) {
  const setWorkspaceMode = useWorkspaceStore((state) => state.setMode);
  const dispatchProjectCommand = useWorkspaceStore((state) => state.dispatchProjectCommand);

  const isHome = currentPath === "/";
  const navigationRoutes = useMemo(
    () =>
      routes.filter(
        (route) =>
          !route.hiddenInNav &&
          (route.id === "model" ||
            route.id === "scenarios" ||
            route.id === "results" ||
            route.id === "formulas" ||
            route.id === "settings")
      ),
    []
  );

  return (
    <header className={`sticky top-0 z-40 ${isHome ? "bg-transparent" : "border-b border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/90 backdrop-blur-xl"}`}>
      <div className={`mx-auto px-3 py-3 sm:px-6 xl:px-10 ${isHome ? "max-w-[76rem]" : "max-w-[min(100%,100rem)]"}`}>
        <div className={`ui-floating-nav flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4`}>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="group flex shrink-0 items-center gap-2 rounded-full px-2 py-1 text-left transition hover:bg-[color:var(--surface-muted)]"
            title="На главную"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)] shadow-[var(--accent-glow)]">
              <TherNestLogo size={22} aria-hidden />
            </span>
            <span className="hidden font-extrabold tracking-tight text-[color:var(--text-base)] sm:inline">
              Гнездышко
            </span>
          </button>

          <nav className="ui-topbar-menu order-3 w-full sm:order-none sm:w-auto" aria-label="Основные разделы">
            <button
              type="button"
              onClick={() => navigate("/")}
              className={`ui-topbar-link ${currentPath === "/" ? "ui-topbar-link--active" : ""}`}
            >
              Главная
            </button>
            {navigationRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => navigate(route.path)}
                title={route.id === "scenarios" ? "Данные" : route.title}
                data-testid={`route-tab-${route.id}`}
                aria-current={currentPath === route.path ? "page" : undefined}
                className={`ui-topbar-link ${currentPath === route.path ? "ui-topbar-link--active" : ""}`}
              >
                {route.id === "scenarios" ? "Данные" : route.title}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setWorkspaceMode("results");
                dispatchProjectCommand("run-full-analysis");
                navigate("/results");
              }}
              className="ui-btn-primary px-4 py-2 text-sm"
              title="Запустить расчёт, Monte Carlo и открыть отчёты"
            >
              Запустить расчёт
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
