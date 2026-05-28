export type ProjectDocumentViewMode = "report" | "reference";

interface ProjectDocumentToolbarProps {
  viewMode: ProjectDocumentViewMode;
  onViewModeChange: (mode: ProjectDocumentViewMode) => void;
  onGenerate: () => void;
  onPrint: () => void;
  onExportPdf: () => void;
  pdfBusy: boolean;
  pdfNote: string | null;
}

export function ProjectDocumentToolbar({
  viewMode,
  onViewModeChange,
  onGenerate,
  onPrint,
  onExportPdf,
  pdfBusy,
  pdfNote,
}: ProjectDocumentToolbarProps) {
  return (
    <div className="project-document-toolbar document-print-hidden">
      <div className="project-document-toolbar__switch" role="tablist" aria-label="Режим отображения раздела">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "report"}
          onClick={() => onViewModeChange("report")}
          className={viewMode === "report" ? "ui-btn-primary px-3 py-2 text-sm" : "ui-btn-secondary px-3 py-2 text-sm"}
        >
          Расчет тепловой защиты
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === "reference"}
          onClick={() => onViewModeChange("reference")}
          className={viewMode === "reference" ? "ui-btn-primary px-3 py-2 text-sm" : "ui-btn-secondary px-3 py-2 text-sm"}
        >
          Справка ПП № 87
        </button>
      </div>

      <div className="project-document-toolbar__actions">
        {viewMode === "report" ? (
          <>
            <button type="button" onClick={onGenerate} className="ui-btn-primary px-4 py-2 text-sm">
              Сформировать документ
            </button>
            <button type="button" onClick={onPrint} className="ui-btn-secondary px-4 py-2 text-sm">
              Печать
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={pdfBusy}
              className="ui-btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pdfBusy ? "Экспорт PDF..." : "Сохранить в PDF"}
            </button>
          </>
        ) : (
          <button type="button" onClick={onPrint} className="ui-btn-secondary px-4 py-2 text-sm">
            Печать
          </button>
        )}
        {pdfNote ? <span className="project-document-toolbar__note">{pdfNote}</span> : null}
      </div>
    </div>
  );
}

export default ProjectDocumentToolbar;
