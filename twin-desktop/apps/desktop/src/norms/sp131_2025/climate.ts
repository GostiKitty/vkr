/**
 * Климатические параметры для расчёта теплозащиты (СП 131.13330.2025, табл. 1 — выборочно).
 * Полный перечень городов можно расширять по мере необходимости проекта.
 */
export interface Sp131CityClimate {
  id: string;
  label: string;
  /** Средняя температура наружного воздуха отопительного периода, °C */
  outdoorHeatingPeriodAverageC: number;
  /** Продолжительность отопительного периода, сут */
  heatingPeriodDurationDays: number;
  /** Расчётная температура наружного воздуха (наиболее холодная пятидневка), °C */
  outdoorDesignTemperatureC: number;
  /** ГСОП, °C·сут (может пересчитываться из t_in, t_ot, z_ot) */
  gsop?: number;
}

export const SP131_CITIES: Sp131CityClimate[] = [
  { id: "moscow", label: "Москва", outdoorHeatingPeriodAverageC: -2.2, heatingPeriodDurationDays: 214, outdoorDesignTemperatureC: -26 },
  { id: "spb", label: "Санкт-Петербург", outdoorHeatingPeriodAverageC: -1.8, heatingPeriodDurationDays: 213, outdoorDesignTemperatureC: -24 },
  { id: "ekb", label: "Екатеринбург", outdoorHeatingPeriodAverageC: -5.5, heatingPeriodDurationDays: 220, outdoorDesignTemperatureC: -32 },
  { id: "novosibirsk", label: "Новосибирск", outdoorHeatingPeriodAverageC: -7.9, heatingPeriodDurationDays: 222, outdoorDesignTemperatureC: -37 },
  { id: "krasnodar", label: "Краснодар", outdoorHeatingPeriodAverageC: 2.7, heatingPeriodDurationDays: 147, outdoorDesignTemperatureC: -15 },
];

export function getSp131CityClimate(cityId: string | null | undefined): Sp131CityClimate | null {
  if (!cityId) {
    return null;
  }
  const normalized = cityId.trim().toLowerCase();
  return SP131_CITIES.find((c) => c.id === normalized || c.label.toLowerCase() === normalized) ?? null;
}

export function listSp131Cities(): Sp131CityClimate[] {
  return [...SP131_CITIES];
}
