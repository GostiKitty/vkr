import test from "node:test";
import assert from "node:assert/strict";
import {
  homogeneityCoefficientFromLinearPointBridges,
  resolveModelHomogeneityCoefficient,
} from "../../src/shared/utils/homogeneityFromModel";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types";

test("homogeneityCoefficientFromLinearPointBridges matches r = A / (A + H * R0)", () => {
  const r0 = 2;
  const area = 10;
  const linear = [{ lengthM: 8, psi_W_mK: 0.12 }];
  const point = [{ count: 2, chi_W_K: 0.08 }];
  const h = 8 * 0.12 + 2 * 0.08;
  const expected = area / (area + h * r0);
  const actual = homogeneityCoefficientFromLinearPointBridges(r0, area, linear, point);
  assert.ok(Math.abs(actual - expected) < 1e-9);
  assert.ok(actual < 1);
});

test("resolveModelHomogeneityCoefficient averages opaque fragments with bridge data", () => {
  const model = {
    ...createEmptyBuildingModel(),
    thermalProtection: {
      envelope: [
        {
          id: "wall-a",
          label: "Стена A",
          constructionType: "wall",
          areaM2: 20,
          layers: [
            { materialId: "mineral_wool", thickness_m: 0.15 },
            { materialId: "ceramic_brick", thickness_m: 0.38 },
          ],
          heterogeneity: {
            linear: [{ lengthM: 10, psi_W_mK: 0.1 }],
          },
        },
        {
          id: "wall-b",
          label: "Стена B",
          constructionType: "wall",
          areaM2: 10,
          layers: [{ materialId: "mineral_wool", thickness_m: 0.15 }],
        },
      ],
    },
  } satisfies ReturnType<typeof createEmptyBuildingModel>;

  const resolved = resolveModelHomogeneityCoefficient(model);
  assert.ok(resolved.hasBridgeData);
  assert.ok(resolved.value != null);
  assert.ok(resolved.byFragmentId["wall-a"]! < 1);
  assert.equal(resolved.byFragmentId["wall-b"], 1);
  assert.ok(resolved.value! < 1);
  assert.ok(resolved.value! > resolved.byFragmentId["wall-a"]!);
});
