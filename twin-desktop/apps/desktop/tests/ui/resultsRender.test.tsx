import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsPanel } from "../../src/features/reports/ResultsPanel.js";
import { MetricsResultsTab } from "../../src/features/reports/MetricsResultsTab.js";
import ProjectDocumentationPage from "../../src/features/reports/ProjectDocumentationPage.js";
import { createEmptyBuildingModel } from "../../src/entities/geometry/types.js";
import { buildAdjacencyGraph } from "../../src/core/graph/adjacency.js";
import { useTwinStore } from "../../src/entities/twin/twin.store.js";
import { useWorkflowStore } from "../../src/entities/workflow/workflow.store.js";
import { DEFAULT_THERMAL_OPTIONS } from "../../src/features/build/thermal/defaultThermalOptions.js";
import ThermalSimulationPanel from "../../src/features/build/components/ThermalSimulationPanel.js";
import { test } from "../testHarness.js";

function resetStores() {
  useTwinStore.getState().reset();
  useWorkflowStore.getState().resetWorkflow();
}

test("ResultsPanel renders its shell even without simulation data", () => {
  resetStores();
  const markup = renderToStaticMarkup(<ResultsPanel projectId={null} />);
  if (!markup.includes("ui-results-tabbar")) {
    throw new Error("ResultsPanel should render tab navigation.");
  }
  if (!markup.includes("ui-panel")) {
    throw new Error("ResultsPanel should render its panel shell.");
  }
  if (markup.includes("undefined") || markup.includes("null")) {
    throw new Error("ResultsPanel should not leak undefined/null in the empty state.");
  }
});

test("MetricsResultsTab renders a recovery empty state without undefined/null", () => {
  resetStores();
  const markup = renderToStaticMarkup(<MetricsResultsTab onRecalculate={() => {}} />);
  if (!markup.includes("ui-btn-primary")) {
    throw new Error("MetricsResultsTab should render a recovery action in the empty state.");
  }
  if (markup.includes("undefined") || markup.includes("null")) {
    throw new Error("MetricsResultsTab empty state should not leak undefined/null.");
  }
});

test("ThermalSimulationPanel renders a clear empty state in the results viewport", () => {
  const model = createEmptyBuildingModel();
  const adjacency = buildAdjacencyGraph(model);
  const markup = renderToStaticMarkup(
    <ThermalSimulationPanel
      projectKey="test-project"
      model={model}
      adjacency={adjacency}
      options={DEFAULT_THERMAL_OPTIONS}
      onOptionsChange={() => {}}
    />
  );
  if (!markup.includes('data-testid="thermal-results-panel"')) {
    throw new Error("ThermalSimulationPanel should render the main results panel marker.");
  }
  if (!markup.includes('data-testid="thermal-results-empty-state"')) {
    throw new Error("ThermalSimulationPanel should render the empty-state marker when no result exists.");
  }
  if (!markup.includes("Выполнить расчёт")) {
    throw new Error("ThermalSimulationPanel empty state should keep the calculate action visible.");
  }
  if (markup.includes("undefined") || markup.includes("null")) {
    throw new Error("ThermalSimulationPanel empty state should not leak undefined/null.");
  }
});

// Temporarily hidden from UI. Will be restored after project documentation export redesign.
// Раньше тест проверял, что страница экспертных документов содержит управляющие кнопки.
// Сейчас компонент сознательно рендерит нейтральную заглушку, и тест проверяет именно её.
// При восстановлении исходной реализации нужно вернуть прежние asserts.
test("ProjectDocumentationPage renders neutral hidden-section placeholder", () => {
  resetStores();
  const markup = renderToStaticMarkup(<ProjectDocumentationPage projectId={null} />);
  if (!markup.includes("Раздел временно скрыт")) {
    throw new Error("ProjectDocumentationPage placeholder should announce that the section is temporarily hidden.");
  }
  if (
    markup.includes('data-testid="open-expertise-inputs-button"') ||
    markup.includes('data-testid="check-export-completeness-button"') ||
    markup.includes("Скачать комплект документов")
  ) {
    throw new Error("ProjectDocumentationPage placeholder must not expose any hidden expertise controls.");
  }
});
