import { apiFetch } from "../../shared/api/client";
import type { RunResult } from "../../shared/api/types";

export interface RunSimulationRequest {
  project_id: string;
}

export const ENGINE_RUN_PATH = "/run";

export async function runEngineSimulation(projectId: string): Promise<RunResult> {
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new Error("Требуется project_id для запуска расчёта.");
  }
  return apiFetch<RunResult>(ENGINE_RUN_PATH, {
    method: "POST",
    json: { project_id: trimmed } satisfies RunSimulationRequest,
    silent: true,
  });
}

export const runsApi = { runEngineSimulation };
