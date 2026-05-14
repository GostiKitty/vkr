import React from "react";
import BuildPage from "../features/build/BuildPage";
import TwinPage from "../features/twin/TwinPage";
import FormulasPage from "../features/formulas/FormulasPage";
import SettingsPage from "../features/settings/SettingsPage";

export interface AppRoute {
  id: string;
  path: string;
  title: string;
  component: React.ComponentType;
}

export const routes: AppRoute[] = [
  {
    id: "studio",
    path: "/",
    title: "Студия",
    component: TwinPage,
  },
  {
    id: "build",
    path: "/build",
    title: "Конструирование",
    component: BuildPage,
  },
  {
    id: "formulas",
    path: "/formulas",
    title: "Формулы",
    component: FormulasPage,
  },
  {
    id: "settings",
    path: "/settings",
    title: "Настройки",
    component: SettingsPage,
  },
];

export function resolveRoute(pathname: string): AppRoute {
  return routes.find((route) => route.path === pathname) ?? routes[0];
}
