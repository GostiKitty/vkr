/**
 * Архитектурный чертёжный лист (ГОСТ 2.301, ГОСТ 2.104-2006, СПДС).
 *
 * viewBox = "0 0 420 297" — А3 альбомная, единицы мм.
 * Ось Y — вниз (SVG-соглашение).
 *
 * Отличия от предыдущей версии:
 *  - Размерные засечки: косые 45° (СПДС-стиль)
 *  - Отметки уровней: треугольный флажок + горизонтальный отросток + значение
 *  - Разрез: штриховка материалов (грунт, бетон, кирпич, кровля)
 *  - Оси: маркеры в кружках по двум концам
 */

import React, { forwardRef, useMemo } from "react";
import type { BuildingModel } from "../../entities/geometry/types";
import type { TitleBlockData, DrawingSheetLayout, DimensionChain } from "./drawingTypes";
import { GOST_MARGIN, GOST_TITLE_BLOCK } from "./drawingTypes";
import { buildDrawingSheetLayout } from "./drawingLayout";
import {
  computeModelBounds,
  buildPlanProjection,
  buildWallPath,
  buildOpeningData,
  buildBuildingAxes,
  buildExplication,
  isExteriorWall,
} from "./drawingGeometry";
import { buildPlanDimensions } from "./drawingDimensions";
import { extractSectionParams, buildSectionGeometry, buildElevationMarks } from "./drawingSection";

// ─── Константы ────────────────────────────────────────────────────────────────

const INK        = "#0d0d0d";
const INK_SOFT   = "#555";
const PAPER      = "#ffffff";
const ROOM_FILL  = "#f6f4ef";
const ROOM_ALT   = "#ede9e0";
const EXT_WALL   = "#2e2e2e";   // наружная стена на плане
const INT_WALL   = "#4a4a4a";   // внутренняя стена

const FONT = "'PT Sans','Arial Narrow',Arial,sans-serif";
const FONT_MONO = "'PT Mono','Courier New',monospace";

const FS = {
  tiny:    1.5,
  dim:     2.0,   // размерные числа
  label:   2.0,
  room:    2.3,   // подписи помещений
  heading: 2.8,
  stamp:   1.8,
  stampLg: 3.2,
  stampXl: 3.8,
  mark:    2.0,   // отметки уровней
};

// ─── Вспомогательные SVG-функции ──────────────────────────────────────────────

function pts(arr: Array<[number, number]>): string {
  return arr.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function linePath(x1: number, y1: number, x2: number, y2: number): string {
  return `M${x1.toFixed(2)},${y1.toFixed(2)}L${x2.toFixed(2)},${y2.toFixed(2)}`;
}

function pathFromPoly(points: Array<{ x: number; y: number }>): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("") + "Z";
}

// ─── Засечки СПДС (косые 45°) ─────────────────────────────────────────────────

/**
 * Косая засечка (/, ∖) в точке для размерной линии.
 * По ГОСТ 2.307: засечка ∠45° к линии измерения, длина ~2.5мм.
 */
function DimTick({
  x, y,
  direction,
}: {
  x: number; y: number;
  direction: "horizontal" | "vertical";
}) {
  const r = 1.4; // половина длины засечки
  if (direction === "horizontal") {
    // линия измерения горизонтальная → засечка наклонная /
    return (
      <line x1={x - r * 0.6} y1={y + r} x2={x + r * 0.6} y2={y - r}
        stroke={INK} strokeWidth={0.25} />
    );
  }
  // вертикальная → засечка \
  return (
    <line x1={x - r} y1={y - r * 0.6} x2={x + r} y2={y + r * 0.6}
      stroke={INK} strokeWidth={0.25} />
  );
}

// ─── Размерная цепочка ─────────────────────────────────────────────────────────

function DimChainSvg({ chain }: { chain: DimensionChain }) {
  const { direction, baselineMm, startMm, endMm, ticks } = chain;
  const elements: React.ReactNode[] = [];
  const extLineLen = 2.5; // длина выносной линии (мм)

  if (direction === "horizontal") {
    // Основная линия цепочки
    elements.push(
      <line key="line" x1={startMm} y1={baselineMm} x2={endMm} y2={baselineMm}
        stroke={INK} strokeWidth={0.2} />
    );
    ticks.forEach((tick, i) => {
      const px = tick.positionMm;
      // Засечка
      elements.push(<DimTick key={`t${i}`} x={px} y={baselineMm} direction="horizontal" />);
      // Выносная линия вверх от геометрии
      elements.push(
        <line key={`el${i}`}
          x1={px} y1={baselineMm - extLineLen}
          x2={px} y2={baselineMm + extLineLen * 0.4}
          stroke={INK} strokeWidth={0.15} />
      );
      // Размерная подпись (центр между текущей и предыдущей засечкой)
      if (i > 0 && tick.label) {
        const prev = ticks[i - 1].positionMm;
        const midX = (prev + px) / 2;
        elements.push(
          <text key={`lbl${i}`} x={midX} y={baselineMm - 1.2}
            textAnchor="middle" fontFamily={FONT} fontWeight={600}
            fontSize={FS.dim} fill={INK} letterSpacing="0">
            {tick.label}
          </text>
        );
      }
    });

  } else {
    // Вертикальная цепочка
    elements.push(
      <line key="line" x1={baselineMm} y1={startMm} x2={baselineMm} y2={endMm}
        stroke={INK} strokeWidth={0.2} />
    );
    ticks.forEach((tick, i) => {
      const py = tick.positionMm;
      elements.push(<DimTick key={`t${i}`} x={baselineMm} y={py} direction="vertical" />);
      elements.push(
        <line key={`el${i}`}
          x1={baselineMm - extLineLen} y1={py}
          x2={baselineMm + extLineLen * 0.4} y2={py}
          stroke={INK} strokeWidth={0.15} />
      );
      if (i > 0 && tick.label) {
        const prev = ticks[i - 1].positionMm;
        const midY = (prev + py) / 2;
        elements.push(
          <text key={`lbl${i}`}
            x={baselineMm - 1.5} y={midY}
            textAnchor="middle" fontFamily={FONT} fontWeight={600}
            fontSize={FS.dim} fill={INK}
            transform={`rotate(-90,${baselineMm - 1.5},${midY})`}>
            {tick.label}
          </text>
        );
      }
    });
  }

  return <g data-dim="chain">{elements}</g>;
}

