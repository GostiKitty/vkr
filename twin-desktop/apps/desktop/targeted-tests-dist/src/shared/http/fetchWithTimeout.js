export class FetchTimeoutError extends Error {
    constructor(message = "Превышено время ожидания ответа") {
        super(message);
        this.name = "FetchTimeoutError";
    }
}
export async function fetchWithTimeout(input, init = {}, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const parentSignal = init.signal;
    const onParentAbort = () => controller.abort();
    if (parentSignal) {
        if (parentSignal.aborted) {
            controller.abort();
        }
        else {
            parentSignal.addEventListener("abort", onParentAbort, { once: true });
        }
    }
    try {
        return await fetch(input, { ...init, signal: controller.signal });
    }
    catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            throw new FetchTimeoutError();
        }
        throw error;
    }
    finally {
        window.clearTimeout(timeoutId);
        if (parentSignal) {
            parentSignal.removeEventListener("abort", onParentAbort);
        }
    }
}
