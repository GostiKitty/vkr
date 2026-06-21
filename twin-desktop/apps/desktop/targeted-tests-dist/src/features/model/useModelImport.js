import { useCallback, useState } from "react";
import { ApiError } from "../../shared/api/client";
import { importModel as importModelRequest } from "./model.api";
export const MODEL_IMPORT_HISTORY_LIMIT = 5;
const generateId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
export function useModelImport() {
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [history, setHistory] = useState([]);
    const [lastEndpoint, setLastEndpoint] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const importModel = useCallback(async (file, options) => {
        setIsLoading(true);
        setError(null);
        setProgress(0);
        setDebugInfo(null);
        const attemptId = generateId();
        const startedAt = Date.now();
        setHistory((prev) => [
            { id: attemptId, fileName: file.name, fileSize: file.size, startedAt, status: "pending" },
            ...prev.slice(0, MODEL_IMPORT_HISTORY_LIMIT - 1),
        ]);
        try {
            const response = await importModelRequest(file, {
                projectName: options?.projectName,
                onProgress: (value) => setProgress(value),
            });
            setResult(response.data);
            setLastEndpoint(response.endpoint);
            setDebugInfo(response.diagnostics);
            setHistory((prev) => prev.map((entry) => entry.id === attemptId
                ? {
                    ...entry,
                    status: "success",
                    projectId: response.data.project_id,
                    spacesCount: response.data.spaces_count,
                    endpoint: response.endpoint,
                }
                : entry));
            return response.data;
        }
        catch (err) {
            const friendly = describeImportError(err);
            setError(friendly);
            setLastEndpoint(null);
            const diagnostics = err.diagnostics ?? null;
            setDebugInfo(diagnostics);
            setHistory((prev) => prev.map((entry) => entry.id === attemptId
                ? {
                    ...entry,
                    status: "error",
                    message: friendly,
                    endpoint: extractEndpointFromUrl(diagnostics?.url),
                }
                : entry));
            throw err;
        }
        finally {
            setIsLoading(false);
            setTimeout(() => setProgress(0), 600);
        }
    }, []);
    const clearError = useCallback(() => setError(null), []);
    return {
        importModel,
        isLoading,
        progress,
        error,
        result,
        history,
        clearError,
        lastEndpoint,
        debugInfo,
    };
}
export function describeImportError(err) {
    if (err instanceof ApiError) {
        if (typeof err.body === "string" && err.body.trim()) {
            return err.body.trim();
        }
        if (err.body && typeof err.body === "object" && "detail" in err.body) {
            const detail = err.body.detail;
            if (typeof detail === "string" && detail.trim()) {
                return detail.trim();
            }
        }
        const status = Number.isFinite(err.status) ? err.status : "неизвестно";
        return `Сервер вернул статус ${status}. Проверьте журнал в «Консоли».`;
    }
    if (err instanceof Error) {
        return err.message;
    }
    return "Не удалось загрузить IFC. Проверьте подключение и откройте «Консоль» для деталей.";
}
export function extractEndpointFromUrl(url) {
    if (!url) {
        return undefined;
    }
    try {
        const parsed = new URL(url);
        return parsed.pathname || url;
    }
    catch {
        return url;
    }
}
