export function isDeleteShortcut(event: KeyboardEvent): boolean {
  return (
    event.code === "Delete" ||
    event.code === "Backspace" ||
    event.key === "Delete" ||
    event.key === "Backspace" ||
    event.key === "Del"
  );
}
