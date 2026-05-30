import React from "react";
import { DRAWING_PAPER, DRAWING_TYPOGRAPHY, MEDIUM_PALETTE, type SheetMetrics } from "../drawingTheme";
import type { EngineeringMedium } from "../../../../../entities/engineering/types";

export interface SheetMetadata {
  title: string;
  subtitle?: string;
  projectName?: string;
  drawingNumber?: string;
  stage?: string;
  sheetNumber?: string;
  scale?: string;
  date?: string;
  author?: string;
  reviewer?: string;
}

interface SheetLayerProps {
  metrics: SheetMetrics;
  metadata: SheetMetadata;
  visibleMedia: EngineeringMedium[];
}

function resolveSheetSizeMm(width: number, height: number): { widthMm: number; heightMm: number } {
  const presets = [
    { widthMm: 297, heightMm: 210 }, // A4 (landscape)
    { widthMm: 420, heightMm: 297 }, // A3
    { widthMm: 594, heightMm: 420 }, // A2
    { widthMm: 841, heightMm: 594 }, // A1
  ];
  const ratio = width / Math.max(1, height);
  return presets.reduce((best, candidate) => {
    const candidateRatio = candidate.widthMm / candidate.heightMm;
    return Math.abs(candidateRatio - ratio) < Math.abs(best.widthMm / best.heightMm - ratio) ? candidate : best;
  }, presets[1]);
}

