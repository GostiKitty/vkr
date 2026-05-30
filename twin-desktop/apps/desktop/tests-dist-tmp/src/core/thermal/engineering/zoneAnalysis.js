import { pointToSegmentDistance } from "../../../entities/geometry/geom";
import { getOrientationWallLabel, getRoomDisplayName } from "./display";
const HEATING_TYPES = new Set(["radiator", "fancoil", "boiler"]);
export function filterFieldCells(field) {
    if (!field) {
        return [];
    }
    return field.cells.filter((cell) => Number.isFinite(cell.temperatureC) &&
        Number.isFinite(cell.x) &&
        Number.isFinite(cell.y) &&
        typeof cell.roomId === "string" &&
        cell.roomId.length > 0);
}
export function computeAverageFieldTemperature(cells) {
    if (!cells.length) {
        return 0;
    }
    return cells.reduce((sum, cell) => sum + cell.temperatureC, 0) / cells.length;
}
export function clusterFieldCells(cells, distanceThresholdM) {
    const clusters = [];
    const visited = new Set();
    for (let index = 0; index < cells.length; index += 1) {
        if (visited.has(index)) {
            continue;
        }
        visited.add(index);
        const seed = cells[index];
        const queue = [index];
        const cluster = [seed];
        while (queue.length) {
            const currentIndex = queue.shift();
            const current = cells[currentIndex];
            for (let candidateIndex = 0; candidateIndex < cells.length; candidateIndex += 1) {
                if (visited.has(candidateIndex)) {
                    continue;
                }
                const candidate = cells[candidateIndex];
                if (candidate.roomId !== current.roomId) {
                    continue;
                }
                if (Math.hypot(candidate.x - current.x, candidate.y - current.y) > distanceThresholdM) {
                    continue;
                }
                visited.add(candidateIndex);
                queue.push(candidateIndex);
                cluster.push(candidate);
            }
        }
        clusters.push(cluster);
    }
    return clusters;
}
export function buildZoneInsights(model, physics, field) {
    const cells = filterFieldCells(field);
    if (!field || !cells.length || !field.levelId) {
        return [];
    }
    const levelRooms = physics.renderGeometry.roomVolumes.filter((room) => room.levelId === field.levelId);
    if (!levelRooms.length) {
        return [];
    }
    const surfaces = physics.surfaces.filter((surface) => surface.levelId === field.levelId && surface.kind === "external");
    const heatingPoints = model.equipment.filter((item) => item.levelId === field.levelId && item.state !== "off" && HEATING_TYPES.has(item.type));
    const meanTemperatureC = computeAverageFieldTemperature(cells);
    const minTemperatureC = Math.min(...cells.map((cell) => cell.temperatureC));
    const maxTemperatureC = Math.max(...cells.map((cell) => cell.temperatureC));
    const spreadC = maxTemperatureC - minTemperatureC;
    const coldThresholdC = meanTemperatureC - Math.max(1.1, spreadC * 0.16);
    const hotThresholdC = meanTemperatureC + Math.max(0.9, spreadC * 0.14);
    const distanceThresholdM = Math.max(field.cellSizeM > 0 ? field.cellSizeM * 1.75 : 0.6, 0.55);
    const metas = cells.map((cell) => buildCellMeta(cell, levelRooms, surfaces, heatingPoints, field.cellSizeM));
    const dominantRoom = [...levelRooms].sort((left, right) => right.areaM2 - left.areaM2)[0];
    const coldClusters = summarizeClusters(metas.filter((meta) => meta.cell.temperatureC <= coldThresholdC && (meta.nearWindow || meta.nearWall || meta.nearCorner)), distanceThresholdM)
        .sort((left, right) => left.temperatureC - right.temperatureC)
        .slice(0, 2);
    const hotClusters = summarizeClusters(metas.filter((meta) => meta.cell.temperatureC >= hotThresholdC && meta.nearHeating), distanceThresholdM)
        .sort((left, right) => right.temperatureC - left.temperatureC)
        .slice(0, 2);
    const wallCluster = summarizeClusters(metas.filter((meta) => meta.nearWall && !meta.nearWindow), distanceThresholdM)
        .sort((left, right) => left.temperatureC - right.temperatureC)[0];
    const windowCluster = summarizeClusters(metas.filter((meta) => meta.nearWindow), distanceThresholdM)
        .sort((left, right) => left.temperatureC - right.temperatureC)[0];
    const heatingCluster = summarizeClusters(metas.filter((meta) => meta.nearHeating), distanceThresholdM)
        .sort((left, right) => right.temperatureC - left.temperatureC)[0];
    const occupiedCandidates = metas.filter((meta) => {
        if (dominantRoom && meta.cell.roomId !== dominantRoom.roomId) {
            return false;
        }
        return meta.distanceToWallM >= Math.max(0.65, field.cellSizeM * 2) && meta.distanceToWindowM >= Math.max(0.85, field.cellSizeM * 2.25);
    });
    const occupiedCluster = summarizeClusters(occupiedCandidates, distanceThresholdM)
        .sort((left, right) => Math.abs(left.temperatureC - meanTemperatureC) - Math.abs(right.temperatureC - meanTemperatureC))[0] ?? summarizeClusters(metas.filter((meta) => meta.cell.roomId === dominantRoom?.roomId), distanceThresholdM)[0];
    const insights = [];
    coldClusters.forEach((cluster, index) => {
        insights.push(buildInsight(model, meanTemperatureC, cluster, "cold", index));
    });
    if (hotClusters.length) {
        hotClusters.forEach((cluster, index) => {
            insights.push(buildInsight(model, meanTemperatureC, cluster, "hot", index));
        });
    }
    if (occupiedCluster) {
        insights.push(buildInsight(model, meanTemperatureC, occupiedCluster, "occupied", 0));
    }
    if (wallCluster) {
        insights.push(buildInsight(model, meanTemperatureC, wallCluster, "wall", 0));
    }
    if (windowCluster) {
        insights.push(buildInsight(model, meanTemperatureC, windowCluster, "window", 0));
    }
    if (heatingCluster) {
        insights.push(buildInsight(model, meanTemperatureC, heatingCluster, "heating", 0));
    }
    return insights;
}
function buildCellMeta(cell, rooms, surfaces, heatingPoints, cellSizeM) {
    const room = rooms.find((entry) => entry.roomId === cell.roomId) ?? null;
    const roomSegments = room ? polygonSegments(room.polygon) : [];
    const externalSurfaces = surfaces.filter((surface) => surface.positiveRoomId === cell.roomId || surface.negativeRoomId === cell.roomId);
    const wallDistance = roomSegments.length
        ? Math.min(...roomSegments.map((segment) => pointToSegmentDistance(cell, segment.a, segment.b)))
        : Number.POSITIVE_INFINITY;
    const nearestSurface = externalSurfaces
        .map((surface) => ({
        distance: pointToSegmentDistance(cell, surface.wall.a, surface.wall.b),
        orientation: surface.orientation,
    }))
        .sort((left, right) => left.distance - right.distance)[0];
    const windowDistance = externalSurfaces.length
        ? Math.min(...externalSurfaces
            .filter((surface) => surface.windowAreaM2 > 0)
            .map((surface) => pointToSegmentDistance(cell, surface.wall.a, surface.wall.b)))
        : Number.POSITIVE_INFINITY;
    const heatingDistance = heatingPoints.length
        ? Math.min(...heatingPoints.map((item) => Math.hypot(item.position.x - cell.x, item.position.y - cell.y)))
        : Number.POSITIVE_INFINITY;
    const cornerLabel = room ? resolveCornerLabel(cell, room.polygon) : null;
    const wallBandM = Math.max(0.38, cellSizeM * 1.6 || 0.5);
    const windowBandM = Math.max(0.5, cellSizeM * 1.9 || 0.65);
    const heatingBandM = Math.max(0.7, cellSizeM * 2.1 || 0.9);
    return {
        cell,
        roomAreaM2: room?.areaM2 ?? 0,
        distanceToWallM: wallDistance,
        distanceToExternalWallM: nearestSurface?.distance ?? Number.POSITIVE_INFINITY,
        distanceToWindowM: Number.isFinite(windowDistance) ? windowDistance : Number.POSITIVE_INFINITY,
        distanceToHeatingM: Number.isFinite(heatingDistance) ? heatingDistance : Number.POSITIVE_INFINITY,
        nearWall: (nearestSurface?.distance ?? Number.POSITIVE_INFINITY) <= wallBandM,
        nearWindow: Number.isFinite(windowDistance) && windowDistance <= windowBandM,
        nearHeating: Number.isFinite(heatingDistance) && heatingDistance <= heatingBandM,
        nearCorner: Boolean(cornerLabel),
        nearestOrientation: nearestSurface?.orientation ?? null,
        cornerLabel,
    };
}
function summarizeClusters(metas, distanceThresholdM) {
    if (!metas.length) {
        return [];
    }
    const clusters = clusterFieldCells(metas.map((meta) => meta.cell), distanceThresholdM);
    return clusters.map((cells) => {
        const related = metas.filter((meta) => cells.some((cell) => cell.x === meta.cell.x && cell.y === meta.cell.y && cell.roomId === meta.cell.roomId));
        const x = average(cells.map((cell) => cell.x));
        const y = average(cells.map((cell) => cell.y));
        return {
            cells,
            x,
            y,
            temperatureC: average(cells.map((cell) => cell.temperatureC)),
            roomId: mostFrequent(cells.map((cell) => cell.roomId)),
            pointCount: cells.length,
            nearestOrientation: mostFrequent(related.map((meta) => meta.nearestOrientation)),
            nearWindow: related.some((meta) => meta.nearWindow),
            nearWall: related.some((meta) => meta.nearWall),
            nearHeating: related.some((meta) => meta.nearHeating),
            nearCorner: related.some((meta) => meta.nearCorner),
            cornerLabel: mostFrequent(related.map((meta) => meta.cornerLabel)),
        };
    });
}
function buildInsight(model, meanTemperatureC, cluster, category, index) {
    const roomName = getRoomDisplayName(model, cluster.roomId);
    const deltaFromAverageC = cluster.temperatureC - meanTemperatureC;
    let title = roomName;
    let reason = "Локальная оценка температуры по расчетной сетке.";
    if (category === "cold") {
        if (cluster.nearCorner && cluster.cornerLabel) {
            title = cluster.cornerLabel;
            reason = "Локальное охлаждение в угловой зоне у наружных ограждений.";
        }
        else if (cluster.nearWindow) {
            title = cluster.nearestOrientation ? `Под окном, ${getOrientationWallLabel(cluster.nearestOrientation)}` : "Под окном";
            reason = "Повышенные теплопотери через оконный проем и примыкающее наружное ограждение.";
        }
        else {
            title = cluster.nearestOrientation ? `Холодная зона, ${getOrientationWallLabel(cluster.nearestOrientation)}` : "Холодная зона";
            reason = "Повышенные теплопотери через наружное ограждение.";
        }
    }
    else if (category === "hot") {
        title = cluster.nearHeating ? "Перегретая зона у прибора" : "Перегретая зона";
        reason = cluster.nearHeating
            ? "Локальный нагрев рядом с отопительным прибором или тепловым источником."
            : "Локальный перегрев по расчетному полю, требующий проверки режима источников.";
    }
    else if (category === "occupied") {
        title = "Рабочая зона";
        reason = "Зона пребывания людей, удаленная от наружных ограждений и локальных источников.";
    }
    else if (category === "wall") {
        title = cluster.nearestOrientation ? `У наружной стены, ${getOrientationWallLabel(cluster.nearestOrientation)}` : "У наружной стены";
        reason = "Контроль температуры в приственной полосе, чувствительной к теплопотерям оболочки.";
    }
    else if (category === "window") {
        title = cluster.nearestOrientation ? `Под окном, ${getOrientationWallLabel(cluster.nearestOrientation)}` : "Приоконная зона";
        reason = "Приоконная полоса наиболее чувствительна к снижению внутренней поверхности и локальному дискомфорту.";
    }
    else if (category === "heating") {
        title = "Возле радиатора";
        reason = "Локальный нагрев отопительным прибором или аналогичным источником тепла.";
    }
    return {
        id: `${category}-${cluster.roomId ?? "level"}-${index + 1}`,
        category,
        title,
        roomId: cluster.roomId,
        roomName,
        x: cluster.x,
        y: cluster.y,
        temperatureC: cluster.temperatureC,
        deltaFromAverageC,
        reason,
        severity: resolveSeverity(category, deltaFromAverageC),
        pointCount: cluster.pointCount,
    };
}
function resolveSeverity(category, deltaFromAverageC) {
    const delta = Math.abs(deltaFromAverageC);
    if (category === "occupied") {
        return delta > 1.5 ? "warning" : "info";
    }
    if (category === "cold") {
        return delta >= 3 ? "critical" : "warning";
    }
    if (category === "hot") {
        return delta >= 2.5 ? "warning" : "info";
    }
    return delta >= 2 ? "warning" : "info";
}
function resolveCornerLabel(point, polygon) {
    const matchingCorner = polygon.find((vertex) => Math.hypot(vertex.x - point.x, vertex.y - point.y) <= 0.55);
    if (!matchingCorner) {
        return null;
    }
    const xs = polygon.map((vertex) => vertex.x);
    const ys = polygon.map((vertex) => vertex.y);
    const horizontal = matchingCorner.x <= Math.min(...xs) + 0.2 ? "западный" : matchingCorner.x >= Math.max(...xs) - 0.2 ? "восточный" : null;
    const vertical = matchingCorner.y <= Math.min(...ys) + 0.2 ? "северный" : matchingCorner.y >= Math.max(...ys) - 0.2 ? "южный" : null;
    if (horizontal && vertical) {
        return `${vertical}-${horizontal} угол`;
    }
    return "Угловая зона";
}
function polygonSegments(polygon) {
    const segments = [];
    for (let index = 0; index < polygon.length; index += 1) {
        segments.push({
            a: polygon[index],
            b: polygon[(index + 1) % polygon.length],
        });
    }
    return segments;
}
function average(values) {
    if (!values.length) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function mostFrequent(values) {
    if (!values.length) {
        return null;
    }
    const counts = new Map();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}
