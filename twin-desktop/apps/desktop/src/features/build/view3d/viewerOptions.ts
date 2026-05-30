export interface BuildViewerOptions {
  showRooms: boolean;
  showWalls: boolean;
  showOpenings: boolean;
  showNetworks: boolean;
  showEquipment: boolean;
  transparentWalls: boolean;
  presentationMode?: "default" | "engineering-overview";
}

export type BuildSectionMode = "horizontal" | "vertical";

export const DEFAULT_STABLE_VIEWER_OPTIONS: BuildViewerOptions = {
  showRooms: true,
  showWalls: true,
  showOpenings: true,
  showNetworks: true,
  showEquipment: true,
  transparentWalls: false,
  presentationMode: "default",
};
