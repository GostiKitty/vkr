/**
 * Расчёт положения солнца (высота + азимут) по астрономическим формулам.
 *
 * Система координат THREE.js:
 *   Y = вертикаль (вверх)
 *   X = восток (+X)
 *   Z = юг  (+Z), т.е. север = -Z
 *
 * Азимут отсчитывается от севера по часовой стрелке:
 *   0°=N, 90°=E, 180°=S, 270°=W
 */
const DEG = Math.PI / 180;
/**
 * Вычисляет положение солнца по упрощённым солнечным формулам.
 *
 * @param latitudeDeg  Широта места, ° (>0 = северная)
 * @param dayOfYear    День года [1..365]
 * @param hourDecimal  Истинное солнечное время, часы [0..24]
 */
export function computeSolarPosition(params) {
    const { latitudeDeg, dayOfYear, hourDecimal } = params;
    const latRad = latitudeDeg * DEG;
    // Склонение солнца δ (Spencer 1971)
    const declDeg = 23.45 * Math.sin(DEG * (360 / 365) * (dayOfYear - 80));
    const declRad = declDeg * DEG;
    // Часовой угол H: солнечный полдень = 0, утро < 0, вечер > 0
    const hourAngleDeg = (hourDecimal - 12.0) * 15.0;
    const hourAngleRad = hourAngleDeg * DEG;
    // Синус высоты солнца
    const sinAlt = Math.sin(latRad) * Math.sin(declRad) +
        Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
    const altRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const altDeg = altRad / DEG;
    // Азимут (от севера, по часовой стрелке)
    let azDeg;
    const cosAlt = Math.cos(altRad);
    if (cosAlt < 1e-9) {
        // Солнце в зените — азимут неопределён, берём юг
        azDeg = 180;
    }
    else {
        const cosAz = (Math.sin(declRad) - Math.sin(altRad) * Math.sin(latRad)) /
            (cosAlt * Math.cos(latRad));
        const azRad = Math.acos(Math.max(-1, Math.min(1, cosAz)));
        azDeg = azRad / DEG;
        // Во второй половине дня солнце движется к западу
        if (Math.sin(hourAngleRad) > 0) {
            azDeg = 360 - azDeg;
        }
    }
    // Вектор положения источника света в THREE.js (north = –Z, east = +X, up = +Y)
    const azRad = azDeg * DEG;
    const cosAltFinal = Math.cos(altRad);
    const lightX = Math.sin(azRad) * cosAltFinal;
    const lightY = Math.sin(altRad);
    const lightZ = -Math.cos(azRad) * cosAltFinal; // минус — север = –Z
    // Нормируем на случай числовых погрешностей
    const len = Math.hypot(lightX, lightY, lightZ) || 1;
    return {
        altitudeDeg: altDeg,
        azimuthDeg: azDeg,
        isAboveHorizon: altDeg > 0,
        lightX: lightX / len,
        lightY: lightY / len,
        lightZ: lightZ / len,
    };
}
/** Форматирование азимута в виде "123° (SE)" */
export function formatAzimuth(azDeg) {
    const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
    const idx = Math.round(azDeg / 45) % 8;
    return `${Math.round(azDeg)}° (${dirs[idx]})`;
}
/** Форматирование часа в виде "14:30" */
export function formatSolarHour(hourDecimal) {
    const h = Math.floor(hourDecimal);
    const m = Math.round((hourDecimal - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
/** Приблизительное название сезона/месяца по дню года */
export function dayOfYearLabel(day) {
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const cumDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
    let month = 0;
    for (let i = 0; i < 12; i++) {
        if (day > cumDays[i] && day <= cumDays[i + 1]) {
            month = i;
            break;
        }
    }
    const dayInMonth = day - cumDays[month];
    return `${dayInMonth} ${months[month]}`;
}
