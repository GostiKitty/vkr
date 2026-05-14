const MIN_LAYER_THICKNESS_M = 0.001;
const MIN_DX_M = 1e-5;
const MAX_REASONABLE_TEMPERATURE_C = 200;
const MAX_REASONABLE_STEP_DELTA_C = 80;
export function solveTransient1DExplicit(layers, scenario, options = {}) {
    if (!layers.length) {
        throw new Error("Для нестационарного расчета требуется хотя бы один слой конструкции.");
    }
    if (scenario.duration_s <= 0 || scenario.timeStep_s <= 0) {
        throw new Error("duration_s и timeStep_s должны быть положительными.");
    }
    const warnings = ["Использована узловая аппроксимация многослойной конструкции."];
    const layerValidationWarnings = validateLayers(layers);
    warnings.push(...layerValidationWarnings);
    if (layerValidationWarnings.length) {
        return buildInvalidTransientResult({
            scenario,
            warnings,
            invalidReason: "Обнаружены некорректные параметры слоев конструкции для нестационарного расчета.",
        });
    }
    const nodes = discretizeLayers(layers);
    if (!nodes.length) {
        throw new Error("Не удалось дискретизировать конструкцию по толщине.");
    }
    const nodeValidationWarnings = validateNodes(nodes);
    warnings.push(...nodeValidationWarnings);
    if (nodeValidationWarnings.length) {
        return buildInvalidTransientResult({
            scenario,
            warnings,
            invalidReason: "Дискретизация конструкции дала некорректные узлы по толщине.",
            nodes,
        });
    }
    const time = buildTimeAxis(scenario.duration_s, scenario.timeStep_s);
    const stableState = evaluateExplicitStability(nodes, scenario.timeStep_s);
    if (!stableState.stable) {
        const instabilityWarning = `Явная схема неустойчива: max(r) = ${stableState.maxR.toFixed(3)} >= 0.5. Уменьшите шаг времени до ${stableState.suggestedTimeStep_s.toFixed(1)} с или меньше.`;
        warnings.push(instabilityWarning);
        return buildInvalidTransientResult({
            scenario,
            warnings,
            invalidReason: instabilityWarning,
            nodes,
            time: [0],
            stableState,
        });
    }
    const initialTemperature = buildInitialTemperature(nodes, scenario);
    if (!isTemperatureSeriesTrustworthy(initialTemperature)) {
        warnings.push("Начальное температурное поле содержит недостоверные значения.");
        return buildInvalidTransientResult({
            scenario,
            warnings,
            invalidReason: "Начальное температурное поле не прошло проверку физической достоверности.",
            nodes,
            initialTemperature,
            time: [0],
            stableState,
        });
    }
    const temperatures = [initialTemperature];
    const innerSurfaceTemperature = [];
    const outerSurfaceTemperature = [];
    const innerBoundarySeries = [];
    const outerBoundarySeries = [];
    let minTemperature = Number.POSITIVE_INFINITY;
    let maxTemperature = Number.NEGATIVE_INFINITY;
    let timeBelowLimit_s = 0;
    let current = [...initialTemperature];
    for (let step = 0; step < time.length; step += 1) {
        const time_s = time[step];
        const boundary = evaluateBoundaryState(nodes, current, scenario, time_s, warnings);
        if (!isTrustworthyTemperature(boundary.innerSurfaceTemperature_C) ||
            !isTrustworthyTemperature(boundary.outerSurfaceTemperature_C) ||
            !isTrustworthyTemperature(boundary.innerBoundaryReference_C) ||
            !isTrustworthyTemperature(boundary.outerBoundaryReference_C)) {
            warnings.push("Граничные условия дали физически недостоверные температуры. Расчет остановлен.");
            return buildInvalidTransientResult({
                scenario,
                warnings,
                invalidReason: "Граничные условия вывели расчет в недостоверную область температур.",
                nodes,
                initialTemperature,
                time: time.slice(0, step + 1),
                temperatures,
                innerSurfaceTemperature,
                outerSurfaceTemperature,
                stableState,
            });
        }
        innerSurfaceTemperature.push(boundary.innerSurfaceTemperature_C);
        outerSurfaceTemperature.push(boundary.outerSurfaceTemperature_C);
        innerBoundarySeries.push(boundary.innerBoundaryReference_C);
        outerBoundarySeries.push(boundary.outerBoundaryReference_C);
        current.forEach((value) => {
            if (value < minTemperature) {
                minTemperature = value;
            }
            if (value > maxTemperature) {
                maxTemperature = value;
            }
        });
        if (typeof options.innerSurfaceLimit_C === "number" && boundary.innerSurfaceTemperature_C < options.innerSurfaceLimit_C) {
            timeBelowLimit_s += step === 0 ? 0 : time[step] - time[step - 1];
        }
        if (step === time.length - 1) {
            break;
        }
        const next = new Array(current.length);
        for (let index = 0; index < current.length; index += 1) {
            const node = nodes[index];
            const volumetricHeatCapacity = node.density_kg_m3 * node.heatCapacity_J_kgK;
            const leftFluxIntoNode_W_m2 = index === 0 ? boundary.innerFluxIntoWall_W_m2 : computeInterfaceFlux(nodes[index - 1], current[index - 1], node, current[index]);
            const rightFluxOutOfNode_W_m2 = index === current.length - 1
                ? -boundary.outerFluxIntoWall_W_m2
                : computeInterfaceFlux(node, current[index], nodes[index + 1], current[index + 1]);
            const source_W_m3 = evaluateInternalHeatSource(scenario, node.x_m, time_s);
            const deltaT = (scenario.timeStep_s / Math.max(volumetricHeatCapacity * node.dx_m, 1e-9)) *
                (leftFluxIntoNode_W_m2 - rightFluxOutOfNode_W_m2 + source_W_m3 * node.dx_m);
            next[index] = current[index] + deltaT;
        }
        if (!isTemperatureSeriesTrustworthy(next, current)) {
            const suggestion = Number.isFinite(stableState.suggestedTimeStep_s)
                ? ` Уменьшите шаг времени до ${stableState.suggestedTimeStep_s.toFixed(1)} с или меньше.`
                : "";
            warnings.push("Численная схема породила недостоверные температуры. Расчет остановлен до использования результата в выводах.");
            return buildInvalidTransientResult({
                scenario,
                warnings,
                invalidReason: `Нестационарный расчет признан неустойчивым по численному контролю.${suggestion}`,
                nodes,
                initialTemperature,
                time: time.slice(0, step + 1),
                temperatures,
                innerSurfaceTemperature,
                outerSurfaceTemperature,
                stableState,
                innerBoundarySeries,
                outerBoundarySeries,
            });
        }
        temperatures.push(next);
        current = next;
    }
    if (temperatures.length !== time.length) {
        temperatures.push([...current]);
    }
    return {
        scenarioId: scenario.id,
        stable: stableState.stable,
        valid: true,
        scheme: options.scheme ?? "explicit",
        warnings: dedupeWarnings(warnings),
        nodes: nodes.map((node) => node.x_m),
        time,
        temperature: temperatures,
        innerSurfaceTemperature,
        outerSurfaceTemperature,
        minTemperature,
        maxTemperature,
        minInnerSurfaceTemperature: Math.min(...innerSurfaceTemperature),
        maxInnerSurfaceTemperature: Math.max(...innerSurfaceTemperature),
        timeBelowLimit_s: typeof options.innerSurfaceLimit_C === "number" ? timeBelowLimit_s : undefined,
        metadata: {
            requestedTimeStep_s: scenario.timeStep_s,
            usedTimeStep_s: scenario.timeStep_s,
            stabilityLimit_s: stableState.suggestedTimeStep_s,
            stabilityRatioMax: stableState.maxR,
            requestedScheme: options.scheme,
            selectedTimeIndex: time.length - 1,
            invalidReason: null,
            implementationWarnings: dedupeWarnings(warnings),
            innerBoundaryTemperature_C: innerBoundarySeries,
            outerBoundaryTemperature_C: outerBoundarySeries,
        },
    };
}
export function getTransientFrame(result, timeIndex) {
    const safeIndex = Math.min(Math.max(0, Math.round(timeIndex)), Math.max(0, result.time.length - 1));
    return {
        time_s: result.time[safeIndex] ?? 0,
        nodes: result.nodes,
        temperature: result.temperature[safeIndex] ?? result.temperature[result.temperature.length - 1] ?? [],
        innerSurfaceTemperature_C: result.innerSurfaceTemperature[safeIndex] ?? result.innerSurfaceTemperature[result.innerSurfaceTemperature.length - 1] ?? NaN,
        outerSurfaceTemperature_C: result.outerSurfaceTemperature[safeIndex] ?? result.outerSurfaceTemperature[result.outerSurfaceTemperature.length - 1] ?? NaN,
    };
}
function discretizeLayers(layers) {
    const nodes = [];
    let cursor = 0;
    layers.forEach((layer, layerIndex) => {
        const count = Math.max(1, Math.round(layer.nodesCount ?? 3));
        const dx_m = layer.thickness_m / count;
        for (let index = 0; index < count; index += 1) {
            nodes.push({
                x_m: cursor + dx_m * (index + 0.5),
                dx_m,
                lambda_W_mK: layer.lambda_W_mK,
                density_kg_m3: layer.density_kg_m3,
                heatCapacity_J_kgK: layer.heatCapacity_J_kgK,
            });
        }
        cursor += layer.thickness_m;
        if (layerIndex === layers.length - 1 && nodes.length) {
            nodes[nodes.length - 1].x_m = cursor - nodes[nodes.length - 1].dx_m * 0.5;
        }
    });
    return nodes;
}
function buildTimeAxis(duration_s, timeStep_s) {
    const steps = Math.max(1, Math.round(duration_s / timeStep_s));
    const time = [];
    for (let step = 0; step <= steps; step += 1) {
        time.push(Math.min(duration_s, step * timeStep_s));
    }
    return time;
}
function buildInitialTemperature(nodes, scenario) {
    if (scenario.initialCondition.kind === "profile" && scenario.initialCondition.profile?.length) {
        const profile = [...scenario.initialCondition.profile].sort((left, right) => left.x_m - right.x_m);
        return nodes.map((node) => interpolateProfile(profile, node.x_m));
    }
    return nodes.map(() => scenario.initialCondition.temperature_C ?? 20);
}
function interpolateProfile(profile, x_m) {
    if (x_m <= profile[0].x_m) {
        return profile[0].temperature_C;
    }
    for (let index = 1; index < profile.length; index += 1) {
        const previous = profile[index - 1];
        const current = profile[index];
        if (x_m <= current.x_m) {
            const span = Math.max(current.x_m - previous.x_m, 1e-9);
            const ratio = (x_m - previous.x_m) / span;
            return previous.temperature_C + (current.temperature_C - previous.temperature_C) * ratio;
        }
    }
    return profile[profile.length - 1].temperature_C;
}
function evaluateExplicitStability(nodes, timeStep_s) {
    let maxR = 0;
    let suggestedTimeStep_s = Number.POSITIVE_INFINITY;
    nodes.forEach((node) => {
        const diffusivity = node.lambda_W_mK / Math.max(node.density_kg_m3 * node.heatCapacity_J_kgK, 1e-9);
        const r = (diffusivity * timeStep_s) / Math.max(node.dx_m * node.dx_m, 1e-9);
        maxR = Math.max(maxR, r);
        suggestedTimeStep_s = Math.min(suggestedTimeStep_s, 0.45 * (node.dx_m * node.dx_m) / Math.max(diffusivity, 1e-9));
    });
    return {
        stable: maxR <= 0.5,
        maxR,
        suggestedTimeStep_s: Number.isFinite(suggestedTimeStep_s) ? suggestedTimeStep_s : timeStep_s,
    };
}
function computeInterfaceFlux(left, leftTemperature_C, right, rightTemperature_C) {
    const resistance = 0.5 * left.dx_m / Math.max(left.lambda_W_mK, 1e-9) + 0.5 * right.dx_m / Math.max(right.lambda_W_mK, 1e-9);
    return (leftTemperature_C - rightTemperature_C) / Math.max(resistance, 1e-9);
}
function evaluateBoundaryState(nodes, temperature, scenario, time_s, warnings) {
    const inner = resolveBoundary(nodes[0], temperature[0], scenario.innerBoundary, time_s, "inner", warnings);
    const outer = resolveBoundary(nodes[nodes.length - 1], temperature[temperature.length - 1], scenario.outerBoundary, time_s, "outer", warnings);
    return {
        innerFluxIntoWall_W_m2: inner.fluxIntoWall_W_m2,
        outerFluxIntoWall_W_m2: outer.fluxIntoWall_W_m2,
        innerSurfaceTemperature_C: inner.surfaceTemperature_C,
        outerSurfaceTemperature_C: outer.surfaceTemperature_C,
        innerBoundaryReference_C: inner.referenceTemperature_C,
        outerBoundaryReference_C: outer.referenceTemperature_C,
    };
}
function resolveBoundary(node, nodeTemperature_C, boundary, time_s, side, warnings) {
    switch (boundary.kind) {
        case "temperature": {
            const boundaryTemperature_C = evaluateBoundaryValue(boundary.temperature_C, time_s, nodeTemperature_C);
            const resistance = 0.5 * node.dx_m / Math.max(node.lambda_W_mK, 1e-9);
            return {
                fluxIntoWall_W_m2: (boundaryTemperature_C - nodeTemperature_C) / Math.max(resistance, 1e-9),
                surfaceTemperature_C: boundaryTemperature_C,
                referenceTemperature_C: boundaryTemperature_C,
            };
        }
        case "convection": {
            const ambientTemperature_C = evaluateBoundaryValue(boundary.ambientTemperature_C, time_s, nodeTemperature_C);
            const alpha_W_m2K = Math.max(boundary.alpha_W_m2K ?? 8.7, 1e-6);
            const totalResistance = 1 / alpha_W_m2K + 0.5 * node.dx_m / Math.max(node.lambda_W_mK, 1e-9);
            const fluxIntoWall_W_m2 = (ambientTemperature_C - nodeTemperature_C) / Math.max(totalResistance, 1e-9);
            const surfaceTemperature_C = nodeTemperature_C + fluxIntoWall_W_m2 * (0.5 * node.dx_m / Math.max(node.lambda_W_mK, 1e-9));
            return {
                fluxIntoWall_W_m2,
                surfaceTemperature_C,
                referenceTemperature_C: ambientTemperature_C,
            };
        }
        case "heatFlux": {
            warnings.push(`Граничное условие heatFlux для ${side} стороны пока не реализовано. Использован нулевой тепловой поток.`);
            return {
                fluxIntoWall_W_m2: 0,
                surfaceTemperature_C: nodeTemperature_C,
                referenceTemperature_C: nodeTemperature_C,
            };
        }
    }
    throw new Error(`Неизвестный тип граничного условия: ${boundary.kind}`);
}
function evaluateBoundaryValue(value, time_s, fallback) {
    if (typeof value === "function") {
        return value(time_s);
    }
    return typeof value === "number" ? value : fallback;
}
function evaluateInternalHeatSource(scenario, x_m, time_s) {
    if (typeof scenario.internalHeatSource_W_m3 === "function") {
        return scenario.internalHeatSource_W_m3(x_m, time_s);
    }
    return scenario.internalHeatSource_W_m3 ?? 0;
}
function dedupeWarnings(warnings) {
    return Array.from(new Set(warnings));
}
function validateLayers(layers) {
    const warnings = [];
    layers.forEach((layer) => {
        if (!(layer.thickness_m >= MIN_LAYER_THICKNESS_M)) {
            warnings.push(`Слой ${layer.name || layer.id} имеет толщину менее ${MIN_LAYER_THICKNESS_M.toFixed(3)} м.`);
        }
        if (!(Number.isFinite(layer.lambda_W_mK) && layer.lambda_W_mK > 0)) {
            warnings.push(`Слой ${layer.name || layer.id} имеет некорректную теплопроводность λ.`);
        }
        if (!(Number.isFinite(layer.density_kg_m3) && layer.density_kg_m3 > 0)) {
            warnings.push(`Слой ${layer.name || layer.id} имеет некорректную плотность ρ.`);
        }
        if (!(Number.isFinite(layer.heatCapacity_J_kgK) && layer.heatCapacity_J_kgK > 0)) {
            warnings.push(`Слой ${layer.name || layer.id} имеет некорректную теплоемкость c.`);
        }
    });
    return warnings;
}
function validateNodes(nodes) {
    const warnings = [];
    nodes.forEach((node, index) => {
        if (!(Number.isFinite(node.dx_m) && node.dx_m > MIN_DX_M)) {
            warnings.push(`Узел ${index + 1} имеет некорректный шаг dx.`);
        }
        if (!(Number.isFinite(node.lambda_W_mK) && node.lambda_W_mK > 0)) {
            warnings.push(`Узел ${index + 1} имеет некорректную теплопроводность λ.`);
        }
        if (!(Number.isFinite(node.density_kg_m3) && node.density_kg_m3 > 0)) {
            warnings.push(`Узел ${index + 1} имеет некорректную плотность ρ.`);
        }
        if (!(Number.isFinite(node.heatCapacity_J_kgK) && node.heatCapacity_J_kgK > 0)) {
            warnings.push(`Узел ${index + 1} имеет некорректную теплоемкость c.`);
        }
    });
    return warnings;
}
function isTrustworthyTemperature(value) {
    return Number.isFinite(value) && Math.abs(value) <= MAX_REASONABLE_TEMPERATURE_C;
}
function isTemperatureSeriesTrustworthy(next, previous) {
    return next.every((value, index) => {
        if (!isTrustworthyTemperature(value)) {
            return false;
        }
        if (!previous) {
            return true;
        }
        const reference = previous[index];
        return Number.isFinite(reference) && Math.abs(value - reference) <= MAX_REASONABLE_STEP_DELTA_C;
    });
}
function buildInvalidTransientResult(input) {
    const nodes = input.nodes?.map((node) => node.x_m) ?? [];
    const temperatureRow = input.temperatures?.[input.temperatures.length - 1] ??
        (input.initialTemperature ? [...input.initialTemperature] : []);
    const time = input.time?.length ? input.time : [0];
    const innerSurfaceTemperature = input.innerSurfaceTemperature?.length ? input.innerSurfaceTemperature : [];
    const outerSurfaceTemperature = input.outerSurfaceTemperature?.length ? input.outerSurfaceTemperature : [];
    const fallbackMin = temperatureRow.length ? Math.min(...temperatureRow) : Number.NaN;
    const fallbackMax = temperatureRow.length ? Math.max(...temperatureRow) : Number.NaN;
    return {
        scenarioId: input.scenario.id,
        stable: false,
        valid: false,
        scheme: "explicit",
        warnings: dedupeWarnings([...input.warnings, input.invalidReason]),
        nodes,
        time,
        temperature: temperatureRow.length ? [temperatureRow] : [],
        innerSurfaceTemperature,
        outerSurfaceTemperature,
        minTemperature: fallbackMin,
        maxTemperature: fallbackMax,
        minInnerSurfaceTemperature: innerSurfaceTemperature.length ? Math.min(...innerSurfaceTemperature) : Number.NaN,
        maxInnerSurfaceTemperature: innerSurfaceTemperature.length ? Math.max(...innerSurfaceTemperature) : Number.NaN,
        timeBelowLimit_s: undefined,
        metadata: {
            requestedTimeStep_s: input.scenario.timeStep_s,
            usedTimeStep_s: input.scenario.timeStep_s,
            stabilityLimit_s: input.stableState?.suggestedTimeStep_s ?? null,
            stabilityRatioMax: input.stableState?.maxR ?? null,
            requestedScheme: "explicit",
            selectedTimeIndex: Math.max(0, time.length - 1),
            invalidReason: input.invalidReason,
            implementationWarnings: dedupeWarnings([...input.warnings, input.invalidReason]),
            innerBoundaryTemperature_C: input.innerBoundarySeries ?? [],
            outerBoundaryTemperature_C: input.outerBoundarySeries ?? [],
        },
    };
}
