import { apiUpload, buildUrl, ApiError } from "../../shared/api/client";
const IMPORT_ENDPOINTS = ["/import", "/api/import", "/ifc/import"];
export async function importModel(file, options) {
    const method = "POST";
    const buildFormData = () => {
        const formData = new FormData();
        formData.append("file", file, file.name);
        if (options?.projectName) {
            formData.append("project_name", options.projectName);
        }
        return formData;
    };
    let lastError = null;
    for (const endpoint of IMPORT_ENDPOINTS) {
        options?.onProgress?.(0);
        const absoluteUrl = buildUrl(endpoint);
        try {
            const data = await apiUpload(absoluteUrl, buildFormData(), {
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
        }
        catch (error) {
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
    throw new Error("Не удалось найти рабочий эндпоинт импорта");
}
export const modelApi = { importModel };
const extractSnippet = (payload) => {
    if (typeof payload === "string") {
        return payload.slice(0, 800);
    }
    try {
        return JSON.stringify(payload).slice(0, 800);
    }
    catch {
        return "";
    }
};
const attachDiagnostics = (error, diagnostics) => {
    if (error && typeof error === "object") {
        Object.assign(error, { diagnostics });
    }
};
