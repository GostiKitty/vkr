const LOCALE = "ru-RU";

type NullableNumber = number | null | undefined;

interface FormatConfig extends Intl.NumberFormatOptions {
  fallback?: string;
}

export function formatNumber(value: NullableNumber, options?: FormatConfig): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return options?.fallback ?? "—";
  }
  const { fallback, ...intlOptions } = options ?? {};
  void fallback;
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...intlOptions,
  }).format(value);
}

export function formatArea(value: NullableNumber): string {
  const formatted = formatNumber(value, { maximumFractionDigits: 2 });
  return formatted === "—" ? formatted : `${formatted} м²`;
}

export function formatVolume(value: NullableNumber): string {
  const formatted = formatNumber(value, { maximumFractionDigits: 2 });
  return formatted === "—" ? formatted : `${formatted} м³`;
}

export function formatEnergy(value: NullableNumber, unit: string = "kWh"): string {
  const formatted = formatNumber(value, { maximumFractionDigits: 1 });
  return formatted === "—" ? formatted : `${formatted} ${unit}`;
}

export function formatPercentage(value: NullableNumber): string {
  const formatted = formatNumber(value, {
    style: "percent",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
  return formatted;
}
