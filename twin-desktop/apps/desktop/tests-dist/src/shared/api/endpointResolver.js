import { buildUrl } from "./client";
export const importCandidates = ["/import/ifc", "/import", "/api/import", "/ifc/import"];
export const twinCandidates = [
    { type: "projectPath", template: "/twin/{id}" },
    { type: "query", path: "/twin" },
    { type: "query", path: "/api/twin" },
    { type: "projectPath", template: "/projects/{id}/twin" },
];
let cachedImportPath = null;
let cachedTwinConfig = null;
async function fetchDocs() {
    try {
        const response = await fetch(buildUrl("/docs"), { method: "GET" });
        if (!response.ok) {
            return null;
        }
        return await response.text();
    }
    catch {
        return null;
    }
}
async function probePath(path) {
    try {
        const response = await fetch(buildUrl(path), { method: "OPTIONS" });
        if (response.ok) {
            return true;
        }
        if (response.status !== 404) {
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
export async function resolveImportPath() {
    if (cachedImportPath) {
        return cachedImportPath;
    }
    const docs = await fetchDocs();
    if (docs) {
        const found = importCandidates.find((candidate) => docs.includes(candidate));
        if (found) {
            cachedImportPath = found;
            return found;
        }
    }
    for (const candidate of importCandidates) {
        if (await probePath(candidate)) {
            cachedImportPath = candidate;
            return candidate;
        }
    }
    cachedImportPath = importCandidates[0];
    return cachedImportPath;
}
export async function resolveTwinConfig() {
    if (cachedTwinConfig) {
        return cachedTwinConfig;
    }
    const docs = await fetchDocs();
    if (docs) {
        for (const candidate of twinCandidates) {
            const searchTerm = candidate.type === "query" ? candidate.path : candidate.template.replace("{id}", "");
            if (docs.includes(searchTerm)) {
                cachedTwinConfig = candidate;
                return candidate;
            }
        }
    }
    for (const candidate of twinCandidates) {
        const path = candidate.type === "query" ? `${candidate.path}?project_id=probe` : candidate.template.replace("{id}", "probe");
        if (await probePath(path)) {
            cachedTwinConfig = candidate;
            return candidate;
        }
    }
    cachedTwinConfig = twinCandidates[0];
    return cachedTwinConfig;
}
