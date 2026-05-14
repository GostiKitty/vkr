import { apiFetch } from "../../shared/api/client";
import { resolveTwinConfig } from "../../shared/api/endpointResolver";
import type { Twin } from "../../shared/api/types";

export async function fetchTwin(projectId: string, signal?: AbortSignal, silent = false): Promise<Twin> {
  if (!projectId) {
    throw new Error("Project ID is required to fetch twin data");
  }

  const config = await resolveTwinConfig();
  const encodedId = encodeURIComponent(projectId);
  const path =
    config.type === "query"
      ? `${config.path}?project_id=${encodedId}`
      : config.template.replace("{id}", encodedId);

  return apiFetch<Twin>(path, {
    method: "GET",
    signal,
    silent,
  });
}

export const twinApi = { fetchTwin };
