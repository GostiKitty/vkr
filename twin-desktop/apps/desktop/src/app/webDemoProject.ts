import { navigate } from "./router";
import { useProjectStore } from "../entities/project/project.store";
import { useWorkflowStore } from "../entities/workflow/workflow.store";
import { buildVideoDemoProjectModel, VIDEO_DEMO_PROJECT_ID } from "../features/build/demoVideoProject";
import { useBuildStore } from "../features/build/build.store";

export function openWebDemoProject(): void {
  const demoModel = buildVideoDemoProjectModel();
  useProjectStore.getState().setProjectId(VIDEO_DEMO_PROJECT_ID, "local");
  useBuildStore.getState().setProjectKey(VIDEO_DEMO_PROJECT_ID);
  useBuildStore.getState().loadModelSnapshot(demoModel);
  useWorkflowStore.getState().setCurrentStep("geometry");
  navigate("/model");
}
