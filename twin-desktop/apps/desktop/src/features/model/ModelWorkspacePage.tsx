import { useCallback, useEffect, useMemo, useState } from "react";
import { navigate } from "../../app/router";
import { notifyInfo } from "../../entities/notifications/notification.store";
import type { BuildingModel } from "../../entities/geometry/types";
import { useProjectStore } from "../../entities/project/project.store";
import { useTwinStore } from "../../entities/twin/twin.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import {
  ActionBar,
  AnimatedTabs,
  EmptyWorkspaceState,
  IconModel,
  IconStatusWarn,
  MetricCard,
  SectionShell,
  StatusBadge,
  InspectorPanel,
  StatusStrip,
  WorkspacePageHeader,
  WorkspacePane,
  WorkspaceShell,
} from "../../shared/ui";
import { formatArea, formatVolume } from "../../shared/utils/format";
import { useBuildStore } from "../build/build.store";
import { buildModelFromTwin } from "../build/import/fromTwin";
import {
  buildProjectSummary,
  doesBuildModelMatchProject,
  hasBuildGeometry,
} from "../project/projectSummary";
import { isEngineProjectSource } from "../../shared/utils/projectRuntime";
import ModelPlan2D from "./ModelPlan2D";
import SpaceDetails from "../twin/SpaceDetails";
import SpaceList from "../twin/SpaceList";
import SpaceViewer3D from "../twin/SpaceViewer3D";
import { useTwin } from "../twin/useTwin";

type ModelView = "3d" | "2d" | "rooms" | "walls" | "props";

