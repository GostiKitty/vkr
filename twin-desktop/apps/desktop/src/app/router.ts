import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

if (typeof window !== "undefined") {
  window.addEventListener("popstate", notify);
}

export function navigate(path: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.pathname === path) {
    return;
  }
  window.history.pushState({}, "", path);
  notify();
}

export function usePathname(): string {
  const subscribe = (callback: Listener) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  };
  const getSnapshot = () => (typeof window === "undefined" ? "/" : window.location.pathname);
  return useSyncExternalStore(subscribe, getSnapshot, () => "/");
}
