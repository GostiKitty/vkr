import React from "react";
import type { BuildingModel, Door, Vec2, Wall, Window } from "../../../../../entities/geometry/types";
import { anchorToOffset } from "../../../utils/openingMath";
import { ROOM_STYLES, WALL_STYLES, OPENING_STYLES } from "../engineeringLineStyles";
import { isExteriorWall, type PlanProjection } from "../geometry";

interface ArchitectureLayerProps {
  model: BuildingModel;
  activeLevelId: string | null;
  projection: PlanProjection;
}

function levelMatches(activeLevelId: string | null, levelId: string | null | undefined): boolean {
  if (activeLevelId == null) return true;
  return levelId === activeLevelId;
}

function pointsToPath(points: Vec2[], projection: PlanProjection): string {
  if (!points.length) return "";
  return points
    .map((p, i) => {
      const projected = projection.project(p);
      return `${i === 0 ? "M" : "L"} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function wallRect(wall: Wall, projection: PlanProjection): { d: string; centerline: string } {
  const a = projection.project(wall.a);
  const b = projection.project(wall.b);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const ux = length > 1e-9 ? dx / length : 1;
  const uy = length > 1e-9 ? dy / length : 0;
  const nx = -uy;
  const ny = ux;
  const halfThickness = ((wall.thickness_m ?? 0.2) * projection.scale) / 2;
  const p1 = { x: a.x + nx * halfThickness, y: a.y + ny * halfThickness };
  const p2 = { x: b.x + nx * halfThickness, y: b.y + ny * halfThickness };
  const p3 = { x: b.x - nx * halfThickness, y: b.y - ny * halfThickness };
  const p4 = { x: a.x - nx * halfThickness, y: a.y - ny * halfThickness };
  return {
    d: `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} L ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`,
    centerline: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`,
  };
}

function openingGeometry(opening: Door | Window, wall: Wall) {
  const wallLength = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  if (wallLength < 1e-6) return null;
  const offset = anchorToOffset(opening.anchor, wall);
  const t = wallLength > 0 ? offset / wallLength : 0;
  const halfWidth = (opening.width_m ?? 1) / 2;
  const t0 = Math.max(0, Math.min(1, t - halfWidth / wallLength));
  const t1 = Math.max(0, Math.min(1, t + halfWidth / wallLength));
  return {
    a: { x: wall.a.x + (wall.b.x - wall.a.x) * t0, y: wall.a.y + (wall.b.y - wall.a.y) * t0 },
    b: { x: wall.a.x + (wall.b.x - wall.a.x) * t1, y: wall.a.y + (wall.b.y - wall.a.y) * t1 },
    wall,
  };
}

