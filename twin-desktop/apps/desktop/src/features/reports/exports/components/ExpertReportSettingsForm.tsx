import { useMemo } from "react";
import {
  EXPERTISE_INPUT_SECTIONS,
  useExpertiseInputsStore,
  type ExpertiseInputKey,
  type ExpertiseReportInputs,
} from "../store/expertiseInputs.store";
import type { ExpertiseContext } from "../data/buildExpertiseContext";

interface ExpertReportSettingsFormProps {
  projectKey: string;
  expertise: ExpertiseContext;
  onClose: () => void;
}

export function ExpertReportSettingsForm({
  projectKey,
  expertise,
  onClose,
}: ExpertReportSettingsFormProps) {
  const inputs = useExpertiseInputsStore((state) => state.getInputs(projectKey));
  const setField = useExpertiseInputsStore((state) => state.setField);
  const resetProject = useExpertiseInputsStore((state) => state.resetProject);

  const updateField = <K extends ExpertiseInputKey>(
    key: K,
    value: ExpertiseReportInputs[K]
  ) => {
    setField(projectKey, key, value);
  };

  const visibleSections = useMemo(() => {
    return EXPERTISE_INPUT_SECTIONS.map((section) => ({
      ...section,
      fields: section.fields.filter((field) => {
        if (field.key === "solarGainsManualValue") {
          return inputs.solarGainsMode === "manual";
        }
        return true;
      }),
    }));
  }, [inputs.solarGainsMode]);

  return (
    <aside
      className="expertise-inputs-panel ui-drawer-panel fixed inset-y-0 right-0 z-40 w-full max-w-3xl overflow-y-auto border-l border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)]/98 text-[color:var(--text-base)] shadow-[var(--shadow-overlay)] backdrop-blur-xl"
      data-testid="expert-report-settings-form"
    >
      <div className="flex items-center justify-between border-b border-[color:var(--border-soft)] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Исходные данные для выпуска документов</h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Поля из этой формы имеют приоритет над demo-defaults и используются при
            формировании всех 5 документов.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => resetProject(projectKey)}
            className="ui-btn-secondary px-3 py-2 text-sm"
          >
            Сбросить
          </button>
          <button type="button" onClick={onClose} className="ui-btn-primary px-3 py-2 text-sm">
            Закрыть
          </button>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5">
        <section className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[color:var(--text-soft)]">
                Готовность комплекта
              </p>
              <p className="text-lg font-semibold">
                {expertise.readiness.percent}% · заполнено {expertise.readiness.filledTotal} из{" "}
                {expertise.readiness.trackedTotal}
              </p>
            </div>
            <div className="text-sm text-[color:var(--text-muted)]">
              Обязательные: {expertise.readiness.requiredFilled}/{expertise.readiness.requiredTotal}
            </div>
            <div className="text-sm text-[color:var(--text-muted)]">
              Рекомендуемые: {expertise.readiness.recommendedFilled}/
              {expertise.readiness.recommendedTotal}
            </div>
          </div>
        </section>

        {visibleSections.map((section) => (
          <section
            key={section.id}
            className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-4"
          >
            <h3 className="text-base font-semibold">{section.title}</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {section.fields.map((field) => {
                const resolved = expertise.fieldMap[field.key];
                const fieldValue = inputs[field.key];
                const fieldStatus = resolved?.statusLabel ?? "не заполнено";
                const sourceLabel = resolved?.sourceLabel ?? "не заполнено";
                const spanFull = field.kind === "textarea";
                return (
                  <label
                    key={field.key}
                    className={`${spanFull ? "md:col-span-2" : ""} flex flex-col gap-2`}
                  >
                    <span className="text-sm font-medium">{field.label}</span>
                    {field.kind === "textarea" ? (
                      <textarea
                        value={typeof fieldValue === "string" ? fieldValue : ""}
                        onChange={(event) => updateField(field.key, event.target.value as ExpertiseReportInputs[typeof field.key])}
                        rows={4}
                        placeholder={field.placeholder ?? ""}
                        className="min-h-[7rem] rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[color:var(--accent-base)]"
                      />
                    ) : field.kind === "select" ? (
                      <select
                        value={String(fieldValue)}
                        onChange={(event) => updateField(field.key, event.target.value as ExpertiseReportInputs[typeof field.key])}
                        className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[color:var(--accent-base)]"
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.kind === "toggle" ? (
                      <select
                        value={Boolean(fieldValue) ? "yes" : "no"}
                        onChange={(event) => updateField(field.key, (event.target.value === "yes") as ExpertiseReportInputs[typeof field.key])}
                        className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[color:var(--accent-base)]"
                      >
                        <option value="yes">да</option>
                        <option value="no">нет</option>
                      </select>
                    ) : (
                      <input
                        value={typeof fieldValue === "string" ? fieldValue : ""}
                        onChange={(event) => updateField(field.key, event.target.value as ExpertiseReportInputs[typeof field.key])}
                        placeholder={field.placeholder ?? ""}
                        className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[color:var(--accent-base)]"
                      />
                    )}
                    <span className="text-xs text-[color:var(--text-soft)]">
                      Статус: {fieldStatus}. Источник: {sourceLabel}.
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

export default ExpertReportSettingsForm;