// ─── Отметка уровня СПДС ──────────────────────────────────────────────────────

/**
 * Отметка уровня: треугольный флажок ◁ + горизонтальный отросток + значение.
 * По СПДС ГОСТ 21.501: флажок 45°×2мм, вправо или влево.
 */
function ElevationMark({
  x, y, label, side = "right", lineLen = 12,
}: {
  x: number; y: number; label: string;
  side?: "left" | "right";
  lineLen?: number;
}) {
  const dir = side === "right" ? 1 : -1;
  const arrowH = 1.4; // высота треугольника
  const arrowW = 1.4;
  const lineX2 = x + dir * lineLen;
  const textX = lineX2 + dir * 0.8;

  return (
    <g data-mark="elevation">
      {/* Горизонтальный отросток */}
      <line x1={x} y1={y} x2={lineX2} y2={y} stroke={INK} strokeWidth={0.2} />
      {/* Треугольный флажок (всегда у оси отметки) */}
      <polygon
        points={pts([
          [x, y],
          [x + dir * arrowW, y - arrowH],
          [x + dir * arrowW, y + arrowH],
        ])}
        fill={INK}
      />
      {/* Значение отметки */}
      <text
        x={textX} y={y + 0.7}
        textAnchor={side === "right" ? "start" : "end"}
        fontFamily={FONT_MONO} fontSize={FS.mark} fill={INK}
      >
        {label}
      </text>
    </g>
  );
}

// ─── Ось с маркером в кружке ───────────────────────────────────────────────────

function AxisBubble({ cx, cy, r = 2.6, label }: { cx: number; cy: number; r?: number; label: string }) {
  return (
    <g data-axis-bubble>
      <circle cx={cx} cy={cy} r={r} fill={PAPER} stroke={INK} strokeWidth={0.25} />
      <text x={cx} y={cy + FS.label * 0.38}
        textAnchor="middle" fontFamily={FONT} fontWeight={700}
        fontSize={FS.label} fill={INK}>
        {label}
      </text>
    </g>
  );
}

// ─── Маркер разреза на плане ───────────────────────────────────────────────────

function SectionCutLine({ area }: { area: { x: number; y: number; w: number; h: number } }) {
  const y  = area.y + area.h * 0.42;
  const x1 = area.x + 5;
  const x2 = area.x + area.w - 5;
  const r  = 2.4;
  const arrLen = 3.5;

  return (
    <g data-layer="section-cut">
      <line x1={x1 + r * 2.5} y1={y} x2={x2 - r * 2.5} y2={y}
        stroke={INK} strokeWidth={0.3} strokeDasharray="3.5 1.2 0.4 1.2" />

      {/* Стрелки (направление взгляда — вниз) */}
      <polygon points={pts([[x1 + r * 2.5, y + arrLen],
        [x1 + r * 2.5 - 1.2, y + 0.5],
        [x1 + r * 2.5 + 1.2, y + 0.5]])} fill={INK} />
      <polygon points={pts([[x2 - r * 2.5, y + arrLen],
        [x2 - r * 2.5 - 1.2, y + 0.5],
        [x2 - r * 2.5 + 1.2, y + 0.5]])} fill={INK} />

      <AxisBubble cx={x1} cy={y} r={r} label="1" />
      <AxisBubble cx={x2} cy={y} r={r} label="1" />
    </g>
  );
}

// ─── Штриховки (defs) ─────────────────────────────────────────────────────────

