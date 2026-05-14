import { polygonArea } from "../../../entities/geometry/geom";
import type { BuildingModel } from "../../../entities/geometry/types";
import { computeWallProperties, getMaterial } from "../../../entities/material/types";
import { dedupeWalls } from "../../geometry/bimPipeline";
import { getRoomDisplayName } from "./display";
import type { EngineeringGridOptions, EngineeringValidationIssue, ResolvedEngineeringOptions } from "./types";
import { isBrokenDisplayText, looksLikeInternalId } from "../../../shared/utils/displayText";

export function validateEngineeringInputs(
  model: BuildingModel,
  options: ResolvedEngineeringOptions
): EngineeringValidationIssue[] {
  const issues: EngineeringValidationIssue[] = [];

  if (!model.rooms.length) {
    issues.push({
      id: "rooms-missing",
      severity: "error",
      scope: "Модель",
      message: "В модели нет помещений, поэтому расчеты теплового баланса и поля невозможны.",
      recommendation: "Создайте хотя бы одно помещение замкнутым контуром.",
    });
  }

  if (!model.walls.length) {
    issues.push({
      id: "walls-missing",
      severity: "error",
      scope: "Модель",
      message: "В модели нет стен, поэтому невозможно корректно сформировать оболочку помещения.",
      recommendation: "Добавьте наружные и внутренние стены.",
    });
  }

  model.rooms.forEach((room) => {
    const roomScope = getRoomDisplayName(model, room.id);
    const area = Math.abs(polygonArea(room.polygon));
    if (isBrokenDisplayText(room.name) || looksLikeInternalId(room.name)) {
      issues.push({
        id: `room-label-${room.id}`,
        severity: "warning",
        scope: roomScope,
        message: "Название помещения недоступно или похоже на технический идентификатор.",
        recommendation: "Задайте читаемое имя помещения; в интерфейсе будет использовано fallback-обозначение.",
      });
    }
    if (!Number.isFinite(area) || area <= 0) {
      issues.push({
        id: `room-area-${room.id}`,
        severity: "error",
        scope: roomScope,
        message: "Площадь помещения невалидна или равна нулю.",
        recommendation: "Проверьте замкнутость и порядок обхода контура помещения.",
      });
    }
  });

  model.walls.forEach((wall, wallIndex) => {
    const wallScope = `Стена ${wallIndex + 1}`;
    if (!Number.isFinite(wall.thickness_m) || wall.thickness_m <= 0) {
      issues.push({
        id: `wall-thickness-${wall.id}`,
        severity: "error",
        scope: wallScope,
        message: "Толщина стены должна быть положительной.",
        recommendation: "Задайте толщину в метрах, больше нуля.",
      });
    } else if (wall.thickness_m > 1.5) {
      issues.push({
        id: `wall-thickness-range-${wall.id}`,
        severity: "warning",
        scope: wallScope,
        message: "Толщина стены больше 1.5 м. Возможно, значение введено не в тех единицах.",
        recommendation: "Проверьте, не была ли толщина введена в миллиметрах.",
      });
    }

    if (!Number.isFinite(wall.height_m) || wall.height_m <= 0) {
      issues.push({
        id: `wall-height-${wall.id}`,
        severity: "error",
        scope: wallScope,
        message: "Высота стены должна быть положительной.",
        recommendation: "Проверьте геометрию стены.",
      });
    }

    wall.layers?.forEach((layer, index) => {
      const material = getMaterial(layer.materialId);
      if (!material) {
        issues.push({
          id: `wall-material-${wall.id}-${index}`,
          severity: "warning",
          scope: wallScope,
          message: `Материал слоя ${index + 1} не найден в библиотеке.`,
          recommendation: "Выберите материал из библиотеки или проверьте идентификатор.",
        });
        return;
      }
      if (!Number.isFinite(layer.thickness_m) || layer.thickness_m <= 0) {
        issues.push({
          id: `wall-layer-thickness-${wall.id}-${index}`,
          severity: "error",
          scope: wallScope,
          message: `Толщина слоя ${index + 1} должна быть положительной.`,
          recommendation: "Проверьте толщину слоя в метрах.",
        });
      }
      if (!Number.isFinite(material.lambda_W_mK) || material.lambda_W_mK < 0.02 || material.lambda_W_mK > 5) {
        issues.push({
          id: `wall-lambda-${wall.id}-${index}`,
          severity: "warning",
          scope: wallScope,
          message: `Теплопроводность слоя ${index + 1} выходит за типичный диапазон 0.02..5 Вт/(м·К).`,
          recommendation: "Проверьте свойства материала.",
        });
      }
    });

    const props = computeWallProperties(wall.layers, wall.wallAssemblyId);
    if (props && (!Number.isFinite(props.uValue) || props.uValue <= 0 || props.uValue > 8)) {
      issues.push({
        id: `wall-u-${wall.id}`,
        severity: "warning",
        scope: wallScope,
        message: "Полученное значение U для стены выглядит нереалистично.",
        recommendation: "Проверьте состав слоев и толщины.",
      });
    }
  });

  if (dedupeWalls(model.walls).length !== model.walls.length) {
    issues.push({
      id: "duplicate-walls",
      severity: "warning",
      scope: "Модель",
      message: "Найдены геометрически дублирующиеся стены. Это может завысить площадь ограждений и теплопотери.",
      recommendation: "Удалите дубли или объедините совпадающие стены.",
    });
  }

  validateGridOptions(options.grid).forEach((issue) => issues.push(issue));

  if (!Number.isFinite(options.windowU_W_m2K) || options.windowU_W_m2K <= 0) {
    issues.push({
      id: "window-u-invalid",
      severity: "error",
      scope: "Сценарий",
      message: "Коэффициент U для окна должен быть положительным.",
      recommendation: "Задайте U окна больше нуля.",
    });
  }

  if (!Number.isFinite(options.doorU_W_m2K) || options.doorU_W_m2K <= 0) {
    issues.push({
      id: "door-u-invalid",
      severity: "error",
      scope: "Сценарий",
      message: "Коэффициент U для двери должен быть положительным.",
      recommendation: "Задайте U двери больше нуля.",
    });
  }

  return issues;
}

