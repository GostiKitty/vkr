import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "../testHarness.js";
test("scheduleCanvasWorkspaceFit must not depend on canvasLayoutFitEpoch", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/BuildPage.tsx"), "utf8");
    const match = source.match(/const scheduleCanvasWorkspaceFit = useCallback\([\s\S]*?\}, \[([^\]]*)\]\);/);
    if (!match) {
        throw new Error("BuildPage should declare scheduleCanvasWorkspaceFit with useCallback.");
    }
    if (match[1].includes("canvasLayoutFitEpoch")) {
        throw new Error("scheduleCanvasWorkspaceFit must not list canvasLayoutFitEpoch in deps (causes fit/zoom loops).");
    }
});
test("build page keeps tools in a persistent side panel", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/BuildPage.tsx"), "utf8");
    if (!source.includes("const showBuildToolsPanel = buildEditingActive")) {
        throw new Error("BuildPage should always show the side tool panel while editing.");
    }
    if (source.includes('variant="top"')) {
        throw new Error("BuildPage should not render the top tool palette anymore.");
    }
    if (!source.includes("layoutFitEpoch={canvasLayoutFitEpoch}")) {
        throw new Error("BuildPage should pass layoutFitEpoch into Canvas2D.");
    }
});
test("canvas viewport fit centers geometry in the available viewport", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/canvas/canvasViewportFit.ts"), "utf8");
    if (!source.includes("centerX - viewport.width / (2 * zoom)")) {
        throw new Error("Canvas viewport fit should center geometry instead of pinning it to the top-left corner.");
    }
});
test("canvas layout fit avoids render loops from unstable effect dependencies", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/components/Canvas2D.tsx"), "utf8");
    if (source.includes("}, [layoutFitEpoch, size.height, size.width, zoomToFitContent]);")) {
        throw new Error("Canvas layout fit effect must not depend on size or zoomToFitContent.");
    }
    if (!source.includes("zoomToFitContentRef.current()")) {
        throw new Error("Canvas layout fit should call the stable ref indirection.");
    }
});
test("build workspace uses grid columns when the sidebar is open on desktop", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/BuildPage.tsx"), "utf8");
    if (!source.includes("md:grid md:grid-cols-[minmax(280px,336px)_minmax(0,1fr)]")) {
        throw new Error("BuildPage should allocate a dedicated sidebar column on desktop.");
    }
});
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
    if (thermalPanel.includes("Окраска пола по roomId") ||
        thermalPanel.includes("temperature meshes") ||
        thermalPanel.includes("сдвига surface")) {
        throw new Error("Demo block should not expose technical 3D overlay wording.");
    }
    if (telemetry.includes("ID проекта")) {
        throw new Error("Telemetry panel should not expose the raw project id label in the user UI.");
    }
    if (!telemetry.includes("Демонстрационный дом")) {
        throw new Error("Telemetry panel should map demo project ids to a readable project name.");
    }
});
test("formulas page explains calculation contours and updated formula statuses", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/formulas/FormulasPage.tsx"), "utf8");
    const requiredStatuses = [
        "используется в RC-модели",
        "используется в инженерном балансе",
        "используется в проверке СП 50",
        "используется в 1D transient",
        "используется только в legacy path",
        "справочная / пока не участвует в основном расчёте",
    ];
    for (const status of requiredStatuses) {
        if (!source.includes(status)) {
            throw new Error(`FormulasPage should document formula status: ${status}`);
        }
    }
    if (!source.includes('ventilation_loss: "используется в инженерном балансе"')) {
        throw new Error("ventilation_loss should be marked as used in the engineering balance.");
    }
    if (!source.includes('"radiator_heat_output", "coolant_flow_rate"')) {
        throw new Error("Heating topic should expose the coolant formula as a future/reference model.");
    }
    if (!source.includes("Расчётные контуры проекта")) {
        throw new Error("FormulasPage should explain the separate calculation contours.");
    }
});
test("results tab exposes active assumptions and ideal heater warning", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/reports/MetricsResultsTab.tsx"), "utf8");
    if (!source.includes("Активные расчётные допущения")) {
        throw new Error("MetricsResultsTab should render the active assumptions table.");
    }
    if (!source.includes("Основная RC-модель использует идеальный догрев до уставки")) {
        throw new Error("MetricsResultsTab should warn about the ideal heater assumption.");
    }
    if (!source.includes("buildThermalOptionsFromWorkflow(scenarioConfig)")) {
        throw new Error("MetricsResultsTab should derive displayed assumptions from workflow thermal options.");
    }
    if (!source.includes("THERMAL_UNCERTAINTY_DEFINITIONS")) {
        throw new Error("MetricsResultsTab should describe active uncertainty parameters when Monte Carlo is available.");
    }
});
test("results tab exposes engineering loss breakdown only from available diagnostics data", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/reports/MetricsResultsTab.tsx"), "utf8");
    if (!source.includes("Инженерное разложение потерь и нагрузок")) {
        throw new Error("MetricsResultsTab should show the engineering loss breakdown section.");
    }
    if (!source.includes("Разложение строится по доступным результатам текущего расчётного контура")) {
        throw new Error("MetricsResultsTab should explain that the breakdown depends on the current calculation contour.");
    }
    if (!source.includes("zone.lossOpaqueW") || !source.includes("zone.lossInfiltrationW")) {
        throw new Error("MetricsResultsTab should render room loss rows from existing diagnostics fields.");
    }
    if (!source.includes("Средняя температура") || !source.includes("Минимальная температура")) {
        throw new Error("MetricsResultsTab should explicitly mark unavailable temperature aggregates.");
    }
    if (!source.includes("нет инженерного разложения")) {
        throw new Error("MetricsResultsTab should show a fallback when the current contour lacks diagnostics data.");
    }
});
test("results and legacy report UI clearly mark separate calculation contours", () => {
    const resultsPanel = readFileSync(resolve(process.cwd(), "src/features/reports/ResultsPanel.tsx"), "utf8");
    const reportGenerator = readFileSync(resolve(process.cwd(), "src/features/reports/ReportGenerator.tsx"), "utf8");
    if (!resultsPanel.includes("Расчётные контуры")) {
        throw new Error("ResultsPanel should explain the multiple calculation contours.");
    }
    if (!reportGenerator.includes("Устаревший контур отчёта / требует синхронизации с основным расчётом")) {
        throw new Error("Legacy report generator should be explicitly marked as outdated.");
    }
    if (resultsPanel.includes("конструкторе (ВКР)")) {
        throw new Error("ResultsPanel should not leak the old ВКР wording in the hints.");
    }
});
test("thermal simulation settings expose engineering assumptions and next-run warning", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/components/ThermalSimulationPanel.tsx"), "utf8");
    const requiredControls = [
        "lightingGain_W_m2",
        "occupancyGain_W_m2",
        "equipmentGainMultiplier",
        "DEFAULT_THERMAL_OPTIONS.outdoor.baseC",
        "DEFAULT_THERMAL_OPTIONS.setpoints.day",
        "DEFAULT_ENGINEERING_OPTIONS.effectiveMassFactor",
    ];
    for (const token of requiredControls) {
        if (!source.includes(token)) {
            throw new Error(`ThermalSimulationPanel should expose and reset assumption control: ${token}`);
        }
    }
    if (!source.includes("Изменения влияют на следующий расчёт")) {
        throw new Error("ThermalSimulationPanel should warn that assumption changes affect only the next run.");
    }
});
test("uncertainty settings clamp runs and document unsurfaced risk thresholds", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/scenarios/UncertaintyPanel.tsx"), "utf8");
    if (!source.includes("THERMAL_MONTE_CARLO_MAX_RUNS")) {
        throw new Error("UncertaintyPanel should clamp Monte Carlo runs to the supported maximum.");
    }
    if (!source.includes("clampMonteCarloRuns")) {
        throw new Error("UncertaintyPanel should normalize Monte Carlo run counts before save/run.");
    }
    if (!source.includes("heatingThresholdKW") || !source.includes("varLevel")) {
        throw new Error("UncertaintyPanel should explain that risk threshold and VaR level are not yet surfaced in UI.");
    }
});
test("calculation backlog keeps TODOs for unsurfaced assumption controls", () => {
    const source = readFileSync(resolve(process.cwd(), "docs/calculation-backlog-2026-05-16.md"), "utf8");
    if (!source.includes("supplyAirTemperatureC") || !source.includes("heatingThresholdKW") || !source.includes("varLevel")) {
        throw new Error("Backlog should keep TODO entries for assumption controls that are not yet surfaced.");
    }
});
test("workspace modes and actions keep the results viewport reachable", () => {
    const workspaceStore = readFileSync(resolve(process.cwd(), "src/entities/workspace/workspace.store.ts"), "utf8");
    const leftToolbar = readFileSync(resolve(process.cwd(), "src/features/build/components/LeftToolbar.tsx"), "utf8");
    const topBar = readFileSync(resolve(process.cwd(), "src/app/TopBar.tsx"), "utf8");
    if (!workspaceStore.includes('type WorkspaceMode = "plan" | "view3d" | "networks" | "results"')) {
        throw new Error("WorkspaceMode should keep the results viewport.");
    }
    if (workspaceStore.includes('id: "thermal"')) {
        throw new Error("Workspace modes should not expose a separate thermal tab.");
    }
    if (!leftToolbar.includes('id: "results"')) {
        throw new Error("LeftToolbar should keep the results action.");
    }
    if (!leftToolbar.includes('onViewportChange("results")')) {
        throw new Error("Results action should switch the workspace to the results viewport.");
    }
    if (!topBar.includes("WORKSPACE_MODES.map((mode) =>")) {
        throw new Error("TopBar should render workspace modes from the shared registry.");
    }
    if (!topBar.includes('data-testid={`workspace-tab-${mode.id}`}')) {
        throw new Error("TopBar should expose stable data-testid markers for workspace tabs.");
    }
    if (!topBar.includes('aria-current={currentPath === "/build" && workspaceMode === mode.id ? "page" : undefined}')) {
        throw new Error("TopBar should expose the active workspace tab through aria-current.");
    }
});
test("build results viewport keeps a dedicated vertical scroll shell", () => {
    const appSource = readFileSync(resolve(process.cwd(), "src/app/App.tsx"), "utf8");
    const source = readFileSync(resolve(process.cwd(), "src/features/build/BuildPage.tsx"), "utf8");
    if (!appSource.includes('? "flex h-screen flex-col overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--text-base)]"')) {
        throw new Error("Build route app shell should use a fixed-height overflow-hidden layout.");
    }
    if (!appSource.includes('? "ui-page-enter mx-auto flex w-full max-w-[min(100%,96rem)] flex-1 min-h-0 overflow-hidden px-4 pb-3 pt-3 sm:px-6 xl:px-8"')) {
        throw new Error("Build route main shell should keep overflow hidden and delegate scrolling to inner viewports.");
    }
    if (!source.includes('className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden bg-transparent px-2 pb-3 pt-2 text-[color:var(--text-base)]"')) {
        throw new Error("BuildPage should fill the available main shell height instead of using a viewport calc.");
    }
    if (!source.includes('activeViewport === "results"')) {
        throw new Error("BuildPage should render the results viewport branch.");
    }
    if (!source.includes('data-testid="workspace-results-viewport"')) {
        throw new Error("BuildPage should expose a stable test id for the results viewport.");
    }
    if (!source.includes("h-full max-h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain")) {
        throw new Error("Results viewport should keep a vertical scroll container without shell-level horizontal overflow.");
    }
    if (!source.includes('id="thermal-results-section"')) {
        throw new Error("BuildPage should expose the thermal results section anchor.");
    }
});
test("thermal results panel clips horizontal overflow and wraps wide tables locally", () => {
    const source = readFileSync(resolve(process.cwd(), "src/features/build/components/ThermalSimulationPanel.tsx"), "utf8");
    if (!source.includes('data-testid="thermal-results-panel"')) {
        throw new Error("ThermalSimulationPanel should expose a stable panel test id.");
    }
    if (!source.includes('data-testid="thermal-results-empty-state"')) {
        throw new Error("ThermalSimulationPanel should expose a stable empty-state test id.");
    }
    if (!source.includes("overflow-x-hidden overflow-y-visible")) {
        throw new Error("ThermalSimulationPanel root should suppress horizontal overflow without killing vertical flow.");
    }
    if (!source.includes('className="mt-3 overflow-x-auto"')) {
        throw new Error("ThermalSimulationPanel should wrap wide tabular blocks in a local horizontal scroller.");
    }
});
