import React, { useCallback, useRef } from "react";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
import { useProjectStore } from "../../entities/project/project.store";
import { useModelImport, describeImportError } from "./useModelImport";
import { deriveProjectName } from "./model.utils";
import { probeEngineHealth } from "../../entities/settings/engine.health";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { navigate } from "../../app/router";

const ACCEPT_TYPES = ".ifc,.glb,.gltf,.obj,.rvt";

type QuickImportVariant = "topbar" | "geometry";

interface QuickImportButtonProps {
  variant: QuickImportVariant;
}

export function QuickImportButton({ variant }: QuickImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { importModel, isLoading, progress } = useModelImport();
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const engineBase = useEngineSettingsStore((state) => state.baseUrl);
  const normalizedBase = engineBase.trim();
  const engineConfigured = normalizedBase.length > 0;

  const resetInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      resetInput();
      if (!engineConfigured) {
        notifyError("Движок не настроен. Откройте «Настройки» и задайте адрес API.");
        return;
      }
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (extension === "rvt") {
        notifyError("Revit (.rvt) напрямую не поддерживается. Экспортируйте в IFC и загрузите файл .ifc.");
        return;
      }
      if (extension !== "ifc") {
        notifyInfo("Формат пока не поддерживается. Экспортируйте IFC или ожидайте обновления.");
        return;
      }
      const engineOnline = await probeEngineHealth();
      if (!engineOnline) {
        const base = normalizedBase || "http://127.0.0.1:8010";
        notifyError(
          `Двигатель недоступен. Убедитесь, что сервис по адресу ${base} запущен и эндпоинт /health отвечает.\n` +
            "1) Запустите backend (uvicorn main:app --reload).\n2) Проверьте URL в разделе «Настройки».\n3) Повторите импорт."
        );
        return;
      }
      try {
        const data = await importModel(file, { projectName: deriveProjectName(file.name) });
        setProjectId(data.project_id, "engine");
        notifyInfo(`Проект ${data.project_id} импортирован. Загружаю Twin Studio…`);
        navigate("/");
      } catch (error) {
        const friendly = describeImportError(error);
        notifyError(friendly);
      }
    },
    [engineConfigured, importModel, normalizedBase, setProjectId]
  );

  const label = isLoading ? `Импорт… ${Math.round(progress * 100)}%` : "Импорт модели";
  const buttonClass =
    variant === "topbar"
      ? `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
          isLoading ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
        }`
      : `rounded-2xl px-5 py-2 text-sm font-semibold transition ${
          isLoading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white shadow hover:bg-slate-800"
        }`;

  return (
    <div className={variant === "topbar" ? "inline-flex" : "flex justify-end"}>
      <input ref={inputRef} type="file" accept={ACCEPT_TYPES} className="hidden" onChange={handleChange} />
      <button
        type="button"
        onClick={handlePick}
        disabled={isLoading || !engineConfigured}
        className={buttonClass}
        title={engineConfigured ? undefined : "Движок не настроен"}
      >
        {label}
      </button>
    </div>
  );
}

export default QuickImportButton;
