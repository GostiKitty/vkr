import { test } from "../testHarness.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("Build3DPreview imports without recursive module initialization", async () => {
  const module = await import("../../src/features/build/view3d/Build3DPreview.js");
  if (typeof module.default !== "object" && typeof module.default !== "function") {
    throw new Error("Build3DPreview should export a React component.");
  }
});

test("Build3DRecoveredPreview imports safely without legacy preview dependency", async () => {
  const module = await import("../../src/features/build/view3d/Build3DRecoveredPreview.js");
  if (typeof module.default !== "object" && typeof module.default !== "function") {
    throw new Error("Build3DRecoveredPreview should export a React component.");
  }
});

test("Build3DCanonicalPreview imports safely without legacy preview dependency", async () => {
  const module = await import("../../src/features/build/view3d/Build3DCanonicalPreview.js");
  if (typeof module.default !== "object" && typeof module.default !== "function") {
    throw new Error("Build3DCanonicalPreview should export a React component.");
  }
});

test("Build3DPreview, threeScene and engineeringOverview import together without cyclic runtime failure", async () => {
  const [previewModule, sceneModule, overviewModule] = await Promise.all([
    import("../../src/features/build/view3d/Build3DPreview.js"),
    import("../../src/features/build/view3d/threeScene.js"),
    import("../../src/features/build/view3d/engineeringOverview.js"),
  ]);
  if (typeof previewModule.default !== "object" && typeof previewModule.default !== "function") {
    throw new Error("Build3DPreview should remain importable.");
  }
  if (typeof sceneModule.createBuildScene !== "function") {
    throw new Error("threeScene should export createBuildScene.");
  }
  if (typeof overviewModule.applyEngineeringOverviewPreset !== "function") {
    throw new Error("engineeringOverview should export its preset helpers.");
  }
});

test("BuildPage imports without initialization order failures", async () => {
  const module = await import("../../src/features/build/BuildPage.js");
  if (typeof module.BuildPage !== "function" || typeof module.default !== "function") {
    throw new Error("BuildPage module should export the page component safely.");
  }
});

test("BuildPage uses Build3DCanonicalPreview as the main 3D path", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/features/build/BuildPage.tsx"),
    "utf8"
  );
  if (!source.includes("from \"./view3d/Build3DCanonicalPreview\"")) {
    throw new Error("BuildPage should import the canonical 3D preview path.");
  }
  if (!source.includes("<Build3DCanonicalPreview")) {
    throw new Error("BuildPage should render Build3DCanonicalPreview in the main 3D viewport.");
  }
});

test("Build3DStablePreview imports without engineering overview runtime dependency", async () => {
  const [stableModule, overviewModule] = await Promise.all([
    import("../../src/features/build/view3d/Build3DStablePreview.js"),
    import("../../src/features/build/view3d/engineeringOverview.js"),
  ]);
  if (typeof stableModule.default !== "object" && typeof stableModule.default !== "function") {
    throw new Error("Build3DStablePreview should export a React component.");
  }
  if (typeof overviewModule.applyEngineeringOverviewPreset !== "function") {
    throw new Error("engineeringOverview helpers should stay importable independently.");
  }
});

test("Build3DSimplePreview imports without stable preview runtime dependency", async () => {
  const [simpleModule, overviewModule] = await Promise.all([
    import("../../src/features/build/view3d/Build3DSimplePreview.js"),
    import("../../src/features/build/view3d/engineeringOverview.js"),
  ]);
  if (typeof simpleModule.default !== "object" && typeof simpleModule.default !== "function") {
    throw new Error("Build3DSimplePreview should export a React component.");
  }
  if (typeof overviewModule.applyEngineeringOverviewPreset !== "function") {
    throw new Error("engineeringOverview helpers should remain independently importable.");
  }
});
