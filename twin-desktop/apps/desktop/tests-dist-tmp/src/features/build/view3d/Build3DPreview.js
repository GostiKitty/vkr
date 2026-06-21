import { jsx as _jsx } from "react/jsx-runtime";
import React, { useEffect, useRef } from "react";
import { createBuildScene } from "./threeScene";
export const Build3DPreview = React.forwardRef(({ model, tool, activeLevelId, equipmentType, pipeType, debug, selection, viewer, showHeatmap, showContours, showWallSurfaces, showVolumeTint, showTooltip, thermalBuildOptions, thermalField, transientFrame = null, onSelect, onHoverInfo, onCameraStateChange, onPerformanceStateChange, onSetWalls, onAddDoor, onAddWindow, onAddPipe, onAddDuct, onAddEquipment, onAddSensor, onUpdateRoom, onUpdateWall, onUpdateDoor, onUpdateWindow, onUpdatePipe, onUpdateDuct, onUpdateEquipment, onUpdateSensor, thermalFrame, sectionHeight, sectionMode, sectionOffset, safeMode = false, debugInit = false, }, forwardedRef) => {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const callbacksRef = useRef({
        onSelect,
        onHoverInfo,
        onCameraStateChange,
        onPerformanceStateChange,
        onSetWalls,
        onAddDoor,
        onAddWindow,
        onAddPipe,
        onAddDuct,
        onAddEquipment,
        onAddSensor,
        onUpdateRoom,
        onUpdateWall,
        onUpdateDoor,
        onUpdateWindow,
        onUpdatePipe,
        onUpdateDuct,
        onUpdateEquipment,
        onUpdateSensor,
    });
    useEffect(() => {
        callbacksRef.current = {
            onSelect,
            onHoverInfo,
            onCameraStateChange,
            onPerformanceStateChange,
            onSetWalls,
            onAddDoor,
            onAddWindow,
            onAddPipe,
            onAddDuct,
            onAddEquipment,
            onAddSensor,
            onUpdateRoom,
            onUpdateWall,
            onUpdateDoor,
            onUpdateWindow,
            onUpdatePipe,
            onUpdateDuct,
            onUpdateEquipment,
            onUpdateSensor,
        };
    }, [
        onSelect,
        onHoverInfo,
        onCameraStateChange,
        onPerformanceStateChange,
        onSetWalls,
        onAddDoor,
        onAddWindow,
        onAddPipe,
        onAddDuct,
        onAddEquipment,
        onAddSensor,
        onUpdateRoom,
        onUpdateWall,
        onUpdateDoor,
        onUpdateWindow,
        onUpdatePipe,
        onUpdateDuct,
        onUpdateEquipment,
        onUpdateSensor,
    ]);
    useEffect(() => {
        if (!canvasRef.current) {
            return;
        }
        sceneRef.current = createBuildScene(canvasRef.current, callbacksRef);
        return () => {
            sceneRef.current?.dispose();
            sceneRef.current = null;
        };
    }, []);
    useEffect(() => {
        sceneRef.current?.update(model, {
            tool,
            activeLevelId,
            equipmentType,
            pipeType,
            safeMode,
            useSimplifiedEquipment: safeMode,
            debugInit,
            debug,
            showHeatmap,
            showContours,
            showWallSurfaces,
            showVolumeTint,
            showTooltip,
            thermalBuildOptions,
        }, viewer, selection ?? null, thermalFrame ?? null, transientFrame ?? null, thermalField, sectionHeight, sectionMode, sectionOffset);
    }, [
        model,
        tool,
        activeLevelId,
        equipmentType,
        pipeType,
        debug,
        selection,
        viewer,
        showHeatmap,
        showContours,
        showWallSurfaces,
        showVolumeTint,
        showTooltip,
        thermalBuildOptions,
        thermalField,
        thermalFrame,
        transientFrame,
        sectionHeight,
        sectionMode,
        sectionOffset,
        safeMode,
        debugInit,
    ]);
    React.useImperativeHandle(forwardedRef, () => ({
        getCanvas: () => canvasRef.current,
        zoomToFit: () => {
            sceneRef.current?.zoomToFit();
        },
        resetView: () => {
            sceneRef.current?.resetView();
        },
        setTopView: () => {
            sceneRef.current?.setTopView();
        },
        focusSelection: () => {
            sceneRef.current?.focusSelection();
        },
    }), []);
    return _jsx("canvas", { ref: canvasRef, className: "block h-full w-full touch-none" });
});
export default Build3DPreview;
