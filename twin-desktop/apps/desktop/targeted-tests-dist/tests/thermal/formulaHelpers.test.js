import { airflowFromACH, assemblyResistance, calculateHydronicHeatPower, calculateRequiredHydronicMassFlow, calculateRequiredHydronicVolumeFlowM3H, gsop, infiltrationLoss, layerResistance, transmissionLoss, uValue, ventilationLoss, } from "../../src/core/thermal/formulas.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";
test("thermal formulas: R = d / lambda", () => {
    expectApproximatelyEqual(layerResistance(0.2, 0.04), 5, 1e-9, "R слоя должно считаться как d/lambda.");
});
test("thermal formulas: R_total = Rsi + sum(R) + Rse", () => {
    const result = assemblyResistance([
        { thicknessM: 0.2, lambdaWmK: 0.04 },
        { thicknessM: 0.25, lambdaWmK: 0.52 },
    ], 0.13, 0.04);
    expectApproximatelyEqual(result, 5.6507692308, 1e-6, "Суммарное сопротивление должно включать пленки и слои.");
});
test("thermal formulas: U = 1 / R", () => {
    expectApproximatelyEqual(uValue(4), 0.25, 1e-9, "U должно считаться как 1/R.");
});
test("thermal formulas: Q = U * A * deltaT", () => {
    expectApproximatelyEqual(transmissionLoss(0.25, 10, 42), 105, 1e-9, "Потери через ограждение должны считаться по U*A*dT.");
});
test("thermal formulas: ACH converts to airflow", () => {
    expectApproximatelyEqual(airflowFromACH(0.5, 300), 0.0416666667, 1e-9, "Расход воздуха должен считаться как ACH*V/3600.");
});
test("thermal formulas: ventilation loss uses SI inputs", () => {
    expectApproximatelyEqual(ventilationLoss(0.1, 1.204, 1005, 20), 2420.04, 1e-6, "Потери на вентиляцию должны считаться по rho*cp*L*dT.");
});
test("thermal formulas: infiltration loss derives airflow from ACH", () => {
    expectApproximatelyEqual(infiltrationLoss(0.5, 300, 1.204, 1005, 20), 1008.35, 0.01, "Потери на инфильтрацию должны использовать ACH и объем.");
});
test("thermal formulas: GSOP = (tIndoor - tHeatingPeriod) * days", () => {
    expectApproximatelyEqual(gsop(20, -3.1, 214), 4943.4, 1e-9, "GSOP должен считаться по нормативной форме.");
});
test("thermal formulas: hydronic Q = m_dot * cp * deltaT", () => {
    const result = calculateHydronicHeatPower({
        massFlowKgS: 0.1,
        supplyTemperatureC: 70,
        returnTemperatureC: 50,
        fluidDensityKgM3: 998,
        fluidHeatCapacityJkgK: 4180,
        efficiency: 1,
    });
    expectApproximatelyEqual(result.availablePowerW ?? 0, 8360, 1e-9, "Гидравлическая мощность должна считаться по m*cp*dT.");
});
test("thermal formulas: hydronic required flow is derived from required power", () => {
    const massFlow = calculateRequiredHydronicMassFlow(8360, 20, 4180, 1);
    const volumeFlow = calculateRequiredHydronicVolumeFlowM3H(8360, 20, 998, 4180, 1);
    expectApproximatelyEqual(massFlow ?? 0, 0.1, 1e-9, "Требуемый массовый расход должен восстанавливаться из мощности.");
    expectApproximatelyEqual(volumeFlow ?? 0, 0.3607214429, 1e-9, "Требуемый объемный расход должен пересчитываться через плотность.");
});
test("thermal formulas: hydronic helper warns when deltaT <= 0", () => {
    const result = calculateHydronicHeatPower({
        massFlowKgS: 0.1,
        supplyTemperatureC: 45,
        returnTemperatureC: 45,
        fluidDensityKgM3: 998,
        fluidHeatCapacityJkgK: 4180,
    });
    if (!result.warnings.some((warning) => warning.includes("подачи"))) {
        throw new Error("Ожидалось предупреждение о некорректном перепаде температур теплоносителя.");
    }
    if (result.availablePowerW !== null) {
        throw new Error("При deltaT <= 0 доступная гидравлическая мощность не должна считаться.");
    }
});
test("thermal formulas: hydronic helper warns when flow is missing", () => {
    const result = calculateHydronicHeatPower({
        supplyTemperatureC: 70,
        returnTemperatureC: 50,
        fluidDensityKgM3: 998,
        fluidHeatCapacityJkgK: 4180,
    });
    if (!result.warnings.some((warning) => warning.includes("Расход"))) {
        throw new Error("Ожидалось предупреждение об отсутствии расхода теплоносителя.");
    }
    if (result.availablePowerW !== null) {
        throw new Error("Без расхода теплоносителя доступная мощность должна оставаться неопределенной.");
    }
});
