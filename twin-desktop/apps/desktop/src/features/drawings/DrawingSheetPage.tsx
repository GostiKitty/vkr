/**
 * Страница «Чертёжный лист» — обёртка вокруг DrawingSheetSvg.
 *
 * Функции:
 *  - переключение уровней (этажей)
 *  - ввод метаданных (штамп)
 *  - экспорт SVG / PDF (A3 альбомная)
 *  - масштабирование просмотра
 */

import React, { useCallback, useRef, useState, useMemo } from "react";
import { jsPDF } from "jspdf";
import DrawingSheetSvg from "./DrawingSheetSvg";
import type { TitleBlockData } from "./drawingTypes";
import { defaultTitleBlock, SHEET_A3_LANDSCAPE } from "./drawingTypes";
import type { BuildingModel } from "../../entities/geometry/types";
import { useBuildStore } from "../build/build.store";
import { videoDemoHouse } from "../../demo/videoDemoHouse";

// ---------------------------------------------------------------------------
// Вспомогательные утилиты
// ---------------------------------------------------------------------------

function serializeSvg(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  if (!clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  }
  if (!clone.getAttribute("xmlns:xlink")) {
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

function exportSvg(svgEl: SVGSVGElement, filename = "chertezh.svg"): void {
  const svgStr = serializeSvg(svgEl);
  const blob = new Blob(
    [`<?xml version="1.0" encoding="UTF-8"?>\n${svgStr}`],
    { type: "image/svg+xml;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Растеризовать SVG-чертёж и собрать одностраничный PDF в формате A3 альбомная.
 */
async function exportPdf(svgEl: SVGSVGElement, filename = "chertezh.pdf"): Promise<void> {
  const sheet = SHEET_A3_LANDSCAPE;
  // 200 DPI даёт ~3307×2339 px при размере PDF ~3–6 МБ (JPEG q=0.92), читаемый чертёжный текст.
  const dpi = 200;
  const pxPerMm = dpi / 25.4;
  const targetW = Math.round(sheet.widthMm * pxPerMm);
  const targetH = Math.round(sheet.heightMm * pxPerMm);

  const svgStr = serializeSvg(svgEl);
  const svgBlob = new Blob(
    [`<?xml version="1.0" encoding="UTF-8"?>\n${svgStr}`],
    { type: "image/svg+xml;charset=utf-8" }
  );
  const url = URL.createObjectURL(svgBlob);

  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas 2D context unavailable"));
            return;
          }
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(image, 0, 0, targetW, targetH);
          // JPEG-сжатие: чертёжные линии переживают q=0.92, файл существенно меньше PNG.
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: [sheet.widthMm, sheet.heightMm],
            compress: true,
          });
          pdf.addImage(dataUrl, "JPEG", 0, 0, sheet.widthMm, sheet.heightMm, undefined, "FAST");
          pdf.save(filename);
          resolve();
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
      image.onerror = () => reject(new Error("SVG image load failed"));
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Панель метаданных (штамп)
// ---------------------------------------------------------------------------

interface MetaPanelProps {
  data: TitleBlockData;
  onChange: (d: TitleBlockData) => void;
}

function MetaPanel({ data, onChange }: MetaPanelProps) {
  const [open, setOpen] = useState(false);

  const field = (
    label: string,
    key: keyof TitleBlockData
  ) => (
    <label key={key} className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <input
        className="border border-gray-300 rounded px-2 py-1 text-xs font-mono"
        value={data[key]}
        onChange={(e) => onChange({ ...data, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100"
      >
        <span>{open ? "▲" : "▼"}</span>
        <span className="font-medium">Основная надпись (штамп)</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 p-3 text-xs">
          {field("Обозначение проекта", "projectCode")}
          {field("Наименование объекта", "objectName")}
          {field("Наименование листа", "sheetName")}
          {field("Стадия", "stage")}
          {field("Лист №", "sheetNumber")}
          {field("Всего листов", "totalSheets")}
          {field("Масштаб", "scale")}
          {field("Разработал", "developer")}
          {field("Проверил", "checker")}
          {field("Дата", "date")}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Главная страница
// ---------------------------------------------------------------------------

export default function DrawingSheetPage() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [titleData, setTitleData] = useState<TitleBlockData>(() => defaultTitleBlock());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Получить BuildingModel из build-хранилища; если нет стен — показать демо
  const storeModel = useBuildStore((state) => state.model);
  const model: BuildingModel = useMemo(
    () => ((storeModel?.walls?.length ?? 0) > 0 ? storeModel : videoDemoHouse),
    [storeModel]
  );

  const isDemoModel = model === videoDemoHouse;

  // Уровни
  const levels = model.levels ?? [];
  const [activeLevelId, setActiveLevelId] = useState<string | null>(levels[0]?.id ?? null);

  const baseFilename = useMemo(() => {
    const code = titleData.projectCode.replace(/[^a-zA-Zа-яА-Я0-9]/g, "-") || "chertezh";
    const num = titleData.sheetNumber || "1";
    return `${code}-${num}`;
  }, [titleData.projectCode, titleData.sheetNumber]);

  const handleExportSvg = useCallback(() => {
    setExportError(null);
    if (svgRef.current) {
      exportSvg(svgRef.current, `${baseFilename}.svg`);
    }
  }, [baseFilename]);

  const handleExportPdf = useCallback(async () => {
    setExportError(null);
    if (!svgRef.current) return;
    setPdfBusy(true);
    try {
      await exportPdf(svgRef.current, `${baseFilename}.pdf`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Не удалось сформировать PDF");
    } finally {
      setPdfBusy(false);
    }
  }, [baseFilename]);

  // Обновить масштаб (штамп) при изменении в полях метаданных
  // (title data уже содержит scale)

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* ── Тулбар ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap">
        <span className="font-semibold text-sm text-gray-800">Чертёжный лист</span>
        <span className="text-gray-300">|</span>

        {/* Масштаб просмотра */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            className="px-2 py-0.5 text-sm border border-gray-300 rounded hover:bg-gray-50">−</button>
          <span className="text-xs w-12 text-center text-gray-600">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            className="px-2 py-0.5 text-sm border border-gray-300 rounded hover:bg-gray-50">+</button>
          <button onClick={() => setZoom(1)}
            className="px-2 py-0.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-500">
            1:1
          </button>
        </div>

        <span className="text-gray-300">|</span>

        {/* Выбор уровня */}
        {levels.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Уровень:</span>
            <select
              value={activeLevelId ?? ""}
              onChange={(e) => setActiveLevelId(e.target.value || null)}
              className="text-xs border border-gray-300 rounded px-1 py-0.5"
            >
              {levels.map((lv) => (
                <option key={lv.id} value={lv.id}>
                  {lv.name || `Уровень ${lv.elevation_m}м`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Источник модели */}
        {isDemoModel && (
          <span className="text-xs px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded">
            Демо-здание
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {exportError && (
            <span className="text-xs px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 rounded">
              {exportError}
            </span>
          )}
          {/* Экспорт SVG */}
          <button
            onClick={handleExportSvg}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-800 rounded hover:bg-gray-50 active:bg-gray-100"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 12l-4-4h2.5V3h3v5H12L8 12zM3 13h10v1.5H3z"/>
            </svg>
            Экспорт SVG
          </button>
          {/* Экспорт PDF */}
          <button
            onClick={handleExportPdf}
            disabled={pdfBusy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 text-white rounded hover:bg-gray-700 active:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 12l-4-4h2.5V3h3v5H12L8 12zM3 13h10v1.5H3z"/>
            </svg>
            {pdfBusy ? "PDF…" : "Экспорт PDF"}
          </button>
        </div>
      </div>

      {/* Метаданные (штамп) */}
      <MetaPanel data={titleData} onChange={setTitleData} />

      {/* ── Область просмотра ── */}
      <div
        className="flex-1 min-h-0 overflow-auto p-4"
        style={{ background: "#6b6b6b" }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            width: "fit-content",
            margin: "0 auto",
          }}
        >
          {/* Тень листа */}
          <div
            style={{
              boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
              display: "inline-block",
              background: "white",
              // A3 420×297мм → при 96dpi: 1587×1122px
              // Показываем в px, масштаб регулируется через zoom
              width: "1587px",
              height: "1122px",
            }}
          >
            <DrawingSheetSvg
              ref={svgRef}
              model={model}
              titleData={titleData}
              levelId={activeLevelId}
            />
          </div>
        </div>
      </div>

      {/* Подсказка внизу */}
      <div className="px-3 py-1.5 bg-white border-t border-gray-200 flex-shrink-0">
        <p className="text-xs text-gray-400">
          ГОСТ 2.104-2006 · ГОСТ 2.301-68 · СПДС · А3 альбомная · лист строится по данным текущей модели здания
        </p>
      </div>
    </div>
  );
}
