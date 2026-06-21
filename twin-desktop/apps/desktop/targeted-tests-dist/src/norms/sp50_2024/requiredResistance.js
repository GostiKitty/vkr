export const REQUIRED_RESISTANCE_GSOP_POINTS = [1000, 2000, 4000, 6000, 8000, 10000, 12000];
export const REQUIRED_RESISTANCE_TABLE = {
    "1.1": {
        wall: {
            values: { 1000: 1.75, 2000: 2.1, 4000: 2.8, 6000: 3.5, 8000: 4.2, 10000: 4.9, 12000: 5.6 },
            coefficients: { a: 0.00035, b: 1.4 },
        },
        covering: {
            values: { 1000: 2.7, 2000: 3.2, 4000: 4.2, 6000: 5.2, 8000: 6.2, 10000: 7.2, 12000: 8.2 },
            coefficients: { a: 0.0005, b: 2.2 },
        },
        floor: {
            values: { 1000: 2.35, 2000: 2.8, 4000: 3.7, 6000: 4.6, 8000: 5.5, 10000: 6.4, 12000: 7.3 },
            coefficients: { a: 0.00045, b: 1.9 },
        },
        window: {
            values: { 1000: 0.49, 2000: 0.49, 4000: 0.63, 6000: 0.73, 8000: 0.75, 10000: 0.77, 12000: 0.8 },
            capAt12000: true,
        },
        lantern: {
            values: { 1000: 0.28, 2000: 0.3, 4000: 0.35, 6000: 0.4, 8000: 0.45, 10000: 0.5, 12000: 0.55 },
            coefficients: { a: 0.000025, b: 0.25 },
        },
    },
    "1.2": {
        wall: {
            values: { 1000: 1.75, 2000: 2.1, 4000: 2.8, 6000: 3.5, 8000: 4.2, 10000: 4.9, 12000: 5.6 },
            coefficients: { a: 0.00035, b: 1.4 },
        },
        covering: {
            values: { 1000: 2.7, 2000: 3.2, 4000: 4.2, 6000: 5.2, 8000: 6.2, 10000: 7.2, 12000: 8.2 },
            coefficients: { a: 0.0005, b: 2.2 },
        },
        floor: {
            values: { 1000: 2.35, 2000: 2.8, 4000: 3.7, 6000: 4.6, 8000: 5.5, 10000: 6.4, 12000: 7.3 },
            coefficients: { a: 0.00045, b: 1.9 },
        },
        window: {
            values: { 1000: 0.3, 2000: 0.3, 4000: 0.45, 6000: 0.6, 8000: 0.7, 10000: 0.75, 12000: 0.8 },
            capAt12000: true,
        },
        lantern: {
            values: { 1000: 0.28, 2000: 0.3, 4000: 0.35, 6000: 0.4, 8000: 0.45, 10000: 0.5, 12000: 0.55 },
            coefficients: { a: 0.000025, b: 0.25 },
        },
    },
    "2": {
        wall: {
            values: { 1000: 1.5, 2000: 1.8, 4000: 2.4, 6000: 3.0, 8000: 3.6, 10000: 4.2, 12000: 4.8 },
            coefficients: { a: 0.0003, b: 1.2 },
        },
        covering: {
            values: { 1000: 1.5, 2000: 2.0, 4000: 2.8, 6000: 3.4, 8000: 3.9, 10000: 4.4, 12000: 4.8 },
        },
        floor: {
            values: { 1000: 1.2, 2000: 1.6, 4000: 2.2, 6000: 2.7, 8000: 3.1, 10000: 3.5, 12000: 3.8 },
        },
        window: {
            values: { 1000: 0.49, 2000: 0.49, 4000: 0.63, 6000: 0.73, 8000: 0.75, 10000: 0.77, 12000: 0.8 },
            capAt12000: true,
        },
        lantern: {
            values: { 1000: 0.28, 2000: 0.3, 4000: 0.35, 6000: 0.4, 8000: 0.45, 10000: 0.5, 12000: 0.55 },
            coefficients: { a: 0.000025, b: 0.25 },
        },
    },
    "3": {
        wall: {
            values: { 1000: 1.2, 2000: 1.4, 4000: 1.8, 6000: 2.2, 8000: 2.6, 10000: 3.0, 12000: 3.4 },
            coefficients: { a: 0.0002, b: 1.0 },
        },
        covering: {
            values: { 1000: 1.5, 2000: 2.0, 4000: 2.8, 6000: 3.4, 8000: 3.9, 10000: 4.4, 12000: 4.8 },
        },
        floor: {
            values: { 1000: 1.2, 2000: 1.6, 4000: 2.2, 6000: 2.7, 8000: 3.1, 10000: 3.5, 12000: 3.8 },
        },
        window: {
            values: { 1000: 0.23, 2000: 0.25, 4000: 0.3, 6000: 0.35, 8000: 0.4, 10000: 0.45, 12000: 0.5 },
            coefficients: { a: 0.000025, b: 0.2 },
            capAt12000: true,
        },
        lantern: {
            values: { 1000: 0.18, 2000: 0.2, 4000: 0.25, 6000: 0.3, 8000: 0.35, 10000: 0.4, 12000: 0.45 },
            coefficients: { a: 0.000025, b: 0.15 },
        },
    },
};
const BUILDING_CATEGORY_TO_TABLE_CATEGORY = {
    residential: "1.1",
    medical: "1.2",
    preschool: "1.2",
    educational: "1.2",
    public: "2",
    administrative: "2",
    industrialDry: "3",
    agricultural: "3",
    storage: "3",
};
function mapConstructionType(constructionType) {
    switch (constructionType) {
        case "wall":
            return "wall";
        case "roof":
        case "covering":
            return "covering";
        case "atticFloor":
        case "floorOverBasement":
        case "floorOnGround":
            return "floor";
        case "window":
            return "window";
        case "door":
        case "gate":
            return null;
        case "lantern":
            return "lantern";
        default:
            return null;
    }
}
export function getRequiredResistance(input) {
    const row = getRequiredResistanceRow(input.buildingCategory, input.constructionType);
    if (!row || !Number.isFinite(input.gsop) || input.gsop <= 0) {
        return null;
    }
    if (row.coefficients) {
        return input.constructionType === "window" && input.gsop > 12000 && row.capAt12000
            ? row.values[12000]
            : row.coefficients.a * input.gsop + row.coefficients.b;
    }
    return interpolateRequiredResistance(row.values, input.gsop, row.capAt12000 ?? false);
}
export function getRequiredResistanceCoefficients(buildingCategory, constructionType) {
    return getRequiredResistanceRow(buildingCategory, constructionType)?.coefficients ?? null;
}
export function getRequiredResistanceRow(buildingCategory, constructionType) {
    const tableCategory = BUILDING_CATEGORY_TO_TABLE_CATEGORY[buildingCategory];
    const tableType = mapConstructionType(constructionType);
    if (!tableCategory || !tableType) {
        return null;
    }
    return REQUIRED_RESISTANCE_TABLE[tableCategory][tableType] ?? null;
}
export function getRequiredResistanceTableCategory(buildingCategory) {
    return BUILDING_CATEGORY_TO_TABLE_CATEGORY[buildingCategory] ?? null;
}
export function interpolateRequiredResistance(values, gsop, capAt12000 = false) {
    const points = Object.keys(values)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
    if (!points.length) {
        return null;
    }
    if (gsop <= points[0]) {
        return values[points[0]];
    }
    const maxPoint = points[points.length - 1];
    if (gsop >= maxPoint) {
        return capAt12000 ? values[maxPoint] : values[maxPoint];
    }
    for (let index = 1; index < points.length; index += 1) {
        const left = points[index - 1];
        const right = points[index];
        if (gsop >= left && gsop <= right) {
            const ratio = (gsop - left) / (right - left);
            return values[left] + ratio * (values[right] - values[left]);
        }
    }
    return null;
}
