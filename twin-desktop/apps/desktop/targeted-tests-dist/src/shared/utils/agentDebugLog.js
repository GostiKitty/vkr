export function writeAgentDebugLog(payload) {
    try {
        window.__agentDebugLog?.(JSON.stringify(payload));
    }
    catch {
        // Ignore logging failures in debug-only instrumentation.
    }
}
