import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDataTheme,
  readStoredThemePreference,
  resolveThemePreference,
  writeStoredThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  /** Переключает между светлой и тёмной, сохраняя явный выбор (не «система»). */
  toggleLightDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredThemePreference());
  const [systemEpoch, setSystemEpoch] = useState(0);

  const resolved = useMemo(() => {
    void systemEpoch;
    return resolveThemePreference(preference);
  }, [preference, systemEpoch]);

  useEffect(() => {
    applyDataTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemEpoch((n) => n + 1);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    writeStoredThemePreference(next);
    setPreferenceState(next);
  }, []);

  const toggleLightDark = useCallback(() => {
    setPreferenceState((prev) => {
      const current = resolveThemePreference(prev);
      const nextPref: ThemePreference = current === "dark" ? "light" : "dark";
      writeStoredThemePreference(nextPref);
      return nextPref;
    });
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference, toggleLightDark }),
    [preference, resolved, setPreference, toggleLightDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
