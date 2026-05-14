import type { Twin } from "../../shared/api/types";

export interface BuildingSummary {
  name: string;
  spaces: number;
  totalArea: number;
  totalVolume: number;
}

export function summarizeBuilding(twin: Twin | null): BuildingSummary | null {
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

export function hasGeometryReady(twin: Twin | null): boolean {
  return Boolean(twin?.spaces?.length);
}
