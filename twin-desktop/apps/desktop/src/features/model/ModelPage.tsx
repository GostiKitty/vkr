import React, { useCallback, useMemo, useRef, useState } from "react";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
import { useProjectStore } from "../../entities/project/project.store";
import type { ImportAttempt } from "./model.types";
import { useModelImport, describeImportError, MODEL_IMPORT_HISTORY_LIMIT } from "./useModelImport";
import type { ImportRequestDiagnostics } from "./model.api";
import { deriveProjectName } from "./model.utils";
import { navigate } from "../../app/router";
import Tooltip from "../../shared/ui/Tooltip";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { probeEngineHealth } from "../../entities/settings/engine.health";

const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const HISTORY_LIMIT = MODEL_IMPORT_HISTORY_LIMIT;

const statusTheme: Record<
  ImportAttempt["status"],
  { badge: string; text: string; description: string }
> = {
  pending: {
    badge: "bg-[color:var(--warning-bg)] text-[color:var(--warning-fg)] ring-1 ring-[color:var(--warning-border)]",
    text: "В обработке",
    description: "Ожидаем ответ",
  },
  success: {
    badge: "bg-[color:var(--success-bg)] text-[color:var(--success-fg)] ring-1 ring-[color:var(--success-border)]",
    text: "Готово",
    description: "Проект сохранён",
  },
  error: {
    badge: "bg-[color:var(--danger-bg)] text-[color:var(--danger-fg)] ring-1 ring-[color:var(--danger-border)]",
    text: "Ошибка",
    description: "Подробности в сообщении",
  },
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${mb.toFixed(1)} МБ`;
}

export function ModelPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  const { importModel, isLoading, progress, error, result, history, clearError, lastEndpoint, debugInfo } =
    useModelImport();
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const engineBase = useEngineSettingsStore((state) => state.baseUrl);
  const engineConfigured = Boolean(engineBase);
  const blocked = !engineConfigured;

  const combinedError = validationError ?? error;
  const progressPercent = Math.min(100, Math.max(0, Math.round(progress * 100)));

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] ?? null;
      if (!nextFile) {
        setFile(null);
        setProjectName("");
        setValidationError(null);
        clearError();
        return;
      }

      const extension = nextFile.name.split(".").pop()?.toLowerCase() ?? "";
      if (extension !== "ifc") {
        setFile(null);
        setProjectName("");
        setValidationError("Поддерживаются только файлы с расширением .ifc");
        clearError();
        return;
      }

      if (nextFile.size > MAX_FILE_SIZE_BYTES) {
        setFile(null);
        setProjectName("");
        setValidationError(`Файл превышает лимит ${MAX_FILE_SIZE_MB} МБ`);
        clearError();
        return;
      }

      setValidationError(null);
      clearError();
      setFile(nextFile);
      setProjectName((prev) => prev || deriveProjectName(nextFile.name));
    },
    [clearError]
  );

  const handleImport = useCallback(async () => {
    if (!engineConfigured) {
      notifyError("Укажите URL движка в разделе «Настройки», чтобы импортировать IFC.");
      return;
    }
    if (!file || isLoading) {
      return;
    }

    setUploadingFileName(file.name);
    const desiredName = projectName.trim() || deriveProjectName(file.name);

    const engineOnline = await probeEngineHealth();
    if (!engineOnline) {
      const base = engineBase || "http://127.0.0.1:8010";
      notifyError(
        `Движок недоступен. Убедитесь, что сервис по адресу ${base} запущен и эндпоинт /health отвечает.\n` +
          "1) Запустите backend (uvicorn main:app --reload).\n2) Проверьте URL в разделе «Настройки».\n3) Повторите импорт."
      );
      setUploadingFileName(null);
      return;
    }

    try {
      const data = await importModel(file, { projectName: desiredName });
      setProjectId(data.project_id, "engine");
      notifyInfo(`Проект ${data.project_id} выбран. Помещений: ${data.spaces_count}.`);
      navigate("/");
      setFile(null);
      setProjectName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      const friendly = describeImportError(err);
      notifyError(friendly);
    } finally {
      setUploadingFileName(null);
    }
  }, [engineBase, engineConfigured, file, importModel, isLoading, navigate, projectName, setProjectId]);

  const disabled = !file || isLoading || blocked;

  const latestHistory = history.slice(0, HISTORY_LIMIT);

  const helperText = useMemo(() => {
    if (!engineConfigured) {
      return "Базовый URL движка не настроен. Откройте раздел «Настройки» и укажите адрес API.";
    }
    if (combinedError) {
      return combinedError;
    }
    if (file) {
      return `Готово к загрузке: ${file.name} (${formatBytes(file.size)})`;
    }
    return `Поддерживаются IFC до ${MAX_FILE_SIZE_MB} МБ. История хранит последние ${HISTORY_LIMIT} попыток.`;
  }, [combinedError, engineConfigured, file]);

  return (
    <section className="ui-panel space-y-6 p-6 sm:p-7">
      <header className="space-y-2">
        <p className="ui-kicker">Импорт IFC</p>
        <h2 className="text-3xl font-semibold tracking-tight text-[color:var(--text-base)]">Подключение цифрового двойника</h2>
        <p className="text-sm text-[color:var(--text-muted)]">
          Загрузите IFC-файл или перетащите его сюда.
        </p>
        {!engineConfigured && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] p-4 text-sm text-[color:var(--danger-fg)]">
            <span>Движок не настроен. Укажите URL в разделе «Настройки», чтобы включить импорт IFC.</span>
            <button
              type="button"
              onClick={() => navigate("/settings")}
              className="ui-btn-secondary shrink-0 border-[color:var(--danger-border)] px-4 py-1 text-xs"
            >
              Открыть настройки
            </button>
          </div>
        )}
      </header>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDebugOpen(true)}
          disabled={!debugInfo}
          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
            debugInfo
              ? "ui-control text-[color:var(--text-muted)]"
              : "cursor-not-allowed border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] text-[color:var(--text-soft)]"
          }`}
        >
          Отладка запроса
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="ui-section space-y-4 shadow-inner">
          <label className="flex flex-col gap-2 rounded-2xl border border-dashed border-[color:var(--border-base)] bg-[color:var(--surface-base)] p-5 text-sm text-[color:var(--text-muted)] transition hover:border-[color:var(--accent-base)]/35">
            <span className="text-base font-semibold text-[color:var(--text-base)]">Файл IFC</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ifc"
              onChange={handleFileChange}
              disabled={isLoading || blocked}
              className="text-sm text-[color:var(--text-muted)] file:mr-3 file:cursor-pointer file:rounded-xl file:border file:border-[color:var(--border-soft)] file:bg-[color:var(--surface-elevated)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[color:var(--text-base)] file:transition file:hover:border-[color:var(--accent-base)]/40"
            />
            <span className="text-xs text-[color:var(--text-soft)]">
              Максимальный размер {MAX_FILE_SIZE_MB} МБ
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-[color:var(--text-muted)]">
            Название проекта
            <input
              type="text"
              value={projectName}
              placeholder="Например, Бизнес-центр Север"
              onChange={(event) => setProjectName(event.target.value)}
              disabled={isLoading}
              className="ui-field px-4 py-2 text-base shadow-inner disabled:opacity-60"
            />
          </label>

          <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] p-4 text-sm">
            <p className={combinedError ? "text-[color:var(--danger-fg)]" : "text-[color:var(--text-muted)]"}>{helperText}</p>
            {uploadingFileName && (
              <p className="mt-1 text-xs text-[color:var(--text-soft)]">
                Отправляю: {uploadingFileName} ({progressPercent}%)
              </p>
            )}
            {(isLoading || progress > 0) && (
              <div className="mt-3 h-2 rounded-full bg-[color:var(--surface-strong)]">
                <div
                  className="h-full rounded-full bg-[color:var(--accent-base)] transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tooltip
              className="inline-flex"
              title="Импорт IFC"
              description="Загружает файл IFC через multipart/form-data (поле file) и пересчитывает площади/объёмы помещений."
              details={[
                "Вход: .ifc, до 200 МБ",
                "Поле формы: file (filename обязателен)",
                "Выход: project_id, spaces_count",
              ]}
              linkedFormulaIds={["geom_polygon_area", "geom_volume"]}
            >
              <button
                type="button"
                onClick={handleImport}
                disabled={disabled}
                className={disabled ? "cursor-not-allowed rounded-2xl px-6 py-3 text-base font-semibold opacity-45 ui-btn-secondary" : "ui-btn-primary rounded-2xl px-6 py-3 text-base"}
              >
                {isLoading ? "Загружаю…" : "Импортировать IFC"}
              </button>
            </Tooltip>
            <button
              type="button"
              disabled={!file || isLoading}
              onClick={() => {
                setFile(null);
                setProjectName("");
                setValidationError(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="ui-btn-secondary rounded-2xl px-5 py-3 text-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              Сбросить выбор
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="ui-panel-muted p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Последний результат</h3>
            {result ? (
              <div className="mt-3 space-y-2 text-base text-[color:var(--text-muted)]">
                <p>
                  <span className="text-[color:var(--text-soft)]">Идентификатор проекта:</span>{" "}
                  <span className="font-mono font-semibold text-[color:var(--text-base)]">{result.project_id}</span>
                </p>
                <p>
                  <span className="text-[color:var(--text-soft)]">Помещений:</span>{" "}
                  <span className="font-semibold text-[color:var(--text-base)]">{result.spaces_count}</span>
                </p>
                <p>
                  <span className="text-[color:var(--text-soft)]">Эндпоинт:</span>{" "}
                  <span className="font-mono text-sm font-semibold text-[color:var(--text-base)]">{lastEndpoint ?? "—"}</span>
                </p>
                <p className="text-sm text-[color:var(--text-soft)]">Идентификатор сохранён и отображается в верхней панели.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--text-soft)]">Загрузите IFC, чтобы увидеть сводку по проекту.</p>
            )}
          </div>

          <div className="ui-panel-muted p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">История импортов</h3>
                <p className="text-xs text-[color:var(--text-soft)]">Последние {HISTORY_LIMIT} попыток</p>
              </div>
              {latestHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    clearError();
                  }}
                  className="text-xs font-semibold text-[color:var(--accent-base)] underline decoration-[color:var(--accent-muted)] underline-offset-2 hover:opacity-90"
                >
                  Очистить ошибки
                </button>
              )}
            </div>
            {latestHistory.length === 0 ? (
              <p className="mt-3 text-sm text-[color:var(--text-soft)]">Здесь появятся отметки о загрузках и ошибках.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {latestHistory.map((entry) => {
                  const theme = statusTheme[entry.status];
                  return (
                    <li key={entry.id} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-base)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--text-base)]">{entry.fileName}</p>
                          <p className="text-xs text-[color:var(--text-soft)]">
                            {new Date(entry.startedAt).toLocaleTimeString()} · {formatBytes(entry.fileSize)}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${theme.badge}`}>{theme.text}</span>
                      </div>
                      <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                        {entry.status === "success" && entry.projectId
                          ? `Проект ${entry.projectId}, помещений: ${entry.spacesCount ?? "—"}`
                          : entry.message ?? theme.description}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--text-soft)]">
                        Эндпоинт: <span className="font-mono font-semibold text-[color:var(--text-muted)]">{entry.endpoint ?? "—"}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      <ModelDebugDrawer open={debugOpen} onClose={() => setDebugOpen(false)} info={debugInfo} />
    </section>
  );
}

function ModelDebugDrawer({ open, onClose, info }: { open: boolean; onClose: () => void; info: ImportRequestDiagnostics | null }) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="max-h-[70%] w-full rounded-t-3xl border border-[color:var(--border-soft)] bg-[color:var(--surface-elevated)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border-soft)] px-6 py-4">
          <div>
            <p className="ui-kicker">Отладка запроса</p>
            <p className="text-xs text-[color:var(--text-soft)]">Последняя попытка импорта IFC</p>
          </div>
          <button type="button" onClick={onClose} className="ui-control rounded-full px-4 py-1 text-xs font-semibold">
            Закрыть
          </button>
        </div>
        {info ? (
          <div className="space-y-3 px-6 py-4 text-sm text-[color:var(--text-muted)]">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[color:var(--text-soft)]">
              <span>{new Date(info.timestamp).toLocaleString()}</span>
              <span>Статус: {info.status ?? "—"}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">Запрос</p>
              <p className="font-mono text-sm text-[color:var(--text-base)]">
                {info.method} {info.url}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">Заголовки</p>
              <pre className="mt-1 max-h-32 overflow-auto rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--surface-muted)] p-3 text-xs">
                {JSON.stringify(info.headers, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[color:var(--text-soft)]">Ответ</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded-xl border border-[color:var(--border-base)] bg-[color:var(--surface-subtle)] p-3 font-mono text-xs text-[color:var(--text-base)]">
                {info.responseSnippet ?? "—"}
              </pre>
            </div>
            {info.error && <p className="text-xs font-semibold text-[color:var(--danger-fg)]">Ошибка: {info.error}</p>}
          </div>
        ) : (
          <p className="px-6 py-4 text-sm text-[color:var(--text-soft)]">Данные отладчика появятся после первой попытки импорта.</p>
        )}
      </div>
    </div>
  );
}

export { useModelImport };
export default ModelPage;
