import type { Sp50HumidityZone, Sp50MoistureMode, Sp50OperationCondition } from "../../entities/geometry/types";

const OPERATION_CONDITION_TABLE: Record<Sp50MoistureMode, Record<Sp50HumidityZone, Sp50OperationCondition>> = {
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

export function getOperationCondition(input: {
  moistureMode: Sp50MoistureMode;
  humidityZone: Sp50HumidityZone;
}): Sp50OperationCondition {
  return OPERATION_CONDITION_TABLE[input.moistureMode][input.humidityZone];
}

export { OPERATION_CONDITION_TABLE };
