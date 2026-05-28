import { useEffect, useRef } from "react";
import { useProjectStore } from "../entities/project/project.store";
import { useTwinStore } from "../entities/twin/twin.store";
import { useWorkflowStore } from "../entities/workflow/workflow.store";
import { useBuildStore } from "../features/build/build.store";
import { writeAgentDebugLog } from "../shared/utils/agentDebugLog";
import { resolveBuildProjectKey } from "../shared/utils/projectRuntime";

export function ProjectStateBridge() {
  const projectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const clearSimulation = useTwinStore((state) => state.clearSimulation);
  const resetWorkflow = useWorkflowStore((state) => state.resetWorkflow);
  const projectKey = useBuildStore((state) => state.projectKey);
  const setProjectKey = useBuildStore((state) => state.setProjectKey);
  const previousProjectRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey = resolveBuildProjectKey(projectId);
    // #region agent log
    writeAgentDebugLog({sessionId:'c3d591',runId:'repro-4',hypothesisId:'H1',location:'ProjectStateBridge.tsx:project-key-sync',message:'bridge sync project key',data:{projectId,projectKind,currentProjectKey:projectKey,nextProjectKey:nextKey,changed:projectKey!==nextKey},timestamp:Date.now()});
    // #endregion
    if (projectKey !== nextKey) {
      setProjectKey(nextKey);
    }
  }, [projectId, projectKey, setProjectKey]);

  useEffect(() => {
    const nextSignature = `${projectKind}:${projectId ?? ""}`;
    if (previousProjectRef.current === nextSignature) {
      return;
    }
    previousProjectRef.current = nextSignature;
    resetWorkflow();
    clearSimulation();
  }, [clearSimulation, projectId, projectKind, resetWorkflow]);

  return null;
}

export default ProjectStateBridge;
