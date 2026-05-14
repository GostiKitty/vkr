import BuildPage from "../features/build/BuildPage";
import TwinPage from "../features/twin/TwinPage";
import FormulasPage from "../features/formulas/FormulasPage";
import SettingsPage from "../features/settings/SettingsPage";
export const routes = [
    {
        id: "studio",
        path: "/",
        title: "Twin Studio",
        component: TwinPage,
    },
    {
        id: "build",
        path: "/build",
        title: "Build Mode",
        component: BuildPage,
    },
    {
        id: "formulas",
        path: "/formulas",
        title: "Theory",
        component: FormulasPage,
    },
    {
        id: "settings",
        path: "/settings",
        title: "Settings",
        component: SettingsPage,
    },
];
export function resolveRoute(pathname) {
    return routes.find((route) => route.path === pathname) ?? routes[0];
}
