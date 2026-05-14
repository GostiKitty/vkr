import type { ImportResp } from "../../shared/api/types";
import type { ImportRequestDiagnostics } from "./model.api";

export interface ModelImportResponse extends ImportResp {}

export type ImportAttemptStatus = "pending" | "success" | "error";

export interface ImportAttempt {
  id: string;
  fileName: string;
  fileSize: number;
  startedAt: number;
  status: ImportAttemptStatus;
  message?: string;
  projectId?: string;
  spacesCount?: number;
  endpoint?: string;
}

export interface ModelImportHookResult {
  importModel: (file: File, options?: { projectName?: string }) => Promise<ModelImportResponse>;
  isLoading: boolean;
  progress: number;
  error: string | null;
  result: ModelImportResponse | null;
  history: ImportAttempt[];
  clearError: () => void;
  lastEndpoint: string | null;
  debugInfo: ImportRequestDiagnostics | null;
}
