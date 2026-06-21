export function deriveProjectName(fileName) {
    return fileName.replace(/\.ifc$/i, "").trim() || "��� ������";
}
