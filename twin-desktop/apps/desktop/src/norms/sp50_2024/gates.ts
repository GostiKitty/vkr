export const GATE_REQUIRED_RESISTANCE: Record<string, number> = {
  uninsulated: 0.7,
  insulated: 1.2,
  coldStorage: 1.6,
};

export function getGateRequiredResistance(gateType: string): number | null {
  return GATE_REQUIRED_RESISTANCE[gateType] ?? null;
}
