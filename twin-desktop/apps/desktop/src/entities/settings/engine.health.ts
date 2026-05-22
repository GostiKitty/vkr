import { getEngineBaseUrl } from "./engine.store";

export async function probeEngineHealth(): Promise<boolean> {
  const base = getEngineBaseUrl().trim().replace(/\/+$/, "");
  if (!base) {
    return false;
  }
  const targets = ["/health", "/ping", "/docs"];
  for (const path of targets) {
    const url = `${base}${path}`;
    try {
      const response = await fetch(url, { method: "GET" });
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
