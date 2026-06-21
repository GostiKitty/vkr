import { createEmptyBuildingModel, type BuildingModel } from "../../src/entities/geometry/types.js";
import { buildSmartModelSnapshot } from "../../src/core/networks/intelligence.js";
import { createEngineeringEquipmentInstance, createEngineeringPipeConnection } from "../../src/features/build/engineering2d/catalog.js";
import { buildNetworkSystemsPresentation } from "../../src/features/build/networks/presentation.js";
import { test } from "../testHarness.js";

test("networks: presentation accumulates route losses along the engineering air chain", () => {
  const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 1.5 }, {
    levelId: "l1",
    name: "ВК-1",
    parameters: { airflowM3H: 600, pressurePa: 100, powerKW: 0.8 },
  });
  const filter = createEngineeringEquipmentInstance("airFilter", { x: 2, y: 1.5 }, {
    levelId: "l1",
    name: "ФВ-1",
    parameters: { pressureDropPa: 30, contaminationPercent: 0 },
  });
  const silencer = createEngineeringEquipmentInstance("silencer", { x: 4, y: 1.5 }, {
    levelId: "l1",
    name: "ШГ-1",
    parameters: { pressureDropPa: 30 },
  });
  const heater = createEngineeringEquipmentInstance("airHeater", { x: 6, y: 1.5 }, {
    levelId: "l1",
    name: "Калорифер-1",
    parameters: { pressureDropPa: 30, powerKW: 18, supplyTemperatureC: 22 },
  });
  const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 8, y: 1.5 }, {
    levelId: "l1",
    name: "П1",
    parameters: { airflowM3H: 600, pressureDropPa: 20 },
  });

  const branches = [
    createEngineeringPipeConnection({ fromEquipment: fan, fromPortId: "outlet", toEquipment: filter, toPortId: "inlet", levelId: "l1" }),
    createEngineeringPipeConnection({ fromEquipment: filter, fromPortId: "outlet", toEquipment: silencer, toPortId: "inlet", levelId: "l1" }),
    createEngineeringPipeConnection({ fromEquipment: silencer, fromPortId: "outlet", toEquipment: heater, toPortId: "inlet", levelId: "l1" }),
    createEngineeringPipeConnection({ fromEquipment: heater, fromPortId: "outlet", toEquipment: diffuser, toPortId: "supply", levelId: "l1" }),
  ];
  if (branches.some((branch) => !branch)) {
    throw new Error("Expected a complete engineering air chain.");
  }

  const resolvedBranches = branches.map((branch) => branch!);
  resolvedBranches.forEach((branch) => {
    branch.flowRate = 600;
  });

  const model: BuildingModel = {
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    engineeringSystems: {
      equipment: [fan, filter, silencer, heater, diffuser],
      pipes: resolvedBranches,
    },
  };

  const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
  const presentation = buildNetworkSystemsPresentation(model, snapshot);
  const terminalBranch = presentation.duct.branches.find(
    (branch) => branch.label.includes("Калорифер-1") && branch.label.includes("П1")
  );

  if (!terminalBranch || (terminalBranch.estimatedPressureDropPa ?? 0) <= 100) {
    throw new Error("Expected branch pressure in presentation to accumulate losses along the route.");
  }
  if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("доступного давления"))) {
    throw new Error("Expected route pressure deficit warning for the downstream air branch.");
  }
});

test("networks: presentation warns about heavily contaminated air filter", () => {
  const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 0 }, {
    levelId: "l1",
    name: "ВК-1",
    parameters: { airflowM3H: 500, pressurePa: 250 },
  });
  const filter = createEngineeringEquipmentInstance("airFilter", { x: 2, y: 0 }, {
    levelId: "l1",
    name: "ФВ-1",
    parameters: { pressureDropPa: 70, contaminationPercent: 85 },
  });
  const branch = createEngineeringPipeConnection({
    fromEquipment: fan,
    fromPortId: "outlet",
    toEquipment: filter,
    toPortId: "inlet",
    levelId: "l1",
  });
  if (!branch) {
    throw new Error("Expected air branch with a filter.");
  }
  branch.flowRate = 500;

  const model: BuildingModel = {
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    engineeringSystems: {
      equipment: [fan, filter],
      pipes: [branch],
    },
  };

  const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
  const presentation = buildNetworkSystemsPresentation(model, snapshot);

  if (!presentation.diagnostics.warnings.some((warning) => warning.id.endsWith(":contamination"))) {
    throw new Error("Expected warning about a heavily contaminated air filter.");
  }
});