function HatchDefs() {
  return (
    <defs>
      {/* Грунт: диагональ + точки */}
      <pattern id="hatch-soil" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="4" stroke={INK} strokeWidth="0.35" opacity="0.45" />
      </pattern>
      {/* Бетон / фундамент: штриховка под 45° */}
      <pattern id="hatch-concrete" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="3" stroke={INK} strokeWidth="0.4" opacity="0.55" />
        <line x1="1.5" y1="0" x2="1.5" y2="3" stroke={INK} strokeWidth="0.4" opacity="0.35" />
      </pattern>
      {/* Кирпич: горизонтальные линии */}
      <pattern id="hatch-brick" width="5" height="2.5" patternUnits="userSpaceOnUse">
        <rect width="5" height="2.5" fill="none" />
        <line x1="0" y1="1.25" x2="5" y2="1.25" stroke={INK} strokeWidth="0.3" opacity="0.4" />
      </pattern>
      {/* Теплоизоляция: зигзаг */}
      <pattern id="hatch-insulation" width="6" height="3" patternUnits="userSpaceOnUse">
        <polyline points="0,1.5 1.5,0 3,1.5 4.5,0 6,1.5" fill="none" stroke={INK} strokeWidth="0.3" opacity="0.55" />
      </pattern>
      {/* Кровля: косая штриховка крупная */}
      <pattern id="hatch-roof" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="#6a4a2a" strokeWidth="0.4" opacity="0.4" />
      </pattern>
    </defs>
  );
}

// ─── Разрез 1-1 (полный) ──────────────────────────────────────────────────────

