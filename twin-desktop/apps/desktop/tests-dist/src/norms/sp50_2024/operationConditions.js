const OPERATION_CONDITION_TABLE = {
    dry: {
        dry: "A",
        normal: "A",
        wet: "B",
    },
    normal: {
        dry: "A",
        normal: "B",
        wet: "B",
    },
    wet: {
        dry: "B",
        normal: "B",
        wet: "B",
    },
    veryWet: {
        dry: "B",
        normal: "B",
        wet: "B",
    },
};
export function getOperationCondition(input) {
    return OPERATION_CONDITION_TABLE[input.moistureMode][input.humidityZone];
}
export { OPERATION_CONDITION_TABLE };
