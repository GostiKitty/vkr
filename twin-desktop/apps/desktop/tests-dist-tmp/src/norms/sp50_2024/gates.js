export const GATE_REQUIRED_RESISTANCE = {
    uninsulated: 0.7,
    insulated: 1.2,
    coldStorage: 1.6,
};
export function getGateRequiredResistance(gateType) {
    return GATE_REQUIRED_RESISTANCE[gateType] ?? null;
}
