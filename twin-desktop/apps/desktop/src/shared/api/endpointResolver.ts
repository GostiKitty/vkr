import { isWebProductionRuntime, WEB_API_REQUEST_TIMEOUT_MS } from "../runtime/webProduction";
import { fetchWithTimeout } from "../http/fetchWithTimeout";
import { buildUrl } from "./client";

export const importCandidates = ["/import/ifc", "/import", "/api/import", "/ifc/import"];
export const twinCandidates = [
  { type: "projectPath" as const, template: "/twin/{id}" },
  { type: "query" as const, path: "/twin" },
  { type: "query" as const, path: "/api/twin" },
  { type: "projectPath" as const, template: "/projects/{id}/twin" },
];

let cachedImportPath: string | null = null;
let cachedTwinConfig: (typeof twinCandidates)[number] | null = null;

async function fetchDocs(): Promise<string | null> {
  if (isWebProductionRuntime()) {
    return null;
  }
  try {
    const response = await fetchWithTimeout(buildUrl("/docs"), { method: "GET" }, WEB_API_REQUEST_TIMEOUT_MS);
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

async function probePath(path: string): Promise<boolean> {
  if (isWebProductionRuntime()) {
    return false;
  }
  try {
    const response = await fetchWithTimeout(buildUrl(path), { method: "OPTIONS" }, WEB_API_REQUEST_TIMEOUT_MS);
    if (response.ok) {
      return true;
    }
    if (response.status !== 404) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function resolveImportPath(): Promise<string> {
  if (cachedImportPath) {
    return cachedImportPath;
  }
  if (isWebProductionRuntime()) {
    cachedImportPath = importCandidates[0];
    return cachedImportPath;
  }
  const docs = await fetchDocs();
  if (docs) {
    const found = importCandidates.find((candidate) => docs.includes(candidate));
    if (found) {
      cachedImportPath = found;
      return found;
    }
  }
  for (const candidate of importCandidates) {
    if (await probePath(candidate)) {
      cachedImportPath = candidate;
      return candidate;
    }
  }
  cachedImportPath = importCandidates[0];
  return cachedImportPath;
}

export async function resolveTwinConfig(): Promise<(typeof twinCandidates)[number]> {
  if (cachedTwinConfig) {
    return cachedTwinConfig;
  }
  if (isWebProductionRuntime()) {
    cachedTwinConfig = twinCandidates[0];
    return cachedTwinConfig;
  }
  const docs = await fetchDocs();
  if (docs) {
    for (const candidate of twinCandidates) {
      const searchTerm = candidate.type === "query" ? candidate.path : candidate.template.replace("{id}", "");
      if (docs.includes(searchTerm)) {
        cachedTwinConfig = candidate;
        return candidate;
      }
    }
  }
  for (const candidate of twinCandidates) {
    const path =
      candidate.type === "query" ? `${candidate.path}?project_id=probe` : candidate.template.replace("{id}", "probe");
    if (await probePath(path)) {
      cachedTwinConfig = candidate;
      return candidate;
    }
  }
  cachedTwinConfig = twinCandidates[0];
  return cachedTwinConfig;
}
