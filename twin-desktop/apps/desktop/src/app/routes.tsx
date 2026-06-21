import React, { lazy, Suspense } from "react";
import ProjectPage from "../features/project/ProjectPage";

export interface AppRoute {
  id: string;
  path: string;
  title: string;
  component: React.ComponentType;
  hiddenInNav?: boolean;
}

function RouteLoadingFallback() {
  return (
    <div className="ui-panel mx-auto max-w-[min(100%,48rem)] px-5 py-8 text-sm text-[color:var(--text-muted)]">
      Загрузка раздела…
    </div>
  );
}

function lazyRoute(factory: () => Promise<{ default: React.ComponentType }>): React.ComponentType {
  const LazyPage = lazy(factory);
  return function LazyRoutePage() {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyPage />
      </Suspense>
    );
  };
}

export const routes: AppRoute[] = [
  {
    id: "project",
    path: "/",
    title: "Главная",
    component: ProjectPage,
    hiddenInNav: true,
  },
  {
    id: "model",
    path: "/model",
    title: "Модель",
    component: lazyRoute(() => import("../features/build/BuildPage")),
  },
  {
    id: "scenarios",
    path: "/scenarios",
    title: "Данные",
    component: lazyRoute(() => import("../features/scenarios/ScenariosWorkspacePage")),
  },
  {
    id: "calculation",
    path: "/calculation",
    title: "Расчёт",
    component: lazyRoute(() => import("../features/runs/CalculationWorkspacePage")),
    hiddenInNav: true,
  },
  {
    id: "uncertainty",
    path: "/uncertainty",
    title: "Анализ",
    component: lazyRoute(() => import("../features/scenarios/UncertaintyWorkspacePage")),
  },
  {
    id: "results",
    path: "/results",
    title: "Отчёты",
    component: lazyRoute(() => import("../features/reports/ResultsWorkspacePage")),
  },
  {
    id: "build",
    path: "/build",
    title: "Конструирование",
    component: lazyRoute(() => import("../features/build/BuildPage")),
    hiddenInNav: true,
  },
  {
    id: "formulas",
    path: "/formulas",
    title: "Формулы",
    component: lazyRoute(() => import("../features/formulas/FormulasPage")),
  },
  {
    id: "drawing",
    path: "/drawing",
    title: "Чертёж",
    component: lazyRoute(() => import("../features/drawings/DrawingSheetPage")),
    hiddenInNav: true,
  },
  {
    id: "settings",
    path: "/settings",
    title: "Настройки",
    component: lazyRoute(() => import("../features/settings/SettingsPage")),
  },
];

export function resolveRoute(pathname: string): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0];
}
