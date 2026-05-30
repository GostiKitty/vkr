import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "../testHarness.js";
test("quick access bar exposes engineering visualization selectors", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/components/QuickAccessBar.tsx"), "utf8");
    if (!source.includes("ENGINEERING_VISUALIZATION_LABELS")) {
        throw new Error("QuickAccessBar should expose engineering visualization modes.");
    }
    if (!source.includes("ENGINEERING_SCHEMATIC_STYLE_LABELS")) {
        throw new Error("QuickAccessBar should expose schematic style presets.");
    }
});
test("build page wires engineering legend and visualization mode into the canvas", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/BuildPage.tsx"), "utf8");
    if (!source.includes("EngineeringLegendPanel")) {
        throw new Error("BuildPage should mount the engineering legend panel.");
    }
    if (!source.includes("engineeringVisualizationMode={visualizationMode}")) {
        throw new Error("BuildPage should pass the visualization mode into Canvas2D.");
    }
    if (!source.includes("engineeringSchematicStyle={schematicStyle}")) {
        throw new Error("BuildPage should pass the schematic style into Canvas2D.");
    }
});
test("canvas uses engineering connection points and diagnostics overlays", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/components/Canvas2D.tsx"), "utf8");
    if (!source.includes("getEquipmentConnectionPoints")) {
        throw new Error("Canvas2D should use engineering connection points for equipment.");
    }
    if (!source.includes("ConnectionPointOverlay")) {
        throw new Error("Canvas2D should render visible engineering connection points.");
    }
    if (!source.includes("EngineeringDiagnosticMarker")) {
        throw new Error("Canvas2D should render engineering network diagnostics on the scheme.");
    }
});
