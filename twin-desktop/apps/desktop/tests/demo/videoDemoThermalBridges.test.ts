import { buildVideoDemoHouseModel } from "../../src/demo/videoDemoHouse.js";
import { envelopeFragmentHasThermalBridgeData } from "../../src/demo/deriveExteriorWallThermalBridges.js";
import { buildSourceDataWorkspaceReport } from "../../src/core/thermal/derived/sourceDataWorkspace.js";
import { buildPreparedVideoDemoProject } from "../../src/features/build/demoVideoProject.js";
import { thermalBridgeLinearConductance, thermalBridgePointConductance } from "../../src/core/thermal/formulas.js";
import { test } from "../testHarness.js";

test("video demo exterior walls get SP230 thermal bridges when not preset", () => {
  const model = buildVideoDemoHouseModel();
  const wall = model.thermalProtection?.envelope?.find((fragment) => fragment.id === "video-ext-walls");
  if (!wall) {
    throw new Error("Demo model should include exterior wall envelope fragment.");
  }
  if (!envelopeFragmentHasThermalBridgeData(wall)) {
    throw new Error("Demo exterior walls should include ψ/χ heterogeneity from geometry and SP 230.");
  }

  const linear = wall.heterogeneity?.linear ?? [];
  const point = wall.heterogeneity?.point ?? [];
  if (!linear.some((entry) => entry.label?.includes("Г.28"))) {
    throw new Error("Expected convex corner ψ from SP 230 table G.28.");
  }
  if (!linear.some((entry) => entry.label?.includes("Г.34"))) {
    throw new Error("Expected window/door jamb ψ from SP 230 table G.34.");
  }
  if (!point.some((entry) => entry.label?.includes("Г.4"))) {
    throw new Error("Expected disc anchor χ from SP 230 table G.4.");
  }

  const corner = linear.find((entry) => entry.label?.includes("Г.28"));
  if (!corner || Math.abs(corner.lengthM - 24) > 0.5) {
    throw new Error(`Expected ~24 m of convex corners (4×2×3 m), got ${corner?.lengthM}.`);
  }

  const hPsi = thermalBridgeLinearConductance(linear);
  const hChi = thermalBridgePointConductance(point);
  if (!(hPsi > 0) || !(hChi > 0)) {
    throw new Error("Derived demo bridges should produce positive H_psi and H_chi.");
  }
});

test("video demo roof and floor on ground include SP230 thermal bridges", () => {
  const model = buildVideoDemoHouseModel();
  const roof = model.thermalProtection?.envelope?.find((fragment) => fragment.id === "video-roof");
  const floor = model.thermalProtection?.envelope?.find((fragment) => fragment.id === "video-floor-ground");
  if (!roof || !floor) {
    throw new Error("Demo envelope should include roof and floor-on-ground fragments.");
  }
  if (!envelopeFragmentHasThermalBridgeData(roof)) {
    throw new Error("Roof fragment should include ψ from SP 230 tables.");
  }
  if (!envelopeFragmentHasThermalBridgeData(floor)) {
    throw new Error("Floor-on-ground fragment should include ψ along perimeter.");
  }
  const roofLinear = roof.heterogeneity?.linear ?? [];
  const floorLinear = floor.heterogeneity?.linear ?? [];
  if (!roofLinear.some((entry) => entry.label?.includes("Г.81"))) {
    throw new Error("Roof should include wall-roof junction from table G.81.");
  }
  if (!roofLinear.some((entry) => entry.label?.includes("Г.104"))) {
    throw new Error("Roof should include ridge from table G.104.");
  }
  if (!floorLinear.some((entry) => entry.label?.includes("Г.40"))) {
    throw new Error("Floor should include edge ψ from table G.40 (SP 50 Lпс).");
  }

  const demo = buildPreparedVideoDemoProject();
  const report = buildSourceDataWorkspaceReport({
    model,
    scenarioConfig: demo.scenarioConfig,
    thermalResult: demo.thermalResult,
    reportInputs: demo.reportInputs,
  });
  const bridgeMode = report.sections.materials.computedFields.find((field) => field.key === "materials.bridge-mode");
  if (bridgeMode?.value !== "explicitPsiChi") {
    throw new Error("Envelope with ψ/χ on multiple fragments should auto-select explicit bridge mode.");
  }
  const hPsiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
  if (typeof hPsiField?.value !== "number" || !(hPsiField.value > 6)) {
    throw new Error("Aggregated H_psi should include wall, roof, and floor bridges.");
  }
});

test("preset heterogeneity on exterior walls is not overwritten", () => {
  const model = buildVideoDemoHouseModel();
  const wall = model.thermalProtection?.envelope?.find((fragment) => fragment.id === "video-ext-walls");
  if (!wall?.heterogeneity) {
    throw new Error("Fixture needs heterogeneity on exterior wall.");
  }
  wall.heterogeneity.linear = [{ lengthM: 1, psi_W_mK: 0.5, label: "Пользовательский узел" }];

  const demo = buildPreparedVideoDemoProject();
  const report = buildSourceDataWorkspaceReport({
    model,
    scenarioConfig: demo.scenarioConfig,
    thermalResult: demo.thermalResult,
    reportInputs: demo.reportInputs,
  });
  const hPsiField = report.sections.materials.computedFields.find((field) => field.key === "materials.h-psi");
  if (typeof hPsiField?.value !== "number" || Math.abs(hPsiField.value - 0.5) > 1e-6) {
    throw new Error("User-defined ψ/χ on model should not be replaced by demo defaults.");
  }
});
