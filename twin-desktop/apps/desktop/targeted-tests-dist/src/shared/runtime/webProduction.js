/** Production web deploy (Vercel): browser app without local Python engine / Electron. */
export function isWebProductionRuntime() {
    return import.meta.env.VITE_WEB_DEMO === "true";
}
export function isLocalEngineUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) {
        return false;
    }
    try {
        const parsed = new URL(trimmed.startsWith("http") ? trimmed : `http://${trimmed}`);
        const host = parsed.hostname.toLowerCase();
        return host === "127.0.0.1" || host === "localhost" || host === "::1";
    }
    catch {
        return /localhost|127\.0\.0\.1/i.test(trimmed);
    }
}
export const WEB_ENGINE_PROBE_TIMEOUT_MS = 3_000;
export const WEB_API_REQUEST_TIMEOUT_MS = 4_000;
