const LOCALE = "ru-RU";
export function formatNumber(value, options) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return options?.fallback ?? "—";
    }
    const { fallback, ...intlOptions } = options ?? {};
    return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        ...intlOptions,
    }).format(value);
}
export function formatArea(value) {
    const formatted = formatNumber(value, { maximumFractionDigits: 2 });
    return formatted === "—" ? formatted : `${formatted} м²`;
}
export function formatVolume(value) {
    const formatted = formatNumber(value, { maximumFractionDigits: 2 });
    return formatted === "—" ? formatted : `${formatted} м³`;
}
export function formatEnergy(value, unit = "kWh") {
    const formatted = formatNumber(value, { maximumFractionDigits: 1 });
    return formatted === "—" ? formatted : `${formatted} ${unit}`;
}
export function formatPercentage(value) {
    const formatted = formatNumber(value, {
        style: "percent",
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
    });
    return formatted;
}
