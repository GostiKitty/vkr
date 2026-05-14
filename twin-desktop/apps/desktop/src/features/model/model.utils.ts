export function deriveProjectName(fileName: string): string {
  return fileName.replace(/\.ifc$/i, "").trim() || "Мой проект";
}
