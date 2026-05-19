export interface ResistanceLayerInput {
  thicknessM: number;
  lambdaWmK: number;
}

export interface HydronicHeatPowerInput {
  massFlowKgS?: number | null;
  volumeFlowM3H?: number | null;
  supplyTemperatureC?: number | null;
  returnTemperatureC?: number | null;
  fluidDensityKgM3?: number | null;
  fluidHeatCapacityJkgK?: number | null;
  efficiency?: number | null;
  maxPowerW?: number | null;
}

export interface HydronicHeatPowerResult {
  availablePowerW: number | null;
  deltaT: number | null;
  massFlowKgS: number | null;
  volumeFlowM3H: number | null;
  warnings: string[];
  usedInputs: {
    massFlowKgS: number | null;
    volumeFlowM3H: number | null;
    supplyTemperatureC: number | null;
    returnTemperatureC: number | null;
    fluidDensityKgM3: number | null;
    fluidHeatCapacityJkgK: number | null;
    efficiency: number | null;
    maxPowerW: number | null;
  };
}

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} должно быть конечным числом.`);
  }
}

function assertPositive(value: number, label: string) {
  assertFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} должно быть больше нуля.`);
  }
}

function assertNonNegative(value: number, label: string) {
  assertFinite(value, label);
  if (value < 0) {
    throw new Error(`${label} не может быть отрицательным.`);
  }
}

export function layerResistance(thicknessM: number, lambdaWmK: number): number {
  assertPositive(thicknessM, "Толщина слоя");
  assertPositive(lambdaWmK, "Теплопроводность слоя");
  return thicknessM / lambdaWmK;
}

export function assemblyResistance(
  layers: readonly ResistanceLayerInput[],
  Rsi = 0,
  Rse = 0
): number {
  if (!layers.length) {
    throw new Error("Для расчета сопротивления конструкции нужен хотя бы один слой.");
  }
  assertNonNegative(Rsi, "Внутреннее поверхностное сопротивление");
  assertNonNegative(Rse, "Наружное поверхностное сопротивление");
  return Rsi + layers.reduce((sum, layer) => sum + layerResistance(layer.thicknessM, layer.lambdaWmK), 0) + Rse;
}

export function uValue(resistance: number): number {
  assertPositive(resistance, "Сопротивление теплопередаче");
  return 1 / resistance;
}

export function transmissionLoss(U: number, areaM2: number, deltaT: number): number {
  assertNonNegative(U, "Коэффициент теплопередачи U");
  assertNonNegative(areaM2, "Площадь конструкции");
  assertFinite(deltaT, "Перепад температур");
  return U * areaM2 * deltaT;
}

export function airflowFromACH(ach: number, volumeM3: number): number {
  assertNonNegative(ach, "Кратность воздухообмена");
  assertNonNegative(volumeM3, "Объем помещения");
  return (ach * volumeM3) / 3600;
}

export function ventilationLoss(flowM3s: number, rho: number, cp: number, deltaT: number): number {
  assertNonNegative(flowM3s, "Объемный расход воздуха");
  assertPositive(rho, "Плотность воздуха");
  assertPositive(cp, "Удельная теплоемкость воздуха");
  assertFinite(deltaT, "Перепад температур");
  return rho * cp * flowM3s * Math.max(0, deltaT);
}

export function infiltrationLoss(ach: number, volumeM3: number, rho: number, cp: number, deltaT: number): number {
  return ventilationLoss(airflowFromACH(ach, volumeM3), rho, cp, deltaT);
}

export function gsop(tIndoor: number, tHeatingPeriod: number, heatingPeriodDays: number): number {
  assertFinite(tIndoor, "Внутренняя температура");
  assertFinite(tHeatingPeriod, "Средняя температура отопительного периода");
  assertNonNegative(heatingPeriodDays, "Продолжительность отопительного периода");
  return Math.max(0, tIndoor - tHeatingPeriod) * heatingPeriodDays;
}

export function calculateRequiredHydronicMassFlow(
  requiredPowerW: number,
  deltaT: number,
  fluidHeatCapacityJkgK: number,
  efficiency = 1
): number | null {
  assertNonNegative(requiredPowerW, "Требуемая тепловая мощность");
  assertPositive(fluidHeatCapacityJkgK, "Удельная теплоемкость теплоносителя");
  assertPositive(efficiency, "КПД гидравлического слоя");
  if (!Number.isFinite(deltaT) || deltaT <= 0) {
    return null;
  }
  return requiredPowerW / (fluidHeatCapacityJkgK * deltaT * efficiency);
}

export function calculateRequiredHydronicVolumeFlowM3H(
  requiredPowerW: number,
  deltaT: number,
  fluidDensityKgM3: number,
  fluidHeatCapacityJkgK: number,
  efficiency = 1
): number | null {
  assertPositive(fluidDensityKgM3, "Плотность теплоносителя");
  const massFlow = calculateRequiredHydronicMassFlow(requiredPowerW, deltaT, fluidHeatCapacityJkgK, efficiency);
  if (massFlow === null) {
    return null;
  }
  return (massFlow / fluidDensityKgM3) * 3600;
}

export function calculateHydronicHeatPower(input: HydronicHeatPowerInput): HydronicHeatPowerResult {
  const warnings: string[] = [];
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
  const deltaT =
    supplyTemperatureC === null || returnTemperatureC === null ? null : supplyTemperatureC - returnTemperatureC;

  if (deltaT === null) {
    warnings.push("Не заданы температуры подачи и/или обратки теплоносителя.");
  } else if (deltaT <= 0) {
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
    } else {
      massFlowKgS = (volumeFlowM3H / 3600) * density;
    }
  }

  if (volumeFlowM3H === null && massFlowKgS !== null) {
    if (density === null) {
      warnings.push("Массовый расход задан, но отсутствует плотность теплоносителя для пересчета в объемный расход.");
    } else {
      volumeFlowM3H = (massFlowKgS / density) * 3600;
    }
  }

  if (massFlowKgS === null && volumeFlowM3H === null) {
    warnings.push("Расход теплоносителя не задан.");
  }

  let availablePowerW: number | null = null;
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
