import { jsx as _jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import OrientationHelper3D from "../../src/features/build/components/OrientationHelper3D.js";
import ThreeDControlPanel from "../../src/features/build/components/ThreeDControlPanel.js";
import { DEFAULT_STABLE_VIEWER_OPTIONS } from "../../src/features/build/view3d/viewerOptions.js";
import { DEFAULT_THERMAL_DISPLAY_OPTIONS } from "../../src/features/build/thermal/displayOptions.js";
import { test } from "../testHarness.js";
test("OrientationHelper3D renders compass block without duplicating the level label", () => {
    const markup = renderToStaticMarkup(_jsx(OrientationHelper3D, { cameraState: null, levelName: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C 1" }));
    if (!markup.includes("Компас 3D")) {
        throw new Error("Orientation helper should render a compass block.");
    }
    if (markup.includes(">Уровень 1<")) {
        throw new Error("Orientation helper should not duplicate the level label in the top overlay.");
    }
});
test("ThreeDControlPanel keeps only active controls in the main 3D UI", () => {
    const markup = renderToStaticMarkup(_jsx(ThreeDControlPanel, { activeLevelName: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C 1", selectedElementLabel: null, workflowMode: "navigation", toolGuide: { title: "Навигация", description: "desc", hint: "hint" }, canFocusSelection: false, onWorkflowModeChange: () => { }, onZoomToFit: () => { }, onResetView: () => { }, onTopView: () => { }, onFocusSelection: () => { }, onToggleFullscreen: () => { }, onClose: () => { }, viewer: DEFAULT_STABLE_VIEWER_OPTIONS, onViewerChange: () => { }, engineeringOverviewActive: false, onApplyEngineeringOverview: () => { }, onResetEngineeringOverview: () => { }, thermalDisplay: {
            ...DEFAULT_THERMAL_DISPLAY_OPTIONS,
            mode: "steady",
            showFloorField: false,
            showContours: false,
            showWallSurfaces: false,
            showVolumeTint: true,
            showTooltip: true,
            showLegend: true,
            outdoorTemperatureC: -5,
            lightingGain_W_m2: 4,
            occupancyGain_W_m2: 1.6,
            infiltrationACH: 0.5,
        }, onThermalDisplayChange: () => { }, hasSimulation: false, thermalPlaying: false, onToggleThermalPlaying: () => { }, thermalTimeIndex: 0, onThermalTimeIndexChange: () => { }, thermalTimelineLength: 0, thermalTimeLabel: "0 \u0447", thermalStatus: "\u0441\u0442\u0430\u0442\u0438\u0447\u043D\u043E", currentOutdoorTemperatureC: -5, performance: null, showDevDebug: false, debug: {
            showWallNormals: false,
            showWallJoinDebug: false,
            showWallDebugCorners: false,
            showRoomContours: false,
            showThermalGrid: false,
            showRadiatorInfluence: false,
            showCoolingZones: false,
            showOpeningHosts: false,
        }, onDebugChange: () => { }, inspector: _jsx("div", { children: "inspector" }), stableMode: true }));
    if (!markup.includes("Фокус на модель") || !markup.includes("Сбросить вид") || !markup.includes("Вид сверху")) {
        throw new Error("Stable panel should keep the basic camera actions.");
    }
    if (!markup.includes("Показать сети") || !markup.includes("Показать оборудование") || !markup.includes("Показать температуру")) {
        throw new Error("Recovered 3D UI should keep the active visibility toggles.");
    }
    if (!markup.includes("Объемная модель здания")) {
        throw new Error("Stable branch should present the main 3D UI, not a demo preview.");
    }
    if (markup.includes("demo preview") || markup.includes("simple preview") || markup.includes("Инженерный обзор")) {
        throw new Error("Main 3D panel should not render demo-only or disabled controls.");
    }
});
