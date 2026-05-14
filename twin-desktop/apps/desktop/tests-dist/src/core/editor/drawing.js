import { orthogonalSnap } from "../../entities/geometry/geom";
export function isLinearTool(tool) {
    return tool === "wall" || tool === "pipe" || tool === "duct";
}
export function startLinearDraft(tool, point) {
    return { tool, points: [{ ...point }] };
}
export function appendLinearDraftPoint(draft, tool, point, orthogonalMode) {
    if (!draft || draft.tool !== tool || draft.points.length === 0) {
        return startLinearDraft(tool, point);
    }
    const lastPoint = draft.points[draft.points.length - 1];
    const nextPoint = orthogonalMode ? orthogonalSnap(point, lastPoint) : point;
    const isDuplicate = Math.hypot(nextPoint.x - lastPoint.x, nextPoint.y - lastPoint.y) < 1e-6;
    if (isDuplicate) {
        return draft;
    }
    return {
        tool,
        points: [...draft.points, { ...nextPoint }],
    };
}
export function previewLinearDraftPoint(draft, point, orthogonalMode) {
    if (!draft || draft.points.length === 0) {
        return null;
    }
    const lastPoint = draft.points[draft.points.length - 1];
    return orthogonalMode ? orthogonalSnap(point, lastPoint) : point;
}
export function cancelLinearDraft() {
    return null;
}
export function finalizeLinearDraft(draft) {
    if (!draft || draft.points.length < 2) {
        return [];
    }
    return draft.points.map((point) => ({ ...point }));
}
