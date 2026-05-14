import type { BuildingEvent } from "../../entities/networks/types";

export function sortEvents(events: BuildingEvent[]): BuildingEvent[] {
  return [...events].sort((left, right) => right.timestamp - left.timestamp);
}

export function getActiveEvents(events: BuildingEvent[]): BuildingEvent[] {
  return sortEvents(events).filter((event) => !event.acknowledged);
}
