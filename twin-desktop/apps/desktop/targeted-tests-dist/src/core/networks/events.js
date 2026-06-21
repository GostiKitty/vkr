export function sortEvents(events) {
    return [...events].sort((left, right) => right.timestamp - left.timestamp);
}
export function getActiveEvents(events) {
    return sortEvents(events).filter((event) => !event.acknowledged);
}