function SectionDrawing({ layout, model }: { layout: DrawingSheetLayout; model: BuildingModel }) {
  const area   = layout.sectionArea;
  const params = useMemo(() => extractSectionParams(model), [model]);
  const geo    = useMemo(() => buildSectionGeometry(params, area, layout.scale), [params, area, layout.scale]);
  const marks  = useMemo(() => buildElevationMarks(geo), [geo]);

  const { left, right, zeroY, scaleV, scaleH } = geo;
  const p  = params;
  const toY = (hm: number) => zeroY - hm * scaleV;

  // Ключевые Y-уровни
  const foundBot   = toY(-p.foundationDepthM);
  const floorY     = toY(0);
  const slab1BotY  = toY(p.floorHeightM - p.slabThicknessM);
  const slab1TopY  = toY(p.floorHeightM);
  const slab2BotY  = p.floors >= 2 ? toY(p.floorHeightM * 2) : slab1TopY;
  const slab2TopY  = p.floors >= 2 ? toY(p.floorHeightM * 2 + p.slabThicknessM) : slab1TopY;
  const roofBaseY  = p.floors >= 2 ? slab2TopY : slab1TopY;
  const roofTopY   = toY(p.floors * p.floorHeightM + p.floors * p.slabThicknessM + p.roofHeightM);
  const groundY    = toY(p.groundLevelM);

  const ovhMm  = p.roofOverhangM * scaleH;
  const wallTh = 3.2;   // толщина стены на чертеже (мм)
  const slabTh = p.slabThicknessM * scaleV;

  // Окна 1 этажа
  const win1SillY  = toY(p.windowSillM);
  const win1TopY   = toY(p.windowSillM + p.windowHeightM);
  const door1TopY  = toY(p.doorHeightM);

  // Метки-отметки: позиция вертикальной выносной линии
  const markLineX = right + ovhMm + 3;
  const markLineLen = 11;

  // Ось разреза (вертикальная штрихпунктирная по середине)
  const midX = (left + right) / 2;

  return (
    <g data-layer="section-full">

      {/* Заголовок */}
      <text x={area.x + area.w / 2} y={area.y + 3.8}
        textAnchor="middle" fontFamily={FONT} fontWeight={700}
        fontSize={FS.heading} fill={INK} letterSpacing="0.5">
        РАЗРЕЗ 1-1
      </text>

      {/* Осевая штрихпунктирная */}
      <line x1={midX} y1={roofTopY - 2} x2={midX} y2={foundBot + 2}
        stroke={INK} strokeWidth={0.13} strokeDasharray="4 1.2 0.5 1.2" opacity={0.5} />

      {/* ── ГРУНТ ── */}
      {/* Заливка грунта */}
      <rect x={left - ovhMm - 4} y={groundY} width={right - left + ovhMm * 2 + 8} height={foundBot - groundY}
        fill="url(#hatch-soil)" stroke="none" />
      {/* Линия земли */}
      <line x1={left - ovhMm - 5} y1={groundY} x2={right + ovhMm + 5} y2={groundY}
        stroke={INK} strokeWidth={0.5} />

      {/* ── ФУНДАМЕНТ ── */}
      <rect x={left - wallTh * 0.6} y={foundBot} width={right - left + wallTh * 1.2} height={floorY - foundBot}
        fill={PAPER} stroke={INK} strokeWidth={0.3} />
      <rect x={left - wallTh * 0.6} y={foundBot} width={right - left + wallTh * 1.2} height={floorY - foundBot}
        fill="url(#hatch-concrete)" stroke="none" />

      {/* ── ПЕРЕКРЫТИЕ 1 ЭТАЖА ── */}
      <rect x={left} y={slab1BotY} width={right - left} height={slabTh}
        fill={PAPER} stroke={INK} strokeWidth={0.2} />
      <rect x={left} y={slab1BotY} width={right - left} height={slabTh}
        fill="url(#hatch-concrete)" stroke="none" />

      {/* ── СТЕНЫ 1 ЭТАЖА ── */}
      {/* Левая */}
      <rect x={left} y={slab1TopY} width={wallTh} height={slab1BotY - slab1TopY}
        fill={EXT_WALL} stroke={INK} strokeWidth={0.18} />
      {/* Правая */}
      <rect x={right - wallTh} y={slab1TopY} width={wallTh} height={slab1BotY - slab1TopY}
        fill={EXT_WALL} stroke={INK} strokeWidth={0.18} />

      {/* Окно 1 этажа (в левой стене) */}
      <rect x={left} y={win1SillY} width={wallTh} height={win1TopY - win1SillY}
        fill={PAPER} stroke={INK} strokeWidth={0.13} />
      {/* Подоконник */}
      <rect x={left - 0.5} y={win1SillY} width={wallTh + 1} height={0.35 * scaleV}
        fill="#999" stroke={INK} strokeWidth={0.13} />

      {/* Дверь 1 этажа (в правой стене) */}
      <rect x={right - wallTh} y={door1TopY} width={wallTh} height={floorY - door1TopY}
        fill={PAPER} stroke={INK} strokeWidth={0.13} />

      {/* ── ПЕРЕКРЫТИЕ 2 ЭТАЖА ── */}
      {p.floors >= 2 && (
        <>
          <rect x={left} y={slab2BotY} width={right - left} height={slabTh}
            fill={PAPER} stroke={INK} strokeWidth={0.2} />
          <rect x={left} y={slab2BotY} width={right - left} height={slabTh}
            fill="url(#hatch-concrete)" stroke="none" />

          {/* Стены 2 этажа */}
          <rect x={left} y={slab2TopY} width={wallTh} height={slab2BotY - slab2TopY}
            fill={EXT_WALL} stroke={INK} strokeWidth={0.18} />
          <rect x={right - wallTh} y={slab2TopY} width={wallTh} height={slab2BotY - slab2TopY}
            fill={EXT_WALL} stroke={INK} strokeWidth={0.18} />

          {/* Окно 2 этажа */}
          {(() => {
            const win2Sill = slab2TopY - (slab2BotY - slab2TopY) * 0.65;
            const win2Top  = win2Sill - (win1SillY - win1TopY);
            return (
              <>
                <rect x={left} y={win2Top} width={wallTh} height={win2Sill - win2Top}
                  fill={PAPER} stroke={INK} strokeWidth={0.13} />
                <rect x={left - 0.5} y={win2Sill} width={wallTh + 1} height={0.35 * scaleV}
                  fill="#999" stroke={INK} strokeWidth={0.13} />
              </>
            );
          })()}
        </>
      )}

      {/* ── КРОВЛЯ ── */}
      {/* Заливка */}
      <polygon
        points={pts([
          [left - ovhMm, roofBaseY],
          [(left + right) / 2, roofTopY],
          [right + ovhMm, roofBaseY],
        ])}
        fill="url(#hatch-roof)" stroke={INK} strokeWidth={0.35}
      />
      {/* Карниз */}
      <line x1={left - ovhMm - 1} y1={roofBaseY} x2={right + ovhMm + 1} y2={roofBaseY}
        stroke={INK} strokeWidth={0.45} />
      {/* Свес кровли */}
      <line x1={left - ovhMm} y1={roofBaseY + 0.5} x2={left - ovhMm} y2={roofBaseY - 1.5}
        stroke={INK} strokeWidth={0.25} />
      <line x1={right + ovhMm} y1={roofBaseY + 0.5} x2={right + ovhMm} y2={roofBaseY - 1.5}
        stroke={INK} strokeWidth={0.25} />

      {/* ── ОТМЕТКИ УРОВНЕЙ (СПДС) ── */}
      {marks.map((mark, i) => (
        <ElevationMark
          key={i}
          x={markLineX}
          y={mark.y}
          label={mark.label}
          side="right"
          lineLen={markLineLen}
        />
      ))}
      {/* Тонкая выносная вертикальная черта рядом со зданием */}
      <line x1={markLineX} y1={roofTopY - 2} x2={markLineX} y2={foundBot + 2}
        stroke={INK} strokeWidth={0.15} strokeDasharray="1 0.5" />

      {/* ── ОСИ РАЗРЕЗА (числовые) ── */}
      {[
        { x: left,  label: "А" },
        { x: right, label: "Б" },
      ].map(({ x, label }) => {
        const topY = roofTopY - 5;
        const botY = foundBot + 2;
        return (
          <g key={label}>
            <line x1={x} y1={topY + 4} x2={x} y2={botY - 4}
              stroke={INK} strokeWidth={0.13} strokeDasharray="3 1 0.5 1" />
            <AxisBubble cx={x} cy={topY} r={2.4} label={label} />
            <AxisBubble cx={x} cy={botY} r={2.4} label={label} />
          </g>
        );
      })}

      {/* ── ВЕРТИКАЛЬНАЯ РАЗМЕРНАЯ ЦЕПОЧКА (высоты этажей) ── */}
      {(() => {
        const chainX = left - ovhMm - markLineLen - 5;
        const items: Array<{ y1: number; y2: number; label: string }> = [
          { y1: floorY, y2: slab1TopY, label: `${Math.round(p.floorHeightM * 1000)}` },
        ];
        if (p.floors >= 2) {
          items.push({ y1: slab2BotY, y2: slab2TopY, label: `${Math.round(p.floorHeightM * 1000)}` });
        }
        items.push({ y1: toY(-p.foundationDepthM), y2: floorY, label: `${Math.round(p.foundationDepthM * 1000)}` });
        items.push({ y1: roofBaseY, y2: roofTopY, label: `${Math.round(p.roofHeightM * 1000)}` });

        return (
          <g data-dim="section-heights">
            {items.map(({ y1, y2, label }, i) => (
              <g key={i}>
                <line x1={chainX} y1={y2} x2={chainX} y2={y1}
                  stroke={INK} strokeWidth={0.2} />
                <DimTick x={chainX} y={y2} direction="vertical" />
                <DimTick x={chainX} y={y1} direction="vertical" />
                <line x1={chainX - 2} y1={y2} x2={chainX + 1} y2={y2}
                  stroke={INK} strokeWidth={0.15} />
                <line x1={chainX - 2} y1={y1} x2={chainX + 1} y2={y1}
                  stroke={INK} strokeWidth={0.15} />
                <text x={chainX - 2} y={(y1 + y2) / 2 + 0.7}
                  textAnchor="middle" fontFamily={FONT} fontWeight={600}
                  fontSize={FS.dim} fill={INK}
                  transform={`rotate(-90,${chainX - 2},${(y1 + y2) / 2 + 0.7})`}>
                  {label}
                </text>
              </g>
            ))}
          </g>
        );
      })()}

      {/* Подпись масштаба */}
      <text x={area.x + area.w / 2} y={area.y + area.h - 0.8}
        textAnchor="middle" fontFamily={FONT}
        fontSize={FS.tiny} fill={INK_SOFT}>
        Масштаб {layout.scale}
      </text>
    </g>
  );
}

