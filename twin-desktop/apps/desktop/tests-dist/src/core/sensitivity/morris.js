/**
 * Runs the Morris elementary effects method (Morris, 1991) to estimate
 * parameter importance. mu* is the mean absolute effect per eq. (5) of Campolongo et al. (2007),
 * while sigma is the standard deviation of the elementary effects capturing non-linearity.
 */
export function runMorrisAnalysis(config) {
    if (config.parameters.length === 0) {
        throw new Error("Morris analysis requires at least one parameter");
    }
    if (config.levels < 2) {
        throw new Error("levels must be >= 2");
    }
    if (config.trajectories < 1) {
        throw new Error("trajectories must be >= 1");
    }
    const rng = new DeterministicRng(config.seed ?? 1337);
    const k = config.parameters.length;
    const deltaNormalized = config.delta ?? config.levels / (2 * (config.levels - 1));
    const gridStep = 1 / (config.levels - 1);
    const effectMap = new Map();
    config.parameters.forEach((param) => effectMap.set(param.name, []));
    for (let trajectory = 0; trajectory < config.trajectories; trajectory++) {
        const basePoint = createBasePoint(k, gridStep, deltaNormalized, rng);
        const order = shuffleIndices(k, rng);
        const directions = createDirections(k, rng);
        let currentPoint = basePoint.slice();
        let currentOutput = config.evaluator(toActual(currentPoint, config.parameters));
        order.forEach((paramIndex, stepIndex) => {
            const direction = adjustDirection(currentPoint[paramIndex], directions[paramIndex], deltaNormalized);
            const nextPoint = currentPoint.slice();
            nextPoint[paramIndex] = clamp01(currentPoint[paramIndex] + direction * deltaNormalized);
            const nextOutput = config.evaluator(toActual(nextPoint, config.parameters));
            const delta = nextPoint[paramIndex] - currentPoint[paramIndex];
            if (delta === 0) {
                currentPoint = nextPoint;
                currentOutput = nextOutput;
                return;
            }
            const effect = (nextOutput - currentOutput) / delta;
            const paramName = config.parameters[paramIndex].name;
            effectMap.get(paramName)?.push(effect);
            currentPoint = nextPoint;
            currentOutput = nextOutput;
        });
    }
    const entries = config.parameters.map((param) => {
        const effects = effectMap.get(param.name) ?? [];
        const absoluteMean = effects.length
            ? effects.reduce((sum, value) => sum + Math.abs(value), 0) / effects.length
            : 0;
        const mean = effects.length ? effects.reduce((sum, value) => sum + value, 0) / effects.length : 0;
        const variance = effects.length > 1
            ? effects.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (effects.length - 1)
            : 0;
        return {
            name: param.name,
            muStar: absoluteMean,
            sigma: Math.sqrt(variance),
            rank: 0,
        };
    });
    entries.sort((a, b) => b.muStar - a.muStar);
    entries.forEach((entry, index) => {
        entry.rank = index + 1;
    });
    return { entries };
}
function toActual(point, parameters) {
    const inputs = {};
    point.forEach((value, idx) => {
        const param = parameters[idx];
        inputs[param.name] = param.min + value * (param.max - param.min);
    });
    return inputs;
}
function createBasePoint(dimension, gridStep, delta, rng) {
    const maxIndex = Math.max(0, Math.floor((1 - delta) / gridStep));
    const point = [];
    for (let i = 0; i < dimension; i++) {
        const index = Math.floor(rng.next() * (maxIndex + 1));
        const value = Math.min(index * gridStep, 1 - delta);
        point.push(value);
    }
    return point;
}
function shuffleIndices(length, rng) {
    const indices = Array.from({ length }, (_, idx) => idx);
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
}
function createDirections(length, rng) {
    const dirs = [];
    for (let i = 0; i < length; i++) {
        dirs.push(rng.next() < 0.5 ? 1 : -1);
    }
    return dirs;
}
function adjustDirection(value, direction, delta) {
    const next = value + direction * delta;
    if (next < 0 || next > 1) {
        return -direction;
    }
    return direction;
}
function clamp01(value) {
    return Math.min(1, Math.max(0, value));
}
class DeterministicRng {
    state;
    constructor(seed) {
        this.state = seed >>> 0;
    }
    next() {
        this.state |= 0;
        this.state = (this.state + 0x6d2b79f5) | 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}
