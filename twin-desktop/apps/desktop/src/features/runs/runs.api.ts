import { apiFetch } from "../../shared/api/client";
import type { RunResult } from "../../shared/api/types";

export interface RunSimulationRequest {
  project_id: string;
}

export async function runEngineSimulation(projectId: string): Promise<RunResult> {
  const trimmed = projectId.trim();
  if (!trimmed) {
    throw new Error("Требуется project_id для запуска расчёта.");
  }
  return apiFetch<RunResult>("/run", {
    method: "POST",
    json: { project_id: trimmed } satisfies RunSimulationRequest,
  });
}

export const runsApi = { runEngineSimulation };
