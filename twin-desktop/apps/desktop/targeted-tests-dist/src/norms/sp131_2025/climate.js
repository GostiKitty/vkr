function gsop20(tOt, zOt) {
    return Math.round((20 - tOt) * zOt);
}
export const SP131_CITIES = [
    // Европейская часть России
    { id: "moscow", label: "Москва", outdoorHeatingPeriodAverageC: -2.2, heatingPeriodDurationDays: 214, outdoorDesignTemperatureC: -26, gsop: gsop20(-2.2, 214), winterWindSpeedM_s: 4.9, summerWindSpeedM_s: 3.0 },
    { id: "spb", label: "Санкт-Петербург", outdoorHeatingPeriodAverageC: -1.8, heatingPeriodDurationDays: 213, outdoorDesignTemperatureC: -24, gsop: gsop20(-1.8, 213), winterWindSpeedM_s: 3.8, summerWindSpeedM_s: 3.5 },
    { id: "voronezh", label: "Воронеж", outdoorHeatingPeriodAverageC: -2.0, heatingPeriodDurationDays: 197, outdoorDesignTemperatureC: -26, gsop: gsop20(-2.0, 197), winterWindSpeedM_s: 4.5, summerWindSpeedM_s: 3.3 },
    { id: "nizhny_novgorod", label: "Нижний Новгород", outdoorHeatingPeriodAverageC: -3.7, heatingPeriodDurationDays: 215, outdoorDesignTemperatureC: -30, gsop: gsop20(-3.7, 215), winterWindSpeedM_s: 4.6, summerWindSpeedM_s: 3.1 },
    { id: "kazan", label: "Казань", outdoorHeatingPeriodAverageC: -4.8, heatingPeriodDurationDays: 219, outdoorDesignTemperatureC: -32, gsop: gsop20(-4.8, 219), winterWindSpeedM_s: 4.6, summerWindSpeedM_s: 3.1 },
    { id: "samara", label: "Самара", outdoorHeatingPeriodAverageC: -4.4, heatingPeriodDurationDays: 213, outdoorDesignTemperatureC: -30, gsop: gsop20(-4.4, 213), winterWindSpeedM_s: 4.3, summerWindSpeedM_s: 3.6 },
    { id: "ufa", label: "Уфа", outdoorHeatingPeriodAverageC: -5.4, heatingPeriodDurationDays: 218, outdoorDesignTemperatureC: -34, gsop: gsop20(-5.4, 218), winterWindSpeedM_s: 4.4, summerWindSpeedM_s: 3.1 },
    { id: "saratov", label: "Саратов", outdoorHeatingPeriodAverageC: -3.1, heatingPeriodDurationDays: 205, outdoorDesignTemperatureC: -27, gsop: gsop20(-3.1, 205), winterWindSpeedM_s: 4.8, summerWindSpeedM_s: 3.6 },
    { id: "volgograd", label: "Волгоград", outdoorHeatingPeriodAverageC: -1.3, heatingPeriodDurationDays: 191, outdoorDesignTemperatureC: -23, gsop: gsop20(-1.3, 191), winterWindSpeedM_s: 6.3, summerWindSpeedM_s: 4.5 },
    { id: "rostov", label: "Ростов-на-Дону", outdoorHeatingPeriodAverageC: 1.0, heatingPeriodDurationDays: 165, outdoorDesignTemperatureC: -19, gsop: gsop20(1.0, 165), winterWindSpeedM_s: 5.3, summerWindSpeedM_s: 3.7 },
    { id: "krasnodar", label: "Краснодар", outdoorHeatingPeriodAverageC: 2.7, heatingPeriodDurationDays: 147, outdoorDesignTemperatureC: -15, gsop: gsop20(2.7, 147), winterWindSpeedM_s: 3.8, summerWindSpeedM_s: 3.0 },
    // Урал
    { id: "ekb", label: "Екатеринбург", outdoorHeatingPeriodAverageC: -5.5, heatingPeriodDurationDays: 220, outdoorDesignTemperatureC: -32, gsop: gsop20(-5.5, 220), winterWindSpeedM_s: 4.9, summerWindSpeedM_s: 3.2 },
    { id: "chelyabinsk", label: "Челябинск", outdoorHeatingPeriodAverageC: -6.0, heatingPeriodDurationDays: 218, outdoorDesignTemperatureC: -33, gsop: gsop20(-6.0, 218), winterWindSpeedM_s: 5.5, summerWindSpeedM_s: 3.6 },
    { id: "perm", label: "Пермь", outdoorHeatingPeriodAverageC: -5.7, heatingPeriodDurationDays: 225, outdoorDesignTemperatureC: -35, gsop: gsop20(-5.7, 225), winterWindSpeedM_s: 3.8, summerWindSpeedM_s: 2.7 },
    // Западная Сибирь
    { id: "tyumen", label: "Тюмень", outdoorHeatingPeriodAverageC: -7.2, heatingPeriodDurationDays: 226, outdoorDesignTemperatureC: -38, gsop: gsop20(-7.2, 226), winterWindSpeedM_s: 4.8, summerWindSpeedM_s: 3.1 },
    { id: "omsk", label: "Омск", outdoorHeatingPeriodAverageC: -8.0, heatingPeriodDurationDays: 221, outdoorDesignTemperatureC: -38, gsop: gsop20(-8.0, 221), winterWindSpeedM_s: 4.9, summerWindSpeedM_s: 3.4 },
    { id: "novosibirsk", label: "Новосибирск", outdoorHeatingPeriodAverageC: -7.9, heatingPeriodDurationDays: 222, outdoorDesignTemperatureC: -37, gsop: gsop20(-7.9, 222), winterWindSpeedM_s: 4.8, summerWindSpeedM_s: 3.4 },
    { id: "tomsk", label: "Томск", outdoorHeatingPeriodAverageC: -8.9, heatingPeriodDurationDays: 235, outdoorDesignTemperatureC: -40, gsop: gsop20(-8.9, 235), winterWindSpeedM_s: 3.3, summerWindSpeedM_s: 2.6 },
    // Восточная Сибирь и ДВ
    { id: "krasnoyarsk", label: "Красноярск", outdoorHeatingPeriodAverageC: -8.8, heatingPeriodDurationDays: 234, outdoorDesignTemperatureC: -40, gsop: gsop20(-8.8, 234), winterWindSpeedM_s: 3.6, summerWindSpeedM_s: 2.8 },
    { id: "irkutsk", label: "Иркутск", outdoorHeatingPeriodAverageC: -9.7, heatingPeriodDurationDays: 247, outdoorDesignTemperatureC: -40, gsop: gsop20(-9.7, 247), winterWindSpeedM_s: 2.3, summerWindSpeedM_s: 2.8 },
    { id: "khabarovsk", label: "Хабаровск", outdoorHeatingPeriodAverageC: -9.0, heatingPeriodDurationDays: 218, outdoorDesignTemperatureC: -31, gsop: gsop20(-9.0, 218), winterWindSpeedM_s: 4.5, summerWindSpeedM_s: 2.9 },
];
export function getSp131CityClimate(cityId) {
    if (!cityId) {
        return null;
    }
    const normalized = cityId.trim().toLowerCase();
    return SP131_CITIES.find((c) => c.id === normalized || c.label.toLowerCase() === normalized) ?? null;
}
export function listSp131Cities() {
    return [...SP131_CITIES];
}
/** Опции для select «Климатический регион» в UI. */
export function sp131CitySelectOptions() {
    return SP131_CITIES.map((city) => ({ value: city.id, label: city.label }));
}
