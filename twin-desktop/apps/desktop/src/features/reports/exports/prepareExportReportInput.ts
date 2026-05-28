import {
  applyDemoDesignDefaults,
  type AssumptionEntry,
} from "./defaults/demoHouseDesignDefaults";
import type {
  BuildReportBaseDataInput,
} from "./data/buildReportBaseData";

export interface PreparedExportReportInput {
  input: BuildReportBaseDataInput;
  appliedAssumptions: AssumptionEntry[];
}

export function prepareExportReportInput(
  rawInput: BuildReportBaseDataInput,
  options: { applyDemoDefaults: boolean }
): PreparedExportReportInput {
  let preparedInput = rawInput;
  let appliedAssumptions: AssumptionEntry[] = [];

  if (options.applyDemoDefaults) {
    const result = applyDemoDesignDefaults(preparedInput);
    preparedInput = result.input;
    appliedAssumptions = result.appliedAssumptions;
  }

  return {
    input: {
      ...preparedInput,
      appliedAssumptions,
      dynamicResultState: preparedInput.thermalResult ? "provided" : "missing",
    },
    appliedAssumptions,
  };
}
