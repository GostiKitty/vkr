import { buildNetworkConnectivityWarnings } from "../networks/connectivity";
export const ENGINEERING_OVERVIEW_PRESENTATION_MODE = "engineering-overview";
export const ENGINEERING_OVERVIEW_PATCH = {
    showRooms: true,
    showWalls: true,
    showOpenings: true,
    showNetworks: true,
    showEquipment: true,
    transparentWalls: true,
    presentationMode: ENGINEERING_OVERVIEW_PRESENTATION_MODE,
};
export function isEngineeringOverviewPresetActive(viewer) {
    return (viewer.presentationMode === ENGINEERING_OVERVIEW_PRESENTATION_MODE &&
        viewer.showRooms &&
        viewer.showWalls &&
        viewer.showOpenings &&
        viewer.showNetworks &&
        viewer.showEquipment &&
        viewer.transparentWalls);
}
export function applyEngineeringOverviewPreset(viewer) {
    if (isEngineeringOverviewPresetActive(viewer)) {
        return viewer;
    }
    return {
        ...viewer,
        ...ENGINEERING_OVERVIEW_PATCH,
    };
}
export function clearEngineeringOverviewPreset(viewer) {
    if (viewer.presentationMode !== ENGINEERING_OVERVIEW_PRESENTATION_MODE) {
        return viewer;
    }
    return {
        ...viewer,
        presentationMode: "default",
    };
}
export function shouldEnableEngineeringOverviewForDemoStep(stepId) {
    return stepId === "networks";
}
export function buildEngineeringOverviewSummary(model) {
    return {
        pipeCount: model.pipes.length,
        ductCount: model.ducts.length,
        equipmentCount: model.equipment.length + model.sensors.length,
        warningCount: buildNetworkConnectivityWarnings(model).length,
        hasNetworks: model.pipes.length > 0 || model.ducts.length > 0 || model.equipment.length > 0 || model.sensors.length > 0,
    };
}
