import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
const FILE_ROUTE_PARAM = "route";

const notify = () => {
  listeners.forEach((listener) => listener());
};

if (typeof window !== "undefined") {
  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
}

function isFileProtocolLocation(locationLike: Pick<Location, "protocol"> | URL): boolean {
  return locationLike.protocol === "file:";
}

function normalizePathname(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

interface ParsedAppTarget {
  pathname: string;
  searchParams: URLSearchParams;
  hash: string;
}

function parseAppTarget(path: string): ParsedAppTarget {
  const trimmed = path.trim();
  const [pathAndSearch, rawHash = ""] = trimmed.split("#", 2);
  const [rawPathname = "/", rawSearch = ""] = pathAndSearch.split("?", 2);
  return {
    pathname: normalizePathname(rawPathname),
    searchParams: new URLSearchParams(rawSearch),
    hash: rawHash ? `#${rawHash}` : "",
  };
}

export function resolveAppPathname(locationLike: Pick<Location, "protocol" | "pathname" | "search">): string {
  if (!isFileProtocolLocation(locationLike)) {
    return normalizePathname(locationLike.pathname);
  }
  const params = new URLSearchParams(locationLike.search);
  return normalizePathname(params.get(FILE_ROUTE_PARAM) ?? "/");
}

export function buildNavigationHref(currentHref: string, path: string): string {
  const target = parseAppTarget(path);
  const currentUrl = new URL(currentHref);

  if (!isFileProtocolLocation(currentUrl)) {
    currentUrl.pathname = target.pathname;
    currentUrl.search = target.searchParams.toString() ? `?${target.searchParams.toString()}` : "";
    currentUrl.hash = target.hash;
    return currentUrl.toString();
  }

  const nextUrl = new URL(currentHref);
  const nextSearch = new URLSearchParams();
  nextSearch.set(FILE_ROUTE_PARAM, target.pathname);
  target.searchParams.forEach((value, key) => {
    nextSearch.append(key, value);
  });
  nextUrl.search = `?${nextSearch.toString()}`;
  nextUrl.hash = target.hash;
  return nextUrl.toString();
}

export function navigate(path: string) {
  if (typeof window === "undefined") {
    return;
  }

  const nextHref = buildNavigationHref(window.location.href, path);
  if (nextHref === window.location.href) {
    return;
  }

  window.history.pushState({}, "", nextHref);
  notify();
}

export function usePathname(): string {
  const subscribe = (callback: Listener) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  };
  const getSnapshot = () => (typeof window === "undefined" ? "/" : resolveAppPathname(window.location));
  return useSyncExternalStore(subscribe, getSnapshot, () => "/");
}
