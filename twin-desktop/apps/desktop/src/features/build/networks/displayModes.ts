export type HeatingNetworkDisplayMode =
  | "lineRole"
  | "diameter"
  | "flow"
  | "temperature"
  | "load"
  | "rooms";

export const HEATING_NETWORK_DISPLAY_LABELS: Record<HeatingNetworkDisplayMode, string> = {
  lineRole: "Подача/обратка",
  diameter: "Диаметры",
  flow: "Расход",
  temperature: "Температура",
  load: "Нагрузка",
  rooms: "Помещения",
};
