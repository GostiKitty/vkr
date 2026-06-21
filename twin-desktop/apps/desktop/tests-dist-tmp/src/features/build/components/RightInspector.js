import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo } from "react";
import { polygonArea, polygonCentroid, polygonContainsPoint } from "../../../entities/geometry/geom";
import { createId } from "../../../shared/utils/id";
import { EQUIPMENT_TYPE_LABELS, HEAT_CARRIER_LABELS, HEATING_CONNECTION_TYPE_LABELS, HEATING_SYSTEM_KIND_LABELS, NETWORK_SYSTEM_TYPE_LABELS, PIPE_CIRCUIT_ROLE_LABELS, PIPE_TYPE_LABELS, PIPE_MARKING_COLOR_LABELS, PIPE_FLOW_ROLE_LABELS, PIPE_SEGMENT_CLASS_LABELS, FLOW_DIRECTION_LABELS, resolveNetworkSystemType, resolvePipeCircuitRole, SENSOR_TYPE_LABELS, } from "../../../entities/networks/types";
import { WALL_ASSEMBLIES, DEFAULT_WALL_ASSEMBLY_ID, computeWallProperties, ensureWallLayers, } from "../../../entities/material/types";
import { applyEnvelopePresetToDoor, applyEnvelopePresetToFloorSlab, applyEnvelopePresetToRoof, applyEnvelopePresetToWall, applyEnvelopePresetToWindow, describeEnvelopePreset, getEnvelopePreset, resolveDefaultPresetId, } from "../../../entities/envelope/envelopePresets";
import { polylineLength } from "../../../core/networks/index";
import { describeEquipmentNetworkPolicy } from "../../../core/networks/compatibility";
import { getRoomDisplayName, normalizeStoredRoomName } from "../../../shared/utils/roomNames";
import { formatArea } from "../../../shared/utils/format";
import { sanitizeDisplayText } from "../../../shared/utils/displayText";
import { anchorToOffset, buildAnchorFromOffset } from "../utils/openingMath";
import { getFloorDisplayLabel, getLevelDisplayLabel, getLevelSummaryLabel, getRoomDisplayLabel, getWallDisplayLabel, } from "../utils/entityLabels";
import { describeEquipmentConnectionStatus, describeSupplyReturnRole, formatEquipmentStateLabel, formatHeatingCircuitLabel, getEquipmentInspectorTitle, getEquipmentPurposeLabel, } from "../engineering/userLabels";
import { createPipeDefaults, FLOOR_SLAB_DEFAULTS, ROOF_DEFAULTS, } from "../defaults";
import { ENGINEERING_EQUIPMENT_LABELS } from "../engineering2d/catalog";
import { EngineeringEquipmentForm, EngineeringPipeForm, } from "./Engineering2DInspector";
import { ConstructionLayerEditor } from "./ConstructionLayerEditor";
import { EnvelopePresetSearchPicker } from "./EnvelopePresetSearchPicker";
const PIPE_DIAMETER_OPTIONS = [15, 20, 25, 32, 40, 50, 65, 80, 100];
function innerDiameterFor(outerDiameter_mm) {
    if (outerDiameter_mm <= 20) {
        return Math.max(10, outerDiameter_mm - 4);
    }
    if (outerDiameter_mm <= 40) {
        return outerDiameter_mm - 5;
    }
    return outerDiameter_mm - 7;
}
function defaultPipeMarkingColor(type) {
    if (type === "heating_supply")
        return "gost_supply";
    if (type === "heating_return")
        return "gost_return";
    if (type === "dhw")
        return "gost_dhw";
    if (type === "chw")
        return "gost_chw";
    return "neutral";
}
export function RightInspector(props) {
    const { model, selection, tool, equipmentPreset, pipePreset, activeLevelLabel, minimal = false, onRemoveSelection } = props;
    const selectedEntity = useMemo(() => {
        if (!selection) {
            return null;
        }
        switch (selection.kind) {
            case "room":
                return model.rooms.find((room) => room.id === selection.id) ?? null;
            case "wall":
                return model.walls.find((wall) => wall.id === selection.id) ?? null;
            case "roof":
                return (model.roofs ?? []).find((roof) => roof.id === selection.id) ?? null;
            case "slab":
                return (model.floorSlabs ?? []).find((slab) => slab.id === selection.id) ?? null;
            case "door":
                return model.doors.find((door) => door.id === selection.id) ?? null;
            case "window":
                return model.windows.find((window) => window.id === selection.id) ?? null;
            case "pipe":
                return model.pipes.find((pipe) => pipe.id === selection.id) ?? null;
            case "duct":
                return model.ducts.find((duct) => duct.id === selection.id) ?? null;
            case "equipment":
                return model.equipment.find((item) => item.id === selection.id) ?? null;
            case "sensor":
                return model.sensors.find((item) => item.id === selection.id) ?? null;
            case "engineeringEquipment":
                return model.engineeringSystems?.equipment.find((item) => item.id === selection.id) ?? null;
            case "engineeringPipe":
                return model.engineeringSystems?.pipes.find((item) => item.id === selection.id) ?? null;
            case "loop":
                return props.loops[selection.id] ?? null;
            default:
                return null;
        }
    }, [model, props.loops, selection]);
    const draftKind = useMemo(() => {
        switch (tool) {
            case "room":
            case "roomRect":
                return "room";
            case "wall":
            case "roof":
            case "slab":
            case "door":
            case "window":
            case "pipe":
            case "duct":
            case "equipment":
            case "sensor":
            case "engineeringEquipment":
            case "engineeringPipe":
                return tool;
            default:
                return null;
        }
    }, [tool]);
    const mode = selectedEntity && selection ? "selected" : draftKind ? "draft" : "empty";
    const hideDraftHeader = mode === "draft";
    const subtitle = mode === "selected"
        ? selectionLabel(selection?.kind)
        : mode === "draft"
            ? draftLabel(draftKind, tool, equipmentPreset, props.engineeringEquipmentPreset)
            : "Ничего не выбрано";
    return (_jsx("aside", { className: `flex min-h-0 min-w-0 flex-col ${minimal
            ? "ui-panel rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] p-2.5 shadow-[0_20px_36px_-28px_rgba(15,23,42,0.45)]"
            : "h-full"}`, children: _jsxs("section", { className: `${minimal ? "ui-panel-muted p-3 rounded-[18px] bg-[color:var(--surface-elevated)]/55" : "h-full p-0 bg-transparent"}`, children: [!hideDraftHeader ? (_jsxs("header", { className: "sticky top-0 z-10 mb-3 flex items-start justify-between gap-3 border-b border-[color:var(--border-soft)] bg-[color:var(--surface-base)]/80 pb-2.5 pt-1 backdrop-blur-sm", children: [_jsx("div", { className: "min-w-0", children: mode === "empty" ? null : (_jsx("p", { className: "truncate text-sm font-medium text-[color:var(--text-muted)]", children: subtitle })) }), mode === "selected" && selection ? (_jsx("button", { type: "button", onClick: onRemoveSelection, className: "ui-control shrink-0 rounded-[10px] border border-[color:var(--danger-border)]/70 bg-[color:var(--danger-bg)]/70 px-2.5 py-1 text-xs font-semibold text-[color:var(--danger-fg)] hover:border-[color:var(--danger-border)] hover:bg-[color:var(--danger-bg)]", children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })) : null] })) : null, mode === "selected" && selection && selectedEntity ? _jsx(SelectionForm, { ...props, entity: selectedEntity }) : null, mode === "draft" && draftKind ? (_jsx(DraftForm, { draftKind: draftKind, wallPreset: props.wallPreset, windowPreset: props.windowPreset, doorPreset: props.doorPreset, roofPreset: props.roofPreset, slabPreset: props.slabPreset })) : null] }) }));
}
function SelectionForm({ model, selection, neighbors, roomNames, loops, roomEnvelopes, slabPreset, entity, onUpdateRoom, onUpdateWall, onUpdateRoof, onAddFloorSlab, onUpdateFloorSlab, onUpdateDoor, onUpdateWindow, onUpdatePipe, onUpdateDuct, onUpdateEquipment, onUpdateSensor, onUpdateEngineeringEquipment, onUpdateEngineeringPipe, onCreateRoomFromLoop, }) {
    if (!selection) {
        return null;
    }
    switch (selection.kind) {
        case "loop": {
            const loop = loops[selection.id];
            if (!loop) {
                return _jsx("p", { className: "text-sm text-[color:var(--text-soft)]", children: "\u041A\u043E\u043D\u0442\u0443\u0440 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D." });
            }
            const status = loop.roomSource === "manual"
                ? "Комната уже создана вручную"
                : loop.roomSource === "auto"
                    ? "Комната распознана автоматически"
                    : loop.valid
                        ? "Контур готов к созданию комнаты"
                        : loop.reason ?? "Контур невалиден";
            const cannotCreate = !loop.valid || Boolean(loop.roomId && loop.roomSource === "manual");
            return (_jsxs("div", { className: "space-y-3", children: [_jsx(InfoCard, { rows: [
                            { label: "Этаж", value: getFloorDisplayLabel(model, loop.levelId) },
                            { label: "Площадь", value: formatArea(loop.area) },
                            { label: "Статус", value: status },
                        ] }), _jsx("button", { type: "button", onClick: () => onCreateRoomFromLoop(selection.id), disabled: cannotCreate, className: `w-full rounded-xl px-3 py-2 text-sm font-semibold transition ${cannotCreate
                            ? "cursor-not-allowed border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
                            : "border border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-fg)] hover:border-[color:var(--success-border)]"}`, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443" })] }));
        }
        case "room": {
            const selectedRoom = entity;
            const roomIndex = model.rooms.findIndex((item) => item.id === selectedRoom.id);
            return (_jsx(RoomForm, { room: selectedRoom, roomIndex: roomIndex, levels: model.levels, neighbors: neighbors, roomNames: roomNames, roomEnvelopes: roomEnvelopes, floorSlabs: model.floorSlabs ?? [], slabPreset: slabPreset, onUpdateRoom: onUpdateRoom, onAddFloorSlab: onAddFloorSlab, onUpdateFloorSlab: onUpdateFloorSlab }));
        }
        case "wall":
            return _jsx(WallForm, { wall: entity, levels: model.levels, onUpdateWall: onUpdateWall });
        case "roof":
            return _jsx(RoofForm, { roof: entity, levels: model.levels, onUpdateRoof: onUpdateRoof });
        case "slab":
            return _jsx(FloorSlabForm, { slab: entity, levels: model.levels, onUpdateFloorSlab: onUpdateFloorSlab });
        case "door":
            return _jsx(OpeningForm, { kind: "door", opening: entity, model: model, onUpdate: (patch) => onUpdateDoor(selection.id, patch) });
        case "window":
            return _jsx(OpeningForm, { kind: "window", opening: entity, model: model, onUpdate: (patch) => onUpdateWindow(selection.id, patch) });
        case "pipe":
            return _jsx(PipeForm, { model: model, pipe: entity, onUpdatePipe: onUpdatePipe });
        case "duct":
            return _jsx(DuctForm, { duct: entity, onUpdateDuct: onUpdateDuct });
        case "equipment":
            return _jsx(EquipmentForm, { model: model, equipment: entity, roomNames: roomNames, onUpdateEquipment: onUpdateEquipment });
        case "sensor":
            return _jsx(SensorForm, { sensor: entity, roomNames: roomNames, onUpdateSensor: onUpdateSensor });
        case "engineeringEquipment":
            return (_jsx(EngineeringEquipmentForm, { equipment: entity, onUpdateEngineeringEquipment: onUpdateEngineeringEquipment }));
        case "engineeringPipe":
            return (_jsx(EngineeringPipeForm, { model: model, pipe: entity, onUpdateEngineeringPipe: onUpdateEngineeringPipe }));
        default:
            return null;
    }
}
function EnvelopePresetField({ kind, value, onChange, }) {
    return (_jsxs("label", { className: "block space-y-1 text-xs font-semibold text-[color:var(--text-soft)]", children: ["\u0422\u0438\u043F\u043E\u0432\u043E\u0439 \u043F\u0440\u0435\u0441\u0435\u0442", _jsx(EnvelopePresetSearchPicker, { kind: kind, value: value, onChange: onChange })] }));
}
function DraftForm({ draftKind, wallPreset, windowPreset, doorPreset, roofPreset, slabPreset, }) {
    if (draftKind === "engineeringEquipment" || draftKind === "engineeringPipe") {
        return null;
    }
    switch (draftKind) {
        case "room":
            return null;
        case "wall": {
            const preset = getEnvelopePreset(wallPreset);
            const layers = preset?.layers ?? WALL_ASSEMBLIES[DEFAULT_WALL_ASSEMBLY_ID]?.layers;
            const properties = computeWallProperties(layers, preset?.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID, {
                includeSp50AirFilms: true,
            });
            return (_jsxs("div", { className: "space-y-3", children: [_jsx(EnvelopePresetField, { kind: "wall", value: wallPreset, onChange: () => undefined }), properties ? (_jsxs("div", { className: "grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx(ValueTile, { label: "R, \u043C\u00B2\u041A/\u0412\u0442", value: properties.rValue.toFixed(3) }), _jsx(ValueTile, { label: "U, \u0412\u0442/(\u043C\u00B2\u041A)", value: properties.uValue.toFixed(3) }), _jsx("div", { className: "col-span-2", children: _jsx(ValueTile, { label: "\u0422\u0435\u043F\u043B\u043E\u0451\u043C\u043A\u043E\u0441\u0442\u044C, \u0414\u0436/(\u043C\u00B2\u041A)", value: properties.heatCapacity_J_m2K.toFixed(0) }) })] })) : null] }));
        }
        case "roof":
            return _jsx(EnvelopePresetField, { kind: "roof", value: roofPreset, onChange: () => undefined });
        case "slab":
            return _jsx(EnvelopePresetField, { kind: "slab", value: slabPreset, onChange: () => undefined });
        case "door":
            return _jsx(EnvelopePresetField, { kind: "door", value: doorPreset, onChange: () => undefined });
        case "window":
            return _jsx(EnvelopePresetField, { kind: "window", value: windowPreset, onChange: () => undefined });
        case "pipe":
        case "duct":
        case "equipment":
        case "sensor":
            return null;
        default:
            return null;
    }
}
function RoomForm({ room, roomIndex, levels, neighbors, roomNames, roomEnvelopes, floorSlabs, slabPreset, onUpdateRoom, onAddFloorSlab, onUpdateFloorSlab, }) {
    const area = Math.abs(polygonArea(room.polygon));
    const envelope = roomEnvelopes[room.id];
    const resolvedRoomIndex = roomIndex >= 0 ? roomIndex : 0;
    useEffect(() => {
        const normalized = normalizeStoredRoomName(room, resolvedRoomIndex);
        if (normalized) {
            onUpdateRoom(room.id, { name: normalized });
        }
    }, [onUpdateRoom, resolvedRoomIndex, room, room.id, room.name]);
    const roomDisplayName = useMemo(() => {
        return roomNames[room.id] ?? getRoomDisplayName(room, resolvedRoomIndex);
    }, [room, roomNames, resolvedRoomIndex]);
    const associatedSlab = useMemo(() => {
        const centroid = polygonCentroid(room.polygon);
        return (floorSlabs.find((slab) => slab.levelId === room.levelId && polygonContainsPoint(centroid, slab.boundary)) ?? null);
    }, [floorSlabs, room.polygon, room.levelId]);
    const handleCreateSlab = useCallback(() => {
        const presetId = slabPreset || resolveDefaultPresetId("slab");
        const baseSlab = {
            id: createId("slab"),
            name: `Пол · ${roomDisplayName}`,
            levelId: room.levelId,
            kind: FLOOR_SLAB_DEFAULTS.kind,
            boundary: room.polygon.map((pt) => ({ ...pt })),
            elevation_m: 0,
            thickness_m: FLOOR_SLAB_DEFAULTS.thickness,
            heatedSide: FLOOR_SLAB_DEFAULTS.heatedSide,
            assemblyId: null,
        };
        onAddFloorSlab(applyEnvelopePresetToFloorSlab(baseSlab, presetId));
    }, [room, roomDisplayName, slabPreset, onAddFloorSlab]);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(TextField, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", value: roomDisplayName, onChange: (value) => onUpdateRoom(room.id, { name: value }) }), _jsx(InfoCard, { rows: [
                    { label: "Площадь", value: `${area.toFixed(2)} м²` },
                    { label: "Контур", value: `${room.polygon.length} вершин` },
                    { label: "Уровень", value: getLevelSummaryLabel({ levels }, room.levelId) },
                ] }), envelope ? (_jsxs("div", { className: "grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx(ValueTile, { label: "\u041E\u043A\u043D\u0430, \u043C\u00B2", value: envelope.windowArea.toFixed(2) }), _jsx(ValueTile, { label: "\u0414\u0432\u0435\u0440\u0438, \u043C\u00B2", value: envelope.doorArea.toFixed(2) }), _jsx("div", { className: "col-span-2", children: _jsx(ValueTile, { label: "\u041E\u043A\u043D\u0430 / \u0441\u0442\u0435\u043D\u044B", value: `${(envelope.wwr * 100).toFixed(1)}%` }) })] })) : null, _jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx("p", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u041F\u0435\u0440\u0435\u043A\u0440\u044B\u0442\u0438\u0435 \u043F\u043E\u043B\u0430" }), associatedSlab ? (_jsxs("div", { className: "space-y-2", children: [_jsx(EnvelopePresetField, { kind: "slab", value: associatedSlab.envelopePresetId ?? resolveDefaultPresetId("slab"), onChange: (value) => onUpdateFloorSlab(associatedSlab.id, applyEnvelopePresetToFloorSlab(associatedSlab, value)) }), _jsxs("p", { className: "text-xs text-[color:var(--text-soft)]", children: ["\u041F\u043E\u043B \u00B7 ", roomDisplayName, " \u00B7 ", associatedSlab.thickness_m.toFixed(3), " \u043C"] })] })) : (_jsx("button", { type: "button", onClick: handleCreateSlab, className: "w-full rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[color:var(--text-soft)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]", children: "+ \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043F\u043E\u043B \u0434\u043B\u044F \u044D\u0442\u043E\u0439 \u043A\u043E\u043C\u043D\u0430\u0442\u044B" }))] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0421\u043E\u0441\u0435\u0434\u0438" }), neighbors[room.id]?.length ? (_jsx("ul", { className: "mt-2 space-y-1 text-sm text-[color:var(--text-muted)]", children: neighbors[room.id].map((neighborId) => (_jsx("li", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] px-3 py-2", children: roomNames[neighborId] ?? neighborId }, neighborId))) })) : (_jsx("p", { className: "mt-2 text-sm text-[color:var(--text-soft)]", children: "\u0421\u043C\u0435\u0436\u043D\u044B\u0435 \u043F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u044F \u043F\u043E\u043A\u0430 \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u044B." }))] })] }));
}
function RoofForm({ roof, levels, onUpdateRoof, }) {
    const planArea = Math.abs(polygonArea(roof.boundary));
    const presetId = roof.envelopePresetId ?? resolveDefaultPresetId("roof");
    const presetLayers = getEnvelopePreset(presetId)?.layers ?? [];
    const layers = roof.layers ?? presetLayers;
    const properties = computeWallProperties(layers, undefined, { includeSp50AirFilms: true });
    const hasCustomLayers = Boolean(roof.layers?.length);
    // Угол уклона в градусах для отображения
    const risePerMeter = roof.slope?.risePerMeter ?? ROOF_DEFAULTS.risePerMeter;
    const slopeAngleDeg = (Math.atan(risePerMeter) * 180) / Math.PI;
    // Фактическая площадь скатной крыши больше плановой
    const actualArea = roof.kind === "pitched" ? planArea / Math.cos(Math.atan(risePerMeter)) : planArea;
    const applyLayersPatch = useCallback((nextLayers) => {
        const totalThickness = nextLayers.reduce((sum, l) => sum + (l.thickness_m || 0), 0);
        onUpdateRoof(roof.id, {
            layers: nextLayers.length ? nextLayers : undefined,
            thickness_m: totalThickness > 0.001 ? Math.round(totalThickness * 1000) / 1000 : roof.thickness_m,
        });
    }, [roof.id, roof.thickness_m, onUpdateRoof]);
    const updateLayer = useCallback((index, patch) => {
        const nextLayers = layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer));
        applyLayersPatch(nextLayers);
    }, [layers, applyLayersPatch]);
    const addLayer = useCallback(() => {
        applyLayersPatch([...layers, { materialId: "mineral_wool", thickness_m: 0.1 }]);
    }, [layers, applyLayersPatch]);
    const removeLayer = useCallback((index) => {
        applyLayersPatch(layers.filter((_, i) => i !== index));
    }, [layers, applyLayersPatch]);
    const resetToPreset = useCallback(() => {
        const preset = getEnvelopePreset(presetId);
        onUpdateRoof(roof.id, {
            layers: undefined,
            thickness_m: preset?.thickness_m ?? roof.thickness_m,
        });
    }, [presetId, roof.id, roof.thickness_m, onUpdateRoof]);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(EnvelopePresetField, { kind: "roof", value: presetId, onChange: (value) => onUpdateRoof(roof.id, applyEnvelopePresetToRoof(roof, value)) }), _jsx(TextField, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", value: sanitizeDisplayText(roof.name, "", { allowInternalId: false }), onChange: (value) => onUpdateRoof(roof.id, { name: value }) }), _jsx(InfoCard, { rows: [
                    { label: "Площадь (план)", value: `${planArea.toFixed(2)} м²` },
                    ...(roof.kind === "pitched"
                        ? [{ label: "Площадь (факт)", value: `${actualArea.toFixed(2)} м²` }]
                        : []),
                    { label: "Контур", value: `${roof.boundary.length} вершин` },
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u0422\u0438\u043F", value: roof.kind, onChange: (value) => onUpdateRoof(roof.id, { kind: value }), options: [
                            { value: "flat", label: "Плоская" },
                            { value: "pitched", label: "Скатная" },
                        ] }), _jsx(SelectField, { label: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C", value: roof.levelId, onChange: (value) => onUpdateRoof(roof.id, { levelId: value }), options: levels.map((level) => ({ value: level.id, label: getLevelDisplayLabel({ levels }, level.id) })) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: hasCustomLayers ? "Толщина (авто), м" : "Толщина, м", value: roof.thickness_m, step: 0.01, onChange: (value) => onUpdateRoof(roof.id, { thickness_m: value }) }), _jsx(NumberField, { label: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u044F, \u043C", value: roof.elevationBase_m, step: 0.05, onChange: (value) => onUpdateRoof(roof.id, { elevationBase_m: value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435, \u00B0", value: roof.slope?.directionDeg ?? ROOF_DEFAULTS.slopeDirectionDeg, step: 5, onChange: (value) => onUpdateRoof(roof.id, {
                            slope: { directionDeg: value, risePerMeter: roof.slope?.risePerMeter ?? ROOF_DEFAULTS.risePerMeter },
                        }), disabled: roof.kind !== "pitched" }), _jsx(NumberField, { label: "\u0423\u043A\u043B\u043E\u043D, \u043C/\u043C", value: risePerMeter, step: 0.05, onChange: (value) => onUpdateRoof(roof.id, {
                            slope: { directionDeg: roof.slope?.directionDeg ?? ROOF_DEFAULTS.slopeDirectionDeg, risePerMeter: value },
                        }), disabled: roof.kind !== "pitched" })] }), roof.kind === "pitched" && (_jsxs("div", { className: "rounded-xl bg-[color:var(--surface-muted)] px-3 py-2 text-xs text-[color:var(--text-muted)]", children: ["\u0423\u0433\u043E\u043B \u0443\u043A\u043B\u043E\u043D\u0430: ", _jsxs("span", { className: "font-semibold text-[color:var(--text-base)]", children: [slopeAngleDeg.toFixed(1), "\u00B0"] }), " · ", "\u041A\u043E\u044D\u0444\u0444\u0438\u0446\u0438\u0435\u043D\u0442 \u043F\u043B\u043E\u0449\u0430\u0434\u0438: ", _jsx("span", { className: "font-semibold text-[color:var(--text-base)]", children: (actualArea / Math.max(planArea, 0.01)).toFixed(3) })] })), _jsx(HeatedSideField, { value: roof.heatedSide ?? ROOF_DEFAULTS.heatedSide, onChange: (value) => onUpdateRoof(roof.id, { heatedSide: value }), options: ROOF_HEATED_SIDE_OPTIONS }), properties ? (_jsxs("div", { className: "grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx(ValueTile, { label: "R total, \u043C\u00B2\u041A/\u0412\u0442", value: properties.rTotal_m2K_W.toFixed(3) }), _jsx(ValueTile, { label: "U total, \u0412\u0442/(\u043C\u00B2\u041A)", value: properties.uTotal_W_m2K.toFixed(3) }), _jsx("div", { className: "col-span-2", children: _jsx(ValueTile, { label: "\u0422\u0435\u043F\u043B\u043E\u0451\u043C\u043A\u043E\u0441\u0442\u044C, \u0414\u0436/(\u043C\u00B2\u041A)", value: properties.heatCapacity_J_m2K.toFixed(0) }) })] })) : null, _jsx(ConstructionLayerEditor, { title: "\u0421\u043E\u0441\u0442\u0430\u0432 \u043A\u0440\u043E\u0432\u043B\u0438", layers: layers, hasCustomLayers: hasCustomLayers, onUpdateLayer: updateLayer, onAddLayer: addLayer, onRemoveLayer: removeLayer, onReset: resetToPreset, resetLabel: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u043E \u043F\u0440\u0435\u0441\u0435\u0442\u0443" })] }));
}
function FloorSlabForm({ slab, levels, onUpdateFloorSlab, }) {
    const area = Math.abs(polygonArea(slab.boundary));
    const presetId = slab.envelopePresetId ?? resolveDefaultPresetId("slab");
    const presetLayers = getEnvelopePreset(presetId)?.layers ?? [];
    // Если пользователь задал слои вручную — используем их; иначе — из пресета
    const layers = slab.layers ?? presetLayers;
    const properties = computeWallProperties(layers, undefined, { includeSp50AirFilms: true });
    const hasCustomLayers = Boolean(slab.layers?.length);
    /** Пересчитывает суммарную толщину из слоёв и пишет в slab */
    const applyLayersPatch = useCallback((nextLayers) => {
        const totalThickness = nextLayers.reduce((sum, l) => sum + (l.thickness_m || 0), 0);
        onUpdateFloorSlab(slab.id, {
            layers: nextLayers.length ? nextLayers : undefined,
            thickness_m: totalThickness > 0.001 ? Math.round(totalThickness * 1000) / 1000 : slab.thickness_m,
        });
    }, [slab.id, slab.thickness_m, onUpdateFloorSlab]);
    const updateLayer = useCallback((index, patch) => {
        const nextLayers = layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer));
        applyLayersPatch(nextLayers);
    }, [layers, applyLayersPatch]);
    const addLayer = useCallback(() => {
        const newLayer = { materialId: "mineral_wool", thickness_m: 0.05 };
        applyLayersPatch([...layers, newLayer]);
    }, [layers, applyLayersPatch]);
    const removeLayer = useCallback((index) => {
        applyLayersPatch(layers.filter((_, i) => i !== index));
    }, [layers, applyLayersPatch]);
    const resetToPreset = useCallback(() => {
        const preset = getEnvelopePreset(presetId);
        onUpdateFloorSlab(slab.id, {
            layers: undefined,
            thickness_m: preset?.thickness_m ?? slab.thickness_m,
        });
    }, [presetId, slab.id, slab.thickness_m, onUpdateFloorSlab]);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(EnvelopePresetField, { kind: "slab", value: presetId, onChange: (value) => onUpdateFloorSlab(slab.id, applyEnvelopePresetToFloorSlab(slab, value)) }), _jsx(TextField, { label: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", value: sanitizeDisplayText(slab.name, "", { allowInternalId: false }), onChange: (value) => onUpdateFloorSlab(slab.id, { name: value }) }), _jsx(InfoCard, { rows: [
                    { label: "Площадь", value: `${area.toFixed(2)} м²` },
                    { label: "Контур", value: `${slab.boundary.length} вершин` },
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u0422\u0438\u043F", value: slab.kind, onChange: (value) => onUpdateFloorSlab(slab.id, { kind: value }), options: [
                            { value: "interfloor", label: "Межэтажное" },
                            { value: "attic", label: "Чердачное" },
                            { value: "basement", label: "Над подвалом" },
                            { value: "ground", label: "Пол по грунту" },
                        ] }), _jsx(SelectField, { label: "\u0423\u0440\u043E\u0432\u0435\u043D\u044C", value: slab.levelId, onChange: (value) => onUpdateFloorSlab(slab.id, { levelId: value }), options: levels.map((level) => ({ value: level.id, label: getLevelDisplayLabel({ levels }, level.id) })) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: hasCustomLayers ? "Толщина (авто), м" : "Толщина, м", value: slab.thickness_m, step: 0.005, onChange: (value) => onUpdateFloorSlab(slab.id, { thickness_m: value }) }), _jsx(NumberField, { label: "\u041E\u0442\u043C\u0435\u0442\u043A\u0430, \u043C", value: slab.elevation_m, step: 0.05, onChange: (value) => onUpdateFloorSlab(slab.id, { elevation_m: value }) })] }), _jsx(SelectField, { label: "\u041E\u0431\u043E\u0433\u0440\u0435\u0432\u0430\u0435\u043C\u0430\u044F \u0441\u0442\u043E\u0440\u043E\u043D\u0430", value: slab.heatedSide ?? FLOOR_SLAB_DEFAULTS.heatedSide, onChange: (value) => onUpdateFloorSlab(slab.id, { heatedSide: value }), options: [
                    { value: "below", label: "Снизу (пол холодный)" },
                    { value: "above", label: "Сверху (тёплый пол)" },
                ] }), properties ? (_jsxs("div", { className: "grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx(ValueTile, { label: "R, \u043C\u00B2\u041A/\u0412\u0442", value: properties.rTotal_m2K_W.toFixed(3) }), _jsx(ValueTile, { label: "U, \u0412\u0442/(\u043C\u00B2\u041A)", value: properties.uTotal_W_m2K.toFixed(3) }), _jsx("div", { className: "col-span-2", children: _jsx(ValueTile, { label: "\u0422\u0435\u043F\u043B\u043E\u0451\u043C\u043A\u043E\u0441\u0442\u044C, \u0414\u0436/(\u043C\u00B2\u041A)", value: properties.heatCapacity_J_m2K.toFixed(0) }) })] })) : null, _jsx(ConstructionLayerEditor, { title: "\u0421\u043E\u0441\u0442\u0430\u0432 \u043F\u0435\u0440\u0435\u043A\u0440\u044B\u0442\u0438\u044F", layers: layers, hasCustomLayers: hasCustomLayers, onUpdateLayer: updateLayer, onAddLayer: addLayer, onRemoveLayer: removeLayer, onReset: resetToPreset, resetLabel: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u043E \u043F\u0440\u0435\u0441\u0435\u0442\u0443" })] }));
}
function WallForm({ wall, levels, onUpdateWall, }) {
    const presetId = wall.envelopePresetId ?? resolveDefaultPresetId("wall");
    const assemblyId = wall.wallAssemblyId ?? DEFAULT_WALL_ASSEMBLY_ID;
    const presetLayers = ensureWallLayers(undefined, assemblyId);
    const layers = wall.layers ?? presetLayers;
    const properties = computeWallProperties(layers, assemblyId, {
        includeSp50AirFilms: true,
    });
    const hasCustomLayers = Boolean(wall.layers?.length);
    const applyLayersPatch = useCallback((nextLayers) => {
        const totalThickness = nextLayers.reduce((sum, layer) => sum + (layer.thickness_m || 0), 0);
        onUpdateWall(wall.id, {
            layers: nextLayers.length ? nextLayers : undefined,
            thickness_m: totalThickness > 0.001 ? Math.round(totalThickness * 1000) / 1000 : wall.thickness_m,
        });
    }, [onUpdateWall, wall.id, wall.thickness_m]);
    const updateLayer = useCallback((index, patch) => {
        const nextLayers = layers.map((layer, layerIndex) => (layerIndex === index ? { ...layer, ...patch } : layer));
        applyLayersPatch(nextLayers);
    }, [applyLayersPatch, layers]);
    const addLayer = useCallback(() => {
        applyLayersPatch([...layers, { materialId: "mineral_wool", thickness_m: 0.05 }]);
    }, [applyLayersPatch, layers]);
    const removeLayer = useCallback((index) => {
        applyLayersPatch(layers.filter((_, layerIndex) => layerIndex !== index));
    }, [applyLayersPatch, layers]);
    const resetToAssembly = useCallback(() => {
        onUpdateWall(wall.id, {
            layers: undefined,
            thickness_m: presetLayers.reduce((sum, layer) => sum + (layer.thickness_m || 0), 0) || wall.thickness_m,
        });
    }, [onUpdateWall, presetLayers, wall.id, wall.thickness_m]);
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(EnvelopePresetField, { kind: "wall", value: presetId, onChange: (value) => onUpdateWall(wall.id, applyEnvelopePresetToWall(wall, value)) }), _jsx(InfoCard, { rows: [
                    { label: "Длина", value: `${wallLength(wall).toFixed(2)} м` },
                    { label: "Уровень", value: getLevelSummaryLabel({ levels }, wall.levelId) },
                    { label: "Источник", value: describeEnvelopePreset(presetId) ?? "Ручная настройка" },
                ] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: hasCustomLayers ? "Толщина (авто), м" : "Толщина, м", value: wall.thickness_m, step: 0.01, onChange: (value) => onUpdateWall(wall.id, { thickness_m: value }) }), _jsx(NumberField, { label: "\u0412\u044B\u0441\u043E\u0442\u0430, \u043C", value: wall.height_m, step: 0.1, onChange: (value) => onUpdateWall(wall.id, { height_m: value }) })] }), properties ? (_jsxs("div", { className: "grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx(ValueTile, { label: "R, \u043C\u00B2\u041A/\u0412\u0442", value: properties.rValue.toFixed(3) }), _jsx(ValueTile, { label: "U, \u0412\u0442/(\u043C\u00B2\u041A)", value: properties.uValue.toFixed(3) }), _jsx("div", { className: "col-span-2", children: _jsx(ValueTile, { label: "\u0422\u0435\u043F\u043B\u043E\u0451\u043C\u043A\u043E\u0441\u0442\u044C, \u0414\u0436/(\u043C\u00B2\u041A)", value: properties.heatCapacity_J_m2K.toFixed(0) }) })] })) : null, _jsx(ConstructionLayerEditor, { title: "\u0421\u043E\u0441\u0442\u0430\u0432 \u0441\u0442\u0435\u043D\u044B", layers: layers, hasCustomLayers: hasCustomLayers, onUpdateLayer: updateLayer, onAddLayer: addLayer, onRemoveLayer: removeLayer, onReset: resetToAssembly, resetLabel: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u043E \u0441\u0431\u043E\u0440\u043A\u0435" })] }));
}
function OpeningForm({ kind, opening, model, onUpdate, }) {
    const { walls } = model;
    const attachedWall = opening.anchor.wallId ? walls.find((wall) => wall.id === opening.anchor.wallId) ?? null : null;
    const offsetValue = attachedWall ? anchorToOffset(opening.anchor, attachedWall) : 0;
    const presetId = opening.envelopePresetId ?? resolveDefaultPresetId(kind);
    const reportLayers = opening.reportLayers ?? getEnvelopePreset(presetId)?.reportLayers;
    const runtimeU = opening.runtimeU_W_m2K ?? getEnvelopePreset(presetId)?.runtimeU_W_m2K ?? null;
    const reportProps = reportLayers?.length
        ? computeWallProperties(reportLayers, undefined, { includeSp50AirFilms: true })
        : null;
    const openingHeightLimit = useMemo(() => {
        if (!attachedWall) {
            return null;
        }
        const sorted = [...model.levels].sort((left, right) => left.elevation_m - right.elevation_m || left.id.localeCompare(right.id));
        const wallLevel = sorted.find((level) => level.id === attachedWall.levelId);
        if (!wallLevel) {
            return Math.max(0.2, attachedWall.height_m);
        }
        const nextLevel = sorted.find((level) => level.elevation_m > wallLevel.elevation_m);
        const ceilingElevation = nextLevel ? nextLevel.elevation_m : wallLevel.elevation_m + wallLevel.height_m;
        const limitByLevel = Math.max(0.2, ceilingElevation - wallLevel.elevation_m);
        return Math.max(0.2, Math.min(limitByLevel, attachedWall.height_m));
    }, [attachedWall, model.levels]);
    const clampOpeningHeight = useCallback((value) => {
        if (!Number.isFinite(value)) {
            return 0.2;
        }
        const base = Math.max(0.2, value);
        if (openingHeightLimit == null) {
            return base;
        }
        return Math.min(base, openingHeightLimit);
    }, [openingHeightLimit]);
    const rebind = (wall, offset) => {
        if (!wall) {
            onUpdate({ anchor: { wallId: null, t: 0, offset_m: 0 }, lost: true });
            return;
        }
        const clamped = clampOffset(offset, wall, opening.width_m);
        onUpdate({ anchor: buildAnchorFromOffset(wall, clamped), lost: false });
    };
    const applyPreset = (value) => {
        if (kind === "door") {
            onUpdate(applyEnvelopePresetToDoor(opening, value));
            return;
        }
        onUpdate(applyEnvelopePresetToWindow(opening, value));
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(EnvelopePresetField, { kind: kind, value: presetId, onChange: applyPreset }), _jsx(InfoCard, { rows: [
                    { label: "Тип", value: kind === "door" ? "Дверь" : "Окно" },
                    { label: "Привязка", value: opening.anchor.wallId ? getWallDisplayLabel(model, opening.anchor.wallId) : "Не привязано" },
                    { label: "U runtime", value: runtimeU != null ? `${runtimeU.toFixed(3)} Вт/(м²·К)` : "—" },
                ] }), reportProps ? (_jsxs("div", { className: "grid grid-cols-2 gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx(ValueTile, { label: "R_red (\u043E\u0442\u0447\u0451\u0442)", value: reportProps.rValue.toFixed(3) }), _jsx(ValueTile, { label: "U (\u043E\u0442\u0447\u0451\u0442)", value: reportProps.uValue.toFixed(3) })] })) : null, _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0428\u0438\u0440\u0438\u043D\u0430, \u043C", value: opening.width_m, step: 0.05, onChange: (value) => onUpdate({ width_m: value }) }), _jsx(NumberField, { label: openingHeightLimit != null ? `Высота, м (до ${openingHeightLimit.toFixed(2)})` : "Высота, м", value: opening.height_m, step: 0.05, min: 0.2, max: openingHeightLimit ?? undefined, onChange: (value) => onUpdate({ height_m: clampOpeningHeight(value) }) })] }), kind === "door" ? (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u041F\u0435\u0442\u043B\u0438", value: opening.swingDirection ?? "left", onChange: (value) => onUpdate({ swingDirection: value }), options: [
                            { value: "left", label: "Влево" },
                            { value: "right", label: "Вправо" },
                        ] }), _jsx(SelectField, { label: "\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u043D\u0438\u0435", value: opening.openingDirection ?? "inward", onChange: (value) => onUpdate({ openingDirection: value }), options: [
                            { value: "inward", label: "Внутрь" },
                            { value: "outward", label: "Наружу" },
                        ] })] })) : null, kind === "window" ? (_jsx(NumberField, { label: "\u041F\u043E\u0434\u043E\u043A\u043E\u043D\u043D\u0438\u043A, \u043C", value: opening.sill_m ?? 0, step: 0.05, onChange: (value) => onUpdate({ sill_m: value }) })) : null, _jsx(SelectField, { label: "\u0421\u0442\u0435\u043D\u0430", value: opening.anchor.wallId ?? "", onChange: (value) => {
                    const nextWall = value ? walls.find((wall) => wall.id === value) ?? null : null;
                    rebind(nextWall, offsetValue);
                }, options: [
                    { value: "", label: "Не выбрана" },
                    ...walls.map((wall) => ({
                        value: wall.id,
                        label: getWallDisplayLabel(model, wall.id),
                    })),
                ] }), _jsx(NumberField, { label: "\u0421\u043C\u0435\u0449\u0435\u043D\u0438\u0435, \u043C", value: attachedWall ? offsetValue : 0, step: 0.05, onChange: (value) => {
                    if (attachedWall) {
                        rebind(attachedWall, value);
                    }
                }, disabled: !attachedWall }), !opening.anchor.wallId ? (_jsx(HintCard, { tone: "warning", text: "\u041F\u0440\u043E\u0451\u043C \u043F\u043E\u0442\u0435\u0440\u044F\u043B \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0443 \u043A \u0441\u0442\u0435\u043D\u0435. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u043E\u0432\u0443\u044E \u0441\u0442\u0435\u043D\u0443, \u0447\u0442\u043E\u0431\u044B \u0438\u0437\u0431\u0435\u0436\u0430\u0442\u044C \u043D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u043E\u0439 3D-\u0433\u0435\u043E\u043C\u0435\u0442\u0440\u0438\u0438." })) : null] }));
}
function PipeForm({ model, pipe, onUpdatePipe, }) {
    const updatePipeRole = (value) => {
        const nextType = value === "supply" ? "heating_supply" : value === "return" ? "heating_return" : pipe.type;
        onUpdatePipe(pipe.id, {
            flowRole: value,
            circuitRole: value === "distribution" ? "mixed" : value,
            type: nextType,
        });
    };
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(InfoCard, { rows: [
                    { label: "Длина", value: `${polylineLength(pipe.path).toFixed(2)} м` },
                    { label: "Сегменты", value: `${Math.max(pipe.path.length - 1, 0)}` },
                    { label: "Подключения", value: pipe.connectedEquipmentIds.length ? `${pipe.connectedEquipmentIds.length}` : "Нет" },
                    { label: "Этаж", value: getFloorDisplayLabel(model, pipe.levelId) },
                    { label: "Контур", value: formatHeatingCircuitLabel(pipe.heatingSystemId) },
                    { label: "Система", value: NETWORK_SYSTEM_TYPE_LABELS[pipe.systemType ?? resolveNetworkSystemType(pipe.type)] },
                    { label: "Подача/обратка", value: describeSupplyReturnRole(pipe) },
                    { label: "Диаметр", value: `${Math.round(pipe.diameter_mm)} мм` },
                ] }), _jsx(TextField, { label: "\u0418\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u043A\u043E\u043D\u0442\u0443\u0440\u0430", value: pipe.heatingSystemId ?? "", onChange: (value) => onUpdatePipe(pipe.id, { heatingSystemId: value.trim() || null }) }), _jsx(SelectField, { label: "\u0422\u0438\u043F \u0441\u0435\u0442\u0438", value: pipe.type, onChange: (value) => {
                    const nextType = value;
                    const defaults = createPipeDefaults(nextType);
                    onUpdatePipe(pipe.id, {
                        type: nextType,
                        flowRole: defaults.flowRole,
                        circuitRole: defaults.circuitRole,
                        systemType: pipe.systemType ?? defaults.systemType,
                        heatingSystemKind: pipe.heatingSystemKind ?? defaults.heatingSystemKind,
                        heatCarrier: pipe.heatCarrier ?? defaults.heatCarrier,
                        markingColor: defaultPipeMarkingColor(nextType),
                    });
                }, options: Object.entries(PIPE_TYPE_LABELS).map(([value, label]) => ({ value, label })) }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u0422\u0438\u043F \u0441\u0438\u0441\u0442\u0435\u043C\u044B", value: pipe.systemType ?? resolveNetworkSystemType(pipe.type), onChange: (value) => onUpdatePipe(pipe.id, { systemType: value }), options: Object.entries(NETWORK_SYSTEM_TYPE_LABELS).map(([value, label]) => ({ value, label })) }), _jsx(SelectField, { label: "\u0420\u043E\u043B\u044C \u0432\u0435\u0442\u0432\u0438", value: pipe.flowRole ?? "distribution", onChange: (value) => updatePipeRole(value), options: Object.entries(PIPE_FLOW_ROLE_LABELS).map(([value, label]) => ({ value, label })) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u0421\u0445\u0435\u043C\u0430 \u043E\u0442\u043E\u043F\u043B\u0435\u043D\u0438\u044F", value: pipe.heatingSystemKind ?? "two_pipe", onChange: (value) => onUpdatePipe(pipe.id, { heatingSystemKind: value }), options: Object.entries(HEATING_SYSTEM_KIND_LABELS).map(([value, label]) => ({ value, label })) }), _jsx(SelectField, { label: "\u0420\u043E\u043B\u044C \u043A\u043E\u043D\u0442\u0443\u0440\u0430", value: pipe.circuitRole ?? resolvePipeCircuitRole(pipe.type), onChange: (value) => onUpdatePipe(pipe.id, { circuitRole: value }), options: Object.entries(PIPE_CIRCUIT_ROLE_LABELS).map(([value, label]) => ({ value, label })) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u041A\u043B\u0430\u0441\u0441 \u0443\u0447\u0430\u0441\u0442\u043A\u0430", value: pipe.segmentClass ?? "branch", onChange: (value) => onUpdatePipe(pipe.id, { segmentClass: value }), options: Object.entries(PIPE_SEGMENT_CLASS_LABELS).map(([value, label]) => ({ value, label })) }), _jsx(SelectField, { label: "\u0422\u0435\u043F\u043B\u043E\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C", value: pipe.heatCarrier ?? "water", onChange: (value) => onUpdatePipe(pipe.id, { heatCarrier: value }), options: Object.entries(HEAT_CARRIER_LABELS).map(([value, label]) => ({ value, label })) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u043E\u0442\u043E\u043A\u0430", value: pipe.flowDirection ?? "unknown", onChange: (value) => onUpdatePipe(pipe.id, { flowDirection: value }), options: Object.entries(FLOW_DIRECTION_LABELS).map(([value, label]) => ({ value, label })) }), _jsx(TextField, { label: "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u043E\u0435 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435", value: pipe.connectedEquipmentIds.join(", "), onChange: (value) => onUpdatePipe(pipe.id, {
                            connectedEquipmentIds: value
                                .split(",")
                                .map((entry) => entry.trim())
                                .filter(Boolean),
                        }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u041C\u0430\u0442\u0435\u0440\u0438\u0430\u043B", value: pipe.material, onChange: (value) => onUpdatePipe(pipe.id, { material: value }), options: [
                            { value: "steel", label: "Сталь" },
                            { value: "pex", label: "PEX" },
                            { value: "copper", label: "Медь" },
                            { value: "polypropylene", label: "Полипропилен" },
                        ] }), _jsx(SelectField, { label: "\u041C\u0430\u0440\u043A\u0438\u0440\u043E\u0432\u043A\u0430 \u0442\u0440\u0443\u0431\u044B", value: pipe.markingColor ?? defaultPipeMarkingColor(pipe.type), onChange: (value) => onUpdatePipe(pipe.id, { markingColor: value }), options: Object.entries(PIPE_MARKING_COLOR_LABELS).map(([value, label]) => ({ value, label })) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u0414\u0438\u0430\u043C\u0435\u0442\u0440 \u043F\u043E \u0440\u044F\u0434\u0443, \u043C\u043C", value: String(pipe.diameter_mm), onChange: (value) => {
                            const diameter = Number(value);
                            onUpdatePipe(pipe.id, { diameter_mm: diameter, innerDiameter_mm: innerDiameterFor(diameter) });
                        }, options: PIPE_DIAMETER_OPTIONS.map((diameter) => ({ value: String(diameter), label: `${diameter} мм` })) }), _jsx(NumberField, { label: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u0434\u0438\u0430\u043C\u0435\u0442\u0440, \u043C\u043C", value: pipe.innerDiameter_mm ?? innerDiameterFor(pipe.diameter_mm), step: 1, onChange: (value) => onUpdatePipe(pipe.id, { innerDiameter_mm: value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430, \u00B0C", value: pipe.fluidTemperatureC, step: 0.5, onChange: (value) => onUpdatePipe(pipe.id, { fluidTemperatureC: value }) }), _jsx(NumberField, { label: "\u041F\u0435\u0440\u0435\u043F\u0430\u0434 \u0394T, \u00B0C", value: pipe.temperatureDropC ?? 0, step: 0.5, onChange: (value) => onUpdatePipe(pipe.id, { temperatureDropC: value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043A\u0433/\u0441", value: pipe.flowRate_kg_s, step: 0.01, onChange: (value) => onUpdatePipe(pipe.id, { flowRate_kg_s: value }) }), _jsx(NumberField, { label: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C, \u043C/\u0441", value: pipe.designVelocity_m_s ?? 0, step: 0.05, onChange: (value) => onUpdatePipe(pipe.id, { designVelocity_m_s: value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0414\u0430\u0432\u043B\u0435\u043D\u0438\u0435, \u041F\u0430", value: pipe.pressurePa, step: 100, onChange: (value) => onUpdatePipe(pipe.id, { pressurePa: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0442\u0435\u0440\u0438 \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F, \u041F\u0430", value: pipe.pressureDropPa ?? 0, step: 50, onChange: (value) => onUpdatePipe(pipe.id, { pressureDropPa: value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0418\u0437\u043E\u043B\u044F\u0446\u0438\u044F, \u043C\u043C", value: pipe.insulationThickness_mm ?? 0, step: 1, onChange: (value) => onUpdatePipe(pipe.id, { insulationThickness_mm: value }) }), _jsx(NumberField, { label: "\u0422\u0435\u043F\u043B\u043E\u043F\u043E\u0442\u0435\u0440\u0438, \u0412\u0442", value: pipe.heatLossW ?? 0, step: 10, onChange: (value) => onUpdatePipe(pipe.id, { heatLossW: value }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u0440\u0430\u0441\u0447. t, \u00B0C", value: pipe.designIndoorTemperatureC ?? 21, step: 0.5, onChange: (value) => onUpdatePipe(pipe.id, { designIndoorTemperatureC: value }) }), _jsx(NumberField, { label: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F \u0440\u0430\u0441\u0447. t, \u00B0C", value: pipe.designOutdoorTemperatureC ?? -18, step: 0.5, onChange: (value) => onUpdatePipe(pipe.id, { designOutdoorTemperatureC: value }) })] })] }));
}
function DuctForm({ duct, onUpdateDuct, }) {
    return (_jsxs("div", { className: "space-y-3", children: [_jsx(InfoCard, { rows: [
                    { label: "Длина", value: `${polylineLength(duct.path).toFixed(2)} м` },
                    { label: "Сегменты", value: `${Math.max(duct.path.length - 1, 0)}` },
                    { label: "Подключения", value: `${duct.connectedEquipmentIds.length}` },
                ] }), _jsx(SelectField, { label: "\u0421\u0435\u0447\u0435\u043D\u0438\u0435", value: duct.section.shape, onChange: (value) => onUpdateDuct(duct.id, { section: { ...duct.section, shape: value } }), options: [
                    { value: "rectangular", label: "Прямоугольное" },
                    { value: "round", label: "Круглое" },
                ] }), duct.section.shape === "rectangular" ? (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0428\u0438\u0440\u0438\u043D\u0430, \u043C\u043C", value: duct.section.width_mm ?? 400, step: 10, onChange: (value) => onUpdateDuct(duct.id, { section: { ...duct.section, width_mm: value } }) }), _jsx(NumberField, { label: "\u0412\u044B\u0441\u043E\u0442\u0430, \u043C\u043C", value: duct.section.height_mm ?? 200, step: 10, onChange: (value) => onUpdateDuct(duct.id, { section: { ...duct.section, height_mm: value } }) })] })) : (_jsx(NumberField, { label: "\u0414\u0438\u0430\u043C\u0435\u0442\u0440, \u043C\u043C", value: duct.section.diameter_mm ?? 250, step: 10, onChange: (value) => onUpdateDuct(duct.id, { section: { ...duct.section, diameter_mm: value } }) })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043C\u00B3/\u0441", value: duct.airflow_m3_s, step: 0.01, onChange: (value) => onUpdateDuct(duct.id, { airflow_m3_s: value }) }), _jsx(NumberField, { label: "\u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C, \u043C/\u0441", value: duct.airVelocity_m_s, step: 0.1, onChange: (value) => onUpdateDuct(duct.id, { airVelocity_m_s: value }) })] })] }));
}
function EquipmentForm({ model, equipment, roomNames, onUpdateEquipment, }) {
    const connectedPipes = model.pipes.filter((pipe) => equipment.connectedNetworkIds.includes(pipe.id));
    const connectedDucts = model.ducts.filter((duct) => equipment.connectedNetworkIds.includes(duct.id));
    const primaryPipe = connectedPipes[0];
    const diagnostics = [
        !equipment.roomId ? "Помещение не назначено — уточните привязку для теплового расчёта." : null,
        !equipment.connectedNetworkIds.length ? "Нет связи с инженерной сетью." : null,
        typeof equipment.params.nominalPowerW !== "number" && ["radiator", "boiler", "heat_exchanger", "fancoil"].includes(equipment.type)
            ? "Не задана расчётная мощность"
            : null,
    ].filter(Boolean);
    const designFlow = typeof equipment.params.designFlow_kg_s === "number"
        ? `${equipment.params.designFlow_kg_s.toFixed(2)} кг/с`
        : typeof equipment.params.designAirflow_m3_s === "number"
            ? `${equipment.params.designAirflow_m3_s.toFixed(2)} м³/с`
            : "Не задан";
    const power = typeof equipment.params.nominalPowerW === "number" && Number.isFinite(equipment.params.nominalPowerW)
        ? `${equipment.params.nominalPowerW.toFixed(0)} Вт`
        : "Не задана";
    const thermalPair = typeof equipment.params.supplyTemperatureC === "number" || typeof equipment.params.returnTemperatureC === "number"
        ? `${equipment.params.supplyTemperatureC?.toFixed(0) ?? "—"} / ${equipment.params.returnTemperatureC?.toFixed(0) ?? "—"} °C`
        : "Нет данных";
    const roomLabel = equipment.roomId
        ? roomNames[equipment.roomId] ?? getRoomDisplayLabel(model, equipment.roomId)
        : "Не назначено";
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("section", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: "\u0418\u043D\u0436\u0435\u043D\u0435\u0440\u043D\u0430\u044F \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430" }), _jsxs("div", { className: "mt-3 grid gap-2 text-sm text-[color:var(--text-muted)]", children: [_jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: getEquipmentInspectorTitle(equipment, model.equipment) })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u0422\u0438\u043F" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: EQUIPMENT_TYPE_LABELS[equipment.type] })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: getEquipmentPurposeLabel(equipment.type) })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u042D\u0442\u0430\u0436" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: getFloorDisplayLabel(model, equipment.levelId) })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u041F\u043E\u043C\u0435\u0449\u0435\u043D\u0438\u0435" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: roomLabel })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u041A\u043E\u043D\u0442\u0443\u0440" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: formatHeatingCircuitLabel(equipment.params.assignedSystemId) })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u041F\u043E\u0434\u0430\u0447\u0430 / \u043E\u0431\u0440\u0430\u0442\u043A\u0430" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: describeSupplyReturnRole(primaryPipe) })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: power })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u0420\u0430\u0441\u0445\u043E\u0434" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: designFlow })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u0422\u0435\u043C\u043F\u0435\u0440\u0430\u0442\u0443\u0440\u0430" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: thermalPair })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435" }), _jsxs("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: [formatEquipmentStateLabel(equipment.state), " \u00B7 ", describeEquipmentConnectionStatus(equipment, model.pipes)] })] }), _jsxs("div", { className: "flex items-start justify-between gap-3 rounded-xl bg-[color:var(--surface-muted)] px-3 py-2", children: [_jsx("span", { children: "\u0422\u0435\u043F\u043B\u043E\u0432\u0430\u044F \u043C\u043E\u0434\u0435\u043B\u044C" }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: equipment.roomId && typeof equipment.params.nominalPowerW === "number"
                                            ? "Учитывается в зональном балансе"
                                            : "Нет данных для зоны" })] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u0422\u0438\u043F \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F", value: equipment.type, onChange: (value) => onUpdateEquipment(equipment.id, { type: value }), options: Object.entries(EQUIPMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })) }), _jsx(SelectField, { label: "\u0421\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435", value: equipment.state, onChange: (value) => onUpdateEquipment(equipment.id, { state: value }), options: [
                            { value: "on", label: "Включено" },
                            { value: "off", label: "Выключено" },
                            { value: "alarm", label: "Авария" },
                        ] })] }), connectedPipes.length ? _jsx(PolicyList, { title: "\u0422\u0440\u0443\u0431\u043E\u043F\u0440\u043E\u0432\u043E\u0434\u044B", items: connectedPipes.map((pipe) => PIPE_TYPE_LABELS[pipe.type]) }) : null, connectedDucts.length ? _jsx(PolicyList, { title: "\u0412\u043E\u0437\u0434\u0443\u0445\u043E\u0432\u043E\u0434\u044B", items: connectedDucts.map((_, index) => `Воздуховод ${index + 1}`) }) : null, diagnostics.length ? _jsx(PolicyList, { title: "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u044F", items: diagnostics }) : null, _jsx(EquipmentParameterFields, { equipment: equipment, onUpdateEquipment: onUpdateEquipment }), _jsx(PolicyList, { title: "\u0414\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0435 \u0441\u0435\u0442\u0438", items: describeEquipmentNetworkPolicy(equipment.type) })] }));
}
function SensorForm({ sensor, roomNames, onUpdateSensor, }) {
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(SelectField, { label: "\u0422\u0438\u043F \u0434\u0430\u0442\u0447\u0438\u043A\u0430", value: sensor.type, onChange: (value) => onUpdateSensor(sensor.id, { type: value }), options: Object.entries(SENSOR_TYPE_LABELS).map(([value, label]) => ({ value, label })) }), _jsx(SelectField, { label: "\u0421\u0442\u0430\u0442\u0443\u0441", value: sensor.status, onChange: (value) => onUpdateSensor(sensor.id, { status: value }), options: [
                            { value: "normal", label: "Норма" },
                            { value: "warning", label: "Внимание" },
                            { value: "alarm", label: "Авария" },
                        ] })] }), _jsx(InfoCard, { rows: [{ label: "Помещение", value: sensor.roomId ? roomNames[sensor.roomId] ?? sensor.roomId : "Не привязано" }] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0422\u0435\u043A\u0443\u0449\u0435\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435", value: sensor.value ?? 0, step: 0.1, onChange: (value) => onUpdateSensor(sensor.id, { value }) }), _jsx(TextField, { label: "\u0415\u0434\u0438\u043D\u0438\u0446\u044B", value: sensor.unit, onChange: (value) => onUpdateSensor(sensor.id, { unit: value }) })] })] }));
}
function EquipmentParameterFields({ equipment, onUpdateEquipment, }) {
    const updateParams = (patch) => onUpdateEquipment(equipment.id, { params: { ...equipment.params, ...patch } });
    switch (equipment.type) {
        case "radiator":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u0412\u0442", value: equipment.params.nominalPowerW ?? 0, step: 50, onChange: (value) => updateParams({ nominalPowerW: value }) }), _jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043A\u0433/\u0441", value: equipment.params.designFlow_kg_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designFlow_kg_s: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0434\u0430\u0447\u0430, \u00B0C", value: equipment.params.supplyTemperatureC ?? 70, step: 0.5, onChange: (value) => updateParams({ supplyTemperatureC: value }) }), _jsx(NumberField, { label: "\u041E\u0431\u0440\u0430\u0442\u043A\u0430, \u00B0C", value: equipment.params.returnTemperatureC ?? 50, step: 0.5, onChange: (value) => updateParams({ returnTemperatureC: value }) }), _jsx(SelectField, { label: "\u0422\u0438\u043F \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F", value: equipment.params.connectionType ?? "side", onChange: (value) => updateParams({ connectionType: value }), options: Object.entries(HEATING_CONNECTION_TYPE_LABELS).map(([value, label]) => ({ value, label })) }), _jsx(TextField, { label: "\u041A\u043E\u043D\u0442\u0443\u0440", value: equipment.params.assignedSystemId ?? "", onChange: (value) => updateParams({ assignedSystemId: value.trim() || null }) })] }));
        case "boiler":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u0412\u0442", value: equipment.params.nominalPowerW ?? 0, step: 100, onChange: (value) => updateParams({ nominalPowerW: value }) }), _jsx(NumberField, { label: "\u041A\u041F\u0414", value: equipment.params.efficiency ?? 0.9, step: 0.01, onChange: (value) => updateParams({ efficiency: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0434\u0430\u0447\u0430, \u00B0C", value: equipment.params.supplyTemperatureC ?? 70, step: 0.5, onChange: (value) => updateParams({ supplyTemperatureC: value }) }), _jsx(NumberField, { label: "\u041E\u0431\u0440\u0430\u0442\u043A\u0430, \u00B0C", value: equipment.params.returnTemperatureC ?? 50, step: 0.5, onChange: (value) => updateParams({ returnTemperatureC: value }) }), _jsx(NumberField, { label: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u0440\u0430\u0441\u0447. t, \u00B0C", value: equipment.params.designIndoorTemperatureC ?? 21, step: 0.5, onChange: (value) => updateParams({ designIndoorTemperatureC: value }) }), _jsx(NumberField, { label: "\u041D\u0430\u0440\u0443\u0436\u043D\u0430\u044F \u0440\u0430\u0441\u0447. t, \u00B0C", value: equipment.params.designOutdoorTemperatureC ?? -18, step: 0.5, onChange: (value) => updateParams({ designOutdoorTemperatureC: value }) })] }));
        case "pump":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u041D\u0430\u043F\u043E\u0440, \u041F\u0430", value: equipment.params.headPa ?? 0, step: 100, onChange: (value) => updateParams({ headPa: value }) }), _jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043A\u0433/\u0441", value: equipment.params.designFlow_kg_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designFlow_kg_s: value }) }), _jsx(NumberField, { label: "\u041A\u041F\u0414", value: equipment.params.efficiency ?? 0.7, step: 0.01, onChange: (value) => updateParams({ efficiency: value }) })] }));
        case "ahu":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0412\u043E\u0437\u0434\u0443\u0445, \u043C\u00B3/\u0441", value: equipment.params.designAirflow_m3_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designAirflow_m3_s: value }) }), _jsx(NumberField, { label: "\u041A\u041F\u0414", value: equipment.params.efficiency ?? 0.68, step: 0.01, onChange: (value) => updateParams({ efficiency: value }) })] }));
        case "diffuser":
            return _jsx(NumberField, { label: "\u0412\u043E\u0437\u0434\u0443\u0445, \u043C\u00B3/\u0441", value: equipment.params.designAirflow_m3_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designAirflow_m3_s: value }) });
        case "fancoil":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u0412\u0442", value: equipment.params.nominalPowerW ?? 0, step: 50, onChange: (value) => updateParams({ nominalPowerW: value }) }), _jsx(NumberField, { label: "\u0412\u043E\u0437\u0434\u0443\u0445, \u043C\u00B3/\u0441", value: equipment.params.designAirflow_m3_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designAirflow_m3_s: value }) }), _jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043A\u0433/\u0441", value: equipment.params.designFlow_kg_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designFlow_kg_s: value }) })] }));
        case "heat_exchanger":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u041C\u043E\u0449\u043D\u043E\u0441\u0442\u044C, \u0412\u0442", value: equipment.params.nominalPowerW ?? 0, step: 500, onChange: (value) => updateParams({ nominalPowerW: value }) }), _jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043A\u0433/\u0441", value: equipment.params.designFlow_kg_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designFlow_kg_s: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0434\u0430\u0447\u0430, \u00B0C", value: equipment.params.supplyTemperatureC ?? 95, step: 0.5, onChange: (value) => updateParams({ supplyTemperatureC: value }) }), _jsx(NumberField, { label: "\u041E\u0431\u0440\u0430\u0442\u043A\u0430, \u00B0C", value: equipment.params.returnTemperatureC ?? 60, step: 0.5, onChange: (value) => updateParams({ returnTemperatureC: value }) }), _jsx(NumberField, { label: "\u0394p, \u041F\u0430", value: equipment.params.pressureDropPa ?? 0, step: 500, onChange: (value) => updateParams({ pressureDropPa: value }) }), _jsx(NumberField, { label: "\u041A\u041F\u0414", value: equipment.params.efficiency ?? 0.97, step: 0.01, onChange: (value) => updateParams({ efficiency: value }) })] }));
        case "elevator":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043A\u0433/\u0441", value: equipment.params.designFlow_kg_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designFlow_kg_s: value }) }), _jsx(NumberField, { label: "\u0394p, \u041F\u0430", value: equipment.params.pressureDropPa ?? 0, step: 500, onChange: (value) => updateParams({ pressureDropPa: value }) }), _jsx(NumberField, { label: "\u041F\u043E\u0434\u0430\u0447\u0430, \u00B0C", value: equipment.params.supplyTemperatureC ?? 95, step: 0.5, onChange: (value) => updateParams({ supplyTemperatureC: value }) }), _jsx(NumberField, { label: "\u041E\u0431\u0440\u0430\u0442\u043A\u0430, \u00B0C", value: equipment.params.returnTemperatureC ?? 70, step: 0.5, onChange: (value) => updateParams({ returnTemperatureC: value }) })] }));
        case "expansion_tank":
            return (_jsx(NumberField, { label: "\u0394p, \u041F\u0430", value: equipment.params.pressureDropPa ?? 0, step: 200, onChange: (value) => updateParams({ pressureDropPa: value }) }));
        case "dirt_separator":
            return (_jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(NumberField, { label: "\u0420\u0430\u0441\u0445\u043E\u0434, \u043A\u0433/\u0441", value: equipment.params.designFlow_kg_s ?? 0, step: 0.01, onChange: (value) => updateParams({ designFlow_kg_s: value }) }), _jsx(NumberField, { label: "\u0394p, \u041F\u0430", value: equipment.params.pressureDropPa ?? 0, step: 500, onChange: (value) => updateParams({ pressureDropPa: value }) })] }));
        default:
            return _jsx(HintCard, { text: "\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0442\u0438\u043F\u0430 \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u044B\u0435 \u043F\u0430\u0440\u0430\u043C\u0435\u0442\u0440\u044B \u043F\u043E\u043A\u0430 \u043D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B." });
    }
}
function PolicyList({ title, items }) {
    return (_jsxs("div", { className: "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]", children: title }), _jsx("ul", { className: "mt-2 space-y-1 text-sm text-[color:var(--text-muted)]", children: items.map((item) => (_jsx("li", { className: "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] px-3 py-2", children: item }, item))) })] }));
}
function NumberField({ label, value, onChange, step, min, max, disabled = false, }) {
    return (_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-soft)]", children: [label, _jsx("input", { type: "number", step: step, min: min, max: max, value: Number.isFinite(value) ? value : 0, disabled: disabled, onChange: (event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) {
                        onChange(next);
                        return;
                    }
                    const clampedMin = typeof min === "number" ? Math.max(min, next) : next;
                    const clamped = typeof max === "number" ? Math.min(max, clampedMin) : clampedMin;
                    onChange(clamped);
                }, className: "ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)] disabled:bg-[color:var(--surface-muted)]" })] }));
}
function TextField({ label, value, onChange }) {
    return (_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-soft)]", children: [label, _jsx("input", { type: "text", value: value, onChange: (event) => onChange(event.target.value), className: "ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]" })] }));
}
const ROOF_HEATED_SIDE_OPTIONS = [
    { value: "below", label: "Снизу тёплое помещение" },
    { value: "above", label: "Снизу холодное помещение (чердак)" },
];
function HeatedSideField({ value, onChange, options, }) {
    return (_jsx("div", { className: "grid grid-cols-2 gap-0.5 rounded-[10px] border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)]/50 p-0.5", role: "group", "aria-label": "\u041E\u0431\u043E\u0433\u0440\u0435\u0432\u0430\u0435\u043C\u0430\u044F \u0441\u0442\u043E\u0440\u043E\u043D\u0430", children: options.map((option) => {
            const active = value === option.value;
            return (_jsx("button", { type: "button", "aria-pressed": active, onClick: () => onChange(option.value), className: `rounded-[8px] px-2 py-1.5 text-left text-[11px] font-medium leading-snug transition ${active
                    ? "bg-[color:var(--surface-elevated)] text-[color:var(--text-base)] shadow-[var(--shadow-control)] ring-1 ring-[color:var(--accent-muted)]"
                    : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-base)]"}`, children: option.label }, option.value));
        }) }));
}
function SelectField({ label, value, onChange, options, }) {
    return (_jsxs("label", { className: "text-xs font-semibold text-[color:var(--text-soft)]", children: [label, _jsx("select", { value: value, onChange: (event) => onChange(event.target.value), className: "ui-field mt-1 w-full rounded-[12px] border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-3 py-2 text-sm text-[color:var(--text-base)]", children: options.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }));
}
function InfoCard({ rows }) {
    return (_jsx("div", { className: "ui-panel-muted rounded-[16px] p-3 text-xs text-[color:var(--text-muted)]", children: rows.map((row) => (_jsxs("div", { className: "flex items-center justify-between gap-3 py-1.5", children: [_jsx("span", { className: "uppercase tracking-wide text-[color:var(--text-soft)]", children: row.label }), _jsx("span", { className: "text-right font-semibold text-[color:var(--text-base)]", children: row.value })] }, row.label))) }));
}
function HintCard({ text, tone = "info", }) {
    return (_jsx("div", { className: `rounded-[16px] border px-3 py-3 text-sm ${tone === "warning"
            ? "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)]"
            : "border-[color:var(--info-border)] bg-[color:var(--info-bg)] text-[color:var(--text-muted)]"}`, children: text }));
}
function ValueTile({ label, value }) {
    return (_jsxs("div", { children: [_jsx("p", { className: "text-[10px] uppercase tracking-wide text-[color:var(--text-soft)]", children: label }), _jsx("p", { className: "text-sm font-semibold text-[color:var(--text-base)]", children: value })] }));
}
const wallLength = (wall) => Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
const clampOffset = (value, wall, width) => {
    const max = Math.max(0, wallLength(wall) - width);
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.min(Math.max(0, value), max);
};
function selectionLabel(kind) {
    if (kind === "engineeringEquipment") {
        return "Инженерное оборудование";
    }
    if (kind === "engineeringPipe") {
        return "Инженерный трубопровод";
    }
    switch (kind) {
        case "room":
            return "Помещение";
        case "wall":
            return "Стена";
        case "roof":
            return "Крыша";
        case "slab":
            return "Перекрытие";
        case "door":
            return "Дверь";
        case "window":
            return "Окно";
        case "pipe":
            return "Трубопровод";
        case "duct":
            return "Воздуховод";
        case "equipment":
            return "Оборудование";
        case "sensor":
            return "Датчик";
        case "loop":
            return "Замкнутый контур";
        default:
            return "Объект";
    }
}
function draftLabel(kind, tool, equipmentPreset, engineeringEquipmentPreset) {
    if (kind === "engineeringEquipment") {
        return `Новое инженерное оборудование: ${ENGINEERING_EQUIPMENT_LABELS[engineeringEquipmentPreset]}`;
    }
    if (kind === "engineeringPipe") {
        return "Новый инженерный трубопровод";
    }
    switch (kind) {
        case "room":
            return tool === "roomRect" ? "Новая прямоугольная комната" : "Новая комната по контуру";
        case "wall":
            return "Новая стена";
        case "roof":
            return "Новая крыша";
        case "slab":
            return "Новое перекрытие";
        case "door":
            return "Новая дверь";
        case "window":
            return "Новое окно";
        case "pipe":
            return "Новый трубопровод";
        case "duct":
            return "Новый воздуховод";
        case "equipment":
            return `Новое оборудование: ${EQUIPMENT_TYPE_LABELS[equipmentPreset]}`;
        case "sensor":
            return "Новый датчик";
        default:
            return "Инструмент";
    }
}
export default RightInspector;