// ─── ГОСТ-рамка ───────────────────────────────────────────────────────────────

function GostFrame({ sheet }: { sheet: DrawingSheetLayout["sheet"] }) {
  const { widthMm: W, heightMm: H } = sheet;
  const m = GOST_MARGIN;
  return (
    <g data-layer="frame">
      <rect x={0} y={0} width={W} height={H} fill={PAPER} />
      {/* Внешняя рамка — тонкая */}
      <rect x={m.right} y={m.top}
        width={W - m.left - m.right} height={H - m.top - m.bottom}
        fill="none" stroke={INK} strokeWidth={0.18} />
      {/* Основная рамка — толстая */}
      <rect x={m.left} y={m.top}
        width={W - m.left - m.right} height={H - m.top - m.bottom}
        fill="none" stroke={INK} strokeWidth={0.7} />
      {/* Поле подшивки */}
      <line x1={m.right} y1={m.top} x2={m.right} y2={H - m.bottom}
        stroke={INK} strokeWidth={0.18} />
    </g>
  );
}

// ─── Основная надпись (форма 1, ГОСТ 2.104-2006) ──────────────────────────────

function TitleBlock({ data, layout }: { data: TitleBlockData; layout: DrawingSheetLayout }) {
  const { x, y, w: W, h: H } = layout.titleBlockArea;
  const sx = (mm: number) => x + (mm / 185) * W;
  const sy = (mm: number) => y + (mm / 55) * H;

  // Вертикальные линии (мм от левого края штампа, ref: 185мм wide)
  const vMm = [17, 40, 55, 65, 135, 155, 172];
  // Горизонтальные линии (ref: 55мм high)
  const hMm = [20, 34, 44];
  const hLeftMm = [5, 10, 15, 24, 28, 32, 38, 42, 48, 52];

  return (
    <g data-layer="title-block">
      <rect x={x} y={y} width={W} height={H} fill={PAPER} stroke={INK} strokeWidth={0.55} />

      {vMm.map((mm) => (
        <line key={`v${mm}`}
          x1={sx(mm)} y1={y} x2={sx(mm)} y2={y + H}
          stroke={INK}
          strokeWidth={mm === 65 || mm === 135 ? 0.35 : 0.18} />
      ))}
      {hMm.map((mm) => (
        <line key={`h${mm}`}
          x1={x} y1={sy(mm)} x2={x + W} y2={sy(mm)}
          stroke={INK}
          strokeWidth={mm === 34 ? 0.35 : 0.18} />
      ))}
      {hLeftMm.map((mm) => (
        <line key={`hl${mm}`}
          x1={x} y1={sy(mm)} x2={sx(65)} y2={sy(mm)}
          stroke={INK} strokeWidth={0.13} />
      ))}

      {/* Блок "Лист/Листов" */}
      <line x1={sx(135)} y1={sy(39)} x2={x + W} y2={sy(39)} stroke={INK} strokeWidth={0.18} />
      <line x1={sx(160)} y1={sy(34)} x2={sx(160)} y2={y + H} stroke={INK} strokeWidth={0.18} />

      {/* Заголовки граф */}
      {[
        { x: sx(137), y: sy(0.14), t: "Лит." },
        { x: sx(157), y: sy(0.14), t: "Масса" },
        { x: sx(173), y: sy(0.14), t: "Масштаб" },
        { x: sx(137), y: sy(0.69), t: "Лист" },
        { x: sx(162), y: sy(0.69), t: "Листов" },
      ].map(({ x: tx, y: ty, t }) => (
        <text key={t} x={tx} y={ty} fontFamily={FONT} fontSize={FS.stamp} fill={INK_SOFT}>{t}</text>
      ))}

      {/* Должности */}
      {[
        { label: "Разраб.", relY: 26, val: data.developer },
        { label: "Пров.",   relY: 30, val: data.checker },
        { label: "Т.контр.",relY: 34, val: "" },
        { label: "Н.контр.",relY: 40, val: "" },
        { label: "Утв.",    relY: 46, val: "" },
      ].map(({ label, relY, val }) => (
        <g key={label}>
          <text x={x + 1} y={sy(relY)} fontFamily={FONT} fontSize={FS.stamp} fill={INK_SOFT}>{label}</text>
          <text x={sx(18)} y={sy(relY)} fontFamily={FONT} fontSize={FS.stamp} fill={INK}>{val}</text>
        </g>
      ))}

      {/* Обозначение проекта */}
      <text x={sx(100)} y={sy(12)} textAnchor="middle"
        fontFamily={FONT} fontWeight={700} fontSize={FS.stampXl} fill={INK}>
        {data.projectCode}
      </text>

      {/* Наименование листа */}
      <text x={sx(100)} y={sy(26)} textAnchor="middle"
        fontFamily={FONT} fontSize={FS.stamp + 0.1} fill={INK}>
        {data.sheetName}
      </text>

      {/* Наименование объекта */}
      <text x={sx(100)} y={sy(40)} textAnchor="middle"
        fontFamily={FONT} fontSize={FS.stamp} fill={INK_SOFT}>
        {data.objectName}
      </text>

      {/* Стадия, масштаб, лист, листов */}
      <text x={sx(145)} y={sy(17)} textAnchor="middle"
        fontFamily={FONT} fontWeight={700} fontSize={FS.stampLg} fill={INK}>
        {data.stage}
      </text>
      <text x={sx(178)} y={sy(17)} textAnchor="middle"
        fontFamily={FONT} fontWeight={700} fontSize={FS.stampLg} fill={INK}>
        {data.scale}
      </text>
      <text x={sx(147)} y={sy(50)} textAnchor="middle"
        fontFamily={FONT} fontWeight={700} fontSize={FS.stampXl} fill={INK}>
        {data.sheetNumber}
      </text>
      <text x={sx(172)} y={sy(50)} textAnchor="middle"
        fontFamily={FONT} fontWeight={700} fontSize={FS.stampXl} fill={INK}>
        {data.totalSheets}
      </text>

      {/* Дата */}
      <text x={sx(56)} y={sy(46)} fontFamily={FONT} fontSize={FS.stamp} fill={INK_SOFT}>
        {data.date}
      </text>
    </g>
  );
}

