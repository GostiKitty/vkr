import { polygonArea } from "../../../entities/geometry/geom";
import { getRoomDisplayName } from "../../../shared/utils/roomNames";
export function buildModelToTwin(model, options = {}) {
    const levelLookup = new Map(model.levels.map((level) => [level.id, level]));
    const defaultHeight = options.defaultHeight ?? estimateDefaultHeight(model.levels);
    const spaces = model.rooms.map((room) => {
        const level = levelLookup.get(room.levelId);
        const height = level?.height_m ?? defaultHeight;
        const area = Math.max(0, Math.abs(polygonArea(room.polygon)));
        const volume = area * height;
        const roomIndex = model.rooms.findIndex((entry) => entry.id === room.id);
        const displayName = getRoomDisplayName(room, roomIndex);
        return {
            id: room.id,
            name: displayName,
            long_name: displayName,
            level: level?.name ?? null,
            area_m2: Number(area.toFixed(2)),
            volume_m3: Number(volume.toFixed(2)),
        };
    });
    const projectName = options.projectName ||
        (model.meta && typeof model.meta["name"] === "string" ? model.meta["name"] : "Ручной проект");
    return {
        meta: {
            schema_version: "build-mode-v1",
            source: "build-mode",
            created_at: new Date().toISOString(),
            ...model.meta,
            sourceProjectId: options.projectId ?? null,
        },
        building: {
            name: projectName,
        },
        spaces,
        assumptions: {
            build_mode: true,
        },
    };
}
const estimateDefaultHeight = (levels) => {
    const heights = levels.map((level) => level.height_m).filter((value) => Number.isFinite(value));
    return heights.length ? heights[0] : 3;
};
