export const KOB_GSOP_POINTS = [1000, 3000, 5000, 8000, 12000];
export const KOB_NORM_TABLE = [
    { heatedVolumeM3: 150, valuesByGsop: { 1000: 1.206, 3000: 0.892, 5000: 0.708, 8000: 0.541, 12000: 0.411 } },
    { heatedVolumeM3: 300, valuesByGsop: { 1000: 0.957, 3000: 0.708, 5000: 0.562, 8000: 0.429, 12000: 0.326 } },
    { heatedVolumeM3: 600, valuesByGsop: { 1000: 0.759, 3000: 0.562, 5000: 0.446, 8000: 0.341, 12000: 0.259 } },
    { heatedVolumeM3: 1200, valuesByGsop: { 1000: 0.606, 3000: 0.449, 5000: 0.356, 8000: 0.272, 12000: 0.207 } },
    { heatedVolumeM3: 2500, valuesByGsop: { 1000: 0.486, 3000: 0.36, 5000: 0.286, 8000: 0.218, 12000: 0.166 } },
    { heatedVolumeM3: 6000, valuesByGsop: { 1000: 0.391, 3000: 0.289, 5000: 0.229, 8000: 0.175, 12000: 0.133 } },
    { heatedVolumeM3: 15000, valuesByGsop: { 1000: 0.327, 3000: 0.242, 5000: 0.192, 8000: 0.146, 12000: 0.111 } },
    { heatedVolumeM3: 50000, valuesByGsop: { 1000: 0.277, 3000: 0.205, 5000: 0.162, 8000: 0.124, 12000: 0.094 } },
    { heatedVolumeM3: 200000, valuesByGsop: { 1000: 0.246, 3000: 0.182, 5000: 0.145, 8000: 0.111, 12000: 0.084 } },
];
export function getSpecificThermalProtectionNorm(input) {
    if (!Number.isFinite(input.heatedVolumeM3) || input.heatedVolumeM3 <= 0 || !Number.isFinite(input.gsop) || input.gsop <= 0) {
        return null;
    }
    const tableValue = interpolateKobNormFromTable(input.heatedVolumeM3, input.gsop);
    const formulaValue = calculateKobNormByFormula(input.heatedVolumeM3, input.gsop);
    const floorValue = calculateKobNormFloor(input.gsop);
    const candidate = formulaValue !== null ? Math.max(formulaValue, floorValue) : floorValue;
    if (input.heatedVolumeM3 > 200000) {
        return candidate;
    }
    return tableValue ?? candidate;
}
export function interpolateKobNormFromTable(heatedVolumeM3, gsop) {
    const rows = [...KOB_NORM_TABLE].sort((left, right) => left.heatedVolumeM3 - right.heatedVolumeM3);
    if (heatedVolumeM3 <= rows[0].heatedVolumeM3) {
        return interpolateByGsop(rows[0].valuesByGsop, gsop);
    }
    if (heatedVolumeM3 >= rows[rows.length - 1].heatedVolumeM3) {
        return interpolateByGsop(rows[rows.length - 1].valuesByGsop, gsop);
    }
    for (let index = 1; index < rows.length; index += 1) {
        const left = rows[index - 1];
        const right = rows[index];
        if (heatedVolumeM3 >= left.heatedVolumeM3 && heatedVolumeM3 <= right.heatedVolumeM3) {
            const leftValue = interpolateByGsop(left.valuesByGsop, gsop);
            const rightValue = interpolateByGsop(right.valuesByGsop, gsop);
            if (leftValue === null || rightValue === null) {
                return null;
            }
            const ratio = (heatedVolumeM3 - left.heatedVolumeM3) / (right.heatedVolumeM3 - left.heatedVolumeM3);
            return leftValue + ratio * (rightValue - leftValue);
        }
    }
    return null;
}
export function calculateKobNormByFormula(heatedVolumeM3, gsop) {
    const denominator = 0.00013 * gsop + 0.61;
    if (denominator <= 0) {
        return null;
    }
    if (heatedVolumeM3 <= 960) {
        return 4.74 / (denominator * Math.cbrt(heatedVolumeM3));
    }
    return (0.16 + 10 / Math.sqrt(heatedVolumeM3)) / denominator;
}
export function calculateKobNormFloor(gsop) {
    return 8.5 / gsop;
}
function interpolateByGsop(valuesByGsop, gsop) {
    const points = Object.keys(valuesByGsop)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right);
    if (!points.length) {
        return null;
    }
    if (gsop <= points[0]) {
        return valuesByGsop[points[0]];
    }
    if (gsop >= points[points.length - 1]) {
        return valuesByGsop[points[points.length - 1]];
    }
    for (let index = 1; index < points.length; index += 1) {
        const left = points[index - 1];
        const right = points[index];
        if (gsop >= left && gsop <= right) {
            const ratio = (gsop - left) / (right - left);
            return valuesByGsop[left] + ratio * (valuesByGsop[right] - valuesByGsop[left]);
        }
    }
    return null;
}
