import { notifyError } from "../../entities/notifications/notification.store";
import { logRequestEnd, logRequestStart } from "../../entities/debug/networkLog.store";
import { getEngineBaseUrl } from "../../entities/settings/engine.store";
export class ApiError extends Error {
    status;
    statusText;
    body;
    url;
    constructor(params) {
        super(`Request failed with status ${params.status}`);
        this.name = "ApiError";
        this.status = params.status;
        this.statusText = params.statusText;
        this.body = params.body;
        this.url = params.url;
    }
}
const ensureBaseUrl = () => {
    const runtimeBase = getEngineBaseUrl().trim().replace(/\/+$/, "");
    if (!runtimeBase) {
        throw new Error("Базовый URL движка не настроен. Откройте страницу «Настройки».");
    }
    return runtimeBase;
};
export const buildUrl = (path) => {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${ensureBaseUrl()}${normalizedPath}`;
};
const toHeaders = (input) => {
    return input instanceof Headers ? input : new Headers(input);
};
const displayNetworkError = (silent) => {
    if (!silent) {
        notifyError("Сеть недоступна. Проверьте соединение с движком.");
    }
};
const extractSnippet = (payload) => {
    if (payload == null) {
        return undefined;
    }
    if (typeof payload === "string") {
        const trimmed = payload.trim();
        return trimmed ? trimmed.slice(0, 800) : undefined;
    }
    try {
        const serialized = JSON.stringify(payload);
        return serialized ? serialized.slice(0, 800) : undefined;
    }
    catch {
        return undefined;
    }
};
export async function apiFetch(path, options = {}) {
    const { json, headers: customHeaders, silent = false, ...rest } = options;
    const headers = toHeaders(customHeaders);
    let body = rest.body;
    const method = (rest.method ?? "GET").toUpperCase();
    const url = buildUrl(path);
    if (json !== undefined) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(json);
    }
    const logId = logRequestStart(method, url);
    const startedAt = Date.now();
    let response;
    try {
        response = await fetch(url, {
            ...rest,
            headers,
            body,
        });
    }
    catch (error) {
        displayNetworkError(silent);
        logRequestEnd(logId, {
            status: undefined,
            ok: false,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : "Неизвестная сетевая ошибка",
        });
        throw error;
    }
    const contentType = response.headers.get("content-type");
    const isJson = contentType?.includes("application/json");
    const shouldParseJson = isJson && response.status !== 204;
    const payload = shouldParseJson ? await response.json() : await response.text();
    const snippet = extractSnippet(payload);
    if (!response.ok) {
        if (!silent) {
            const message = typeof payload === "string" && payload.trim().length
                ? payload
                : response.statusText || "Неизвестная ошибка";
            notifyError(`Ошибка ${response.status}: ${message}`);
        }
        logRequestEnd(logId, {
            status: response.status,
            ok: false,
            durationMs: Date.now() - startedAt,
            responseSnippet: snippet,
            error: response.statusText || "Ошибка ответа",
        });
        throw new ApiError({
            status: response.status,
            statusText: response.statusText,
            body: payload,
            url: response.url,
        });
    }
    logRequestEnd(logId, {
        status: response.status,
        ok: true,
        durationMs: Date.now() - startedAt,
        responseSnippet: snippet,
    });
    return payload ?? undefined;
}
export function apiUpload(path, formData, options = {}) {
    const method = (options.method ?? "POST").toUpperCase();
    const url = buildUrl(path);
    const logId = logRequestStart(method, url);
    const startedAt = Date.now();
    const silent = options.silent ?? false;
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const cleanup = () => {
            if (options.signal) {
                options.signal.removeEventListener("abort", abortHandler);
            }
        };
        const finalizeLog = (info) => {
            logRequestEnd(logId, {
                durationMs: Date.now() - startedAt,
                ...info,
            });
        };
        const abortHandler = () => {
            xhr.abort();
        };
        if (options.signal) {
            if (options.signal.aborted) {
                cleanup();
                const abortError = new DOMException("Aborted", "AbortError");
                finalizeLog({ ok: false, error: abortError.message });
                reject(abortError);
                return;
            }
            options.signal.addEventListener("abort", abortHandler);
        }
        if (options.onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable && event.total > 0) {
                    options.onProgress?.(event.loaded / event.total);
                }
            };
        }
        xhr.onerror = () => {
            cleanup();
            displayNetworkError(silent);
            finalizeLog({
                status: xhr.status || undefined,
                ok: false,
                error: "Ошибка сети",
            });
            reject(new Error("Сетевая ошибка при загрузке файла"));
        };
        xhr.onabort = () => {
            cleanup();
            const abortError = new DOMException("Aborted", "AbortError");
            finalizeLog({
                status: xhr.status || undefined,
                ok: false,
                error: abortError.message,
            });
            reject(abortError);
        };
        xhr.onload = () => {
            cleanup();
            const contentType = xhr.getResponseHeader("content-type") ?? "";
            const isJson = contentType.includes("application/json");
            let payload = xhr.responseText;
            if (isJson && xhr.responseText) {
                try {
                    payload = JSON.parse(xhr.responseText);
                }
                catch {
                    // fall back to text
                }
            }
            const status = xhr.status || 0;
            if (status < 200 || status >= 300) {
                if (!silent) {
                    const message = typeof payload === "string" && payload.trim().length
                        ? payload
                        : xhr.statusText || "Неизвестная ошибка";
                    notifyError(`Ошибка ${status}: ${message}`);
                }
                finalizeLog({
                    status,
                    ok: false,
                    error: xhr.statusText || "Ошибка ответа",
                    responseSnippet: extractSnippet(payload),
                });
                reject(new ApiError({
                    status,
                    statusText: xhr.statusText ?? "",
                    body: payload,
                    url,
                }));
                return;
            }
            options.onProgress?.(1);
            finalizeLog({
                status,
                ok: true,
                responseSnippet: extractSnippet(payload),
            });
            resolve(payload ?? undefined);
        };
        xhr.open(method, url, true);
        if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                xhr.setRequestHeader(key, value);
            });
        }
        xhr.send(formData);
    });
}
