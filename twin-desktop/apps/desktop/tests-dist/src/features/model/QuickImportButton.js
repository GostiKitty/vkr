import React, { useCallback, useRef } from "react";
import { notifyError, notifyInfo } from "../../entities/notifications/notification.store";
import { useProjectStore } from "../../entities/project/project.store";
import { useModelImport, describeImportError } from "./useModelImport";
import { deriveProjectName } from "./model.utils";
import { probeEngineHealth } from "../../entities/settings/engine.health";
import { useEngineSettingsStore } from "../../entities/settings/engine.store";
import { navigate } from "../../app/router";
const ACCEPT_TYPES = ".ifc,.glb,.gltf,.obj,.rvt";
export function QuickImportButton({ variant }) {
    const inputRef = useRef(null);
    const { importModel, isLoading, progress } = useModelImport();
    const setProjectId = useProjectStore((state) => state.setProjectId);
    const engineBase = useEngineSettingsStore((state) => state.baseUrl);
    const resetInput = () => {
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };
    const handlePick = useCallback(() => {
        inputRef.current?.click();
    }, []);
    const handleChange = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        resetInput();
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (extension === "rvt") {
            notifyError("Revit (.rvt) �������� �� ��������������. ������������� � IFC � ��������� ���� .ifc.");
            return;
        }
        if (extension !== "ifc") {
            notifyInfo("������ ���� �� ��������������. ������������� IFC ��� ��������� ����������.");
            return;
        }
        const engineOnline = await probeEngineHealth();
        if (!engineOnline) {
            const base = engineBase || "http://127.0.0.1:8010";
            notifyError(`��������� ����������. ���������, ��� ������ �� ������ ${base} ������� � �������� /health ��������.\n` +
                "1) ��������� backend (uvicorn main:app --reload).\n2) ��������� URL � ������� ����������.\n3) ��������� ������.");
            return;
        }
        try {
            const data = await importModel(file, { projectName: deriveProjectName(file.name) });
            setProjectId(data.project_id, "engine");
            notifyInfo(`������ ${data.project_id} ������������. �������� Twin Studio�`);
            navigate("/");
        }
        catch (error) {
            const friendly = describeImportError(error);
            notifyError(friendly);
        }
    }, [engineBase, importModel, setProjectId]);
    const label = isLoading ? `������ ${Math.round(progress * 100)}%` : "������ ������";
    const buttonClass = variant === "topbar"
        ? `rounded-full border px-4 py-1.5 text-sm font-semibold transition ${isLoading ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"}`
        : `rounded-2xl px-5 py-2 text-sm font-semibold transition ${isLoading ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white shadow hover:bg-slate-800"}`;
    return (<div className={variant === "topbar" ? "inline-flex" : "flex justify-end"}>
      <input ref={inputRef} type="file" accept={ACCEPT_TYPES} className="hidden" onChange={handleChange}/>
      <button type="button" onClick={handlePick} disabled={isLoading} className={buttonClass}>
        {label}
      </button>
    </div>);
}
export default QuickImportButton;
