export const THEME_STORAGE_KEY = "gnezdyshko-theme";

export type ThemePreference = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

export function resolveThemePreference(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") {
    return pref;
  }
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

export function writeStoredThemePreference(pref: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

export function applyDataTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function readResolvedThemeFromDom(): ResolvedTheme {
  if (typeof document === "undefined") {
    return "light";
  }
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