export function ModelWorkspacePage() {
  const projectId = useProjectStore((state) => state.projectId);
  const projectKind = useProjectStore((state) => state.projectKind);
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const setCurrentStep = useWorkflowStore((state) => state.setCurrentStep);
  const buildModel = useBuildStore((state) => state.model);
  const loadModelSnapshot = useBuildStore((state) => state.loadModelSnapshot);
  const setProjectKey = useBuildStore((state) => state.setProjectKey);
  const thermalGraph = useTwinStore((state) => state.thermalGraph);
  const selectSpace = useTwinStore((state) => state.selectSpace);
  const selectedSpaceId = useTwinStore((state) => state.selectedSpaceId);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ModelView>(() => readModelViewFromSearch());

  const { twin, loading, error } = useTwin(projectId ?? null, projectKind);

  useEffect(() => {
    setCurrentStep("geometry");
  }, [setCurrentStep]);

  const hasTwinGeometry = projectKind === "engine" && Boolean(twin?.spaces?.length);
  const hasLocalGeometry =
    hasBuildGeometry(buildModel) &&
    doesBuildModelMatchProject(buildModel, projectId, projectKind);
  const effectiveModel = useMemo(() => {
    if (hasLocalGeometry) {
      return buildModel;
    }
    if (hasTwinGeometry && twin) {
      return buildModelFromTwin(twin, projectId ?? null);
    }
    return buildModel;
  }, [buildModel, hasLocalGeometry, hasTwinGeometry, projectId, twin]);
  const summary = useMemo(
    () => buildProjectSummary({ projectId, projectKind, twin, buildModel: effectiveModel }),
    [effectiveModel, projectId, projectKind, twin]
  );
  const wallsWithAssemblies = useMemo(
    () =>
      effectiveModel.walls.filter((wall) => wall.wallAssemblyId || wall.layers?.length).length,
    [effectiveModel.walls]
  );

  const handleOpenInBuild = useCallback(() => {
    if (twin) {
      const nextProjectId = projectId ?? `local:${Date.now()}`;
      const nextProjectKind = isEngineProjectSource(projectId, projectKind) ? "engine" : "local";
      const editableModel = buildModelFromTwin(twin, projectId ?? null);
      setProjectId(nextProjectId, nextProjectKind);
      setProjectKey(nextProjectId);
      loadModelSnapshot(editableModel);
      notifyInfo(
        "Модель открыта в конструкторе. Можно дополнять стены, окна, двери и инженерные сети."
      );
      navigate("/build");
      return;
    }
    if (hasLocalGeometry) {
      notifyInfo("Открываю локальную модель в конструкторе.");
      navigate("/build");
    }
  }, [hasLocalGeometry, loadModelSnapshot, projectId, projectKind, setProjectId, setProjectKey, twin]);

  const hasModel = hasTwinGeometry || hasLocalGeometry;
  const selectedWall = effectiveModel.walls.find((wall) => wall.id === selectedWallId) ?? null;
  const selectedRoom = effectiveModel.rooms.find((room) => room.id === selectedSpaceId) ?? null;

  useEffect(() => {
    const nextView = readModelViewFromSearch();
    if (nextView !== activeView) {
      setActiveView(nextView);
    }
  }, [activeView]);

  return (
    <section className="w-full space-y-4 ui-page-enter">
      <WorkspacePageHeader
        kicker="Модель"
        title="Цифровая модель здания"
        description="2D-чертёж, 3D и свойства — в одном окне."
      />

      <SectionShell
        title="Сводка модели"
        description="Помещения, конструкции и готовность к расчёту."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Помещения"
            value={summary?.spaces ?? effectiveModel.rooms.length}
            unit="шт"
            precision={0}
            status={hasModel ? "success" : "warning"}
            icon={<IconModel size={16} />}
            subtitle="Количество зон в текущей модели"
          />
          <MetricCard
            label="Ограждающие конструкции"
            value={effectiveModel.walls.length}
            unit="шт"
            precision={0}
            status={effectiveModel.walls.length > 0 ? "info" : "warning"}
            subtitle="Стены и оболочка здания"
          />
          <MetricCard
            label="Материалы назначены"
            value={effectiveModel.walls.length > 0 ? (wallsWithAssemblies / effectiveModel.walls.length) * 100 : null}
            unit="%"
            precision={0}
            status={wallsWithAssemblies > 0 ? "success" : "warning"}
            subtitle={`${wallsWithAssemblies}/${effectiveModel.walls.length} конструкций`}
          />
          <MetricCard
            label="Тепловой граф"
            value={thermalGraph ? 1 : null}
            unit={thermalGraph ? "готов" : ""}
            precision={0}
            status={thermalGraph ? "success" : "warning"}
            icon={thermalGraph ? <IconModel size={16} /> : <IconStatusWarn size={16} />}
            subtitle={thermalGraph ? "Граф готов" : "Нужен расчёт"}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={hasTwinGeometry ? "success" : "info"}>
            {hasTwinGeometry ? "Геометрия с движка" : "Локальная модель"}
          </StatusBadge>
          <StatusBadge tone={hasLocalGeometry ? "success" : "warning"}>
            {hasLocalGeometry ? "Локальная модель готова" : "Требуется импорт/конструктор"}
          </StatusBadge>
        </div>
      </SectionShell>

      <ActionBar>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenInBuild}
            disabled={!twin && !hasLocalGeometry}
            className="ui-btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
          >
            Открыть в конструкторе
          </button>
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("model-readiness")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="ui-btn-secondary px-4 py-2 text-sm"
          >
            Проверить модель
          </button>
          <button
            type="button"
            onClick={() => setActiveView("2d")}
            className="ui-btn-secondary px-4 py-2 text-sm"
          >
            Открыть 2D-план
          </button>
          <button
            type="button"
            onClick={() => navigate("/scenarios")}
            className="ui-btn-secondary px-4 py-2 text-sm"
          >
            Перейти к сценариям
          </button>
        </div>
        <p className="text-sm text-[color:var(--text-muted)]">
          Геометрия и расчётный контур не меняются.
        </p>
      </ActionBar>

      <StatusStrip
        items={[
          { label: "Помещений", value: summary?.spaces ?? effectiveModel.rooms.length },
          { label: "Стен", value: effectiveModel.walls.length },
          {
            label: "С материалами",
            value: `${wallsWithAssemblies}/${effectiveModel.walls.length}`,
            tone: wallsWithAssemblies > 0 ? "success" : "warning",
          },
          {
            label: "Тепловой граф",
            value: thermalGraph ? "Готов" : "Нет",
            tone: thermalGraph ? "success" : "warning",
          },
        ]}
      />

      {loading ? (
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-overlay)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
          Загружаю геометрию проекта…
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-[color:var(--warning-border)] bg-[color:var(--warning-bg)] px-4 py-3 text-sm text-[color:var(--warning-fg)]">
          {error}
        </div>
      ) : null}

      <WorkspaceShell className="xl:grid-cols-[minmax(0,1fr),20rem]">
        <WorkspacePane
          title="Рабочая зона"
          subtitle="2D-чертёж, 3D, помещения и свойства."
          className="ui-scan-effect"
        >
          <div className="space-y-4">
            <AnimatedTabs<ModelView>
              value={activeView}
              onChange={setActiveView}
              tabs={[
                { id: "3d", label: "3D-модель" },
                { id: "2d", label: "2D-план" },
                { id: "rooms", label: "Помещения" },
                { id: "walls", label: "Конструкции" },
                { id: "props", label: "Свойства" },
              ]}
            />
            {renderModelView({
              activeView,
              hasTwinGeometry,
              hasLocalGeometry,
              handleOpenInBuild,
              navigateToProject: () => navigate("/"),
              navigateToScenarios: () => navigate("/scenarios"),
              summary,
              model: effectiveModel,
              selectedSpaceId,
              selectedWallId,
              selectSpace,
              setSelectedWallId,
            })}
          </div>
        </WorkspacePane>

        <div className="space-y-4 min-w-0">
          {hasTwinGeometry ? <SpaceDetails /> : null}
          <InspectorPanel
            title="Состояние ограждений"
            subtitle="Локальная готовность к теплотехническому расчёту."
            className="min-w-0"
          >
            <div id="model-readiness" className="space-y-4">
              <dl className="ui-workspace-facts">
                <FactRow label="Локальная модель" value={hasLocalGeometry ? "Есть" : "Нет"} />
                <FactRow label="Стен" value={effectiveModel.walls.length} />
                <FactRow
                  label="С материалами"
                  value={`${wallsWithAssemblies}/${effectiveModel.walls.length}`}
                />
                <FactRow
                  label="Тепловой граф"
                  value={thermalGraph ? "Построен" : "Не построен"}
                />
              </dl>
              <dl className="ui-workspace-facts">
                <FactRow label="Выбранное помещение" value={selectedRoom?.name ?? "—"} />
                <FactRow label="Выбранная стена" value={selectedWall?.id ?? "—"} />
              </dl>
              {!hasLocalGeometry ? (
                <EmptyWorkspaceState
                  title="Нет локальной модели"
                  message="Для расчёта ограждений сначала откройте проект в конструкторе или импортируйте демо-модель."
                />
              ) : null}
            </div>
          </InspectorPanel>
        </div>
      </WorkspaceShell>
    </section>
  );
}

