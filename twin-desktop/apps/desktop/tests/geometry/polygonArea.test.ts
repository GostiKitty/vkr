import { polygonArea } from "../../src/entities/geometry/geom.js";
import { test, expectApproximatelyEqual } from "../testHarness.js";

test("polygonArea returns positive area for rectangle", () => {
  const rect = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 5 },
  ];
  const area = polygonArea(rect);
  expectApproximatelyEqual(area, 50, 1e-6, "Площадь прямоугольника должна быть 50 м²");
});

test("polygonArea handles clockwise vertices", () => {
  const rectCW = [
    { x: 0, y: 0 },
    { x: 0, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 0 },
  ];
  const area = Math.abs(polygonArea(rectCW));
  expectApproximatelyEqual(area, 16, 1e-6, "Абсолютная площадь не зависит от направления обхода");
});