const ArchitectureLayer: React.FC<ArchitectureLayerProps> = ({ model, activeLevelId, projection }) => {
  const rooms = model.rooms.filter((r) => levelMatches(activeLevelId, r.levelId));
  const walls = model.walls.filter((w) => levelMatches(activeLevelId, w.levelId));
  const doors = model.doors ?? [];
  const windows = model.windows ?? [];

  const wallById = new Map(model.walls.map((w) => [w.id, w]));

  return (
    <g data-layer="architecture">
      {/* Заливки помещений — нейтральная подоснова */}
      <g data-sublayer="rooms" fill={ROOM_STYLES.fill} stroke={ROOM_STYLES.stroke} strokeWidth={ROOM_STYLES.strokeWidth}>
        {rooms.map((room, idx) => (
          <path
            key={room.id}
            d={pointsToPath(room.polygon, projection)}
            fill={idx % 2 === 0 ? ROOM_STYLES.fill : ROOM_STYLES.fillAlt}
          />
        ))}
      </g>

      {/* Тела стен (заливка + контур) */}
      <g data-sublayer="walls">
        {walls.map((wall) => {
          const exterior = isExteriorWall(model, wall);
          const style = exterior ? WALL_STYLES.exterior : WALL_STYLES.interior;
          const { d } = wallRect(wall, projection);
          return (
            <path
              key={wall.id}
              d={d}
              fill={style.fill}
              fillOpacity={exterior ? 0.92 : 0.62}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinejoin="miter"
            />
          );
        })}
      </g>

      {/* Проёмы — двери и окна вырезают визуальную ленту поверх стены */}
      <g data-sublayer="openings">
        {windows.map((win) => {
          const wall = wallById.get(win.anchor.wallId ?? "");
          if (!wall) return null;
          const geom = openingGeometry(win, wall);
          if (!geom) return null;
          const a = projection.project(geom.a);
          const b = projection.project(geom.b);
          const halfThickness = ((wall.thickness_m ?? 0.2) * projection.scale) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.hypot(dx, dy);
          if (length < 1e-6) return null;
          const ux = dx / length;
          const uy = dy / length;
          const nx = -uy;
          const ny = ux;
          const p1 = { x: a.x + nx * halfThickness, y: a.y + ny * halfThickness };
          const p2 = { x: b.x + nx * halfThickness, y: b.y + ny * halfThickness };
          const p3 = { x: b.x - nx * halfThickness, y: b.y - ny * halfThickness };
          const p4 = { x: a.x - nx * halfThickness, y: a.y - ny * halfThickness };
          return (
            <g key={win.id}>
              <path
                d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`}
                fill="#fbfbf7"
                stroke="none"
              />
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={OPENING_STYLES.windowOuter} strokeWidth={OPENING_STYLES.windowWidth} />
              <line x1={p4.x} y1={p4.y} x2={p3.x} y2={p3.y} stroke={OPENING_STYLES.windowOuter} strokeWidth={OPENING_STYLES.windowWidth} />
              <line
                x1={(p1.x + p4.x) / 2}
                y1={(p1.y + p4.y) / 2}
                x2={(p2.x + p3.x) / 2}
                y2={(p2.y + p3.y) / 2}
                stroke={OPENING_STYLES.windowInner}
                strokeWidth={OPENING_STYLES.windowWidth}
              />
            </g>
          );
        })}

        {doors.map((door) => {
          const wall = wallById.get(door.anchor.wallId ?? "");
          if (!wall) return null;
          const geom = openingGeometry(door, wall);
          if (!geom) return null;
          const a = projection.project(geom.a);
          const b = projection.project(geom.b);
          const halfThickness = ((wall.thickness_m ?? 0.2) * projection.scale) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const length = Math.hypot(dx, dy);
          if (length < 1e-6) return null;
          const ux = dx / length;
          const uy = dy / length;
          const nx = -uy;
          const ny = ux;
          const radius = length;
          const hinge = door.swingDirection === "right" ? b : a;
          const closedLeafEnd = door.swingDirection === "right" ? a : b;
          const openingSign = door.openingDirection === "outward" ? 1 : -1;
          const openLeafEnd = { x: hinge.x + nx * radius * openingSign, y: hinge.y + ny * radius * openingSign };
          const cross =
            (closedLeafEnd.x - hinge.x) * (openLeafEnd.y - hinge.y) -
            (closedLeafEnd.y - hinge.y) * (openLeafEnd.x - hinge.x);
          const sweepFlag = cross < 0 ? 0 : 1;
          const wallEdgeA = { x: a.x + nx * halfThickness, y: a.y + ny * halfThickness };
          const wallEdgeB = { x: b.x + nx * halfThickness, y: b.y + ny * halfThickness };
          const wallEdgeC = { x: b.x - nx * halfThickness, y: b.y - ny * halfThickness };
          const wallEdgeD = { x: a.x - nx * halfThickness, y: a.y - ny * halfThickness };
          return (
            <g key={door.id}>
              <path
                d={`M ${wallEdgeA.x} ${wallEdgeA.y} L ${wallEdgeB.x} ${wallEdgeB.y} L ${wallEdgeC.x} ${wallEdgeC.y} L ${wallEdgeD.x} ${wallEdgeD.y} Z`}
                fill="#fbfbf7"
                stroke="none"
              />
              <path
                d={`M ${closedLeafEnd.x} ${closedLeafEnd.y} A ${radius} ${radius} 0 0 ${sweepFlag} ${openLeafEnd.x} ${openLeafEnd.y}`}
                fill="none"
                stroke={OPENING_STYLES.doorArc}
                strokeWidth={OPENING_STYLES.doorWidth}
              />
              <line x1={hinge.x} y1={hinge.y} x2={openLeafEnd.x} y2={openLeafEnd.y} stroke={OPENING_STYLES.doorLeaf} strokeWidth={OPENING_STYLES.doorWidth} />
            </g>
          );
        })}
      </g>
    </g>
  );
};

export default ArchitectureLayer;
