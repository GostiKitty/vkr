export function summarizeBuilding(twin) {
    if (!twin) {
        return null;
    }
    const spaces = twin.spaces ?? [];
    if (!spaces.length) {
        return null;
    }
    const totalArea = spaces.reduce((sum, space) => sum + (space.area_m2 ?? 0), 0);
    const totalVolume = spaces.reduce((sum, space) => sum + (space.volume_m3 ?? 0), 0);
    return {
        name: twin.building?.name ?? "Building",
        spaces: spaces.length,
        totalArea,
        totalVolume,
    };
}
export function hasGeometryReady(twin) {
    return Boolean(twin?.spaces?.length);
}
