import { apiUpload, buildUrl, ApiError, type ApiUploadOptions } from "../../shared/api/client";
import type { ImportResp } from "../../shared/api/types";

export interface ImportModelOptions extends Pick<ApiUploadOptions, "onProgress" | "signal" | "silent"> {
  projectName?: string;
}

export interface ImportRequestDiagnostics {
  method: string;
  url: string;
  headers: Record<string, string>;
  status?: number;
  responseSnippet?: string;
  error?: string;
  timestamp: number;
}

export interface ImportModelResult {
  data: ImportResp;
  endpoint: string;
  diagnostics: ImportRequestDiagnostics;
}

const IMPORT_ENDPOINTS = ["/import/ifc", "/import", "/api/import", "/ifc/import"];

export async function importModel(file: File, options?: ImportModelOptions): Promise<ImportModelResult> {
  const method = "POST";
  const buildFormData = () => {
    const formData = new FormData();
    formData.append("file", file, file.name);
    if (options?.projectName) {
      formData.append("project_name", options.projectName);
    }
    return formData;
  };

  let lastError: unknown = null;

  for (const endpoint of IMPORT_ENDPOINTS) {
    options?.onProgress?.(0);
    const absoluteUrl = buildUrl(endpoint);
    try {
      const data = await apiUpload<ImportResp>(absoluteUrl, buildFormData(), {
        method,
        onProgress: options?.onProgress,
        signal: options?.signal,
        silent: options?.silent,
      });
      return {
        data,
        endpoint,
        diagnostics: {
          method,
          url: absoluteUrl,
          headers: {},
          status: 200,
          responseSnippet: JSON.stringify(data).slice(0, 600),
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && error.status === 404) {
        continue;
      }
      attachDiagnostics(error, {
        method,
        url: absoluteUrl,
        headers: {},
        status: error instanceof ApiError ? error.status : undefined,
        responseSnippet: error instanceof ApiError ? extractSnippet(error.body) : undefined,
        error: error instanceof Error ? error.message : "Неизвестная ошибка",
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  if (lastError instanceof ApiError) {
    attachDiagnostics(lastError, {
      method,
      url: buildUrl(IMPORT_ENDPOINTS[IMPORT_ENDPOINTS.length - 1]),
      headers: {},
      status: lastError.status,
      responseSnippet: extractSnippet(lastError.body),
      error: lastError.message,
      timestamp: Date.now(),
    });
    throw lastError;
  }

  throw new Error("Не удалось найти рабочий маршрут импорта IFC.");
}

export const modelApi = { importModel };

const extractSnippet = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload.slice(0, 800);
  }
  try {
    return JSON.stringify(payload).slice(0, 800);
  } catch {
    return "";
  }
};

const attachDiagnostics = (error: unknown, diagnostics: ImportRequestDiagnostics) => {
  if (error && typeof error === "object") {
    Object.assign(error, { diagnostics });
  }
};
