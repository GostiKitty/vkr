import assert from "node:assert/strict";
import { getSourceFieldFormulaInfo } from "../../src/features/scenarios/sourceFieldFormulaInfo";

const bridgeModeInfo = getSourceFieldFormulaInfo("materials.bridge-mode");
assert.ok(bridgeModeInfo);
assert.match(bridgeModeInfo.formula ?? "", /mode/);
assert.ok(bridgeModeInfo.linkedFormulaIds?.includes("bridge_accounting_mode_resolve"));

const constructionR0 = getSourceFieldFormulaInfo("video-ext-walls:r0");
assert.ok(constructionR0);
assert.ok(constructionR0.linkedFormulaIds?.includes("assembly_resistance_series"));

const airVolume = getSourceFieldFormulaInfo("air.total-volume");
assert.ok(airVolume?.linkedFormulaIds?.includes("geometry_heated_volume"));

const geometryWindow = getSourceFieldFormulaInfo("geometry.window-area");
assert.ok(geometryWindow?.linkedFormulaIds?.includes("geometry_opening_area"));

const geometryFloorArea = getSourceFieldFormulaInfo("geometry.floor-area");
assert.ok(geometryFloorArea?.linkedFormulaIds?.includes("geom_polygon_area"));

const airQinf = getSourceFieldFormulaInfo("air.q-inf");
assert.ok(airQinf?.linkedFormulaIds?.includes("envelope_infiltration"));

const missing = getSourceFieldFormulaInfo("unknown.field");
assert.equal(missing, undefined);

console.log("sourceFieldFormulaInfo.test.ts: ok");
