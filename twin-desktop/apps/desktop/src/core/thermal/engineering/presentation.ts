import type {
  EngineeringAnalysisResult,
  EngineeringMetricInsight,
  EngineeringPresentationSummary,
  EngineeringRecommendation,
  EngineeringStatusSummary,
  EngineeringUiTone,
} from "./types";

type PresentationInput = Omit<EngineeringAnalysisResult, "presentation">;

function formatValue(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function buildPresentationSummary(result: PresentationInput): EngineeringPresentationSummary {
  const targetC = result.comfort.targetTemperatureC;
  const recommendedBand = `${formatValue(targetC - 1, 1)}–${formatValue(targetC + 1, 1)} °C`;
  const totalAreaM2 = Math.max(
    result.rooms.reduce((sum, room) => sum + room.areaM2, 0),
    1
  );
  const specificLossW_m2 = result.balance.totalLossW / totalAreaM2;
  const dominantLoss = pickDominantLoss(result);
  const comfort = buildComfortStatus(result);
  const reliability = buildReliabilityStatus(result);
  const heating = buildHeatingStatus(result);
  const heatLoss = buildHeatLossStatus(specificLossW_m2, dominantLoss.label);
  const uniformity = buildUniformityStatus(result);

  const metrics: EngineeringMetricInsight[] = [
    {
      id: "mean-temperature",
      label: "Средняя температура",
      value: formatValue(result.comfort.meanAirTemperatureC, 1),
      unit: "°C",
      explanation:
        Math.abs(result.comfort.meanAirTemperatureC - targetC) <= 0.5
          ? "Температура в помещении близка к комфортной."
          : result.comfort.meanAirTemperatureC < targetC
            ? "В среднем в помещении прохладнее желаемого уровня."
            : "В среднем в помещении теплее целевого уровня.",
      target: `Цель: ${formatValue(targetC, 1)} °C`,
      tone: getToneByDeviation(result.comfort.meanAirTemperatureC - targetC, 0.5, 1.5),
    },
    {
      id: "occupied-temperature",
      label: "Температура в рабочей зоне",
      value: formatValue(result.comfort.occupiedMeanTemperatureC, 1),
      unit: "°C",
      explanation:
        Math.abs(result.comfort.occupiedMeanTemperatureC - targetC) <= 0.7
          ? "В зоне пребывания людей условия близки к комфортным."
          : result.comfort.occupiedMeanTemperatureC < targetC
            ? "В зоне пребывания людей немного прохладнее рекомендуемого уровня."
            : "В зоне пребывания людей заметен локальный перегрев.",
      target: `Рекомендуемо: ${recommendedBand}`,
      tone: getToneByDeviation(result.comfort.occupiedMeanTemperatureC - targetC, 0.7, 1.5),
    },
    {
      id: "losses",
      label: "Суммарные теплопотери",
      value: formatValue(result.balance.totalLossW / 1000, 2),
      unit: "кВт",
      explanation: `Основные потери связаны с элементом «${dominantLoss.label.toLowerCase()}».`,
      target: `Удельно: ${formatValue(specificLossW_m2, 0)} Вт/м²`,
      tone: specificLossW_m2 > 90 ? "critical" : specificLossW_m2 > 55 ? "warning" : "good",
    },
    {
      id: "heating",
      label: "Состояние отопления",
      value: heating.status,
      unit: "",
      explanation: heating.explanation,
      target: `Установлено: ${formatValue(result.balance.installedHeatingCapacityW / 1000, 2)} кВт`,
      tone: heating.tone,
    },
    {
      id: "confidence",
      label: "Надежность расчета",
      value: reliability.status,
      unit: "",
      explanation: reliability.explanation,
      target: `По умолчанию: ${result.confidence.defaultsUsed} параметров`,
      tone: reliability.tone,
    },
  ];

  const summaryLines = [
    `В помещении ${comfort.status.toLowerCase()}. Средняя температура составляет ${formatValue(result.comfort.meanAirTemperatureC, 1)} °C, а в рабочей зоне — ${formatValue(result.comfort.occupiedMeanTemperatureC, 1)} °C.`,
    `Наибольшие теплопотери приходятся на ${dominantLoss.label.toLowerCase()}; суммарно помещение теряет около ${formatValue(result.balance.totalLossW / 1000, 2)} кВт тепла.`,
    heating.status === "Мощности достаточно"
      ? "Текущей мощности отопления достаточно для поддержания заданной температуры."
      : heating.status === "На пределе"
        ? "Отопление работает близко к пределу, поэтому запас по мощности небольшой."
        : "Текущей мощности отопления недостаточно для уверенного поддержания заданной температуры.",
    result.confidence.level === "high"
      ? "Результат имеет высокую надежность: основные входные параметры заданы без критичных конфликтов."
      : result.confidence.level === "medium"
        ? "Результат имеет среднюю надежность: часть параметров принята по умолчанию и требует уточнения."
        : "Результат ориентировочный: в модели есть ошибки или слишком много допущений.",
  ];

  const recommendations = buildRecommendations(result, dominantLoss.label, heating, reliability);

  return {
    summaryLines,
    metrics,
    statuses: {
      comfort,
      reliability,
      heating,
      heatLoss,
      uniformity,
    },
    recommendations,
    dominantLossLabel: dominantLoss.label,
  };
}

function buildComfortStatus(result: PresentationInput): EngineeringStatusSummary {
  const deviationC = result.comfort.occupiedMeanTemperatureC - result.comfort.targetTemperatureC;
  if (result.comfort.localOverheatRisk && deviationC > 1) {
    return {
      id: "comfort",
      label: "Комфортность",
      status: "Есть локальный перегрев",
      explanation: "В части помещения температура выше комфортной, особенно рядом с локальными источниками.",
      tone: "warning",
    };
  }
  if (deviationC < -1.8) {
    return {
      id: "comfort",
      label: "Комфортность",
      status: "Слишком холодно",
      explanation: "Рабочая зона заметно холоднее рекомендуемого диапазона.",
      tone: "critical",
    };
  }
  if (deviationC < -0.6) {
    return {
      id: "comfort",
      label: "Комфортность",
      status: "Слегка прохладно",
      explanation: "Температура ниже желаемой, но отклонение пока умеренное.",
      tone: "warning",
    };
  }
  return {
    id: "comfort",
    label: "Комфортность",
    status: "Комфортно",
    explanation: "Температура в зоне пребывания людей близка к целевой.",
    tone: "good",
  };
}

function buildReliabilityStatus(result: PresentationInput): EngineeringStatusSummary {
  if (result.confidence.level === "high") {
    return {
      id: "reliability",
      label: "Надежность расчета",
      status: "Высокая",
      explanation: "Основные параметры заданы, а критичных конфликтов во входных данных не обнаружено.",
      tone: "good",
    };
  }
  if (result.confidence.level === "medium") {
    return {
      id: "reliability",
      label: "Надежность расчета",
      status: "Средняя",
      explanation: "Часть параметров принята по умолчанию, поэтому результат требует осторожной интерпретации.",
      tone: "warning",
    };
  }
  return {
    id: "reliability",
    label: "Надежность расчета",
    status: "Низкая",
    explanation: "Модель содержит ошибки или слишком много допущений для уверенного инженерного вывода.",
    tone: "critical",
  };
}

function buildHeatingStatus(result: PresentationInput): EngineeringStatusSummary {
  const installed = Math.max(result.balance.installedHeatingCapacityW, 1);
  const ratio = result.balance.requiredHeatingW / installed;
  if (ratio <= 0.85) {
    return {
      id: "heating",
      label: "Состояние отопления",
      status: "Мощности достаточно",
      explanation: "Установленной мощности хватает для поддержания заданной температуры с запасом.",
      tone: "good",
    };
  }
  if (ratio <= 1) {
    return {
      id: "heating",
      label: "Состояние отопления",
      status: "На пределе",
      explanation: "Отопление покрывает расчетную потребность, но запас по мощности небольшой.",
      tone: "warning",
    };
  }
  return {
    id: "heating",
    label: "Состояние отопления",
    status: "Недостаточно мощности",
    explanation: "Текущей мощности отопления не хватает для удержания целевой температуры.",
    tone: "critical",
  };
}

function buildHeatLossStatus(specificLossW_m2: number, dominantLossLabel: string): EngineeringStatusSummary {
  if (specificLossW_m2 > 90) {
    return {
      id: "heat-loss",
      label: "Состояние теплопотерь",
      status: "Сильно повышенные",
      explanation: `Потери тепла высокие; наиболее заметный вклад дает «${dominantLossLabel.toLowerCase()}».`,
      tone: "critical",
    };
  }
  if (specificLossW_m2 > 55) {
    return {
      id: "heat-loss",
      label: "Состояние теплопотерь",
      status: "Повышенные",
      explanation: `Потери тепла выше умеренного уровня; стоит проверить «${dominantLossLabel.toLowerCase()}».`,
      tone: "warning",
    };
  }
  return {
    id: "heat-loss",
    label: "Состояние теплопотерь",
    status: "Нормальные",
    explanation: "Суммарный уровень теплопотерь не выглядит чрезмерным для текущих условий расчета.",
    tone: "good",
  };
}

function buildUniformityStatus(result: PresentationInput): EngineeringStatusSummary {
  if (result.comfort.occupiedBandSpreadC > 3 || result.comfort.fieldSpreadC > 6) {
    return {
      id: "uniformity",
      label: "Равномерность поля",
      status: "Есть проблемные зоны",
      explanation: "В помещении есть заметные локальные перепады температуры.",
      tone: "critical",
    };
  }
  if (result.comfort.occupiedBandSpreadC > 1.8 || result.comfort.fieldSpreadC > 4) {
    return {
      id: "uniformity",
      label: "Равномерность поля",
      status: "Есть заметный перепад",
      explanation: "Температура распределена неравномерно, особенно рядом с ограждениями или приборами.",
      tone: "warning",
    };
  }
  return {
    id: "uniformity",
    label: "Равномерность поля",
    status: "Равномерно",
    explanation: "Существенных локальных перепадов температуры не обнаружено.",
    tone: "good",
  };
}

function buildRecommendations(
  result: PresentationInput,
  dominantLossLabel: string,
  heating: EngineeringStatusSummary,
  reliability: EngineeringStatusSummary
): EngineeringRecommendation[] {
  const recommendations: EngineeringRecommendation[] = [];
  const totalLoss = Math.max(result.balance.totalLossW, 1);
  const windowShare = result.balance.windowLossW / totalLoss;
  const wallShare = result.balance.wallLossW / totalLoss;
  const ventilationShare = (result.balance.ventilationLossW + result.balance.infiltrationLossW) / totalLoss;
  const coldWindowZone = result.zoneInsights.find((zone) => zone.category === "window" || zone.category === "cold");

  if (heating.status === "Недостаточно мощности") {
    recommendations.push({
      id: "heating-capacity",
      title: "Проверить мощность отопления",
      explanation: "Расчет показывает дефицит тепла. Стоит проверить мощность прибора или режим его работы.",
      tone: "critical",
    });
  }

  if (windowShare >= 0.28) {
    recommendations.push({
      id: "windows",
      title: "Проверить окна и примыкания",
      explanation: "Существенная часть потерь идет через окна. Имеет смысл уточнить их U-значение, состояние уплотнений или рассмотреть замену.",
      tone: "warning",
    });
  } else if (wallShare >= 0.35) {
    recommendations.push({
      id: "walls",
      title: "Проверить утепление наружных стен",
      explanation: "Основные потери приходятся на наружные стены. Стоит уточнить состав конструкции и сопротивление теплопередаче.",
      tone: "warning",
    });
  } else if (ventilationShare >= 0.3) {
    recommendations.push({
      id: "ventilation",
      title: "Уточнить воздухообмен",
      explanation: "Потери на вентиляцию и инфильтрацию велики. Проверьте кратность воздухообмена и реальные расходы воздуха.",
      tone: "warning",
    });
  }

  if (coldWindowZone) {
    recommendations.push({
      id: "cold-zone-layout",
      title: "Проверить расположение рабочей зоны",
      explanation: "Есть локально холодная зона рядом с наружным ограждением. Возможно, стоит сместить рабочее место или усилить локальный обогрев.",
      tone: "warning",
    });
  }

  if (reliability.status !== "Высокая") {
    recommendations.push({
      id: "inputs",
      title: "Уточнить исходные данные",
      explanation: "Часть параметров принята по умолчанию. Наиболее полезно добавить реальные материалы ограждений и параметры воздухообмена.",
      tone: "neutral",
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: "monitoring",
      title: "Сохранить текущую конфигурацию как базовый вариант",
      explanation: `Состояние близко к расчетной норме. Можно использовать текущий вариант как базу для сравнения сценариев по «${dominantLossLabel.toLowerCase()}».`,
      tone: "good",
    });
  }

  return recommendations.slice(0, 3);
}

function pickDominantLoss(result: PresentationInput) {
  const candidates = [
    { label: "окна", value: result.balance.windowLossW },
    { label: "наружные стены", value: result.balance.wallLossW },
    { label: "вентиляция и инфильтрация", value: result.balance.ventilationLossW + result.balance.infiltrationLossW },
    { label: "пол", value: result.balance.floorLossW },
    { label: "покрытие", value: result.balance.roofLossW },
    { label: "двери", value: result.balance.doorLossW },
  ];
  return candidates.sort((left, right) => right.value - left.value)[0] ?? { label: "ограждения", value: 0 };
}

function getToneByDeviation(value: number, goodBand: number, warningBand: number): EngineeringUiTone {
  const delta = Math.abs(value);
  if (delta <= goodBand) {
    return "good";
  }
  if (delta <= warningBand) {
    return "warning";
  }
  return "critical";
}
