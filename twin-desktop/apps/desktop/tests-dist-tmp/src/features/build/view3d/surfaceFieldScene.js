import * as THREE from "three";
import { getSurfaceFieldPatchValue, getSurfaceFieldValueRange, SURFACE_FIELD_MODE_LABELS, } from "../../../core/thermal/surfaceField";
import { thermalColor } from "./thermalColormap";
const SURFACE_KIND_LABELS = {
    wall: "Поверхность стены",
    floor: "Поверхность пола",
    ceiling: "Поверхность потолка",
    window: "Поверхность окна",
    door: "Поверхность двери",
};
const NOT_AVAILABLE = "н/д";
export function buildSurfaceFieldOverlayGroup(result, options) {
    const root = new THREE.Group();
    root.name = "group:surface-field";
    root.visible = true;
    const range = getSurfaceFieldValueRange(result, options.mode);
    const overlayXRay = options.xRay ?? false;
    // User-adjustable opacity: default 0.52, XRay mode slightly dimmer, condensation slightly stronger
    const baseOpacity = Math.max(0.1, Math.min(1, options.overlayOpacity ?? 0.52));
    if (options.showSurfaceField && range) {
        const patchesBySurfaceId = new Map();
        result.patches.forEach((patch) => {
            const list = patchesBySurfaceId.get(patch.surfaceId) ?? [];
            list.push(patch);
            patchesBySurfaceId.set(patch.surfaceId, list);
        });
        patchesBySurfaceId.forEach((patches, surfaceId) => {
            const geometry = new THREE.BufferGeometry();
            const positions = [];
            const colors = [];
            const patchIdsByCellIndex = [];
            patches.forEach((patch) => {
                const cornerValues = buildCornerValuesForMode(patch, options.mode);
                const cornerColors = cornerValues.map((value) => colorForMode(value, range, options.mode));
                const triangles = [
                    [0, 1, 2],
                    [0, 2, 3],
                ];
                triangles.forEach(([a, b, c]) => {
                    [a, b, c].forEach((index) => {
                        const corner = patch.corners[index];
                        const color = cornerColors[index];
                        positions.push(corner.x, corner.y, corner.z);
                        colors.push(color.r, color.g, color.b);
                    });
                });
                patchIdsByCellIndex.push(patch.id);
            });
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
            geometry.computeVertexNormals();
            const material = new THREE.MeshBasicMaterial({
                vertexColors: true,
                transparent: true,
                // Semi-transparent — baseOpacity driven by user slider (default 0.52).
                opacity: overlayXRay ? Math.min(baseOpacity + 0.28, 0.92) : options.mode === "condensationRisk" ? Math.min(baseOpacity + 0.16, 0.82) : baseOpacity,
                side: THREE.DoubleSide,
                depthTest: !overlayXRay,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = true;
            mesh.renderOrder = overlayXRay ? 20 : 6;
            mesh.name = `surface-field:${surfaceId}`;
            mesh.userData = {
                category: "surface-field",
                surfaceId,
                patchIdsByCellIndex,
                xRay: overlayXRay,
                disposeMaterial: true,
            };
            root.add(mesh);
        });
    }
    if (options.showHeatSources) {
        const heatSourcesRoot = new THREE.Group();
        heatSourcesRoot.name = "group:surface-field-sources";
        result.heatSources.forEach((source) => {
            const color = twoStopColor(clamp(source.totalPowerW / 1800, 0, 1), 0xf59e0b, 0xdc2626);
            if (source.segment) {
                const start = new THREE.Vector3(source.segment.start.x, source.segment.start.y, source.segment.start.z);
                const end = new THREE.Vector3(source.segment.end.x, source.segment.end.y, source.segment.end.z);
                const direction = new THREE.Vector3(end.x - start.x, end.y - start.y, end.z - start.z);
                const length = direction.length();
                if (length > 1e-4) {
                    const geometry = new THREE.CylinderGeometry(source.kind === "pipe" ? 0.015 : 0.028, source.kind === "pipe" ? 0.015 : 0.028, length, 8);
                    const material = new THREE.MeshBasicMaterial({
                        color,
                        transparent: true,
                        opacity: 0.96,
                        depthTest: !overlayXRay,
                        depthWrite: false,
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.visible = true;
                    mesh.renderOrder = overlayXRay ? 24 : 8;
                    mesh.position.set((start.x + end.x) * 0.5, (start.y + end.y) * 0.5, (start.z + end.z) * 0.5);
                    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
                    mesh.userData = {
                        category: "surface-heat-source",
                        sourceId: source.id,
                        sourceKind: source.kind,
                        title: source.kind === "pipe" ? "Источник тепла (труба)" : "Линейный источник тепла",
                        details: [
                            { label: "Мощность", value: `${source.totalPowerW.toFixed(0)} Вт` },
                            { label: "Радиус влияния", value: `${source.influenceRadiusM.toFixed(2)} м` },
                        ],
                        disposeMaterial: true,
                    };
                    heatSourcesRoot.add(mesh);
                }
                return;
            }
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(source.kind === "radiator" ? 0.09 : 0.06, 14, 14), new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.96,
                depthTest: !overlayXRay,
                depthWrite: false,
            }));
            mesh.visible = true;
            mesh.renderOrder = overlayXRay ? 24 : 8;
            mesh.position.set(source.position.x, source.position.y, source.position.z);
            mesh.name = `surface-source:${source.id}`;
            mesh.userData = {
                category: "surface-heat-source",
                sourceId: source.id,
                sourceKind: source.kind,
                title: source.kind === "radiator" ? "Источник тепла (радиатор)" : "Локальный источник тепла",
                details: [
                    { label: "Мощность", value: `${source.totalPowerW.toFixed(0)} Вт` },
                    { label: "Радиус влияния", value: `${source.influenceRadiusM.toFixed(2)} м` },
                ],
            };
            heatSourcesRoot.add(mesh);
        });
        root.add(heatSourcesRoot);
    }
    if (options.showThermalBridges) {
        const bridgeRoot = new THREE.Group();
        bridgeRoot.name = "group:surface-field-bridges";
        result.thermalBridges.forEach((bridge) => {
            if (bridge.segment) {
                const material = new THREE.LineBasicMaterial({
                    color: 0x38bdf8,
                    transparent: true,
                    opacity: 0.78,
                    depthTest: !overlayXRay,
                    depthWrite: false,
                });
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(bridge.segment.start.x, bridge.segment.start.y, bridge.segment.start.z),
                    new THREE.Vector3(bridge.segment.end.x, bridge.segment.end.y, bridge.segment.end.z),
                ]);
                const line = new THREE.Line(geometry, material);
                line.visible = true;
                line.renderOrder = overlayXRay ? 26 : 10;
                line.name = `surface-bridge:${bridge.id}`;
                line.userData = {
                    category: "surface-thermal-bridge",
                    bridgeId: bridge.id,
                    title: "Зона мостика холода",
                    details: [
                        { label: "Штраф по температуре", value: `${bridge.temperaturePenaltyC.toFixed(2)} °C` },
                        { label: "Радиус влияния", value: `${bridge.influenceRadiusM.toFixed(2)} м` },
                    ],
                    disposeMaterial: true,
                };
                bridgeRoot.add(line);
                return;
            }
            if (!bridge.position) {
                return;
            }
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), new THREE.MeshBasicMaterial({
                color: 0x38bdf8,
                transparent: true,
                opacity: 0.88,
                depthTest: !overlayXRay,
                depthWrite: false,
            }));
            mesh.visible = true;
            mesh.renderOrder = overlayXRay ? 26 : 10;
            mesh.position.set(bridge.position.x, bridge.position.y, bridge.position.z);
            mesh.name = `surface-bridge:${bridge.id}`;
            mesh.userData = {
                category: "surface-thermal-bridge",
                bridgeId: bridge.id,
                title: "Зона мостика холода",
                details: [
                    { label: "Штраф по температуре", value: `${bridge.temperaturePenaltyC.toFixed(2)} °C` },
                    { label: "Радиус влияния", value: `${bridge.influenceRadiusM.toFixed(2)} м` },
                ],
            };
            bridgeRoot.add(mesh);
        });
        root.add(bridgeRoot);
    }
    return root;
}
export function buildSurfaceFieldHoverInfo(args) {
    const userData = args.intersection.object.userData ?? {};
    const category = userData.category;
    if (category === "surface-field") {
        const faceIndex = args.intersection.faceIndex ?? 0;
        const cellIndex = Math.floor(faceIndex / 2);
        const patchId = userData.patchIdsByCellIndex?.[cellIndex];
        if (!patchId) {
            return null;
        }
        const patch = args.result.patchMap.get(patchId);
        if (!patch) {
            return null;
        }
        const roomDiagnostics = args.result.roomDiagnosticsByRoomId.get(patch.roomId);
        const roomLabel = args.roomLabelById.get(patch.roomId) ?? patch.roomId;
        const modeValue = getSurfaceFieldPatchValue(patch, args.mode);
        return {
            title: SURFACE_KIND_LABELS[patch.surfaceKind],
            subtitle: roomLabel,
            temperatureC: patch.patchTemperatureC,
            details: [
                {
                    label: "Воздух",
                    value: roomDiagnostics ? `${roomDiagnostics.airTemperatureC.toFixed(1)} °C` : NOT_AVAILABLE,
                },
                {
                    label: "Средняя лучистая",
                    value: roomDiagnostics ? `${roomDiagnostics.meanRadiantTemperatureC.toFixed(1)} °C` : NOT_AVAILABLE,
                },
                { label: "Тепловой поток", value: `${patch.patchHeatFluxWm2.toFixed(1)} Вт/м²` },
                { label: "Потери тепла", value: `${patch.patchHeatLossW.toFixed(2)} Вт` },
                { label: SURFACE_FIELD_MODE_LABELS[args.mode], value: formatModeValue(args.mode, modeValue) },
                {
                    label: "Точка росы",
                    value: roomDiagnostics ? `${roomDiagnostics.dewPointC.toFixed(1)} °C` : NOT_AVAILABLE,
                },
                {
                    label: "Конденсация",
                    value: patch.condensationRisk
                        ? `риск (${patch.condensationMarginC.toFixed(1)} °C)`
                        : `безопасно (+${patch.condensationMarginC.toFixed(1)} °C)`,
                },
                {
                    label: "Диапазон по помещению",
                    value: roomDiagnostics
                        ? `${roomDiagnostics.minSurfaceTempC.toFixed(1)}…${roomDiagnostics.maxSurfaceTempC.toFixed(1)} °C`
                        : NOT_AVAILABLE,
                },
            ],
            screenX: args.screenX,
            screenY: args.screenY,
        };
    }
    if (category === "surface-heat-source" || category === "surface-thermal-bridge") {
        return {
            title: userData.title ?? "Диагностика поверхности",
            subtitle: undefined,
            details: userData.details ?? [],
            screenX: args.screenX,
            screenY: args.screenY,
        };
    }
    return null;
}
function buildCornerValuesForMode(patch, mode) {
    if (mode === "surfaceTemperature") {
        return patch.cornerTemperaturesC;
    }
    if (mode === "condensationRisk") {
        return patch.cornerTemperaturesC.map((value) => clamp((-((value - patch.patchTemperatureC) + patch.condensationMarginC) + 1.5) / 4, 0, 1));
    }
    const patchValue = getSurfaceFieldPatchValue(patch, mode);
    return [patchValue, patchValue, patchValue, patchValue];
}
/**
 * Map a patch value to an ANSYS-like color for the given render mode.
 * Uses the shared thermal colormap for temperature/flux/loss,
 * and a safe→danger gradient for condensation risk.
 */
