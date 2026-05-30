export const THEME_STORAGE_KEY = "gnezdyshko-theme";
export function resolveThemePreference(pref) {
    if (pref === "light" || pref === "dark") {
        return pref;
    }
    if (typeof window === "undefined") {
        return "light";
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function readStoredThemePreference() {
    if (typeof window === "undefined") {
        return "system";
    }
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") {
        return raw;
    }
    return "system";
}
export function writeStoredThemePreference(pref) {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
}
export function applyDataTheme(resolved) {
    document.documentElement.setAttribute("data-theme", resolved);
}
export function readResolvedThemeFromDom() {
    if (typeof document === "undefined") {
        return "light";
    }
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
