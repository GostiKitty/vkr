export function calibrateParameters(config) {
    if (!config.observations.length) {
        throw new Error("Observations array must not be empty");
    }
    if (!config.parameters.length) {
        throw new Error("At least one calibration parameter is required");
    }
    const iterations = config.iterations ?? 200;
    if (iterations <= 0) {
        throw new Error("iterations must be positive");
    }
    const rng = new DeterministicRng(config.seed ?? 2026);
    let bestParams = null;
    let bestRmse = Number.POSITIVE_INFINITY;
    let bestMape = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
        const candidate = sampleParameters(config.parameters, rng);
        const prediction = config.model(candidate);
        validatePrediction(prediction, config.observations.length);
        const rmse = computeRmse(prediction, config.observations);
        const mape = computeMape(prediction, config.observations);
        const objectiveScore = config.objective === "mape" ? mape : rmse;
        const bestObjective = config.objective === "mape" ? bestMape : bestRmse;
        if (objectiveScore < bestObjective) {
            bestParams = candidate;
            bestRmse = rmse;
            bestMape = mape;
        }
    }
    if (!bestParams) {
        throw new Error("Calibration failed to evaluate any candidate");
    }
    return {
        bestParameters: bestParams,
        rmse: bestRmse,
        mape: bestMape,
    };
}
function sampleParameters(parameters, rng) {
    const samples = {};
    parameters.forEach((param) => {
        const span = param.max - param.min;
        if (!Number.isFinite(span) || span <= 0) {
            throw new Error(`Parameter "${param.name}" must have min < max`);
        }
        samples[param.name] = param.min + rng.next() * span;
    });
    return samples;
}
function validatePrediction(prediction, expectedLength) {
    if (prediction.length !== expectedLength) {
        throw new Error(`Model returned ${prediction.length} points, expected ${expectedLength}`);
    }
    prediction.forEach((value, index) => {
        if (!Number.isFinite(value)) {
            throw new Error(`Model output at index ${index} is not finite`);
        }
    });
}
function computeRmse(prediction, observations) {
    const mse = prediction.reduce((sum, value, index) => {
        const error = value - observations[index];
        return sum + error * error;
    }, 0);
    return Math.sqrt(mse / prediction.length);
}
function computeMape(prediction, observations) {
    const eps = 1e-6;
    const apeSum = prediction.reduce((sum, value, index) => {
        const denom = Math.max(Math.abs(observations[index]), eps);
        return sum + Math.abs((value - observations[index]) / denom);
    }, 0);
    return (apeSum / prediction.length) * 100;
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
