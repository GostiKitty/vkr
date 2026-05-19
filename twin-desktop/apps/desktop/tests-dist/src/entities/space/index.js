import { getSpaceDisplayName } from "../../shared/utils/roomNames";
export function filterSpaces(spaces, query) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
        return spaces.slice();
    }
    return spaces.filter((space, index) => getSpaceDisplayName(space, index).toLowerCase().includes(normalized));
}
export function sortSpacesByArea(spaces, direction) {
    return spaces
        .slice()
        .sort((a, b) => {
        const areaA = a.area_m2 ?? 0;
        const areaB = b.area_m2 ?? 0;
        return direction === "asc" ? areaA - areaB : areaB - areaA;
    });
}
export function getSpaceById(spaces, id) {
    if (!id) {
        return null;
    }
    return spaces.find((space) => space.id === id) ?? null;
}
