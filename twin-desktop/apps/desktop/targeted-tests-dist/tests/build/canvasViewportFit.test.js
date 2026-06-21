import { computeCanvasViewportFit, worldToScreenPoint } from "../../src/features/build/canvas/canvasViewportFit.js";
import { test } from "../testHarness.js";
test("computeCanvasViewportFit centers geometry in the viewport", () => {
    const fit = computeCanvasViewportFit([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
    ], { width: 800, height: 600 });
    if (!fit) {
        throw new Error("Expected a viewport fit for non-empty geometry.");
    }
    const center = worldToScreenPoint({ x: 5, y: 5 }, fit);
    const deltaX = Math.abs(center.x - 400);
    const deltaY = Math.abs(center.y - 300);
    if (deltaX > 1 || deltaY > 1) {
        throw new Error(`Expected bbox center near viewport center, got (${center.x}, ${center.y}).`);
    }
});
test("computeCanvasViewportFit does not drift vertically when viewport height matches the visible area", () => {
    const points = [
        { x: 2, y: 2 },
        { x: 8, y: 8 },
    ];
    const fit = computeCanvasViewportFit(points, { width: 800, height: 600 });
    if (!fit) {
        throw new Error("Expected a viewport fit for non-empty geometry.");
    }
    const center = worldToScreenPoint({ x: 5, y: 5 }, fit);
    if (Math.abs(center.y - 300) > 2) {
        throw new Error(`Expected geometry center near vertical middle, got y=${center.y}.`);
    }
});
test("computeCanvasViewportFit increases zoom when viewport grows wider", () => {
    const points = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
    ];
    const narrow = computeCanvasViewportFit(points, { width: 500, height: 600 });
    const wide = computeCanvasViewportFit(points, { width: 900, height: 600 });
    if (!narrow || !wide) {
        throw new Error("Expected fits for both viewport sizes.");
    }
    if (wide.zoom <= narrow.zoom) {
        throw new Error(`Expected wider viewport to increase zoom (${narrow.zoom} -> ${wide.zoom}).`);
    }
});
