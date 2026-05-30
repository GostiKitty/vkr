import { fetchWithTimeout } from "../../shared/http/fetchWithTimeout";
import {
  isLocalEngineUrl,
  isWebProductionRuntime,
  WEB_ENGINE_PROBE_TIMEOUT_MS,
} from "../../shared/runtime/webProduction";
import { getEngineBaseUrl } from "./engine.store";

export async function probeEngineHealth(timeoutMs = WEB_ENGINE_PROBE_TIMEOUT_MS): Promise<boolean> {
  const base = getEngineBaseUrl().trim().replace(/\/+$/, "");
  if (!base) {
    return false;
  }
  if (isWebProductionRuntime() && isLocalEngineUrl(base)) {
    return false;
  }
  const targets = ["/health", "/ping", "/docs"];
  for (const path of targets) {
    const url = `${base}${path}`;
    try {
      const response = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
      if (response.ok) {
        return true;
      }
      if (response.status !== 404) {
        return false;
      }
    } catch {
      // try next endpoint
    }
  }
  return false;
}
