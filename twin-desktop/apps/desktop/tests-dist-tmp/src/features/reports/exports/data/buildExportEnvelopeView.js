import { buildAdjacencyGraph } from "../../../../core/graph/adjacency";
import { sanitizeDisplayText } from "../../../../shared/utils/displayText";
export function buildExportEnvelopeView(input) {
    const adjacency = buildAdjacencyGraph(input.model);
    const externalWallOrientation = new Map(adjacency.external.map((edge) => [edge.wallId, edge.orientation]));
    const externalWallIds = new Set(adjacency.external.map((edge) => edge.wallId));
    const internalWallIds = new Set(adjacency.edges.map((edge) => edge.wallId));
    const wallById = new Map(input.model.walls.map((wall) => [wall.id, wall]));
    const doorById = new Map(input.model.doors.map((door) => [door.id, door]));
    const windowById = new Map(input.model.windows.map((windowItem) => [windowItem.id, windowItem]));
    const roofById = new Map((input.model.roofs ?? []).map((roof) => [roof.id, roof]));
    const slabById = new Map((input.model.floorSlabs ?? []).map((slab) => [slab.id, slab]));
    const rawElements = input.constructions.map((construction) => classifyConstruction({
        construction,
        model: input.model,
        wallById,
        doorById,
        windowById,
        roofById,
        slabById,
        externalWallIds,
        internalWallIds,
        externalWallOrientation,
        outdoorDesignTemperatureC: input.outdoorDesignTemperatureC,
    }));
    const appendixElements = assignDesignations(rawElements);
    const includedElements = appendixElements.filter((entry) => entry.includeInEnvelope);
    const groupedElements = groupEnvelopeElements(includedElements);
    const warnings = collectWarnings(appendixElements);
    const totalContribution = includedElements.reduce((sum, entry) => sum + (Number.isFinite(entry.contribution) ? entry.contribution ?? 0 : 0), 0);
    const totalArea = includedElements.reduce((sum, entry) => sum + (Number.isFinite(entry.areaM2) ? entry.areaM2 ?? 0 : 0), 0);
    const kobActual = input.heatedVolumeM3 && input.heatedVolumeM3 > 0 && totalContribution > 0
        ? totalContribution / input.heatedVolumeM3
        : null;
    const kOverall = totalArea > 0 && totalContribution > 0 ? totalContribution / totalArea : null;
    const kobStatus = formatComplianceStatus(kobActual, input.kobNorm);
    const criticalElements = includedElements
        .filter((entry) => entry.status === "не соответствует")
        .sort((left, right) => {
        const leftMargin = (left.actualResistance ?? 0) - (left.normalizedResistance ?? 0);
        const rightMargin = (right.actualResistance ?? 0) - (right.normalizedResistance ?? 0);
        return leftMargin - rightMargin;
    })
        .slice(0, 10);
    return {
        includedElements,
        appendixElements,
        groupedElements,
        criticalElements,
        warnings,
        kobActual,
        kobNorm: input.kobNorm,
        kobStatus,
        kOverall,
    };
}
function classifyConstruction(input) {
    const source = resolveConstructionSource(input.construction);
    const resolvedSource = enrichSourceWithModelData(source, {
        wallById: input.wallById,
        doorById: input.doorById,
        windowById: input.windowById,
        roofById: input.roofById,
        slabById: input.slabById,
    });
    const orientation = resolvedSource.kind === "wall"
        ? input.externalWallOrientation.get(resolvedSource.modelId ?? "")
        : resolvedSource.hostWallId
            ? input.externalWallOrientation.get(resolvedSource.hostWallId)
            : null;
    const levelLabel = resolveLevelLabel(input.model, resolvedSource.levelId);
    const categoryResult = classifyBySource({
        construction: input.construction,
        source: resolvedSource,
        externalWallIds: input.externalWallIds,
        internalWallIds: input.internalWallIds,
        slabById: input.slabById,
    });
    const modelId = resolvedSource.modelId ?? input.construction.id;
    const typeLabel = categoryTypeLabel(categoryResult.category);
    const normalizedResistance = finiteOrNull(input.construction.normalizedResistance_m2K_W);
    const isExternalDoorMissingNorm = categoryResult.category === "external-door" &&
        categoryResult.classification === "included" &&
        normalizedResistance === null;
    let status = categoryResult.classification === "requires-review"
        ? "требует проверки классификации"
        : categoryResult.classification === "excluded-internal"
            ? "не участвует в проверке наружной оболочки"
            : mapConstructionStatus(input.construction.status, input.construction.complies);
    if (isExternalDoorMissingNorm) {
        status = "требует уточнения";
    }
    return {
        key: input.construction.id,
        modelId,
        designation: "",
        name: buildProjectElementName({
            category: categoryResult.category,
            typeLabel,
            levelLabel,
            orientation,
        }),
        typeLabel,
        areaM2: finiteOrNull(input.construction.areaM2),
        actualResistance: finiteOrNull(input.construction.actualResistance_m2K_W),
        requiredResistance: finiteOrNull(input.construction.requiredResistance_m2K_W),
        normalizedResistance,
        reducedResistance: finiteOrNull(input.construction.reducedResistance_m2K_W),
        uValue: finiteOrNull(input.construction.heatTransferCoefficient_W_m2K),
        nt: finiteOrNull(input.construction.nt),
        contribution: finiteOrNull(input.construction.contribution_W_K),
        status,
        classification: categoryResult.classification,
        classificationNote: categoryResult.note,
        includeInEnvelope: categoryResult.classification === "included",
        category: categoryResult.category,
        internalSurfaceTemperature: formatInternalSurfaceTemperature(input.construction.internalSurfaceTemperatureC, input.outdoorDesignTemperatureC),
    };
}
function resolveConstructionSource(construction) {
    if (construction.id.startsWith("wall-")) {
        return { kind: "wall", modelId: construction.id.slice(5), hostWallId: null, levelId: null };
    }
    if (construction.id.startsWith("window-")) {
        return { kind: "window", modelId: construction.id.slice(7), hostWallId: null, levelId: null };
    }
    if (construction.id.startsWith("door-")) {
        return { kind: "door", modelId: construction.id.slice(5), hostWallId: null, levelId: null };
    }
    if (construction.id.startsWith("roof-")) {
        return { kind: "roof", modelId: construction.id.slice(5), hostWallId: null, levelId: null };
    }
    if (construction.id.startsWith("slab-")) {
        return { kind: "slab", modelId: construction.id.slice(5), hostWallId: null, levelId: null };
    }
    return { kind: "other", modelId: null, hostWallId: null, levelId: null };
}
function classifyBySource(input) {
    const { construction, source, externalWallIds, internalWallIds, slabById } = input;
    switch (construction.constructionType) {
        case "wall":
            if (source.modelId && externalWallIds.has(source.modelId)) {
                return {
                    category: "external-wall",
                    classification: "included",
                    note: "Элемент принят в состав наружной тепловой оболочки.",
                };
            }
            if (source.modelId && internalWallIds.has(source.modelId)) {
                return {
                    category: "internal-element",
                    classification: "excluded-internal",
                    note: "Элемент не включён в расчёт наружной тепловой оболочки, так как относится к внутренним конструкциям.",
                };
            }
            return {
                category: "ambiguous",
                classification: "requires-review",
                note: "Не удалось однозначно подтвердить принадлежность стены к наружной тепловой оболочке.",
            };
        case "window":
        case "lantern": {
            return classifyOpening(source.hostWallId, "window", externalWallIds, internalWallIds);
        }
        case "door":
        case "gate":
            return classifyOpening(source.hostWallId, "door", externalWallIds, internalWallIds);
        case "covering":
        case "roof":
            return {
                category: "roof",
                classification: "included",
                note: "Покрытие включено в состав наружной оболочки.",
            };
        case "floorOnGround":
            return {
                category: "ground-floor",
                classification: "included",
                note: "Пол по грунту включён в наружную тепловую оболочку.",
            };
        case "atticFloor":
        case "floorOverBasement": {
            const slab = source.modelId ? slabById.get(source.modelId) ?? null : null;
            if (slab?.kind === "attic" || slab?.kind === "basement") {
                return {
                    category: "floor-over-unheated",
                    classification: "included",
                    note: "Перекрытие над неотапливаемым объёмом включено в наружную оболочку.",
                };
            }
            return {
                category: "ambiguous",
                classification: "requires-review",
                note: "Перекрытие требует проверки: в документ включаются только конструкции над неотапливаемым объёмом.",
            };
        }
        default:
            return {
                category: "ambiguous",
                classification: "requires-review",
                note: "Тип конструкции не сопоставлен с наружной тепловой оболочкой.",
            };
    }
}
function classifyOpening(hostWallId, kind, externalWallIds, internalWallIds) {
    if (hostWallId && externalWallIds.has(hostWallId)) {
        return {
            category: kind === "window" ? "window" : "external-door",
            classification: "included",
            note: kind === "window"
                ? "Оконный проём расположен в наружной стене."
                : "Дверной проём расположен в наружной стене и учитывается как наружная дверь.",
        };
    }
    if (hostWallId && internalWallIds.has(hostWallId)) {
        return {
            category: "internal-element",
            classification: "excluded-internal",
            note: "Элемент не включён в расчёт наружной тепловой оболочки, так как относится к внутренним конструкциям.",
        };
    }
    return {
        category: "ambiguous",
        classification: "requires-review",
        note: kind === "window"
            ? "Не удалось подтвердить, что оконный проём относится к наружной оболочке."
            : "Не удалось подтвердить, что дверь относится к наружной оболочке.",
    };
}
function assignDesignations(elements) {
    const counters = new Map();
    return elements.map((element) => {
        const prefix = designationPrefix(element.category);
        const nextIndex = (counters.get(prefix) ?? 0) + 1;
        counters.set(prefix, nextIndex);
        return {
            ...element,
            designation: `${prefix}-${String(nextIndex).padStart(2, "0")}`,
        };
    });
}
function groupEnvelopeElements(elements) {
    const groups = new Map();
    for (const element of elements) {
        const key = element.category;
        const entry = groups.get(key) ??
            {
                key,
                typeLabel: element.typeLabel,
                count: 0,
                areaM2: 0,
                weightedRequiredResistance: null,
                weightedActualResistance: null,
                weightedUValue: null,
                status: "соответствует",
            };
        const previousArea = entry.areaM2;
        const area = element.areaM2 ?? 0;
        entry.count += 1;
        entry.areaM2 += area;
        entry.weightedRequiredResistance = mergeWeighted(entry.weightedRequiredResistance, previousArea, element.normalizedResistance, area);
        entry.weightedActualResistance = mergeWeighted(entry.weightedActualResistance, previousArea, element.actualResistance, area);
        entry.weightedUValue = mergeWeighted(entry.weightedUValue, previousArea, element.uValue, area);
        if (element.status === "не соответствует") {
            entry.status = "не соответствует";
        }
        else if (entry.status !== "не соответствует" &&
            element.status === "требует уточнения") {
            entry.status = "требует уточнения";
        }
        groups.set(key, entry);
    }
    return Array.from(groups.values()).sort((left, right) => categoryOrder(left.key) - categoryOrder(right.key));
}
function collectWarnings(elements) {
    const seen = new Set();
    const result = [];
    elements.forEach((element) => {
        if (element.classification !== "included" &&
            !seen.has(element.classificationNote)) {
            seen.add(element.classificationNote);
            result.push(element.classificationNote);
        }
        if (element.internalSurfaceTemperature === "требует проверки расчётной модели" &&
            !seen.has("Часть значений температуры внутренней поверхности требует проверки расчётной модели.")) {
            seen.add("Часть значений температуры внутренней поверхности требует проверки расчётной модели.");
            result.push("Часть значений температуры внутренней поверхности требует проверки расчётной модели.");
        }
    });
    return result;
}
function buildProjectElementName(input) {
    const facade = input.orientation && /^[NESWА-Я]$/i.test(input.orientation)
        ? `, фасад ${input.orientation}`
        : "";
    switch (input.category) {
        case "external-wall":
            return `Наружная стена, ${input.levelLabel}${facade}`;
        case "window":
            return `Окно наружной оболочки, ${input.levelLabel}${facade}`;
        case "external-door":
            return `Наружная дверь, ${input.levelLabel}${facade}`;
        case "roof":
            return `Покрытие / кровля, ${input.levelLabel}`;
        case "ground-floor":
            return `Пол по грунту, ${input.levelLabel}`;
        case "floor-over-unheated":
            return `Перекрытие над неотапливаемым объёмом, ${input.levelLabel}`;
        case "internal-element":
            return `Внутренний элемент, ${input.levelLabel}`;
        default:
            return `${input.typeLabel}, ${input.levelLabel}`;
    }
}
function resolveLevelLabel(model, levelId) {
    if (!levelId) {
        return "без привязки уровня";
    }
    const level = model.levels.find((item) => item.id === levelId);
    const label = sanitizeDisplayText(level?.name, "", { allowInternalId: false });
    return label || levelId;
}
function enrichSourceWithModelData(source, maps) {
    if (source.kind === "wall" && source.modelId) {
        const wall = maps.wallById.get(source.modelId) ?? null;
        return { ...source, levelId: wall?.levelId ?? null };
    }
    if (source.kind === "window" && source.modelId) {
        const windowItem = maps.windowById.get(source.modelId) ?? null;
        const hostWall = windowItem?.anchor.wallId
            ? maps.wallById.get(windowItem.anchor.wallId) ?? null
            : null;
        return {
            ...source,
            levelId: hostWall?.levelId ?? null,
            hostWallId: hostWall?.id ?? null,
        };
    }
    if (source.kind === "door" && source.modelId) {
        const door = maps.doorById.get(source.modelId) ?? null;
        const hostWall = door?.anchor.wallId
            ? maps.wallById.get(door.anchor.wallId) ?? null
            : null;
        return {
            ...source,
            levelId: hostWall?.levelId ?? null,
            hostWallId: hostWall?.id ?? null,
        };
    }
    if (source.kind === "roof" && source.modelId) {
        const roof = maps.roofById.get(source.modelId) ?? null;
        return { ...source, levelId: roof?.levelId ?? null };
    }
    if (source.kind === "slab" && source.modelId) {
        const slab = maps.slabById.get(source.modelId) ?? null;
        return { ...source, levelId: slab?.levelId ?? null };
    }
    return source;
}
function designationPrefix(category) {
    switch (category) {
        case "external-wall":
            return "НС";
        case "window":
            return "ОК";
        case "external-door":
            return "ДН";
        case "roof":
            return "ПК";
        case "ground-floor":
            return "ПГ";
        case "floor-over-unheated":
            return "ПН";
        default:
            return "ВЭ";
    }
}
function categoryTypeLabel(category) {
    switch (category) {
        case "external-wall":
            return "Наружные стены";
        case "window":
            return "Окна";
        case "external-door":
            return "Наружные двери";
        case "roof":
            return "Покрытия и кровля";
        case "ground-floor":
            return "Полы по грунту";
        case "floor-over-unheated":
            return "Перекрытия над неотапливаемым объёмом";
        case "internal-element":
            return "Внутренние элементы";
        default:
            return "Требует проверки классификации";
    }
}
function categoryOrder(category) {
    switch (category) {
        case "external-wall":
            return 1;
        case "window":
            return 2;
        case "external-door":
            return 3;
        case "roof":
            return 4;
        case "ground-floor":
            return 5;
        case "floor-over-unheated":
            return 6;
        case "internal-element":
            return 7;
        default:
            return 8;
    }
}
function mergeWeighted(currentAverage, currentWeight, nextValue, nextWeight) {
    if (!Number.isFinite(nextValue) || nextValue === null || nextWeight <= 0) {
        return currentAverage;
    }
    if (currentAverage === null || !Number.isFinite(currentAverage) || currentWeight <= 0) {
        return nextValue;
    }
    return (currentAverage * currentWeight + nextValue * nextWeight) / (currentWeight + nextWeight);
}
function formatComplianceStatus(actual, norm) {
    if (!Number.isFinite(actual) || actual === null || !Number.isFinite(norm) || norm === null) {
        return "требует уточнения";
    }
    return actual <= norm ? "соответствует" : "не соответствует";
}
function mapConstructionStatus(status, complies) {
    if (complies === false || status === "fail") {
        return "не соответствует";
    }
    if (complies === true || status === "pass") {
        return "соответствует";
    }
    if (status === "insufficient_data") {
        return "требует уточнения";
    }
    return "требует уточнения";
}
function formatInternalSurfaceTemperature(value, outdoorDesignTemperatureC) {
    if (!Number.isFinite(value) || value === null) {
        return "недостаточно данных";
    }
    if (Number.isFinite(outdoorDesignTemperatureC) &&
        outdoorDesignTemperatureC !== null &&
        Math.abs(value - outdoorDesignTemperatureC) <= 0.5) {
        return "требует проверки расчётной модели";
    }
    return new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
    }).format(value);
}
function finiteOrNull(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