// ─── Экспликация помещений ─────────────────────────────────────────────────────

function ExplicationTable({
  rows,
  area,
}: {
  rows: Array<{ number: number; name: string; areaSqM: number }>;
  area: { x: number; y: number; w: number; h: number };
}) {
  const rowH  = 4.2;
  const headH = 5.0;
  const colW  = [7, area.w * 0.56, area.w - 7 - area.w * 0.56];
  const colX  = [area.x, area.x + colW[0], area.x + colW[0] + colW[1]];
  const maxR  = Math.floor((area.h - headH - 7) / rowH);
  const show  = rows.slice(0, maxR);
  const tblH  = headH + show.length * rowH;

  return (
    <g data-layer="explication">
      <text x={area.x + area.w / 2} y={area.y + 3.5}
        textAnchor="middle" fontFamily={FONT} fontWeight={700}
        fontSize={FS.heading} fill={INK}>
        Экспликация помещений
      </text>

      <rect x={area.x} y={area.y + 5} width={area.w} height={tblH}
        fill={PAPER} stroke={INK} strokeWidth={0.3} />

      {/* Заголовки */}
      {([["№", 0], ["Наименование", 1], ["Пл., м²", 2]] as const).map(([t, ci]) => (
        <text key={String(t)} fontFamily={FONT} fontWeight={700} fontSize={FS.label}
          x={colX[ci] + colW[ci] / 2} y={area.y + 5 + headH * 0.68}
          textAnchor="middle" fill={INK}>
          {t}
        </text>
      ))}
      <line x1={area.x} y1={area.y + 5 + headH} x2={area.x + area.w} y2={area.y + 5 + headH}
        stroke={INK} strokeWidth={0.25} />

      {/* Вертикальные разделители */}
      <line x1={colX[1]} y1={area.y + 5} x2={colX[1]} y2={area.y + 5 + tblH}
        stroke={INK} strokeWidth={0.18} />
      <line x1={colX[2]} y1={area.y + 5} x2={colX[2]} y2={area.y + 5 + tblH}
        stroke={INK} strokeWidth={0.18} />

      {show.map((row, i) => {
        const ry = area.y + 5 + headH + i * rowH;
        const maxName = Math.floor(colW[1] / 1.2);
        return (
          <g key={row.number}>
            {i % 2 === 1 && (
              <rect x={area.x} y={ry} width={area.w} height={rowH} fill="#f7f6f2" />
            )}
            <line x1={area.x} y1={ry + rowH} x2={area.x + area.w} y2={ry + rowH}
              stroke={INK} strokeWidth={0.1} />
            <text x={colX[0] + colW[0] / 2} y={ry + rowH * 0.72}
              textAnchor="middle" fontFamily={FONT} fontSize={FS.dim} fill={INK}>
              {row.number}
            </text>
            <text x={colX[1] + 1} y={ry + rowH * 0.72}
              fontFamily={FONT} fontSize={FS.dim} fill={INK}>
              {row.name.length > maxName ? row.name.slice(0, maxName - 1) + "…" : row.name}
            </text>
            <text x={colX[2] + colW[2] / 2} y={ry + rowH * 0.72}
              textAnchor="middle" fontFamily={FONT} fontSize={FS.dim} fill={INK}>
              {row.areaSqM.toFixed(2)}
            </text>
          </g>
        );
      })}
      {rows.length > maxR && (
        <text x={area.x + area.w / 2} y={area.y + 5 + tblH + 3}
          textAnchor="middle" fontFamily={FONT} fontSize={FS.tiny} fill={INK_SOFT}>
          … и ещё {rows.length - maxR} пом.
        </text>
      )}
    </g>
  );
}

