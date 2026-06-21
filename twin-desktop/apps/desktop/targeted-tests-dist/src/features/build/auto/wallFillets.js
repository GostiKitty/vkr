/** Допуск опознавания стыка по позиции (согласован с wallJoins ENDPOINT_TOLERANCE). */
export const JOINT_TOLERANCE = 0.25;
function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function normalize(v) {
    const l = Math.hypot(v.x, v.y);
    if (l <= 1e-9) {
        return { x: 0, y: 0 };
    }
    return { x: v.x / l, y: v.y / l };
}
/**
 * Список стыков стен (узлов) по уровням. Концы стен кластеризуются по позиции,
 * для каждого стыка собираются «рукава» — направления и длины примыкающих стен.
 */
export function listWallJoints(model) {
    const joints = [];
    const findJoint = (levelId, point) => {
        const existing = joints.find((joint) => joint.levelId === levelId && distance(joint.point, point) <= JOINT_TOLERANCE);
        if (existing) {
            return existing;
        }
        const created = { levelId, point: { ...point }, arms: [] };
        joints.push(created);
        return created;
    };
    model.walls.forEach((wall) => {
        const length = distance(wall.a, wall.b);
        if (length <= 1e-6) {
            return;
        }
        const jointA = findJoint(wall.levelId, wall.a);
        jointA.arms.push({ wallId: wall.id, dir: normalize({ x: wall.b.x - wall.a.x, y: wall.b.y - wall.a.y }), length });
        const jointB = findJoint(wall.levelId, wall.b);
        jointB.arms.push({ wallId: wall.id, dir: normalize({ x: wall.a.x - wall.b.x, y: wall.a.y - wall.b.y }), length });
    });
    return joints;
}
/**
 * Приводит сохранённые скругления к актуальным стыкам: точка fillet притягивается к
 * ближайшему реальному стыку (≥2 стен), радиус ограничивается доступной длиной стен,
 * «осиротевшие» скругления удаляются.
 */
export function syncWallFillets(model) {
    const fillets = model.wallFillets ?? [];
    if (!fillets.length) {
        return [];
    }
    // Скругляемы только чистые угловые стыки ровно из 2 стен (на T/X-стыках скругление даёт щели).
    const joints = listWallJoints(model).filter((joint) => joint.arms.length === 2);
    const result = [];
    fillets.forEach((fillet) => {
        if (!(fillet.radius_m > 0)) {
            return;
        }
        let best = null;
        let bestDistance = JOINT_TOLERANCE;
        joints.forEach((joint) => {
            if (joint.levelId !== fillet.levelId) {
                return;
            }
            const d = distance(joint.point, fillet.point);
            if (d <= bestDistance) {
                bestDistance = d;
                best = joint;
            }
        });
        if (!best) {
            return;
        }
        const joint = best;
        const minArmLength = Math.min(...joint.arms.map((arm) => arm.length));
        const maxRadius = minArmLength * 0.5;
        const radius = Math.min(fillet.radius_m, maxRadius);
        if (!(radius > 0.01)) {
            return;
        }
        result.push({
            ...fillet,
            point: { ...joint.point },
            radius_m: radius,
        });
    });
    return result;
}
