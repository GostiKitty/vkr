import test from "node:test";
import assert from "node:assert/strict";
import { formulaRegistry, getFormulasByIds } from "../../src/entities/formulas/registry.js";
test("registry resolves SP50 and RC formula ids", () => {
    const ids = [
        "sp50_kob",
        "sp50_k_vent",
        "sp50_q_heating",
        "rc_infiltration_g",
        "rc_envelope_loss",
        "climate_gsop",
        "sp50_annual_heating_energy",
        "internal_gains",
        "weather_sinusoid",
        "rc_zone_discrete_balance",
        "loss_share_breakdown",
        "facade_weighted_u_conductance",
        "sp50_vapor_resistance",
        "uncertainty_percentile",
        "sp50_resistance_margin",
        "sp50_kob_compliance_margin",
        "sp50_air_permeability_resistance",
        "sp50_floor_absorption_y",
        "climate_average_air_density_sp50",
        "layer_bridge_R_ut_lambda_o",
        "envelope_enrich_linear_psi",
        "sp230_psi_window_jamb",
        "sp230_psi_convex_corner",
        "sp230_chi_disc_anchor",
        "sp230_psi_wall_roof",
        "sp230_psi_floor_ground_edge",
        "sp50_q_heating_characteristic",
        "sp50_air_specific_weight",
        "sp230_psi_pitched_rafter",
        "sp230_psi_pitched_ridge",
    ];
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
