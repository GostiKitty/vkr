import { applyDemoDesignDefaults, } from "./defaults/demoHouseDesignDefaults";
export function prepareExportReportInput(rawInput, options) {
    let preparedInput = rawInput;
    let appliedAssumptions = [];
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
