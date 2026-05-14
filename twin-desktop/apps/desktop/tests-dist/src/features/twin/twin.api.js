import { apiFetch } from "../../shared/api/client";
import { resolveTwinConfig } from "../../shared/api/endpointResolver";
export async function fetchTwin(projectId, signal) {
    if (!projectId) {
        throw new Error("Project ID is required to fetch twin data");
    }
    const config = await resolveTwinConfig();
    const encodedId = encodeURIComponent(projectId);
    const path = config.type === "query"
        ? `${config.path}?project_id=${encodedId}`
        : config.template.replace("{id}", encodedId);
    return apiFetch(path, {
        method: "GET",
        signal,
    });
}
export const twinApi = { fetchTwin };
