/**
 * SolarTimeOverlay — плавающий виджет управления солнечным временем.
 * Показывается поверх 3D- и 2D-канваса, позволяет выбрать час и день года.
 */

import React from "react";
import {
  computeSolarPosition,
  dayOfYearLabel,
  formatAzimuth,
  formatSolarHour,
  type SolarPosition,
} from "../../../core/solar/solarPosition";

export interface SolarTimeState {
  hour: number;      // 0–24 (истинное солнечное время)
  dayOfYear: number; // 1–365
  latitudeDeg: number;
}

interface SolarTimeOverlayProps {
  state: SolarTimeState;
  onChange: (next: Partial<SolarTimeState>) => void;
  onClose: () => void;
}

/** Компас-роза с индикатором солнца (SVG). */
export function CompassRose({ solarPosition }: { solarPosition: SolarPosition | null }) {
  const R = 36; // радиус окружности
  const CX = 44;
  const CY = 44;

  // Позиция солнца на компасе
  let sunX = CX;
  let sunY = CY - R * 0.68;
  let sunVisible = false;
  if (solarPosition && solarPosition.isAboveHorizon) {
    const az = solarPosition.azimuthDeg * (Math.PI / 180);
    // Высота влияет на расстояние от центра (зенит = центр, горизонт = край)
    const altFraction = Math.max(0, Math.min(1, solarPosition.altitudeDeg / 90));
    const r = R * 0.65 * (1 - altFraction * 0.55);
    sunX = CX + r * Math.sin(az);
    sunY = CY - r * Math.cos(az);
    sunVisible = true;
  }

  return (
    <svg
      width={88}
      height={88}
      viewBox="0 0 88 88"
      className="shrink-0"
      aria-label="Компасная роза"
    >
      {/* Внешняя окружность */}
      <circle cx={CX} cy={CY} r={R} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth={1.5} />

      {/* Тики по кардинальным направлениям */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = deg * (Math.PI / 180);
        const x1 = CX + (R - 6) * Math.sin(rad);
        const y1 = CY - (R - 6) * Math.cos(rad);
        const x2 = CX + R * Math.sin(rad);
        const y2 = CY - R * Math.cos(rad);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={1.5} />;
      })}

      {/* Стрелка на север */}
      <polygon
        points={`${CX},${CY - R + 10} ${CX - 4},${CY - 4} ${CX},${CY + 4} ${CX + 4},${CY - 4}`}
        fill="#ef4444"
        opacity={0.85}
      />
      <polygon
        points={`${CX},${CY + R - 10} ${CX - 4},${CY + 4} ${CX},${CY - 4} ${CX + 4},${CY + 4}`}
        fill="#94a3b8"
        opacity={0.7}
      />

      {/* Центральная точка */}
      <circle cx={CX} cy={CY} r={3} fill="#475569" />

      {/* Подписи сторон света */}
      <text x={CX} y={CY - R + 4} textAnchor="middle" dominantBaseline="hanging" fontSize={9} fontWeight="700" fill="#1e293b">
        С
      </text>
      <text x={CX + R - 4} y={CY} textAnchor="start" dominantBaseline="middle" fontSize={9} fontWeight="600" fill="#64748b">
        В
      </text>
      <text x={CX} y={CY + R - 4} textAnchor="middle" dominantBaseline="auto" fontSize={9} fontWeight="600" fill="#64748b">
        Ю
      </text>
      <text x={CX - R + 4} y={CY} textAnchor="end" dominantBaseline="middle" fontSize={9} fontWeight="600" fill="#64748b">
        З
      </text>

      {/* Солнце */}
      {sunVisible && (
        <g>
          {/* Лучи */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = deg * (Math.PI / 180);
            return (
              <line
                key={deg}
                x1={sunX + 6.5 * Math.cos(rad)}
                y1={sunY + 6.5 * Math.sin(rad)}
                x2={sunX + 10 * Math.cos(rad)}
                y2={sunY + 10 * Math.sin(rad)}
                stroke="#f59e0b"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })}
          <circle cx={sunX} cy={sunY} r={5.5} fill="#fbbf24" stroke="#f59e0b" strokeWidth={1} />
        </g>
      )}

      {/* Луна / ночь */}
      {!sunVisible && (
        <g opacity={0.4}>
          <circle cx={CX} cy={CY} r={5} fill="none" stroke="#64748b" strokeWidth={1.5} strokeDasharray="2,2" />
          <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#64748b">
            🌙
          </text>
        </g>
      )}
    </svg>
  );
}

export default function SolarTimeOverlay({ state, onChange, onClose }: SolarTimeOverlayProps) {
  const solarPos = computeSolarPosition({
    latitudeDeg: state.latitudeDeg,
    dayOfYear: state.dayOfYear,
    hourDecimal: state.hour,
  });

  return (
    <div className="pointer-events-auto select-none rounded-2xl border border-slate-200 bg-white/95 shadow-xl backdrop-blur-sm"
      style={{ minWidth: 280, maxWidth: 340 }}
    >
      {/* Заголовок */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">☀️</span>
          <span className="text-sm font-semibold text-slate-800">Положение солнца</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-3 px-4 pb-3 pt-3">
        {/* Компас */}
        <CompassRose solarPosition={solarPos} />

        {/* Информация о солнце */}
        <div className="flex flex-1 flex-col gap-1 pt-1">
          <div className="text-xs text-slate-500">Дата: <span className="font-medium text-slate-700">{dayOfYearLabel(state.dayOfYear)}</span></div>
          <div className="text-xs text-slate-500">Время: <span className="font-medium text-slate-700">{formatSolarHour(state.hour)}</span></div>
          {solarPos.isAboveHorizon ? (
            <>
              <div className="text-xs text-slate-500">Высота: <span className="font-medium text-amber-600">{solarPos.altitudeDeg.toFixed(1)}°</span></div>
              <div className="text-xs text-slate-500">Азимут: <span className="font-medium text-slate-700">{formatAzimuth(solarPos.azimuthDeg)}</span></div>
            </>
          ) : (
            <div className="mt-1 text-xs font-medium text-slate-400">Солнце за горизонтом</div>
          )}
          <div className="text-xs text-slate-400">φ = {state.latitudeDeg.toFixed(1)}°</div>
        </div>
      </div>

      {/* Слайдер времени */}
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <label className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>Время суток</span>
          <span className="font-semibold text-slate-700">{formatSolarHour(state.hour)}</span>
        </label>
        <input
          type="range"
          min={0}
          max={24}
          step={0.25}
          value={state.hour}
          onChange={(e) => onChange({ hour: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
          <span>00:00</span>
          <span>06:00</span>
          <span>12:00</span>
          <span>18:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Слайдер дня */}
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <label className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>День года</span>
          <span className="font-semibold text-slate-700">{dayOfYearLabel(state.dayOfYear)}</span>
        </label>
        <input
          type="range"
          min={1}
          max={365}
          step={1}
          value={state.dayOfYear}
          onChange={(e) => onChange({ dayOfYear: Number(e.target.value) })}
          className="w-full accent-amber-500"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-slate-400">
          <span>Янв</span>
          <span>Апр</span>
          <span>Июл</span>
          <span>Окт</span>
          <span>Дек</span>
        </div>
      </div>
    </div>
  );
}