function validateGridOptions(grid: EngineeringGridOptions): EngineeringValidationIssue[] {
  const issues: EngineeringValidationIssue[] = [];
  if (!Number.isFinite(grid.cellSizeM) || grid.cellSizeM <= 0) {
    issues.push({
      id: "grid-size-invalid",
      severity: "error",
      scope: "Сетка",
      message: "Шаг сетки должен быть положительным.",
      recommendation: "Задайте шаг сетки в диапазоне примерно 0.2..0.6 м.",
    });
  } else if (grid.cellSizeM < 0.12) {
    issues.push({
      id: "grid-too-dense",
      severity: "warning",
      scope: "Сетка",
      message: "Сетка очень плотная. Это увеличит время расчета без заметного выигрыша для плановой 2D-модели.",
      recommendation: "Для инженерного режима обычно достаточно шага 0.2..0.4 м.",
    });
  } else if (grid.cellSizeM > 0.9) {
    issues.push({
      id: "grid-too-sparse",
      severity: "warning",
      scope: "Сетка",
      message: "Сетка слишком редкая, локальные перепады температуры рядом с окнами и приборами будут сглажены.",
      recommendation: "Уменьшите шаг сетки до 0.2..0.5 м.",
    });
  }

  if (!Number.isFinite(grid.maxIterations) || grid.maxIterations < 50) {
    issues.push({
      id: "grid-iterations-low",
      severity: "warning",
      scope: "Сетка",
      message: "Слишком мало итераций решателя, сходимость может не быть достигнута.",
      recommendation: "Увеличьте лимит хотя бы до 150..300 итераций.",
    });
  }

  if (!Number.isFinite(grid.toleranceC) || grid.toleranceC <= 0) {
    issues.push({
      id: "grid-tolerance-invalid",
      severity: "error",
      scope: "Сетка",
      message: "Критерий остановки должен быть положительным.",
      recommendation: "Укажите допуск, например 0.02 °C.",
    });
  }

  return issues;
}