function colorForMode(value, range, mode) {
    const span = Math.max(range.max - range.min, 1e-9);
    const ratio = clamp((value - range.min) / span, 0, 1);
    if (mode === "condensationRisk") {
        // Special: green (safe) → red (risk) — keep distinct from thermal
        return twoStopColor(ratio, 0x16a34a, 0xdc2626);
    }
    // All other modes (surfaceTemperature, heatFlux, heatLoss) use the thermal colormap
    return thermalColor(ratio);
}
/** Simple two-stop lerp kept for non-thermal modes (condensation, equipment glow). */
function twoStopColor(ratio, cold, hot) {
    const t = clamp(ratio, 0, 1);
    const colorA = new THREE.Color(cold);
    const colorB = new THREE.Color(hot);
    const out = new THREE.Color();
    out.r = colorA.r + (colorB.r - colorA.r) * t;
    out.g = colorA.g + (colorB.g - colorA.g) * t;
    out.b = colorA.b + (colorB.b - colorA.b) * t;
    return out;
}
function formatModeValue(mode, value) {
    switch (mode) {
        case "surfaceTemperature":
            return `${value.toFixed(1)} °C`;
        case "heatFlux":
            return `${value.toFixed(1)} Вт/м²`;
        case "heatLoss":
            return `${value.toFixed(2)} Вт`;
        case "condensationRisk":
            return `${Math.round(value * 100)} %`;
        default:
            return `${value.toFixed(1)}`;
    }
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