const SheetLayer: React.FC<SheetLayerProps> = ({ metrics, metadata, visibleMedia }) => {
  const { width, height } = metrics;
  const { widthMm, heightMm } = resolveSheetSizeMm(width, height);
  const pxPerMmX = width / widthMm;
  const pxPerMmY = height / heightMm;
  const toX = (mm: number) => mm * pxPerMmX;
  const toY = (mm: number) => mm * pxPerMmY;

  // ГОСТ 2.301: рамка 5 мм по периметру и 20 мм слева.
  const frameLeft = toX(20);
  const frameTop = toY(5);
  const frameRightInset = toX(5);
  const frameBottomInset = toY(5);
  const frameWidth = width - frameLeft - frameRightInset;
  const frameHeight = height - frameTop - frameBottomInset;

  const innerX = frameLeft;
  const innerY = frameTop;
  const innerW = frameWidth;
  const innerH = frameHeight;

  // Строгое ГОСТ-позиционирование штампов (в мм).
  const mainStampWidth = toX(185);
  const mainStampHeight = toY(55);
  const stampX = width - frameRightInset - mainStampWidth;
  const stampY = height - frameBottomInset - mainStampHeight;

  // Левая служебная таблица занимает полосу 15 мм между 5 мм и 20 мм рамками.
  const sideStampX = toX(5);
  const sideStampY = stampY;
  const sideStampWidth = toX(15);
  const sideStampHeight = mainStampHeight;

  // Legend: верхний правый угол внутри рамки
  const legendItems = visibleMedia.map((m) => MEDIUM_PALETTE[m]);
  const legendItemHeight = 18;
  const legendPadding = 12;
  const legendWidth = 220;
  const legendHeight = legendItems.length * legendItemHeight + legendPadding * 2 + 24;
  const legendX = innerX + innerW - legendWidth - 12;
  const legendY = innerY + 12;

  return (
    <g data-layer="sheet">
      {/* Бумага */}
      <rect x={0} y={0} width={width} height={height} fill={DRAWING_PAPER.background} />

      {/* Внешняя рамка */}
      <rect
        x={toX(5)}
        y={toY(5)}
        width={width - toX(10)}
        height={height - toY(10)}
        fill="none"
        stroke={DRAWING_PAPER.border}
        strokeWidth={0.6}
      />

      {/* Основная рамка чертежа (ГОСТ: 20 мм слева, 5 мм с остальных сторон) */}
      <rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        fill="none"
        stroke={DRAWING_PAPER.border}
        strokeWidth={1.25}
      />

      {/* Линия подшивки (граница 20 мм поля слева) */}
      <line x1={innerX} y1={toY(5)} x2={innerX} y2={height - toY(5)} stroke={DRAWING_PAPER.border} strokeWidth={0.8} />

      {/* Левая служебная табличка (ГОСТ-подобная) */}
      <g transform={`translate(${sideStampX} ${sideStampY})`}>
        <rect x={0} y={0} width={sideStampWidth} height={sideStampHeight} fill="#ffffff" stroke={DRAWING_PAPER.border} strokeWidth={0.95} />
        <line x1={sideStampWidth * 0.52} y1={0} x2={sideStampWidth * 0.52} y2={sideStampHeight} stroke={DRAWING_PAPER.border} strokeWidth={0.75} />
        <line x1={sideStampWidth * 0.77} y1={0} x2={sideStampWidth * 0.77} y2={sideStampHeight} stroke={DRAWING_PAPER.border} strokeWidth={0.75} />
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={`side-h-${ratio}`}
            x1={0}
            y1={sideStampHeight * ratio}
            x2={sideStampWidth}
            y2={sideStampHeight * ratio}
            stroke={DRAWING_PAPER.border}
            strokeWidth={0.6}
          />
        ))}
        {/* Верхняя маленькая ячейка справа: "Зам. инв. №" */}
        <line
          x1={sideStampWidth * 0.77}
          y1={sideStampHeight * 0.14}
          x2={sideStampWidth}
          y2={sideStampHeight * 0.14}
          stroke={DRAWING_PAPER.border}
          strokeWidth={0.6}
        />

        <text
          x={sideStampWidth * 0.26}
          y={sideStampHeight / 2}
          transform={`rotate(-90 ${sideStampWidth * 0.26} ${sideStampHeight / 2})`}
          textAnchor="middle"
          fontFamily={DRAWING_TYPOGRAPHY.family}
          fontSize={6.6}
          fill={DRAWING_PAPER.ink}
        >
          Инв. № подл.
        </text>
        <text
          x={sideStampWidth * 0.645}
          y={sideStampHeight / 2}
          transform={`rotate(-90 ${sideStampWidth * 0.645} ${sideStampHeight / 2})`}
          textAnchor="middle"
          fontFamily={DRAWING_TYPOGRAPHY.family}
          fontSize={6.6}
          fill={DRAWING_PAPER.ink}
        >
          Подп. и дата
        </text>
        <text
          x={sideStampWidth * 0.885}
          y={sideStampHeight * 0.57}
          transform={`rotate(-90 ${sideStampWidth * 0.885} ${sideStampHeight * 0.57})`}
          textAnchor="middle"
          fontFamily={DRAWING_TYPOGRAPHY.family}
          fontSize={6.4}
          fill={DRAWING_PAPER.ink}
        >
          Взам. инв. №
        </text>
        <text
          x={sideStampWidth * 0.885}
          y={sideStampHeight * 0.07}
          transform={`rotate(-90 ${sideStampWidth * 0.885} ${sideStampHeight * 0.07})`}
          textAnchor="middle"
          fontFamily={DRAWING_TYPOGRAPHY.family}
          fontSize={5.8}
          fill={DRAWING_PAPER.ink}
        >
          Зам. инв. №
        </text>
      </g>

      {/* Легенда */}
      {legendItems.length > 0 ? (
        <g transform={`translate(${legendX} ${legendY})`}>
          <rect
            x={0}
            y={0}
            width={legendWidth}
            height={legendHeight}
            fill="rgba(255,255,255,0.94)"
            stroke={DRAWING_PAPER.border}
            strokeWidth={0.7}
          />
          <text
            x={legendPadding}
            y={20}
            fontFamily={DRAWING_TYPOGRAPHY.family}
            fontSize={DRAWING_TYPOGRAPHY.legendTitle}
            fontWeight={700}
            fill={DRAWING_PAPER.ink}
          >
            УСЛОВНЫЕ ОБОЗНАЧЕНИЯ
          </text>
          {legendItems.map((item, idx) => {
            const y = 36 + idx * legendItemHeight;
            return (
              <g key={item.short} transform={`translate(${legendPadding} ${y})`}>
                <line
                  x1={0}
                  y1={6}
                  x2={32}
                  y2={6}
                  stroke={item.ink}
                  strokeWidth={2}
                  strokeDasharray={item.dash}
                />
                <text
                  x={42}
                  y={10}
                  fontFamily={DRAWING_TYPOGRAPHY.family}
                  fontSize={DRAWING_TYPOGRAPHY.legendItem}
                  fill={DRAWING_PAPER.ink}
                >
                  {item.short}
                </text>
                <text
                  x={70}
                  y={10}
                  fontFamily={DRAWING_TYPOGRAPHY.family}
                  fontSize={DRAWING_TYPOGRAPHY.legendItem}
                  fill={DRAWING_PAPER.inkSoft}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}

      {/* Штамп (ГОСТ-подобная основная надпись, форма 1) */}
      <g transform={`translate(${stampX} ${stampY})`}>
        {(() => {
          const ux = mainStampWidth / 185;
          const uy = mainStampHeight / 55;
          const sx = (value: number) => value * ux;
          const sy = (value: number) => value * uy;
          const cut = (value: string | undefined, max: number) => {
            const text = (value ?? "").trim();
            if (!text) return "—";
            return text.length > max ? `${text.slice(0, max - 1)}…` : text;
          };
          return (
            <>
              <rect x={0} y={0} width={mainStampWidth} height={mainStampHeight} fill="#ffffff" stroke={DRAWING_PAPER.border} strokeWidth={1.3} />
              {/* Вертикальные деления (по референсной форме) */}
              {[17, 40, 55, 65, 135, 155, 172].map((x) => (
                <line key={`v-${x}`} x1={sx(x)} y1={0} x2={sx(x)} y2={mainStampHeight} stroke={DRAWING_PAPER.border} strokeWidth={x === 65 || x === 135 ? 0.9 : 0.7} />
              ))}
              {/* Горизонтальные деления */}
              {[20, 34, 44].map((y) => (
                <line key={`h-${y}`} x1={0} y1={sy(y)} x2={sx(185)} y2={sy(y)} stroke={DRAWING_PAPER.border} strokeWidth={y === 34 ? 0.9 : 0.7} />
              ))}
              {/* Мелкая сетка слева */}
              {[5, 10, 15, 24, 28, 32, 38, 42, 48, 52].map((y) => (
                <line key={`lh-${y}`} x1={0} y1={sy(y)} x2={sx(65)} y2={sy(y)} stroke={DRAWING_PAPER.border} strokeWidth={0.6} />
              ))}
              {/* Блок листов справа снизу */}
              <line x1={sx(135)} y1={sy(39)} x2={sx(185)} y2={sy(39)} stroke={DRAWING_PAPER.border} strokeWidth={0.7} />
              <line x1={sx(160)} y1={sy(34)} x2={sx(160)} y2={sy(55)} stroke={DRAWING_PAPER.border} strokeWidth={0.7} />

              <text x={sx(136)} y={sy(7)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.5} fill={DRAWING_PAPER.ink}>Литера</text>
              <text x={sx(156)} y={sy(7)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.5} fill={DRAWING_PAPER.ink}>Масса</text>
              <text x={sx(173)} y={sy(7)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.5} fill={DRAWING_PAPER.ink}>Масштаб</text>

              <text x={sx(100)} y={sy(14)} textAnchor="middle" fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={9} fontWeight={600} fill={DRAWING_PAPER.ink}>
                {cut(metadata.drawingNumber, 20)}
              </text>
              <text x={sx(100)} y={sy(28)} textAnchor="middle" fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={9} fill={DRAWING_PAPER.ink}>
                {cut(metadata.title, 40)}
              </text>
              <text x={sx(100)} y={sy(50)} textAnchor="middle" fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={8.5} fill={DRAWING_PAPER.inkSoft}>
                {cut(metadata.subtitle || metadata.projectName, 48)}
              </text>

              <text x={sx(2)} y={sy(26)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.2} fill={DRAWING_PAPER.ink}>Разраб.</text>
              <text x={sx(2)} y={sy(30)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.2} fill={DRAWING_PAPER.ink}>Пров.</text>
              <text x={sx(2)} y={sy(34)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.2} fill={DRAWING_PAPER.ink}>Т.контр.</text>
              <text x={sx(2)} y={sy(40)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.2} fill={DRAWING_PAPER.ink}>Н.контр.</text>
              <text x={sx(2)} y={sy(46)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.2} fill={DRAWING_PAPER.ink}>Утв.</text>

              <text x={sx(18)} y={sy(26)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.4} fill={DRAWING_PAPER.inkSoft}>{cut(metadata.author, 10)}</text>
              <text x={sx(18)} y={sy(30)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.4} fill={DRAWING_PAPER.inkSoft}>{cut(metadata.reviewer, 10)}</text>
              <text x={sx(18)} y={sy(46)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.4} fill={DRAWING_PAPER.inkSoft}>{cut(metadata.date, 10)}</text>

              <text x={sx(139)} y={sy(37.5)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.5} fill={DRAWING_PAPER.ink}>Лист</text>
              <text x={sx(164)} y={sy(37.5)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={6.5} fill={DRAWING_PAPER.ink}>Листов</text>
              <text x={sx(145)} y={sy(52)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={8.8} fontWeight={600} fill={DRAWING_PAPER.ink}>
                {metadata.sheetNumber || "1"}
              </text>
              <text x={sx(170)} y={sy(52)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={8.8} fontWeight={600} fill={DRAWING_PAPER.ink}>1</text>

              <text x={sx(138)} y={sy(17)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={8.5} fontWeight={600} fill={DRAWING_PAPER.ink}>
                {metadata.stage || "Р"}
              </text>
              <text x={sx(158)} y={sy(17)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={8.2} fill={DRAWING_PAPER.inkSoft}>—</text>
              <text x={sx(174)} y={sy(17)} fontFamily={DRAWING_TYPOGRAPHY.family} fontSize={8.8} fontWeight={600} fill={DRAWING_PAPER.ink}>
                {metadata.scale || "1:100"}
              </text>
            </>
          );
        })()}
      </g>
    </g>
  );
};

export default SheetLayer;
