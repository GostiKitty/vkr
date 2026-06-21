import { modelHasLinearOrPointBridges, resolveBridgeAccountingMode, } from "../../src/shared/utils/bridgeAccountingMode.js";
import { test } from "../testHarness.js";
function minimalModel(envelope) {
    return {
        rooms: [],
        walls: [],
        windows: [],
        doors: [],
        roofs: [],
        floorSlabs: [],
        pipes: [],
        sensors: [],
        thermalProtection: envelope,
    };
}
test("resolveBridgeAccountingMode prefers explicit psi/chi when model has bridge data", () => {
    const model = minimalModel({
        envelope: [
            {
                id: "wall-1",
                label: "Стена",
                constructionType: "wall",
                areaM2: 100,
                layers: [],
                heterogeneity: {
                    linear: [{ lengthM: 10, psi_W_mK: 0.1 }],
                },
            },
        ],
    });
    if (!modelHasLinearOrPointBridges(model)) {
        throw new Error("Fixture should include linear bridges.");
    }
    const resolved = resolveBridgeAccountingMode({
        userMode: undefined,
        userHomogeneityCoefficient: null,
        model,
    });
    if (resolved.mode !== "explicitPsiChi" || resolved.origin !== "calculated") {
        throw new Error("Auto mode should select explicit psi/chi when model has ψ/χ.");
    }
});
test("resolveBridgeAccountingMode uses homogeneity when user sets r without psi/chi", () => {
    const model = minimalModel({
        envelope: [
            {
                id: "wall-1",
                label: "Стена",
                constructionType: "wall",
                areaM2: 100,
                layers: [],
            },
        ],
    });
    const resolved = resolveBridgeAccountingMode({
        userMode: undefined,
        userHomogeneityCoefficient: 0.92,
        model,
    });
    if (resolved.mode !== "homogeneityCoefficient") {
        throw new Error("User homogeneity coefficient should enable r mode.");
    }
});
test("resolveBridgeAccountingMode respects explicit user disable without bridge data", () => {
    const model = minimalModel({
        envelope: [
            {
                id: "wall-1",
                label: "Стена",
                constructionType: "wall",
                areaM2: 100,
                layers: [],
            },
        ],
    });
    const resolved = resolveBridgeAccountingMode({
        userMode: "disabled",
        userHomogeneityCoefficient: null,
        model,
    });
    if (resolved.mode !== "disabled") {
        throw new Error("User disable should stay disabled when model has no bridges.");
    }
});