test("networks: presentation applies extra losses for throttled variable air regulators", () => {
  const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 0 }, {
    levelId: "l1",
    name: "Р’Рљ-2",
    parameters: { airflowM3H: 500, pressurePa: 260, sectionWidthMm: 400, sectionHeightMm: 200 },
  });
  const regulator = createEngineeringEquipmentInstance("airFlowRegulatorVar", { x: 2, y: 0 }, {
    levelId: "l1",
    name: "КРВ-1",
    parameters: {
      airflowM3H: 500,
      sectionWidthMm: 300,
      sectionHeightMm: 150,
      damperPositionPercent: 20,
      pressureDropPa: 40,
    },
  });
  const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 4, y: 0 }, {
    levelId: "l1",
    name: "П2",
    parameters: { airflowM3H: 500, pressureDropPa: 25 },
  });
  const branchA = createEngineeringPipeConnection({
    fromEquipment: fan,
    fromPortId: "outlet",
    toEquipment: regulator,
    toPortId: "inlet",
    levelId: "l1",
  });
  const branchB = createEngineeringPipeConnection({
    fromEquipment: regulator,
    fromPortId: "outlet",
    toEquipment: diffuser,
    toPortId: "supply",
    levelId: "l1",
  });
  if (!branchA || !branchB) {
    throw new Error("Expected branches with a throttled air regulator.");
  }
  branchA.flowRate = 500;
  branchB.flowRate = 500;

  const model: BuildingModel = {
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    engineeringSystems: {
      equipment: [fan, regulator, diffuser],
      pipes: [branchA, branchB],
    },
  };

  const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
  const presentation = buildNetworkSystemsPresentation(model, snapshot);
  const downstreamBranch = presentation.duct.branches.find(
    (branch) => branch.label.includes("КРВ-1") && branch.label.includes("П2")
  );

  if (!downstreamBranch || (downstreamBranch.estimatedPressureDropPa ?? 0) <= 110) {
    throw new Error("Expected throttled regulator to add significant pressure loss on the downstream route.");
  }
});

test("networks: presentation warns when a variable air regulator is almost closed", () => {
  const fan = createEngineeringEquipmentInstance("ductFan", { x: 0, y: 0 }, {
    levelId: "l1",
    name: "FAN-1",
    parameters: { airflowM3H: 500, pressurePa: 260, sectionWidthMm: 400, sectionHeightMm: 200 },
  });
  const regulator = createEngineeringEquipmentInstance("airFlowRegulatorVar", { x: 2, y: 0 }, {
    levelId: "l1",
    name: "VR-1",
    parameters: {
      airflowM3H: 500,
      sectionWidthMm: 300,
      sectionHeightMm: 150,
      damperPositionPercent: 5,
      pressureDropPa: 40,
    },
  });
  const diffuser = createEngineeringEquipmentInstance("supplyDiffuser", { x: 4, y: 0 }, {
    levelId: "l1",
    name: "S-1",
    parameters: { airflowM3H: 500, pressureDropPa: 25 },
  });
  const branchA = createEngineeringPipeConnection({
    fromEquipment: fan,
    fromPortId: "outlet",
    toEquipment: regulator,
    toPortId: "inlet",
    levelId: "l1",
  });
  const branchB = createEngineeringPipeConnection({
    fromEquipment: regulator,
    fromPortId: "outlet",
    toEquipment: diffuser,
    toPortId: "supply",
    levelId: "l1",
  });
  if (!branchA || !branchB) {
    throw new Error("Expected branches with an almost closed air regulator.");
  }
  branchA.flowRate = 500;
  branchB.flowRate = 500;

  const model: BuildingModel = {
    ...createEmptyBuildingModel(),
    levels: [{ id: "l1", name: "1", elevation_m: 0, height_m: 3 }],
    engineeringSystems: {
      equipment: [fan, regulator, diffuser],
      pipes: [branchA, branchB],
    },
  };

  const snapshot = buildSmartModelSnapshot(model, null, Date.UTC(2026, 0, 1));
  const presentation = buildNetworkSystemsPresentation(model, snapshot);

  if (!presentation.diagnostics.warnings.some((warning) => warning.message.includes("почти закрыт"))) {
    throw new Error("Expected warning about an almost closed variable air regulator.");
  }
});
