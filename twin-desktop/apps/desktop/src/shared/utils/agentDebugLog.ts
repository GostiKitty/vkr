export type AgentDebugPayload = {
  sessionId: string;
  runId: string;
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
};

type AgentDebugWindow = Window & {
  __agentDebugLog?: (line: string) => void;
};

export function writeAgentDebugLog(payload: AgentDebugPayload): void {
  try {
    (window as AgentDebugWindow).__agentDebugLog?.(JSON.stringify(payload));
  } catch {
    // Ignore logging failures in debug-only instrumentation.
  }
}
