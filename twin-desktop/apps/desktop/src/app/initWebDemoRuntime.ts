import { useProjectStore } from "../entities/project/project.store";
import { useTwinStore } from "../entities/twin/twin.store";
import { useEngineSettingsStore } from "../entities/settings/engine.store";
import { isLocalEngineUrl, isWebProductionRuntime } from "../shared/runtime/webProduction";
import { deferBuildStorePersistenceHydration } from "../features/build/build.store";

export function initWebDemoRuntime(): void {
  if (!isWebProductionRuntime()) {
    return;
  }

  const engineUrl = useEngineSettingsStore.getState().baseUrl;
  if (isLocalEngineUrl(engineUrl)) {
    useEngineSettingsStore.getState().setBaseUrl("");
  }

  const { projectKind, projectId, clearProjectId } = useProjectStore.getState();
  if (projectKind === "engine" && projectId) {
    clearProjectId();
  }

  useTwinStore.getState().setLoading(false);
  useTwinStore.getState().setError(null);

  deferBuildStorePersistenceHydration();
}
