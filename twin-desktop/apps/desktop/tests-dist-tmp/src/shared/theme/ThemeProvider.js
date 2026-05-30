import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from "react";
import { applyDataTheme, readStoredThemePreference, resolveThemePreference, writeStoredThemePreference, } from "./theme";
const ThemeContext = createContext(null);
export function ThemeProvider({ children }) {
    const [preference, setPreferenceState] = useState(() => readStoredThemePreference());
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
    const setPreference = useCallback((next) => {
        writeStoredThemePreference(next);
        setPreferenceState(next);
    }, []);
    const toggleLightDark = useCallback(() => {
        setPreferenceState((prev) => {
            const current = resolveThemePreference(prev);
            const nextPref = current === "dark" ? "light" : "dark";
            writeStoredThemePreference(nextPref);
            return nextPref;
        });
    }, []);
    const value = useMemo(() => ({ preference, resolved, setPreference, toggleLightDark }), [preference, resolved, setPreference, toggleLightDark]);
    return _jsx(ThemeContext.Provider, { value: value, children: children });
}
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within ThemeProvider");
    }
    return ctx;
}
