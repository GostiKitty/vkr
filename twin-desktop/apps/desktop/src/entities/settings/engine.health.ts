import { getEngineBaseUrl } from "./engine.store";

export async function probeEngineHealth(): Promise<boolean> {
  const base = getEngineBaseUrl().trim().replace(/\/+$/, "");
  if (!base) {
    return false;
  }
  const targets = ["/health", "/docs"];
  for (const path of targets) {
    try {
      const response = await fetch(`${base}${path}`, { method: "GET" });
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
