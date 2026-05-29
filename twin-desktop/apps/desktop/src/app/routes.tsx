import React from "react";
import BuildPage from "../features/build/BuildPage";
import TwinPage from "../features/twin/TwinPage";
import FormulasPage from "../features/formulas/FormulasPage";
import SettingsPage from "../features/settings/SettingsPage";
import ProjectPage from "../features/project/ProjectPage";
import ScenariosWorkspacePage from "../features/scenarios/ScenariosWorkspacePage";
import CalculationWorkspacePage from "../features/runs/CalculationWorkspacePage";
import UncertaintyWorkspacePage from "../features/scenarios/UncertaintyWorkspacePage";
import ResultsWorkspacePage from "../features/reports/ResultsWorkspacePage";
import DrawingSheetPage from "../features/drawings/DrawingSheetPage";

export interface AppRoute {
  id: string;
  path: string;
  title: string;
  component: React.ComponentType;
  hiddenInNav?: boolean;
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
    component: BuildPage,
  },
  {
    id: "scenarios",
    path: "/scenarios",
    title: "Данные",
    component: ScenariosWorkspacePage,
  },
  {
    id: "calculation",
    path: "/calculation",
    title: "Расчёт",
    component: CalculationWorkspacePage,
    hiddenInNav: true,
  },
  {
    id: "uncertainty",
    path: "/uncertainty",
    title: "Анализ",
    component: UncertaintyWorkspacePage,
  },
  {
    id: "results",
    path: "/results",
    title: "Отчёты",
    component: ResultsWorkspacePage,
  },
  {
    id: "build",
    path: "/build",
    title: "Конструирование",
    component: BuildPage,
    hiddenInNav: true,
  },
  {
    id: "formulas",
    path: "/formulas",
    title: "Формулы",
    component: FormulasPage,
  },
  {
    id: "drawing",
    path: "/drawing",
    title: "Чертёж",
    component: DrawingSheetPage,
    hiddenInNav: true,
  },
  {
    id: "settings",
    path: "/settings",
    title: "Настройки",
    component: SettingsPage,
  },
  {
    id: "studio",
    path: "/studio",
    title: "Студия",
    component: TwinPage,
    hiddenInNav: true,
  },
];

export function resolveRoute(pathname: string): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0];
}
