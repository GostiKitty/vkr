import { useSyncExternalStore } from "react";
const listeners = new Set();
const notify = () => {
    listeners.forEach((listener) => listener());
};
if (typeof window !== "undefined") {
    window.addEventListener("popstate", notify);
}
export function navigate(path) {
    if (typeof window === "undefined") {
        return;
    }
    if (window.location.pathname === path) {
        return;
    }
    window.history.pushState({}, "", path);
    notify();
}
export function usePathname() {
    const subscribe = (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
    };
    const getSnapshot = () => (typeof window === "undefined" ? "/" : window.location.pathname);
    return useSyncExternalStore(subscribe, getSnapshot, () => "/");
}
