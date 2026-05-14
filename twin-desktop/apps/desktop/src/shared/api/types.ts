export interface Space {
  id: string;
  name: string;
  long_name?: string | null;
  level?: string | null;
  area_m2?: number | null;
  volume_m3?: number | null;
}

export interface TwinMeta {
  schema_version: string;
  source: string;
  created_at: string;
  ifc_filename?: string;
  [key: string]: unknown;
}

export interface TwinBuilding {
  name: string | null;
  [key: string]: unknown;
}

export interface Twin {
  meta: TwinMeta;
  building: TwinBuilding;
  spaces: Space[];
  envelope?: unknown[];
  systems?: Record<string, unknown>;
  assumptions?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ImportResp {
  project_id: string;
  spaces_count: number;
}

export interface RunResultMetric {
  key: string;
  label?: string;
  unit?: string;
  value: number;
}

export type RunStatus = "pending" | "running" | "completed" | "failed";

export interface RunResult {
  id: string;
  project_id: string;
  scenario_id?: string;
  status: RunStatus;
  started_at: string;
  finished_at?: string;
  metrics?: RunResultMetric[];
  payload?: Record<string, unknown>;
  attachments?: Record<string, string>;
}
