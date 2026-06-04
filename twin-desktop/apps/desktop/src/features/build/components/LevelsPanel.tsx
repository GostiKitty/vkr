import { useEffect, useMemo, useRef, useState } from "react";
import type { Level } from "../../../entities/geometry/types";
import { buildLevelName, getLevelDisplayLabel } from "../utils/entityLabels";
import { firstDisplayText } from "../../../shared/utils/displayText";

interface LevelsPanelProps {
  levels: Level[];
  activeLevelId: string | null;
  onSelectLevel: (levelId: string) => void;
  onAddLevel: (payload: { name: string; elevation_m: number; height_m: number }) => void;
  onUpdateLevel: (levelId: string, patch: Partial<Level>) => void;
  onCopyLevelModel?: (targetLevelId: string) => void;
}

export function LevelsPanel({ levels, activeLevelId, onSelectLevel, onAddLevel, onUpdateLevel, onCopyLevelModel }: LevelsPanelProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const activeSummaryRef = useRef<HTMLDivElement | null>(null);
  const metricsGridRef = useRef<HTMLDivElement | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftElevation, setDraftElevation] = useState(3);
  const [draftHeight, setDraftHeight] = useState(3);
  const orderedLevels = useMemo(
    () =>
      [...levels].sort(
        (left, right) => left.elevation_m - right.elevation_m || left.height_m - right.height_m || left.id.localeCompare(right.id)
      ),
    [levels]
  );
  const activeLevelIndex = useMemo(
    () => orderedLevels.findIndex((level) => level.id === activeLevelId),
    [activeLevelId, orderedLevels]
  );
  const activeLevel = activeLevelIndex >= 0 ? orderedLevels[activeLevelIndex] ?? null : null;
  const previousLevel = activeLevelIndex > 0 ? orderedLevels[activeLevelIndex - 1] ?? null : null;
  const nextLevel =
    activeLevelIndex >= 0 && activeLevelIndex < orderedLevels.length - 1 ? orderedLevels[activeLevelIndex + 1] ?? null : null;
  const nextLevelName = useMemo(() => buildLevelName(levels.length + 1), [levels.length]);

  useEffect(() => {
    const root = rootRef.current;
    const summary = activeSummaryRef.current;
    const grid = metricsGridRef.current;
    if (!root || !summary || !grid) {
      return;
    }
    const block = root.closest(".ui-build-sidebar-block") as HTMLElement | null;
    const previousBlock = block?.previousElementSibling as HTMLElement | null;
    const previousSection = root.previousElementSibling as HTMLElement | null;
    const rootRect = root.getBoundingClientRect();
    const blockRect = block?.getBoundingClientRect();
    const previousRect = previousBlock?.getBoundingClientRect();
    const previousSectionRect = previousSection?.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const cards = Array.from(grid.querySelectorAll("[data-level-metric]")).map((card) => {
      const rect = card.getBoundingClientRect();
      const label = card.querySelector("[data-level-metric-label]");
      const value = card.querySelector("[data-level-metric-value]");
      const labelRect = label?.getBoundingClientRect();
      const valueRect = value?.getBoundingClientRect();
      return {
        text: card.textContent?.trim() ?? "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        labelWidth: labelRect ? Math.round(labelRect.width) : null,
        labelScrollWidth: label instanceof HTMLElement ? label.scrollWidth : null,
        valueWidth: valueRect ? Math.round(valueRect.width) : null,
        valueScrollWidth: value instanceof HTMLElement ? value.scrollWidth : null,
        cardScrollWidth: card instanceof HTMLElement ? card.scrollWidth : null,
      };
    });
    // #region agent log
    fetch("http://127.0.0.1:7637/ingest/4f7bb7c6-5696-42f7-857e-af01b8cf01ed", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "016eb9" },
      body: JSON.stringify({
        sessionId: "016eb9",
        runId: "levels-panel-initial",
        hypothesisId: "H1,H2,H3,H4,H5",
        location: "src/features/build/components/LevelsPanel.tsx:layout-effect",
        message: "LevelsPanel active summary metrics",
        data: {
          levelsCount: levels.length,
          activeLevelId,
          root: {
            top: Math.round(rootRect.top),
            left: Math.round(rootRect.left),
            width: Math.round(rootRect.width),
            paddingTop: window.getComputedStyle(root).paddingTop,
          },
          block: blockRect
            ? {
                top: Math.round(blockRect.top),
                previousGap: previousRect ? Math.round(blockRect.top - previousRect.bottom) : null,
                marginTop: block ? window.getComputedStyle(block).marginTop : null,
                paddingTop: block ? window.getComputedStyle(block).paddingTop : null,
                borderTopWidth: block ? window.getComputedStyle(block).borderTopWidth : null,
              }
            : null,
          previousBlock: previousRect
            ? {
                bottom: Math.round(previousRect.bottom),
                height: Math.round(previousRect.height),
              }
            : null,
          previousSection: previousSectionRect
            ? {
                bottom: Math.round(previousSectionRect.bottom),
                height: Math.round(previousSectionRect.height),
                gapToRoot: Math.round(rootRect.top - previousSectionRect.bottom),
                marginBottom: previousSection ? window.getComputedStyle(previousSection).marginBottom : null,
              }
            : null,
          summaryWidth: Math.round(summaryRect.width),
          gridWidth: Math.round(gridRect.width),
          gridScrollWidth: grid.scrollWidth,
          gridTemplateColumns: window.getComputedStyle(grid).gridTemplateColumns,
          cards,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [activeLevelId, levels.length, orderedLevels]);

  const handleAdd = () => {
    const nextHeight = clampLevelHeight(Number(draftHeight) || 3);
    const nextElevation = Number.isFinite(draftElevation) ? draftElevation : 0;
    onAddLevel({
      name: firstDisplayText([draftName], nextLevelName, { allowInternalId: false }),
      elevation_m: nextElevation,
      height_m: nextHeight,
    });
    setDraftElevation(nextElevation + nextHeight);
    setDraftName("");
  };

  return (
    <section ref={rootRef} className="space-y-3">
      {activeLevel ? (
        <div ref={activeSummaryRef} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-control-active rounded-full px-2.5 py-1 text-xs font-semibold">Активный уровень</span>
            <span className="text-sm font-semibold text-[color:var(--text-base)]">
              {getLevelDisplayLabel({ levels: orderedLevels }, activeLevel.id)}
            </span>
          </div>
          <div ref={metricsGridRef} className="grid gap-1.5 text-xs text-[color:var(--text-muted)]">
            <div data-level-metric className="ui-metric flex items-center justify-between gap-3 rounded-[14px] px-3 py-2">
              <p data-level-metric-label className="ui-kicker text-[10px]">Отметка</p>
              <p data-level-metric-value className="min-w-0 text-right font-semibold text-[color:var(--text-base)]">{activeLevel.elevation_m.toFixed(2)} м</p>
            </div>
            <div data-level-metric className="ui-metric flex items-center justify-between gap-3 rounded-[14px] px-3 py-2">
              <p data-level-metric-label className="ui-kicker text-[10px]">Ниже</p>
              <p data-level-metric-value className="min-w-0 text-right font-semibold text-[color:var(--text-base)]">{previousLevel ? getLevelDisplayLabel({ levels: orderedLevels }, previousLevel.id) : "Нет уровня"}</p>
            </div>
            <div data-level-metric className="ui-metric flex items-center justify-between gap-3 rounded-[14px] px-3 py-2">
              <p data-level-metric-label className="ui-kicker text-[10px]">Выше</p>
              <p data-level-metric-value className="min-w-0 text-right font-semibold text-[color:var(--text-base)]">{nextLevel ? getLevelDisplayLabel({ levels: orderedLevels }, nextLevel.id) : "Нет уровня"}</p>
            </div>
          </div>
        </div>
      ) : null}

      {activeLevel && onCopyLevelModel && orderedLevels.length > 1 ? (
        <div className="space-y-1.5">
          <p className="ui-kicker text-[10px]">Скопировать план на уровень</p>
          <div className="flex flex-wrap gap-1.5">
            {orderedLevels
              .filter((level) => level.id !== activeLevelId)
              .map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => onCopyLevelModel(level.id)}
                  className="ui-control rounded-[12px] border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-2.5 py-1 text-xs font-medium text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
                >
                  {getLevelDisplayLabel({ levels: orderedLevels }, level.id)}
                </button>
              ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {orderedLevels.map((level) => {
          const isActive = level.id === activeLevelId;
          const levelLabel = getLevelDisplayLabel({ levels: orderedLevels }, level.id);
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => onSelectLevel(level.id)}
              className={`w-full rounded-[18px] border px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-[color:var(--accent-base)] bg-[color:var(--accent-base)] text-[color:var(--accent-contrast)]"
                  : "border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)]"
              }`}
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <input
                  type="text"
                  value={levelLabel}
                  onChange={(event) => onUpdateLevel(level.id, { name: event.target.value })}
                  onClick={(event) => event.stopPropagation()}
                  className={`w-full bg-transparent ${isActive ? "text-[color:var(--accent-contrast)] placeholder-[color:var(--accent-contrast)]/60" : "text-[color:var(--text-muted)]"}`}
                />
                <span className="ml-2 text-xs">{level.height_m.toFixed(2)} м</span>
              </div>
              <div
                className={`mt-2 grid grid-cols-2 gap-2 text-xs ${isActive ? "text-[color:var(--accent-contrast)]/80" : "text-[color:var(--text-soft)]"}`}
                onClick={(event) => event.stopPropagation()}
              >
                <label className="flex flex-col gap-1">
                  <span>Отм., м</span>
                  <input
                    type="number"
                    value={level.elevation_m}
                    onChange={(event) => onUpdateLevel(level.id, { elevation_m: Number(event.target.value) })}
                    className={`rounded-xl border px-2 py-1 text-xs ${
                      isActive ? "border-[color:var(--accent-contrast)]/20 bg-[color:var(--accent-contrast)]/10 text-[color:var(--accent-contrast)]" : "ui-field text-[color:var(--text-muted)]"
                    }`}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>Высота</span>
                  <input
                    type="number"
                    value={level.height_m}
                    onChange={(event) => onUpdateLevel(level.id, { height_m: clampLevelHeight(Number(event.target.value)) })}
                    className={`rounded-xl border px-2 py-1 text-xs ${
                      isActive ? "border-[color:var(--accent-contrast)]/20 bg-[color:var(--accent-contrast)]/10 text-[color:var(--accent-contrast)]" : "ui-field text-[color:var(--text-muted)]"
                    }`}
                  />
                </label>
              </div>
            </button>
          );
        })}
        {levels.length === 0 ? (
          <p className="text-sm text-[color:var(--text-soft)]">Добавьте уровень, чтобы начать моделирование.</p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        <p className="ui-kicker">Новый уровень</p>
        <input
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          className="ui-field w-full px-3 py-2 text-sm"
          placeholder={nextLevelName}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-[color:var(--text-soft)]">
            Отметка, м
            <input
              type="number"
              value={draftElevation}
              onChange={(event) => setDraftElevation(Number(event.target.value))}
              className="ui-field mt-1 w-full px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs text-[color:var(--text-soft)]">
            Высота, м
            <input
              type="number"
              value={draftHeight}
              onChange={(event) => setDraftHeight(clampLevelHeight(Number(event.target.value)))}
              className="ui-field mt-1 w-full px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="ui-control w-full px-3 py-2 text-sm font-semibold"
        >
          Добавить уровень
        </button>
      </div>
    </section>
  );
}

function clampLevelHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return 3;
  }
  return Math.max(0.5, value);
}

export default LevelsPanel;


