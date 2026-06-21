import { useEffect, useMemo, useRef, useState } from "react";
import { createThermalFieldModel } from "../../../core/thermal/field";
import { buildPreviewThermalFrame } from "../../../core/thermal/preview";
function buildModelThermalKey(model) {
    const encodeRooms = model.rooms
        .map((room) => `${room.id}:${room.levelId}:${room.polygon.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(";")}`)
        .sort()
        .join("|");
    const encodeWalls = model.walls
        .map((wall) => `${wall.id}:${wall.levelId}:${wall.a.x.toFixed(2)},${wall.a.y.toFixed(2)}:${wall.b.x.toFixed(2)},${wall.b.y.toFixed(2)}:${wall.thickness_m.toFixed(2)}:${wall.height_m.toFixed(2)}`)
        .sort()
        .join("|");
    const encodeEquipment = model.equipment
        .map((item) => `${item.id}:${item.type}:${item.levelId}:${item.position.x.toFixed(2)},${item.position.y.toFixed(2)}:${item.state}:${item.roomId ?? "na"}:${item.connectedNetworkIds.join(",")}:${item.params.nominalPowerW ?? 0}:${item.params.designAirflow_m3_s ?? 0}:${item.params.supplyTemperatureC ?? "na"}`)
        .sort()
        .join("|");
    const encodePipes = model.pipes
        .map((pipe) => `${pipe.id}:${pipe.levelId}:${pipe.type}:${pipe.fluidTemperatureC}:${pipe.flowRate_kg_s}:${pipe.connectedEquipmentIds.join(",")}:${pipe.path.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(";")}`)
        .sort()
        .join("|");
    const encodeDucts = model.ducts
        .map((duct) => `${duct.id}:${duct.levelId}:${duct.airflow_m3_s}:${duct.airVelocity_m_s}:${duct.connectedEquipmentIds.join(",")}:${duct.path.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(";")}`)
        .sort()
        .join("|");
    const encodeOpenings = [...model.windows, ...model.doors]
        .map((opening) => `${opening.id}:${opening.anchor.wallId ?? "lost"}:${opening.anchor.offset_m.toFixed(2)}:${opening.width_m.toFixed(2)}:${opening.height_m.toFixed(2)}`)
        .sort()
        .join("|");
    const scenario = model.scenarios.find((item) => item.id === model.activeScenarioId);
    const scenarioKey = scenario
        ? `${scenario.id}:${scenario.impact.setpointOffsetC}:${scenario.impact.networkFlowMultiplier}:${scenario.impact.heatLoadMultiplier}:${Object.entries(scenario.impact.equipmentStateOverrides)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}:${value}`)
            .join(",")}`
        : "no-scenario";
    return [encodeRooms, encodeWalls, encodeOpenings, encodeEquipment, encodePipes, encodeDucts, scenarioKey].join("#");
}
function buildFrameKey(frame) {
    if (!frame) {
        return "preview";
    }
    const roomKey = Object.entries(frame.rooms)
        .map(([roomId, payload]) => `${roomId}:${payload.temperatureC.toFixed(3)}:${payload.heatingPowerW.toFixed(1)}`)
        .sort()
        .join("|");
    return `${frame.timeHours.toFixed(3)}:${frame.outdoorTemperatureC.toFixed(3)}:${roomKey}`;
}
function buildAnalysisKey(model, fieldOptions, frame) {
    return `${buildModelThermalKey(model)}::${JSON.stringify(fieldOptions)}::${buildFrameKey(frame)}`;
}
function computeSync(model, fieldOptions, frame) {
    const startedAt = performance.now();
    const previewFrame = buildPreviewThermalFrame(model, fieldOptions);
    const effectiveFrame = frame ?? previewFrame;
    const roomTemperaturesC = Object.fromEntries(Object.entries(effectiveFrame.rooms).map(([roomId, payload]) => [roomId, payload.temperatureC]));
    const field = createThermalFieldModel(model, {
        ...fieldOptions,
        outdoorTemperatureC: effectiveFrame.outdoorTemperatureC,
        roomTemperaturesC,
    });
    return {
        previewFrame,
        effectiveFrame,
        field,
        stats: {
            computeMs: performance.now() - startedAt,
            sampleCount: field.rooms.reduce((sum, room) => sum + room.samplePoints.length, 0),
            sourceCount: field.sources.length,
            boundaryCount: field.boundaries.length,
        },
    };
}
export function usePreparedThermalAnalysis(model, fieldOptions, frame, enabled) {
    const [result, setResult] = useState(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);
    const [cacheSize, setCacheSize] = useState(0);
    const workerRef = useRef(null);
    const requestIdRef = useRef(0);
    const cacheRef = useRef(new Map());
    const requestKey = useMemo(() => {
        if (!enabled) {
            return null;
        }
        return buildAnalysisKey(model, fieldOptions, frame);
    }, [enabled, fieldOptions, frame, model]);
    useEffect(() => {
        if (!enabled || !requestKey) {
            setPending(false);
            setError(null);
            setResult(null);
            return;
        }
        const cached = cacheRef.current.get(requestKey);
        if (cached) {
            setResult(cached);
            setPending(false);
            setError(null);
            return;
        }
        // Preview mode must update immediately after geometry edits; otherwise
        // the UI can keep showing a stale worker result for the previous room set.
        if (frame === null) {
            const computed = computeSync(model, fieldOptions, frame);
            cacheRef.current.set(requestKey, computed);
            setCacheSize(cacheRef.current.size);
            setResult(computed);
            setPending(false);
            setError(null);
            return;
        }
        if (typeof Worker === "undefined") {
            const computed = computeSync(model, fieldOptions, frame);
            cacheRef.current.set(requestKey, computed);
            setCacheSize(cacheRef.current.size);
            setResult(computed);
            setPending(false);
            setError(null);
            return;
        }
        if (!workerRef.current) {
            workerRef.current = new Worker(new URL("./thermal.worker.ts", import.meta.url), { type: "module" });
        }
        const worker = workerRef.current;
        const requestId = ++requestIdRef.current;
        setPending(true);
        setError(null);
        const handleMessage = (event) => {
            if (event.data.requestId !== requestId) {
                return;
            }
            worker.removeEventListener("message", handleMessage);
            if (!event.data.ok) {
                if (import.meta.env.DEV) {
                    console.warn("[thermal] worker failed, using synchronous fallback", event.data.error);
                }
                const fallback = computeSync(model, fieldOptions, frame);
                cacheRef.current.set(requestKey, fallback);
                setCacheSize(cacheRef.current.size);
                setResult(fallback);
                setPending(false);
                setError(null);
                return;
            }
            cacheRef.current.set(requestKey, event.data.result);
            setCacheSize(cacheRef.current.size);
            setResult(event.data.result);
            setPending(false);
            setError(null);
        };
        worker.addEventListener("message", handleMessage);
        const payload = {
            requestId,
            model,
            fieldOptions,
            frame,
        };
        worker.postMessage(payload);
        return () => {
            worker.removeEventListener("message", handleMessage);
        };
    }, [enabled, fieldOptions, frame, model, requestKey]);
    useEffect(() => {
        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);
    return {
        result,
        pending,
        error,
        cacheSize,
    };
}
