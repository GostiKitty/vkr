import { BUILDING_CATEGORIES } from "./buildingCategories";
export const INTERNAL_HEAT_TRANSFER_COEFFICIENTS = {
    wall: 8.7,
    floor: 8.7,
    smoothCeiling: 8.7,
    ribbedCeiling: 7.6,
    roof: 8.7,
    atticFloor: 8.7,
    floorOverBasement: 8.7,
    window: 8,
    door: 8,
    gate: 8,
    lantern: 9.9,
};
export const EXTERNAL_HEAT_TRANSFER_COEFFICIENTS = {
    wall: 23,
    roof: 23,
    floorOverDriveway: 23,
    floorOverColdBasementVentilated: 17,
    wallWithVentilatedAirGap: 12,
    atticFloor: 12,
    floorOverUnheatedBasementWithOpenings: 12,
    floorOverUnheatedBasementClosed: 6,
    floorOnGround: 6,
};
const DELTA_T_RULES = {
    1: {
        wall: 4,
        roof: 3,
        atticFloor: 3,
        floorOverBasement: 2,
        window: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
        door: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
    },
    2: {
        wall: 4.5,
        roof: 4,
        atticFloor: 4,
        floorOverBasement: 2.5,
        window: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
        door: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
    },
    3: {
        wall: ({ indoorTemperatureC, dewPointC }) => Math.min(indoorTemperatureC - dewPointC, 7),
        roof: ({ indoorTemperatureC, dewPointC }) => Math.min(0.8 * (indoorTemperatureC - dewPointC), 6),
        atticFloor: ({ indoorTemperatureC, dewPointC }) => Math.min(0.8 * (indoorTemperatureC - dewPointC), 6),
        floorOverBasement: 2.5,
        window: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
        door: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
    },
    4: {
        wall: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
        roof: ({ indoorTemperatureC, dewPointC }) => 0.8 * (indoorTemperatureC - dewPointC),
        atticFloor: ({ indoorTemperatureC, dewPointC }) => 0.8 * (indoorTemperatureC - dewPointC),
        floorOverBasement: 2.5,
        window: () => null,
        door: () => null,
    },
    5: {
        wall: 12,
        roof: 12,
        atticFloor: 12,
        floorOverBasement: 2.5,
        window: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
        door: ({ indoorTemperatureC, dewPointC }) => indoorTemperatureC - dewPointC,
    },
};
export function getInternalHeatTransferCoefficient(surfaceType) {
    return INTERNAL_HEAT_TRANSFER_COEFFICIENTS[surfaceType];
}
export function getExternalHeatTransferCoefficient(surfaceType) {
    switch (surfaceType) {
        case "wall":
        case "roof":
        case "window":
        case "door":
        case "gate":
            return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.wall;
        case "atticFloor":
        case "lantern":
            return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.atticFloor;
        case "floorOverBasement":
            return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.floorOverColdBasementVentilated;
        case "floor":
        case "smoothCeiling":
        case "ribbedCeiling":
            return null;
        default:
            return null;
    }
}
export function getExternalHeatTransferCoefficientByCondition(input) {
    if (input.constructionType === "wall" && input.isVentilatedAirGap) {
        return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.wallWithVentilatedAirGap;
    }
    if (input.constructionType === "roof" || input.constructionType === "covering") {
        return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.roof;
    }
    if (input.constructionType === "atticFloor" || input.constructionType === "lantern") {
        return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.atticFloor;
    }
    if (input.constructionType === "floorOnGround") {
        return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.floorOnGround;
    }
    if (input.constructionType === "floorOverBasement") {
        if (input.basementVentilatedByOutdoorAir) {
            return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.floorOverColdBasementVentilated;
        }
        if (input.basementHasOpenings) {
            return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.floorOverUnheatedBasementWithOpenings;
        }
        return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.floorOverUnheatedBasementClosed;
    }
    if (input.constructionType === "window" || input.constructionType === "door" || input.constructionType === "gate" || input.constructionType === "wall") {
        return EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.wall;
    }
    return null;
}
export function getNormalizedTemperatureDifference(input) {
    const category = BUILDING_CATEGORIES[input.buildingCategory];
    const normalizedType = input.constructionType === "floorOnGround"
        ? "floorOverBasement"
        : input.constructionType === "covering"
            ? "roof"
            : input.constructionType;
    if (normalizedType === "gate" || normalizedType === "lantern") {
        return null;
    }
    const rule = DELTA_T_RULES[category.temperatureCategory][normalizedType];
    if (!rule) {
        return null;
    }
    return typeof rule === "number" ? rule : rule({ indoorTemperatureC: input.indoorTemperatureC, dewPointC: input.dewPointC });
}
export function getDefaultSurfaceResistanceProfile() {
    const alphaIn = getInternalHeatTransferCoefficient("wall");
    const alphaOut = EXTERNAL_HEAT_TRANSFER_COEFFICIENTS.wall;
    return {
        internal_m2K_W: 1 / alphaIn,
        external_m2K_W: 1 / alphaOut,
    };
}