// ─── Главный SVG ───────────────────────────────────────────────────────────────

export interface DrawingSheetSvgProps {
  model: BuildingModel;
  titleData: TitleBlockData;
  levelId?: string | null;
}

const DrawingSheetSvg = forwardRef<SVGSVGElement, DrawingSheetSvgProps>(
  function DrawingSheetSvg({ model, titleData, levelId = null }, ref) {

    const layout = useMemo(() => buildDrawingSheetLayout(model), [model]);
    const { sheet, scale, planArea, explicArea } = layout;

    const activeLevelId = useMemo(
      () => levelId ?? (model.levels?.[0]?.id ?? null),
      [levelId, model.levels]
    );

    // Геометрия плана
    const bounds = useMemo(() => computeModelBounds(model, activeLevelId), [model, activeLevelId]);
    const proj   = useMemo(() => buildPlanProjection(bounds, planArea, scale, 28), [bounds, planArea, scale]);

    const wallData = useMemo(
      () => model.walls
        .filter((w) => !activeLevelId || w.levelId === activeLevelId)
        .map((w) => buildWallPath(w, proj))
        .filter(Boolean),
      [model.walls, activeLevelId, proj]
    );

    const openings = useMemo(() => [
      ...buildOpeningData(model.windows ?? [], "window", model, proj),
      ...buildOpeningData(model.doors   ?? [], "door",   model, proj),
    ], [model, proj]);

    const axes       = useMemo(() => buildBuildingAxes(bounds, proj, 10), [bounds, proj]);
    const dims       = useMemo(() => buildPlanDimensions(model, activeLevelId, proj), [model, activeLevelId, proj]);
    const explication = useMemo(() => buildExplication(model, activeLevelId), [model, activeLevelId]);

    const rooms = model.rooms.filter((r) => !activeLevelId || r.levelId === activeLevelId);

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${sheet.widthMm} ${sheet.heightMm}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", display: "block" }}
        data-drawing-sheet="true"
      >
        <HatchDefs />

        {/* ── РАМКА ── */}
        <GostFrame sheet={sheet} />

        {/* ── ОСНОВНАЯ НАДПИСЬ ── */}
        <TitleBlock data={titleData} layout={layout} />

        {/* ── ПЛАН ЭТАЖА ── */}
        <g data-layer="plan">
          {/* Подпись */}
          <text x={planArea.x + planArea.w / 2} y={planArea.y + 3.8}
            textAnchor="middle" fontFamily={FONT} fontWeight={700}
            fontSize={FS.heading} fill={INK} letterSpacing="0.5">
            {`ПЛАН 1-ГО ЭТАЖА. Масштаб ${scale}`}
          </text>

          {/* Заливки помещений */}
          {rooms.map((room, i) => {
            const pts2 = room.polygon.map((p) => ({
              x: (p.x - proj.minX) * proj.scale + proj.offsetX,
              y: (p.y - proj.minY) * proj.scale + proj.offsetY,
            }));
            return (
              <path key={room.id}
                d={pathFromPoly(pts2)}
                fill={i % 2 === 0 ? ROOM_FILL : ROOM_ALT}
                stroke="none" />
            );
          })}

          {/* Оси */}
          {axes.map((axis) => (
            <g key={`axis-${axis.label}`}>
              {axis.direction === "vertical" ? (
                <>
                  <line x1={axis.positionMm} y1={axis.startMm}
                    x2={axis.positionMm} y2={axis.endMm}
                    stroke={INK} strokeWidth={0.13} strokeDasharray="3 1.2 0.5 1.2" />
                  <AxisBubble cx={axis.positionMm} cy={axis.startMm - 3.5} label={axis.label} />
                  <AxisBubble cx={axis.positionMm} cy={axis.endMm   + 3.5} label={axis.label} />
                </>
              ) : (
                <>
                  <line x1={axis.startMm} y1={axis.positionMm}
                    x2={axis.endMm} y2={axis.positionMm}
                    stroke={INK} strokeWidth={0.13} strokeDasharray="3 1.2 0.5 1.2" />
                  <AxisBubble cx={axis.startMm - 3.5} cy={axis.positionMm} label={axis.label} />
                  <AxisBubble cx={axis.endMm   + 3.5} cy={axis.positionMm} label={axis.label} />
                </>
              )}
            </g>
          ))}

          {/* Стены */}
          {wallData.map((wd, i) => {
            if (!wd) return null;
            const ext = isExteriorWall(wd.wall);
            return (
              <path key={wd.wall.id ?? i}
                d={wd.fillPath}
                fill={ext ? EXT_WALL : INT_WALL}
                stroke={INK}
                strokeWidth={ext ? 0.3 : 0.15} />
            );
          })}

          {/* Окна */}
          {openings.filter((op) => op.type === "window").map((op, i) => {
            const { a, b, nx, ny, halfWallMm } = op;
            return (
              <g key={`win-${i}`}>
                <polygon
                  points={pts([
                    [a.x + nx * halfWallMm, a.y + ny * halfWallMm],
                    [b.x + nx * halfWallMm, b.y + ny * halfWallMm],
                    [b.x - nx * halfWallMm, b.y - ny * halfWallMm],
                    [a.x - nx * halfWallMm, a.y - ny * halfWallMm],
                  ])}
                  fill={PAPER}
                />
                {[-0.4, 0, 0.4].map((f) => (
                  <line key={f}
                    x1={a.x + nx * halfWallMm * f * 2}
                    y1={a.y + ny * halfWallMm * f * 2}
                    x2={b.x + nx * halfWallMm * f * 2}
                    y2={b.y + ny * halfWallMm * f * 2}
                    stroke={INK} strokeWidth={0.18}
                  />
                ))}
              </g>
            );
          })}

          {/* Двери */}
          {openings.filter((op) => op.type === "door").map((op, i) => {
            const { a, b, nx, ny, halfWallMm, widthMm } = op;
            return (
              <g key={`door-${i}`}>
                <polygon
                  points={pts([
                    [a.x + nx * halfWallMm, a.y + ny * halfWallMm],
                    [b.x + nx * halfWallMm, b.y + ny * halfWallMm],
                    [b.x - nx * halfWallMm, b.y - ny * halfWallMm],
                    [a.x - nx * halfWallMm, a.y - ny * halfWallMm],
                  ])}
                  fill={PAPER}
                />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={INK} strokeWidth={0.28} />
                <path
                  d={`M${a.x.toFixed(2)},${a.y.toFixed(2)} A${widthMm.toFixed(2)},${widthMm.toFixed(2)} 0 0 1 ${(a.x + ny * widthMm).toFixed(2)},${(a.y - nx * widthMm).toFixed(2)}`}
                  fill="none" stroke={INK} strokeWidth={0.15} strokeDasharray="1.5 0.6"
                />
              </g>
            );
          })}

          {/* Подписи помещений */}
          {rooms.map((room, i) => {
            const ppts = room.polygon.map((p) => ({
              x: (p.x - proj.minX) * proj.scale + proj.offsetX,
              y: (p.y - proj.minY) * proj.scale + proj.offsetY,
            }));
            const cx = ppts.reduce((s, pp) => s + pp.x, 0) / ppts.length;
            const cy = ppts.reduce((s, pp) => s + pp.y, 0) / ppts.length;
            const num = i + 1;
            return (
              <g key={`label-${room.id}`}>
                <circle cx={cx} cy={cy - 1.8} r={2.3}
                  fill={PAPER} stroke={INK} strokeWidth={0.2} />
                <text x={cx} y={cy - 0.95}
                  textAnchor="middle" fontFamily={FONT} fontWeight={700}
                  fontSize={FS.room - 0.5} fill={INK}>
                  {num}
                </text>
                <text x={cx} y={cy + 2.5}
                  textAnchor="middle" fontFamily={FONT}
                  fontSize={FS.tiny} fill={INK_SOFT}>
                  {room.name?.trim() || `Пом.${num}`}
                </text>
              </g>
            );
          })}

          {/* Линия разреза 1-1 */}
          <SectionCutLine area={planArea} />
        </g>

        {/* ── РАЗМЕРНЫЕ ЛИНИИ ПЛАНА ── */}
        <g data-layer="plan-dims">
          {dims.bottomDetailChain && <DimChainSvg chain={dims.bottomDetailChain} />}
          {dims.bottomTotalChain  && <DimChainSvg chain={dims.bottomTotalChain} />}
          {dims.leftDetailChain   && <DimChainSvg chain={dims.leftDetailChain} />}
          {dims.leftTotalChain    && <DimChainSvg chain={dims.leftTotalChain} />}
        </g>

        {/* ── ЭКСПЛИКАЦИЯ ── */}
        <ExplicationTable rows={explication} area={explicArea} />

        {/* ── РАЗРЕЗ 1-1 ── */}
        <SectionDrawing layout={layout} model={model} />

        {/* ── Разделительные линии зон (тонкие вспомогательные) ── */}
        <g data-layer="zone-dividers" opacity={0.4}>
          <line x1={layout.workArea.x} y1={layout.sectionArea.y}
            x2={layout.planArea.x + layout.planArea.w} y2={layout.sectionArea.y}
            stroke={INK} strokeWidth={0.1} strokeDasharray="2 1.5" />
          <line x1={layout.explicArea.x} y1={layout.workArea.y}
            x2={layout.explicArea.x} y2={layout.titleBlockArea.y}
            stroke={INK} strokeWidth={0.1} strokeDasharray="2 1.5" />
        </g>
      </svg>
    );
  }
);

export default DrawingSheetSvg;
