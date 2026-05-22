import test from "node:test";
import assert from "node:assert/strict";
import { formulaRegistry, getFormulasByIds } from "../../src/entities/formulas/registry.js";

test("registry resolves SP50 and RC formula ids", () => {
  const ids = ["sp50_kob", "sp50_k_vent", "sp50_q_heating", "rc_infiltration_g", "rc_envelope_loss"];
  const formulas = getFormulasByIds(ids);
  assert.equal(formulas.length, ids.length);
  formulas.forEach((f) => {
    assert.ok(f.normReference, `missing normReference for ${f.id}`);
  });
});

test("all registry entries have required fields", () => {
  formulaRegistry.forEach((formula) => {
    assert.ok(formula.id);
    assert.ok(formula.latex);
    assert.ok(formula.module);
  });
});