function readModelViewFromSearch(): ModelView {
  if (typeof window === "undefined") {
    return "3d";
  }
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  return view === "2d" ? "2d" : "3d";
}

function renderModelView({
  activeView,
  hasTwinGeometry,
  hasLocalGeometry,
  handleOpenInBuild,
  navigateToProject,
  navigateToScenarios,
  summary,
  model,
  selectedSpaceId,
  selectedWallId,
  selectSpace,
  setSelectedWallId,
}: {
  activeView: ModelView;
  hasTwinGeometry: boolean;
  hasLocalGeometry: boolean;
  handleOpenInBuild: () => void;
  navigateToProject: () => void;
  navigateToScenarios: () => void;
  summary: ReturnType<typeof buildProjectSummary> | null;
  model: BuildingModel;
  selectedSpaceId: string | null;
  selectedWallId: string | null;
  selectSpace: (spaceId: string | null) => void;
  setSelectedWallId: (wallId: string | null) => void;
}) {
  if (activeView === "3d") {
    if (hasTwinGeometry) {
      return (
        <div className="space-y-4">
          <SpaceViewer3D caption="3D-модель" height={500} showFitControl />
          {summary ? (
            <dl className="ui-workspace-facts">
              <FactRow label="Название проекта" value={summary.name} />
              <FactRow label="Площадь" value={formatArea(summary.totalArea)} />
              <FactRow label="Объём" value={formatVolume(summary.totalVolume)} />
            </dl>
          ) : null}
        </div>
      );
    }
    if (hasLocalGeometry) {
      return (
        <EmptyWorkspaceState
          title="Есть локальная модель"
          message="Откройте конструктор для редактирования или переключитесь на 2D-план."
          actions={
            <>
              <button type="button" onClick={handleOpenInBuild} className="ui-btn-primary px-4 py-2 text-sm">
                Открыть в конструкторе
              </button>
              <button type="button" onClick={navigateToScenarios} className="ui-btn-secondary px-4 py-2 text-sm">
                Перейти к сценариям
              </button>
            </>
          }
        />
      );
    }
    return (
      <EmptyWorkspaceState
        title="Нет модели"
        message="Откройте проект или загрузите IFC, чтобы увидеть 3D-модель."
        actions={
          <button type="button" onClick={navigateToProject} className="ui-btn-secondary px-4 py-2 text-sm">
            Перейти в проект
          </button>
        }
      />
    );
  }

  if (activeView === "2d") {
    return (
      <div className="space-y-3">
        <ModelPlan2D
          model={model}
          selectedRoomId={selectedSpaceId}
          selectedWallId={selectedWallId}
          onSelectRoom={selectSpace}
          onSelectWall={setSelectedWallId}
        />
        <div className="flex justify-end">
          <button type="button" className="ui-btn-secondary px-4 py-2 text-sm" onClick={() => setSelectedWallId(null)}>
            Сбросить выбор стены
          </button>
        </div>
      </div>
    );
  }

  if (activeView === "rooms") {
    if (hasTwinGeometry) {
      return <SpaceList />;
    }
    return (
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Помещения локальной модели</p>
        <ul className="mt-3 space-y-2">
          {model.rooms.map((room) => (
            <li key={room.id} className="rounded-xl border border-[color:var(--border-soft)] px-3 py-2 text-sm">
              <button type="button" onClick={() => selectSpace(room.id)} className="font-semibold text-[color:var(--text-base)]">
                {room.name}
              </button>
            </li>
          ))}
          {model.rooms.length === 0 ? (
            <li className="text-sm text-[color:var(--text-muted)]">Нет помещений в текущей модели.</li>
          ) : null}
        </ul>
      </div>
    );
  }

  if (activeView === "walls") {
    return (
      <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
        <p className="text-sm font-semibold text-[color:var(--text-base)]">Конструкции</p>
        <div className="mt-3 max-h-[28rem] overflow-auto rounded-xl border border-[color:var(--border-soft)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]">
              <tr>
                <th className="px-3 py-2">Стена</th>
                <th className="px-3 py-2">Длина</th>
                <th className="px-3 py-2">Материалы</th>
              </tr>
            </thead>
            <tbody>
              {model.walls.map((wall, index) => {
                const dx = wall.b.x - wall.a.x;
                const dy = wall.b.y - wall.a.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const hasLayers = Boolean(wall.wallAssemblyId || wall.layers?.length);
                return (
                  <tr key={wall.id} className="border-t border-[color:var(--border-soft)]">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="font-semibold text-[color:var(--text-base)]"
                        onClick={() => setSelectedWallId(wall.id)}
                      >
                        {wall.wallAssemblyId?.trim() || `Стена ${index + 1}`}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)]">{length.toFixed(2)} м</td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)]">{hasLayers ? "Назначены" : "Нет"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4">
      <p className="text-sm font-semibold text-[color:var(--text-base)]">Свойства выбора</p>
      <div className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
        <p>Помещение: {model.rooms.find((room) => room.id === selectedSpaceId)?.name ?? "не выбрано"}</p>
        <p>Стена: {model.walls.find((wall) => wall.id === selectedWallId)?.id ?? "не выбрано"}</p>
      </div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="ui-workspace-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default ModelWorkspacePage;
