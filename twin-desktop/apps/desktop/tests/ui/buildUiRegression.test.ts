import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "../testHarness.js";

test("toolbar stays horizontal and does not declare vertical auto scroll", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/build/components/QuickAccessBar.tsx"), "utf8");
  if (!source.includes("overflow-x-auto overflow-y-hidden")) {
    throw new Error("QuickAccessBar should use horizontal scrolling without vertical overflow.");
  }
  if (source.includes("overflow-y-scroll")) {
    throw new Error("QuickAccessBar must not keep a vertical scroll container.");
  }
});

test("tooltip renders through portal with high z-index", () => {
  const source = readFileSync(resolve(process.cwd(), "src/shared/ui/Tooltip.tsx"), "utf8");
  if (!source.includes("createPortal")) {
    throw new Error("Tooltip should render through a portal to avoid clipping.");
  }
  if (!source.includes("z-[9999]")) {
    throw new Error("Tooltip should use a high z-index above the builder UI.");
  }
});

test("thermal engineering panel avoids duplicated demo SP block when main SP report exists", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/build/components/ThermalSimulationPanel.tsx"), "utf8");
  if (!source.includes("demoSp50Result && !engineeringResult.sp50")) {
    throw new Error("Demo SP block should be hidden when the main engineering SP report is already visible.");
  }
});

test("room labels use the shared layout helper and are rendered through a single path", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/build/components/Canvas2D.tsx"), "utf8");
  if (!source.includes("const labelLayout = resolvePlanLabelLayout(room")) {
    throw new Error("Room labels should use resolvePlanLabelLayout.");
  }
  const roomLabelLayerCount = source.split('data-layer="room-label"').length - 1;
  if (roomLabelLayerCount !== 1) {
    throw new Error(`Canvas2D should keep one room-label render path, found ${roomLabelLayerCount}.`);
  }
});

test("chart tooltips map raw value keys to readable Russian metric labels", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/build/components/ThermalSimulationPanel.tsx"), "utf8");
  if (!source.includes('value: "Значение"')) {
    throw new Error("Chart tooltip metric map should translate the raw value key.");
  }
  if (!source.includes('getChartMetricLabel(entry, "Значение")')) {
    throw new Error("Bar tooltip should use the readable metric label helper.");
  }
});

test("level panels use display labels instead of leaking raw video-level ids", () => {
  const levelsPanel = readFileSync(resolve(process.cwd(), "src/features/build/components/LevelsPanel.tsx"), "utf8");
  const inspector = readFileSync(resolve(process.cwd(), "src/features/build/components/RightInspector.tsx"), "utf8");
  const thermalPanel = readFileSync(resolve(process.cwd(), "src/features/build/components/ThermalSimulationPanel.tsx"), "utf8");
  if (!levelsPanel.includes("getLevelDisplayLabel({ levels: orderedLevels }, level.id)")) {
    throw new Error("LevelsPanel should render levels through getLevelDisplayLabel.");
  }
  if (!inspector.includes("getLevelDisplayLabel({ levels }, level.id)")) {
    throw new Error("RightInspector should use display labels for level selectors.");
  }
  if (!thermalPanel.includes("{getLevelDisplayLabel(model, level.id)}")) {
    throw new Error("ThermalSimulationPanel should use display labels for level options.");
  }
});

test("methodology badges do not render raw PHYSICAL MODEL labels", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/build/components/ThermalSimulationPanel.tsx"), "utf8");
  if (!source.includes("formatMethodClassificationLabel(entry.classification)")) {
    throw new Error("Methodology card should format classification labels for UI.");
  }
  if (source.includes("{entry.classification}")) {
    throw new Error("Methodology card must not render raw classification tokens.");
  }
});

test("small room labels are hidden when they conflict with important overlays", () => {
  const source = readFileSync(resolve(process.cwd(), "src/features/build/components/Canvas2D.tsx"), "utf8");
  if (!source.includes("area < 8 && obstacleInRoom")) {
    throw new Error("Canvas2D should hide small room labels when a temperature or equipment obstacle occupies the room.");
  }
  if (!source.includes("const showArea = !obstacleInRoom")) {
    throw new Error("Canvas2D should hide room area labels when a room bubble already occupies the label zone.");
  }
});

test("demo and telemetry UI do not expose raw preset, localStorage or localdemo labels", () => {
  const thermalPanel = readFileSync(resolve(process.cwd(), "src/features/build/components/ThermalSimulationPanel.tsx"), "utf8");
  const telemetry = readFileSync(resolve(process.cwd(), "src/features/build/components/TelemetryPanel.tsx"), "utf8");
  if (
    thermalPanel.includes("Окраска пола по roomId") ||
    thermalPanel.includes("temperature meshes") ||
    thermalPanel.includes("сдвига surface")
  ) {
    throw new Error("Demo block should not expose technical 3D overlay wording.");
  }
  if (telemetry.includes("ID проекта")) {
    throw new Error("Telemetry panel should not expose the raw project id label in the user UI.");
  }
  if (!telemetry.includes("Демонстрационный дом")) {
    throw new Error("Telemetry panel should map demo project ids to a readable project name.");
  }
});
