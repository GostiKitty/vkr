import React, { useEffect, useState } from "react";
import { notifyInfo } from "../../entities/notifications/notification.store";
import { useWorkflowStore } from "../../entities/workflow/workflow.store";
import { EngineeringCallout, EngineeringSectionHeader } from "../../shared/ui";

const clamp = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
};

export function ScenarioSetupPanel() {
  const saved = useWorkflowStore((state) => state.scenarioConfig);
  const setScenarioConfig = useWorkflowStore((state) => state.setScenarioConfig);
  const [baseC, setBaseC] = useState(saved?.climate.baseC ?? -5);
  const [amplitudeC, setAmplitudeC] = useState(saved?.climate.amplitudeC ?? 8);
  const [seasonalOffsetC, setSeasonalOffsetC] = useState(saved?.climate.seasonalOffsetC ?? 0);
  const [day, setDay] = useState(saved?.setpoints.day ?? 21);
  const [night, setNight] = useState(saved?.setpoints.night ?? 18);
  const [dayStart, setDayStart] = useState(saved?.setpoints.dayStartHour ?? 6);
  const [nightStart, setNightStart] = useState(saved?.setpoints.nightStartHour ?? 22);
  const [dayGain, setDayGain] = useState(saved?.internalGains.dayGain_W_m2 ?? 6);
  const [nightGain, setNightGain] = useState(saved?.internalGains.nightGain_W_m2 ?? 1);
  const [dayOcc, setDayOcc] = useState(saved?.occupancy.dayFraction ?? 1);
  const [nightOcc, setNightOcc] = useState(saved?.occupancy.nightFraction ?? 0.2);
  const [infiltration, setInfiltration] = useState(saved?.ventilation.infiltrationACH ?? 0.5);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!saved) {
      return;
    }
    setBaseC(saved.climate.baseC);
    setAmplitudeC(saved.climate.amplitudeC);
    setSeasonalOffsetC(saved.climate.seasonalOffsetC);
    setDay(saved.setpoints.day);
    setNight(saved.setpoints.night);
    setDayStart(saved.setpoints.dayStartHour);
    setNightStart(saved.setpoints.nightStartHour);
    setDayGain(saved.internalGains.dayGain_W_m2);
    setNightGain(saved.internalGains.nightGain_W_m2);
    setDayOcc(saved.occupancy.dayFraction);
    setNightOcc(saved.occupancy.nightFraction);
    setInfiltration(saved.ventilation.infiltrationACH);
  }, [saved]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setScenarioConfig({
      climate: {
        baseC,
        amplitudeC,
        seasonalOffsetC,
      },
      setpoints: {
        day,
        night,
        dayStartHour: dayStart,
        nightStartHour: nightStart,
      },
      internalGains: {
        dayGain_W_m2: dayGain,
        nightGain_W_m2: nightGain,
      },
      occupancy: {
        dayFraction: clamp(dayOcc, 0, 1),
        nightFraction: clamp(nightOcc, 0, 1),
      },
      ventilation: {
        infiltrationACH: Math.max(0, infiltration),
      },
    });
    setJustSaved(true);
    notifyInfo("Сценарий сохранён. Можно переходить к расчёту.");
    window.setTimeout(() => setJustSaved(false), 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="ui-panel space-y-5 p-4 sm:p-6">
      <EngineeringSectionHeader
        kicker="Шаг 3 · сценарий"
        title="Климат, уставки и нагрузки"
        subtitle="Входы для погодного профиля и RC-модели: уставки отопления, доли занятости, тепловыделения на м² и воздухообмен ACH (кратность воздуха в час)."
      />

      <EngineeringCallout variant="info" title="Подсказка по ACH">
        <p>
          ACH задаёт эквивалентную проводимость инфильтрации в RC (сенсибельный обмен с наружным воздухом). Это упрощение: не
          разделяет притоки по зонам и не заменяет вентиляционный расчёт.
        </p>
      </EngineeringCallout>

      <section className="ui-section space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Климат</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField label="Базовая температура, °C" value={baseC} onChange={setBaseC} step={0.5} />
          <NumberField label="Амплитуда, °C" value={amplitudeC} min={0} onChange={setAmplitudeC} step={0.5} />
          <NumberField label="Сезонный сдвиг, °C" value={seasonalOffsetC} onChange={setSeasonalOffsetC} step={0.5} />
        </div>
      </section>

      <section className="ui-section space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Уставки</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="День, °C" value={day} onChange={setDay} step={0.5} />
          <NumberField label="Ночь, °C" value={night} onChange={setNight} step={0.5} />
          <NumberField label="Старт дня, ч" value={dayStart} min={0} max={23} step={1} onChange={(v) => setDayStart(clamp(Math.round(v), 0, 23))} />
          <NumberField label="Старт ночи, ч" value={nightStart} min={0} max={23} step={1} onChange={(v) => setNightStart(clamp(Math.round(v), 0, 23))} />
        </div>
      </section>

      <section className="ui-section space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-soft)]">Тепловые поступления</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField label="День, Вт/м²" value={dayGain} min={0} onChange={setDayGain} step={0.5} />
          <NumberField label="Ночь, Вт/м²" value={nightGain} min={0} onChange={setNightGain} step={0.5} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <NumberField label="Занятость днём, доля" value={dayOcc} min={0} max={1} step={0.05} onChange={(v) => setDayOcc(clamp(v, 0, 1))} />
        <NumberField label="Занятость ночью, доля" value={nightOcc} min={0} max={1} step={0.05} onChange={(v) => setNightOcc(clamp(v, 0, 1))} />
        <NumberField label="Инфильтрация, ACH" value={infiltration} min={0} step={0.1} onChange={(v) => setInfiltration(Math.max(0, v))} />
      </section>

      <button type="submit" className="ui-btn-primary w-full px-6 py-3 text-sm">
        Сохранить сценарий
      </button>

      {justSaved && <p className="text-sm text-[color:var(--success-fg)]">Сценарий сохранён.</p>}
    </form>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="text-xs font-semibold text-[color:var(--text-muted)]">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 0.1}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isNaN(next)) {
            return;
          }
          if (typeof min === "number" && next < min) {
            onChange(min);
            return;
          }
          if (typeof max === "number" && next > max) {
            onChange(max);
            return;
          }
          onChange(next);
        }}
        className="ui-field mt-1 w-full px-3 py-2 text-sm"
      />
    </label>
  );
}

export default ScenarioSetupPanel;
