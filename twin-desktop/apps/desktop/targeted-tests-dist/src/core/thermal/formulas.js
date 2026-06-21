function assertFinite(value, label) {
    if (!Number.isFinite(value)) {
        throw new Error(`${label} должно быть конечным числом.`);
    }
}
function assertPositive(value, label) {
    assertFinite(value, label);
    if (value <= 0) {
        throw new Error(`${label} должно быть больше нуля.`);
    }
}
function assertNonNegative(value, label) {
    assertFinite(value, label);
    if (value < 0) {
        throw new Error(`${label} не может быть отрицательным.`);
    }
}
export function layerResistance(thicknessM, lambdaWmK) {
    assertPositive(thicknessM, "Толщина слоя");
    assertPositive(lambdaWmK, "Теплопроводность слоя");
    return thicknessM / lambdaWmK;
}
export function assemblyResistance(layers, Rsi = 0, Rse = 0) {
    if (!layers.length) {
        throw new Error("Для расчета сопротивления конструкции нужен хотя бы один слой.");
    }
    assertNonNegative(Rsi, "Внутреннее поверхностное сопротивление");
    assertNonNegative(Rse, "Наружное поверхностное сопротивление");
    return Rsi + layers.reduce((sum, layer) => sum + layerResistance(layer.thicknessM, layer.lambdaWmK), 0) + Rse;
}
export function uValue(resistance) {
    assertPositive(resistance, "Сопротивление теплопередаче");
    return 1 / resistance;
}
export function transmissionLoss(U, areaM2, deltaT) {
    assertNonNegative(U, "Коэффициент теплопередачи U");
    assertNonNegative(areaM2, "Площадь конструкции");
    assertFinite(deltaT, "Перепад температур");
    return U * areaM2 * deltaT;
}
export function airflowFromACH(ach, volumeM3) {
    assertNonNegative(ach, "Кратность воздухообмена");
    assertNonNegative(volumeM3, "Объем помещения");
    return (ach * volumeM3) / 3600;
}
export function achFromAirflowM3s(airflowM3s, volumeM3) {
    assertNonNegative(airflowM3s, "Объемный расход воздуха");
    assertPositive(volumeM3, "Отапливаемый объём");
    return (airflowM3s * 3600) / volumeM3;
}
export function ventilationLoss(flowM3s, rho, cp, deltaT) {
    assertNonNegative(flowM3s, "Объемный расход воздуха");
    assertPositive(rho, "Плотность воздуха");
    assertPositive(cp, "Удельная теплоемкость воздуха");
    assertFinite(deltaT, "Перепад температур");
    return rho * cp * flowM3s * Math.max(0, deltaT);
}
export function infiltrationLoss(ach, volumeM3, rho, cp, deltaT) {
    return ventilationLoss(airflowFromACH(ach, volumeM3), rho, cp, deltaT);
}
export function gsop(tIndoor, tHeatingPeriod, heatingPeriodDays) {
    assertFinite(tIndoor, "Внутренняя температура");
    assertFinite(tHeatingPeriod, "Средняя температура отопительного периода");
    assertNonNegative(heatingPeriodDays, "Продолжительность отопительного периода");
    return Math.max(0, tIndoor - tHeatingPeriod) * heatingPeriodDays;
}
export function reducedResistanceByHomogeneity(baseResistance_m2K_W, homogeneityCoefficient = 1) {
    assertPositive(baseResistance_m2K_W, "baseResistance_m2K_W");
    assertPositive(homogeneityCoefficient, "homogeneityCoefficient");
    return baseResistance_m2K_W * homogeneityCoefficient;
}
export function thermalBridgeLinearConductance(bridges) {
    return bridges.reduce((sum, bridge) => {
        assertNonNegative(bridge.lengthM, "bridge.lengthM");
        assertNonNegative(bridge.psi_W_mK, "bridge.psi_W_mK");
        return sum + bridge.lengthM * bridge.psi_W_mK;
    }, 0);
}
export function thermalBridgePointConductance(bridges) {
    return bridges.reduce((sum, bridge) => {
        const count = bridge.count ?? 1;
        assertNonNegative(count, "bridge.count");
        assertNonNegative(bridge.chi_W_K, "bridge.chi_W_K");
        return sum + count * bridge.chi_W_K;
    }, 0);
}
export function thermalBridgeHeatLoss(deltaT, linearConductance_W_K, pointConductance_W_K = 0) {
    assertFinite(deltaT, "deltaT");
    assertNonNegative(linearConductance_W_K, "linearConductance_W_K");
    assertNonNegative(pointConductance_W_K, "pointConductance_W_K");
    return Math.max(0, deltaT) * (linearConductance_W_K + pointConductance_W_K);
}
export function heatLossCoefficientTransmission(elements) {
    return elements.reduce((sum, element) => {
        assertNonNegative(element.U_W_m2K, "element.U_W_m2K");
        assertNonNegative(element.areaM2, "element.areaM2");
        return sum + element.U_W_m2K * element.areaM2;
    }, 0);
}
export function heatLossCoefficientVentilation(flowM3s, rho, cp, heatRecoveryFactor = 0) {
    const recovery = Math.min(1, Math.max(0, heatRecoveryFactor));
    return ventilationLoss(flowM3s, rho, cp, 1) * (1 - recovery);
}
export function heatLossCoefficientTotal(...coefficients_W_K) {
    coefficients_W_K.forEach((value, index) => assertNonNegative(value, `coefficients_W_K[${index}]`));
    return coefficients_W_K.reduce((sum, value) => sum + value, 0);
}
export function thermalTimeConstantSeconds(capacitance_J_K, heatLossCoefficient_W_K) {
    assertNonNegative(capacitance_J_K, "capacitance_J_K");
    assertNonNegative(heatLossCoefficient_W_K, "heatLossCoefficient_W_K");
    if (heatLossCoefficient_W_K <= 0) {
        return null;
    }
    return capacitance_J_K / heatLossCoefficient_W_K;
}
export function freeCoolingTemperatureAtTime(initialTemperatureC, outdoorTemperatureC, elapsedSeconds, timeConstantSeconds) {
    assertFinite(initialTemperatureC, "initialTemperatureC");
    assertFinite(outdoorTemperatureC, "outdoorTemperatureC");
    assertNonNegative(elapsedSeconds, "elapsedSeconds");
    assertPositive(timeConstantSeconds, "timeConstantSeconds");
    return outdoorTemperatureC + (initialTemperatureC - outdoorTemperatureC) * Math.exp(-elapsedSeconds / timeConstantSeconds);
}
export function internalSurfaceTemperatureC(indoorTemperatureC, outdoorTemperatureC, internalSurfaceResistance_m2K_W, totalResistance_m2K_W, n = 1) {
    assertFinite(indoorTemperatureC, "indoorTemperatureC");
    assertFinite(outdoorTemperatureC, "outdoorTemperatureC");
    assertPositive(internalSurfaceResistance_m2K_W, "internalSurfaceResistance_m2K_W");
    assertPositive(totalResistance_m2K_W, "totalResistance_m2K_W");
    assertPositive(n, "n");
    return indoorTemperatureC - (n * (indoorTemperatureC - outdoorTemperatureC) * internalSurfaceResistance_m2K_W) / totalResistance_m2K_W;
}
export function dewPointMagnusC(temperatureC, relativeHumidityFraction) {
    assertFinite(temperatureC, "temperatureC");
    assertPositive(relativeHumidityFraction, "relativeHumidityFraction");
    if (relativeHumidityFraction > 1) {
        throw new Error("relativeHumidityFraction must be specified as a fraction in [0, 1].");
    }
    const gamma = (17.27 * temperatureC) / (237.7 + temperatureC) + Math.log(relativeHumidityFraction);
    return (237.7 * gamma) / (17.27 - gamma);
}
export function temperatureAtResistance(indoorTemperatureC, outdoorTemperatureC, resistanceToPoint_m2K_W, totalResistance_m2K_W) {
    assertFinite(indoorTemperatureC, "indoorTemperatureC");
    assertFinite(outdoorTemperatureC, "outdoorTemperatureC");
    assertNonNegative(resistanceToPoint_m2K_W, "resistanceToPoint_m2K_W");
    assertPositive(totalResistance_m2K_W, "totalResistance_m2K_W");
    return indoorTemperatureC - ((indoorTemperatureC - outdoorTemperatureC) * resistanceToPoint_m2K_W) / totalResistance_m2K_W;
}
export function fourierNumber(lambda_W_mK, density_kg_m3, heatCapacity_J_kgK, timestepSeconds, stepM) {
    assertPositive(lambda_W_mK, "lambda_W_mK");
    assertPositive(density_kg_m3, "density_kg_m3");
    assertPositive(heatCapacity_J_kgK, "heatCapacity_J_kgK");
    assertPositive(timestepSeconds, "timestepSeconds");
    assertPositive(stepM, "stepM");
    const diffusivity = lambda_W_mK / (density_kg_m3 * heatCapacity_J_kgK);
    return (diffusivity * timestepSeconds) / (stepM * stepM);
}
export function isExplicitFourierStable(fo) {
    assertNonNegative(fo, "fo");
    return fo <= 0.5;
}
export function requiredNormativeVentilationFlowM3H(input) {
    const peopleFlowM3H = input.peopleCount != null && input.litresPerPersonM3H != null
        ? Math.max(0, input.peopleCount) * Math.max(0, input.litresPerPersonM3H)
        : null;
    const areaFlowM3H = input.areaM2 != null && input.litresPerAreaM3H != null
        ? Math.max(0, input.areaM2) * Math.max(0, input.litresPerAreaM3H)
        : null;
    const roomFlowM3H = input.roomFlowM3H != null ? Math.max(0, input.roomFlowM3H) : null;
    const candidates = [peopleFlowM3H, areaFlowM3H, roomFlowM3H].filter((value) => value !== null);
    return {
        requiredFlowM3H: candidates.length ? Math.max(...candidates) : null,
        peopleFlowM3H,
        areaFlowM3H,
        roomFlowM3H,
    };
}
export function ventilationRecoveryLoss(flowM3s, rho, cp, deltaT, heatRecoveryFactor) {
    const beforeRecoveryW = ventilationLoss(flowM3s, rho, cp, deltaT);
    const recovery = Math.min(1, Math.max(0, heatRecoveryFactor));
    const afterRecoveryW = beforeRecoveryW * (1 - recovery);
    return { beforeRecoveryW, afterRecoveryW, savedW: beforeRecoveryW - afterRecoveryW };
}
export function specificHeatLoadByArea(totalHeatFlowW, areaM2) {
    assertFinite(totalHeatFlowW, "totalHeatFlowW");
    assertNonNegative(areaM2, "areaM2");
    if (areaM2 <= 0) {
        return null;
    }
    return totalHeatFlowW / areaM2;
}
export function specificHeatLoadByVolume(totalHeatFlowW, volumeM3) {
    assertFinite(totalHeatFlowW, "totalHeatFlowW");
    assertNonNegative(volumeM3, "volumeM3");
    if (volumeM3 <= 0) {
        return null;
    }
    return totalHeatFlowW / volumeM3;
}
export function specificHeatLoadByVolumeAndDeltaT(totalHeatFlowW, volumeM3, deltaT) {
    assertFinite(totalHeatFlowW, "totalHeatFlowW");
    assertNonNegative(volumeM3, "volumeM3");
    assertFinite(deltaT, "deltaT");
    if (volumeM3 <= 0 || deltaT <= 0) {
        return null;
    }
    return totalHeatFlowW / (volumeM3 * deltaT);
}
export function coefficientOfVariationPercent(mean, stdDev) {
    assertFinite(mean, "mean");
    assertNonNegative(stdDev, "stdDev");
    if (Math.abs(mean) < 1e-9) {
        return null;
    }
    return (stdDev / mean) * 100;
}
export function meanConfidenceInterval(mean, sampleStdDev, sampleSize, zScore = 1.96) {
    assertFinite(mean, "mean");
    assertNonNegative(sampleStdDev, "sampleStdDev");
    assertPositive(sampleSize, "sampleSize");
    assertPositive(zScore, "zScore");
    if (sampleSize < 2) {
        return null;
    }
    const margin = (zScore * sampleStdDev) / Math.sqrt(sampleSize);
    return {
        lower: mean - margin,
        upper: mean + margin,
        zScore,
    };
}
export function calculateRequiredHydronicMassFlow(requiredPowerW, deltaT, fluidHeatCapacityJkgK, efficiency = 1) {
    assertNonNegative(requiredPowerW, "Требуемая тепловая мощность");
    assertPositive(fluidHeatCapacityJkgK, "Удельная теплоемкость теплоносителя");
    assertPositive(efficiency, "КПД гидравлического слоя");
    if (!Number.isFinite(deltaT) || deltaT <= 0) {
        return null;
    }
    return requiredPowerW / (fluidHeatCapacityJkgK * deltaT * efficiency);
}
export function calculateRequiredHydronicVolumeFlowM3H(requiredPowerW, deltaT, fluidDensityKgM3, fluidHeatCapacityJkgK, efficiency = 1) {
    assertPositive(fluidDensityKgM3, "Плотность теплоносителя");
    const massFlow = calculateRequiredHydronicMassFlow(requiredPowerW, deltaT, fluidHeatCapacityJkgK, efficiency);
    if (massFlow === null) {
        return null;
    }
    return (massFlow / fluidDensityKgM3) * 3600;
}
export function calculateHydronicHeatPower(input) {
    const warnings = [];
    const density = input.fluidDensityKgM3 ?? null;
    const cp = input.fluidHeatCapacityJkgK ?? null;
    const efficiency = input.efficiency ?? 1;
    const maxPowerW = input.maxPowerW ?? null;
    if (density !== null) {
        assertPositive(density, "Плотность теплоносителя");
    }
    if (cp !== null) {
        assertPositive(cp, "Удельная теплоемкость теплоносителя");
    }
    assertPositive(efficiency, "КПД гидравлического слоя");
    if (maxPowerW !== null) {
        assertNonNegative(maxPowerW, "Ограничение мощности");
    }
    const supplyTemperatureC = input.supplyTemperatureC ?? null;
    const returnTemperatureC = input.returnTemperatureC ?? null;
    const deltaT = supplyTemperatureC === null || returnTemperatureC === null ? null : supplyTemperatureC - returnTemperatureC;
    if (deltaT === null) {
        warnings.push("Не заданы температуры подачи и/или обратки теплоносителя.");
    }
    else if (deltaT <= 0) {
        warnings.push("Температура подачи меньше или равна температуре обратки: доступная гидравлическая мощность не определена.");
    }
    let massFlowKgS = input.massFlowKgS ?? null;
    let volumeFlowM3H = input.volumeFlowM3H ?? null;
    if (massFlowKgS !== null) {
        if (!Number.isFinite(massFlowKgS) || massFlowKgS < 0) {
            warnings.push("Массовый расход теплоносителя задан некорректно.");
            massFlowKgS = null;
        }
    }
    if (volumeFlowM3H !== null) {
        if (!Number.isFinite(volumeFlowM3H) || volumeFlowM3H < 0) {
            warnings.push("Объемный расход теплоносителя задан некорректно.");
            volumeFlowM3H = null;
        }
    }
    if (massFlowKgS === null && volumeFlowM3H !== null) {
        if (density === null) {
            warnings.push("Объемный расход задан, но отсутствует плотность теплоносителя для пересчета в массовый расход.");
        }
        else {
            massFlowKgS = (volumeFlowM3H / 3600) * density;
        }
    }
    if (volumeFlowM3H === null && massFlowKgS !== null) {
        if (density === null) {
            warnings.push("Массовый расход задан, но отсутствует плотность теплоносителя для пересчета в объемный расход.");
        }
        else {
            volumeFlowM3H = (massFlowKgS / density) * 3600;
        }
    }
    if (massFlowKgS === null && volumeFlowM3H === null) {
        warnings.push("Расход теплоносителя не задан.");
    }
    let availablePowerW = null;
    if (massFlowKgS !== null && cp !== null && deltaT !== null && deltaT > 0) {
        availablePowerW = massFlowKgS * cp * deltaT * efficiency;
        if (maxPowerW !== null) {
            availablePowerW = Math.min(availablePowerW, maxPowerW);
        }
    }
    return {
        availablePowerW,
        deltaT,
        massFlowKgS,
        volumeFlowM3H,
        warnings,
        usedInputs: {
            massFlowKgS,
            volumeFlowM3H,
            supplyTemperatureC,
            returnTemperatureC,
            fluidDensityKgM3: density,
            fluidHeatCapacityJkgK: cp,
            efficiency,
            maxPowerW,
        },
    };
}
