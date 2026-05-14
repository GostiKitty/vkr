import React, { useCallback, useMemo, useRef, useState } from "react";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
import { useProjectStore } from "../../entities/project/project.store";
import { useModelImport, describeImportError, MODEL_IMPORT_HISTORY_LIMIT } from "./useModelImport";
import { deriveProjectName } from "./model.utils";
import { navigate } from "../../app/router";
import Tooltip from "../../shared/ui/Tooltip";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { probeEngineHealth } from "../../entities/settings/engine.health";
const MAX_FILE_SIZE_MB = 200;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const HISTORY_LIMIT = MODEL_IMPORT_HISTORY_LIMIT;
const statusTheme = {
    pending: {
        badge: "bg-amber-100 text-amber-800",
        text: "В обработке",
        description: "Ожидаем ответ от движка",
    },
    success: {
        badge: "bg-emerald-100 text-emerald-700",
        text: "Готово",
        description: "Проект сохранён",
    },
    error: {
        badge: "bg-red-100 text-red-700",
        text: "Ошибка",
        description: "Подробности в сообщении",
    },
};
function formatBytes(bytes) {
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
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [projectName, setProjectName] = useState("");
    const [validationError, setValidationError] = useState(null);
    const [uploadingFileName, setUploadingFileName] = useState(null);
    const [debugOpen, setDebugOpen] = useState(false);
    const { importModel, isLoading, progress, error, result, history, clearError, lastEndpoint, debugInfo } = useModelImport();
    const setProjectId = useProjectStore((state) => state.setProjectId);
    const engineBase = useEngineSettingsStore((state) => state.baseUrl);
    const engineConfigured = Boolean(engineBase);
    const blocked = !engineConfigured;
    const combinedError = validationError ?? error;
    const progressPercent = Math.min(100, Math.max(0, Math.round(progress * 100)));
    const handleFileChange = useCallback((event) => {
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
    }, [clearError]);
    const handleImport = useCallback(async () => {
        if (!engineConfigured) {
            notifyError("Укажите URL двигателя в разделе «Настройки», чтобы импортировать IFC.");
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
            notifyError(`Двигатель недоступен. Убедитесь, что сервис по адресу ${base} запущен и эндпоинт /health отвечает.\n` +
                "1) Запустите backend (uvicorn main:app --reload).\n2) Проверьте URL в разделе «Настройки».\n3) Повторите импорт.");
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
        }
        catch (err) {
            const friendly = describeImportError(err);
            notifyError(friendly);
        }
        finally {
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
    return (<section className="space-y-6 rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-sm">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Импорт IFC</p>
        <h2 className="text-3xl font-semibold text-slate-900">Подключение цифрового двойника</h2>
        <p className="text-sm text-slate-500">
          Загрузите IFC-файл или перетащите его сюда. 
        </p>
        {!engineConfigured && (<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <span>Движок не настроен. Укажите URL в разделе «Настройки», чтобы включить импорт IFC.</span>
            <button type="button" onClick={() => navigate("/settings")} className="rounded-full border border-red-300 px-4 py-1 text-xs font-semibold text-red-700 hover:border-red-400">
              Открыть настройки
            </button>
          </div>)}
      </header>

      <div className="flex justify-end">
        <button type="button" onClick={() => setDebugOpen(true)} disabled={!debugInfo} className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${debugInfo
            ? "border-slate-300 bg-white text-slate-600 hover:border-slate-500"
            : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}>
          Отладка запроса
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-slate-50/60 p-5 shadow-inner">
          <label className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-5 text-sm text-slate-600 transition hover:border-slate-400">
            <span className="text-base font-semibold text-slate-900">Файл IFC</span>
            <input ref={fileInputRef} type="file" accept=".ifc" onChange={handleFileChange} disabled={isLoading || blocked} className="text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-xl file:border file:border-slate-200 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 file:transition file:hover:border-slate-400"/>
            <span className="text-xs text-slate-500">
              Максимальный размер {MAX_FILE_SIZE_MB} МБ 
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Название проекта
            <input type="text" value={projectName} placeholder="Например, Бизнес-центр Север" onChange={(event) => setProjectName(event.target.value)} disabled={isLoading} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-base text-slate-900 shadow-inner transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100"/>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-600">
            <p className={combinedError ? "text-red-600" : "text-slate-600"}>{helperText}</p>
            {uploadingFileName && (<p className="mt-1 text-xs text-slate-500">
                Отправляю: {uploadingFileName} ({progressPercent}%)
              </p>)}
            {(isLoading || progress > 0) && (<div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-900 transition-all duration-200" style={{ width: `${progressPercent}%` }}/>
              </div>)}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tooltip className="inline-flex" title="Импорт IFC" description="Загружает файл IFC через multipart/form-data (поле file) и пересчитывает площади/объёмы помещений." details={[
            "Вход: .ifc, до 200 МБ",
            "Поле формы: file (filename обязателен)",
            "Выход: project_id, spaces_count",
        ]} linkedFormulaIds={["geom_polygon_area", "geom_volume"]}>
              <button type="button" onClick={handleImport} disabled={disabled} className={`rounded-2xl px-6 py-3 text-base font-semibold ${disabled
            ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-slate-900 text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800"}`}>
                {isLoading ? "Загружаю…" : "Импортировать IFC"}
              </button>
            </Tooltip>
            <button type="button" disabled={!file || isLoading} onClick={() => {
            setFile(null);
            setProjectName("");
            setValidationError(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }} className="rounded-2xl border border-slate-300 px-5 py-3 text-base font-semibold text-slate-600 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50">
              Сбросить выбор
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Последний результат</h3>
            {result ? (<div className="mt-3 space-y-2 text-base text-slate-700">
                <p>
                  <span className="text-slate-500">ID проекта:</span>{" "}
                  <span className="font-semibold text-slate-900">{result.project_id}</span>
                </p>
                <p>
                  <span className="text-slate-500">Помещений:</span>{" "}
                  <span className="font-semibold text-slate-900">{result.spaces_count}</span>
                </p>
                <p>
                  <span className="text-slate-500">Эндпоинт:</span>{" "}
                  <span className="font-semibold text-slate-900">{lastEndpoint ?? "—"}</span>
                </p>
                <p className="text-sm text-slate-500">ID автоматически сохранён и доступен в верхней панели.</p>
              </div>) : (<p className="mt-3 text-sm text-slate-500">Загрузите IFC, чтобы увидеть сводку по проекту.</p>)}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white/90 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">История импортов</h3>
                <p className="text-xs text-slate-400">Последние {HISTORY_LIMIT} попыток</p>
              </div>
              {latestHistory.length > 0 && (<button type="button" onClick={() => {
                setValidationError(null);
                clearError();
            }} className="text-xs font-semibold text-slate-500 underline hover:text-slate-700">
                  Очистить ошибки
                </button>)}
            </div>
            {latestHistory.length === 0 ? (<p className="mt-3 text-sm text-slate-500">Здесь появятся отметки о загрузках и ошибках.</p>) : (<ul className="mt-4 space-y-3">
                {latestHistory.map((entry) => {
                const theme = statusTheme[entry.status];
                return (<li key={entry.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{entry.fileName}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(entry.startedAt).toLocaleTimeString()} · {formatBytes(entry.fileSize)}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${theme.badge}`}>{theme.text}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {entry.status === "success" && entry.projectId
                        ? `Проект ${entry.projectId}, помещений: ${entry.spacesCount ?? "—"}`
                        : entry.message ?? theme.description}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Эндпоинт: <span className="font-semibold text-slate-600">{entry.endpoint ?? "—"}</span>
                      </p>
                    </li>);
            })}
              </ul>)}
          </div>
        </div>
      </div>
      <ModelDebugDrawer open={debugOpen} onClose={() => setDebugOpen(false)} info={debugInfo}/>
    </section>);
}
function ModelDebugDrawer({ open, onClose, info }) {
    if (!open) {
        return null;
    }
    return (<div className="fixed inset-0 z-40 flex items-end bg-black/30" onClick={onClose}>
      <div className="max-h-[70%] w-full rounded-t-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Отладка запроса</p>
            <p className="text-xs text-slate-400">Последняя попытка импорта IFC</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-4 py-1 text-xs font-semibold text-slate-600 hover:border-slate-400">
            Закрыть
          </button>
        </div>
        {info ? (<div className="space-y-3 px-6 py-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span>{new Date(info.timestamp).toLocaleString()}</span>
              <span>Статус: {info.status ?? "—"}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Запрос</p>
              <p className="font-mono text-sm text-slate-900">
                {info.method} {info.url}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Заголовки</p>
              <pre className="mt-1 max-h-32 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                {JSON.stringify(info.headers, null, 2)}
              </pre>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Ответ</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded-xl bg-slate-900/90 p-3 text-xs text-slate-100">
                {info.responseSnippet ?? "—"}
              </pre>
            </div>
            {info.error && <p className="text-xs font-semibold text-rose-600">Ошибка: {info.error}</p>}
          </div>) : (<p className="px-6 py-4 text-sm text-slate-500">Данные отладчика появятся после первой попытки импорта.</p>)}
      </div>
    </div>);
}
export { useModelImport };
export default ModelPage;
