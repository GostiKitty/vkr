import type { BuildingModel, Vec2 } from "../../entities/geometry/types";
import {
  isHeatingPipeType,
  normalizeFlowDirection,
  resolvePipeFlowRole,
  type Equipment,
  type FlowDirection,
  type HeatCarrierType,
  type HeatingConnectionType,
  type HeatingSystemKind,
  type PipeFlowRole,
  type PipeNetwork,
  type PipeSegmentClass,
} from "../../entities/networks/types";
import { polylineLength } from "./utils";

const NODE_SNAP_TOLERANCE_M = 0.08;

type NodeType = "source" | "equipment" | "junction" | "terminal" | "inline";

export interface HeatingNode {
  id: string;
  systemId: string;
  levelId: string;
  point: Vec2;
  type: NodeType;
  connectedSegmentIds: string[];
  connectedBranchIds: string[];
  connectedEquipmentIds: string[];
}

export interface HeatingPipeSegment {
  id: string;
  pipeId: string;
  systemId: string;
  levelId: string;
  lineRole: PipeFlowRole;
  segmentClass: PipeSegmentClass;
  flowDirection: FlowDirection;
  fromNodeId: string;
  toNodeId: string;
  start: Vec2;
  end: Vec2;
  length_m: number;
  diameter_mm: number;
  innerDiameter_mm: number;
  flowRate_kg_s: number;
  designVelocity_m_s: number;
  fluidTemperatureC: number;
  pressureDropPa: number;
  heatLossW: number;
}

export interface HeatingBranch {
  id: string;
  pipeId: string;
  systemId: string;
  levelId: string;
  role: PipeFlowRole;
  segmentClass: PipeSegmentClass;
  fromNodeId: string;
  toNodeId: string;
  segmentIds: string[];
  length_m: number;
  heatLossW: number;
  pressureDropPa: number;
  flowRate_kg_s: number;
  localLoadW: number;
  downstreamLoadW: number;
  downstreamFlow_kg_s: number;
  servedRoomIds: string[];
  terminalEquipmentIds: string[];
  parentBranchId: string | null;
  childBranchIds: string[];
  reachableFromSource: boolean;
  status: "connected" | "dangling" | "isolated";
}

export interface HeatingEquipmentConnection {
  equipmentId: string;
  equipmentType: Equipment["type"];
  roomId: string | null;
  systemId: string;
  loadW: number;
  flowRate_kg_s: number;
  supplyPipeIds: string[];
  returnPipeIds: string[];
  connectionType: HeatingConnectionType | null;
  connected: boolean;
}

export interface HeatingSystemGraph {
  id: string;
  name: string;
  levelIds: string[];
  systemType: HeatingSystemKind;
  heatCarrier: HeatCarrierType;
  supplyTemperatureC: number;
  returnTemperatureC: number;
  designIndoorTemperatureC: number;
  designOutdoorTemperatureC: number;
  deltaT_C: number;
  nodes: HeatingNode[];
  segments: HeatingPipeSegment[];
  branches: HeatingBranch[];
  equipmentConnections: HeatingEquipmentConnection[];
  roomIds: string[];
  sourceEquipmentIds: string[];
  rootBranchIds: string[];
  totalLength_m: number;
  totalHeatLossW: number;
  totalLoadW: number;
  estimatedFlow_kg_s: number;
  danglingNodeIds: string[];
  hasSupply: boolean;
  hasReturn: boolean;
  connected: boolean;
  issues: HeatingIntegrityIssue[];
}

export interface HeatingModelSnapshot {
  systems: HeatingSystemGraph[];
  totalLength_m: number;
  totalLoadW: number;
  unassignedHeatingEquipmentIds: string[];
  unassignedHeatingPipeIds: string[];
  issues: HeatingIntegrityIssue[];
}

export interface HeatingIntegrityIssue {
  severity: "warning" | "error";
  code:
    | "missing_supply"
    | "missing_return"
    | "missing_source"
    | "dangling_node"
    | "missing_dual_connection"
    | "isolated_branch"
    | "missing_parameters"
    | "duplicate_segment";
  message: string;
  systemId: string;
  pipeId?: string;
  branchId?: string;
  equipmentId?: string;
  nodeId?: string;
}

type MutableNode = {
  id: string;
  levelId: string;
  point: Vec2;
  segmentIds: Set<string>;
  branchIds: Set<string>;
  equipmentIds: Set<string>;
};

const HEATING_SOURCE_TYPES = new Set<Equipment["type"]>(["boiler", "pump", "heat_exchanger"]);
const HEATING_CONSUMER_TYPES = new Set<Equipment["type"]>(["radiator", "fancoil"]);

export function buildHeatingModelSnapshot(model: BuildingModel): HeatingModelSnapshot {
  const heatingPipes = model.pipes.filter((pipe) => isHeatingPipeType(pipe.type));
  if (!heatingPipes.length) {
    return {
      systems: [],
      totalLength_m: 0,
      totalLoadW: 0,
      unassignedHeatingEquipmentIds: resolveHeatingEquipment(model.equipment).map((equipment) => equipment.id),
      unassignedHeatingPipeIds: [],
      issues: [],
    };
  }

  const equipmentById = new Map(model.equipment.map((equipment) => [equipment.id, equipment] as const));
  const pipesById = new Map(heatingPipes.map((pipe) => [pipe.id, pipe] as const));
  const pipeConnections = buildPipeEquipmentConnections(heatingPipes, model.equipment);
  const adjacency = buildPipeAdjacency(heatingPipes, pipeConnections);
  const components = collectPipeComponents(heatingPipes, adjacency);

  const systems = components.map((pipeIds, index) =>
    buildSystemGraph({
      pipeIds,
      systemIndex: index,
      pipesById,
      pipeConnections,
      equipmentById,
    })
  );

  const assignedHeatingEquipmentIds = new Set(
    systems.flatMap((system) => system.equipmentConnections.map((connection) => connection.equipmentId))
  );
  const unassignedHeatingEquipmentIds = resolveHeatingEquipment(model.equipment)
    .filter((equipment) => !assignedHeatingEquipmentIds.has(equipment.id))
    .map((equipment) => equipment.id);
  const unassignedHeatingPipeIds = heatingPipes
    .filter((pipe) => {
      const connected = pipeConnections.get(pipe.id);
      return !(connected && connected.size) && !adjacency.get(pipe.id)?.size;
    })
    .map((pipe) => pipe.id);

  return {
    systems,
    totalLength_m: systems.reduce((sum, system) => sum + system.totalLength_m, 0),
    totalLoadW: systems.reduce((sum, system) => sum + system.totalLoadW, 0),
    unassignedHeatingEquipmentIds,
    unassignedHeatingPipeIds,
    issues: systems.flatMap((system) => system.issues),
  };
}

function assignBranchLoads(
  branches: HeatingBranch[],
  equipmentConnections: HeatingEquipmentConnection[]
): HeatingBranch[] {
  const branchMap = new Map<string, HeatingBranch>(
    branches.map((branch) => [branch.id, cloneBranch(branch)])
  );

  equipmentConnections.forEach((connection) => {
    if (!HEATING_CONSUMER_TYPES.has(connection.equipmentType)) {
      return;
    }
    const targets = unique([...connection.supplyPipeIds, ...connection.returnPipeIds]);
    targets.forEach((branchId) => {
      const branch = branchMap.get(branchId);
      if (!branch) {
        return;
      }
      branch.localLoadW += connection.loadW;
      branch.downstreamLoadW += connection.loadW;
      branch.downstreamFlow_kg_s += Math.max(0, connection.flowRate_kg_s);
      branch.terminalEquipmentIds = unique([...branch.terminalEquipmentIds, connection.equipmentId]);
      branch.servedRoomIds = unique([...branch.servedRoomIds, ...(connection.roomId ? [connection.roomId] : [])]);
    });
  });

  return [...branchMap.values()];
}

function buildBranchHierarchy(
  branches: HeatingBranch[],
  nodesById: Map<string, HeatingNode>,
  sourceEquipmentIds: string[]
): HeatingBranch[] {
  const branchesById = new Map<string, HeatingBranch>(
    branches.map((branch) => [branch.id, cloneBranch(branch)])
  );
  const roleGroups = new Map<PipeFlowRole, HeatingBranch[]>();
  branches.forEach((branch) => {
    const group = roleGroups.get(branch.role) ?? [];
    group.push(branchesById.get(branch.id) ?? branch);
    roleGroups.set(branch.role, group);
  });

  roleGroups.forEach((roleBranches) => {
    const nodeToBranchIds = new Map<string, string[]>();
    roleBranches.forEach((branch) => {
      [branch.fromNodeId, branch.toNodeId].forEach((nodeId) => {
        const next = nodeToBranchIds.get(nodeId) ?? [];
        next.push(branch.id);
        nodeToBranchIds.set(nodeId, next);
      });
    });

    const sourceNodeIds = new Set(
      [...nodesById.values()]
        .filter((node) => node.connectedEquipmentIds.some((equipmentId) => sourceEquipmentIds.includes(equipmentId)))
        .map((node) => node.id)
    );
    const depth = new Map<string, number>();
    const queue: string[] = [];

    roleBranches.forEach((branch) => {
      if (sourceNodeIds.has(branch.fromNodeId) || sourceNodeIds.has(branch.toNodeId)) {
        depth.set(branch.id, 0);
        queue.push(branch.id);
      }
    });

    while (queue.length) {
      const currentId = queue.shift();
      if (!currentId) {
        continue;
      }
      const current = branchesById.get(currentId);
      if (!current) {
        continue;
      }
      const currentDepth = depth.get(currentId) ?? 0;
      const neighborIds = unique([
        ...(nodeToBranchIds.get(current.fromNodeId) ?? []),
        ...(nodeToBranchIds.get(current.toNodeId) ?? []),
      ]).filter((branchId) => branchId !== currentId);
      neighborIds.forEach((neighborId) => {
        if (!depth.has(neighborId)) {
          depth.set(neighborId, currentDepth + 1);
          queue.push(neighborId);
        }
      });
    }

    roleBranches.forEach((branch) => {
      const branchDepth = depth.get(branch.id);
      branch.reachableFromSource = branchDepth !== undefined;
      if (!branch.reachableFromSource) {
        branch.status = "isolated";
        return;
      }
      const neighborIds = unique([
        ...(nodeToBranchIds.get(branch.fromNodeId) ?? []),
        ...(nodeToBranchIds.get(branch.toNodeId) ?? []),
      ]).filter((branchId) => branchId !== branch.id);
      const parentCandidate = neighborIds
        .map((neighborId) => ({ id: neighborId, depth: depth.get(neighborId) }))
        .filter((entry): entry is { id: string; depth: number } => typeof entry.depth === "number" && entry.depth < (branchDepth ?? 0))
        .sort((left, right) => right.depth - left.depth)[0];
      branch.parentBranchId = parentCandidate?.id ?? null;
      branch.status = branch.terminalEquipmentIds.length || neighborIds.length > 0 ? "connected" : "dangling";
    });

    roleBranches.forEach((branch) => {
      if (branch.parentBranchId) {
        const parent = branchesById.get(branch.parentBranchId);
        if (parent) {
          parent.childBranchIds = unique([...parent.childBranchIds, branch.id]);
        }
      }
    });
  });

  const accumulated = new Set<string>();
  const accumulate = (branchId: string): { loadW: number; flow: number; roomIds: string[] } => {
    if (accumulated.has(branchId)) {
      const existing = branchesById.get(branchId);
      return {
        loadW: existing?.downstreamLoadW ?? 0,
        flow: existing?.downstreamFlow_kg_s ?? 0,
        roomIds: existing?.servedRoomIds ?? [],
      };
    }
    const branch = branchesById.get(branchId);
    if (!branch) {
      return { loadW: 0, flow: 0, roomIds: [] };
    }
    let loadW = branch.localLoadW;
    let flow = branch.downstreamFlow_kg_s;
    let roomIds = [...branch.servedRoomIds];
    branch.childBranchIds.forEach((childId) => {
      const child = accumulate(childId);
      loadW += child.loadW;
      flow += child.flow;
      roomIds = unique([...roomIds, ...child.roomIds]);
    });
    branch.downstreamLoadW = loadW;
    branch.downstreamFlow_kg_s = flow;
    branch.servedRoomIds = roomIds;
    accumulated.add(branchId);
    return { loadW, flow, roomIds };
  };

  [...branchesById.values()].forEach((branch) => {
    if (!branch.parentBranchId) {
      accumulate(branch.id);
    }
  });

  return [...branchesById.values()];
}

function buildBranchIssues(
  systemId: string,
  branches: HeatingBranch[],
  equipmentConnections: HeatingEquipmentConnection[],
  pipes: PipeNetwork[],
  nodesById: Map<string, HeatingNode>
): HeatingIntegrityIssue[] {
  const issues: HeatingIntegrityIssue[] = [];
  const supplyBranches = branches.filter((branch) => branch.role === "supply");
  const returnBranches = branches.filter((branch) => branch.role === "return");
  if (!supplyBranches.length) {
    issues.push({
      severity: "error",
      code: "missing_supply",
      message: `В контуре ${systemId} отсутствует подающая линия.`,
      systemId,
    });
  }
  if (!returnBranches.length) {
    issues.push({
      severity: "error",
      code: "missing_return",
      message: `В контуре ${systemId} отсутствует обратная линия.`,
      systemId,
    });
  }
  if (!equipmentConnections.some((connection) => HEATING_SOURCE_TYPES.has(connection.equipmentType))) {
    issues.push({
      severity: "warning",
      code: "missing_source",
      message: `Контур ${systemId} не привязан к источнику тепла или циркуляции.`,
      systemId,
    });
  }
  equipmentConnections.forEach((connection) => {
    if (!HEATING_CONSUMER_TYPES.has(connection.equipmentType)) {
      return;
    }
    if (!connection.supplyPipeIds.length || !connection.returnPipeIds.length) {
      issues.push({
        severity: "error",
        code: "missing_dual_connection",
        message: `Прибор ${connection.equipmentId} должен быть подключен и к подаче, и к обратке.`,
        systemId,
        equipmentId: connection.equipmentId,
      });
    }
  });
  branches.forEach((branch) => {
    if (!branch.reachableFromSource) {
      issues.push({
        severity: "warning",
        code: "isolated_branch",
        message: `Ветвь ${branch.id} не связана с источником тепла.`,
        systemId,
        branchId: branch.id,
        pipeId: branch.pipeId,
      });
    }
    if (branch.status === "dangling") {
      issues.push({
        severity: "warning",
        code: "dangling_node",
        message: `Ветвь ${branch.id} имеет висячее окончание без продолжения трассы.`,
        systemId,
        branchId: branch.id,
        pipeId: branch.pipeId,
      });
    }
  });
  const nodeDegrees = new Map<string, number>();
  branches.forEach((branch) => {
    nodeDegrees.set(branch.fromNodeId, (nodeDegrees.get(branch.fromNodeId) ?? 0) + 1);
    nodeDegrees.set(branch.toNodeId, (nodeDegrees.get(branch.toNodeId) ?? 0) + 1);
  });
  [...nodeDegrees.entries()]
    .filter(([nodeId, degree]) => degree > 4 && (nodesById.get(nodeId)?.type === "junction" || nodesById.get(nodeId)?.type === "inline"))
    .forEach(([nodeId]) => {
      issues.push({
        severity: "warning",
        code: "dangling_node",
        message: `Узел ${nodeId} имеет перегруженную топологию соединений.`,
        systemId,
        nodeId,
      });
    });
  pipes
    .filter((pipe) => !Number.isFinite(pipe.diameter_mm) || pipe.diameter_mm <= 0 || !pipe.material)
    .forEach((pipe) => {
      issues.push({
        severity: "error",
        code: "missing_parameters",
        message: `Участок ${pipe.id} не имеет полного набора инженерных параметров.`,
        systemId,
        pipeId: pipe.id,
        branchId: pipe.id,
      });
    });
  collectDuplicatePipeIds(pipes).forEach((pipeId) => {
    issues.push({
      severity: "warning",
      code: "duplicate_segment",
      message: `Участок ${pipeId} дублирует существующую трассу в этом контуре.`,
      systemId,
      pipeId,
      branchId: pipeId,
    });
  });
  return dedupeIssues(issues);
}

function buildPipeEquipmentConnections(
  pipes: PipeNetwork[],
  equipmentItems: Equipment[]
): Map<string, Set<string>> {
  const pipesById = new Map(pipes.map((pipe) => [pipe.id, pipe] as const));
  const connections = new Map<string, Set<string>>();

  pipes.forEach((pipe) => {
    connections.set(pipe.id, new Set(pipe.connectedEquipmentIds));
  });

  equipmentItems.forEach((equipment) => {
    equipment.connectedNetworkIds.forEach((networkId) => {
      if (!pipesById.has(networkId)) {
        return;
      }
      if (!connections.has(networkId)) {
        connections.set(networkId, new Set());
      }
      connections.get(networkId)?.add(equipment.id);
    });
  });

  return connections;
}

function buildPipeAdjacency(
  pipes: PipeNetwork[],
  pipeConnections: Map<string, Set<string>>
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>();
  const nodeToPipes = new Map<string, Set<string>>();

  pipes.forEach((pipe) => {
    adjacency.set(pipe.id, adjacency.get(pipe.id) ?? new Set());
    pipe.path.forEach((point) => {
      const key = pointKey(pipe.levelId, point);
      if (!nodeToPipes.has(key)) {
        nodeToPipes.set(key, new Set());
      }
      nodeToPipes.get(key)?.add(pipe.id);
    });
  });

  nodeToPipes.forEach((pipeIds) => {
    const ids = [...pipeIds];
    for (let index = 0; index < ids.length; index += 1) {
      for (let inner = index + 1; inner < ids.length; inner += 1) {
        link(adjacency, ids[index], ids[inner]);
      }
    }
  });

  const equipmentToPipes = new Map<string, string[]>();
  pipeConnections.forEach((equipmentIds, pipeId) => {
    equipmentIds.forEach((equipmentId) => {
      const next = equipmentToPipes.get(equipmentId) ?? [];
      next.push(pipeId);
      equipmentToPipes.set(equipmentId, next);
    });
  });

  equipmentToPipes.forEach((pipeIds) => {
    for (let index = 0; index < pipeIds.length; index += 1) {
      for (let inner = index + 1; inner < pipeIds.length; inner += 1) {
        link(adjacency, pipeIds[index], pipeIds[inner]);
      }
    }
  });

  return adjacency;
}

function collectPipeComponents(
  pipes: PipeNetwork[],
  adjacency: Map<string, Set<string>>
): string[][] {
  const visited = new Set<string>();
  const components: string[][] = [];

  pipes.forEach((pipe) => {
    if (visited.has(pipe.id)) {
      return;
    }
    const queue = [pipe.id];
    const component: string[] = [];
    visited.add(pipe.id);
    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      component.push(current);
      adjacency.get(current)?.forEach((next) => {
        if (visited.has(next)) {
          return;
        }
        visited.add(next);
        queue.push(next);
      });
    }
    components.push(component);
  });

  return components;
}

function buildSystemGraph({
  pipeIds,
  systemIndex,
  pipesById,
  pipeConnections,
  equipmentById,
}: {
  pipeIds: string[];
  systemIndex: number;
  pipesById: Map<string, PipeNetwork>;
  pipeConnections: Map<string, Set<string>>;
  equipmentById: Map<string, Equipment>;
}): HeatingSystemGraph {
  const pipes = pipeIds.map((pipeId) => pipesById.get(pipeId)).filter((pipe): pipe is PipeNetwork => Boolean(pipe));
  const namedSystemId = pipes.find((pipe) => pipe.heatingSystemId)?.heatingSystemId?.trim();
  const systemId = namedSystemId || `heating-system-${systemIndex + 1}`;
  const systemName = namedSystemId || `Контур ${systemIndex + 1}`;
  const nodesByKey = new Map<string, MutableNode>();
  const segments: HeatingPipeSegment[] = [];
  const branches: HeatingBranch[] = [];

  pipes.forEach((pipe) => {
    const role = pipe.flowRole ?? resolvePipeFlowRole(pipe.type) ?? "distribution";
    const segmentClass = pipe.segmentClass ?? "branch";
    const flowDirection = normalizeFlowDirection(pipe.flowDirection ?? "forward");
    const segmentIds: string[] = [];
    let firstSegmentId: string | null = null;
    let lastSegmentId: string | null = null;
    let branchHeatLossW = 0;
    let branchPressureDropPa = 0;

    for (let index = 1; index < pipe.path.length; index += 1) {
      const geometricStart = pipe.path[index - 1];
      const geometricEnd = pipe.path[index];
      const length_m = Math.hypot(geometricEnd.x - geometricStart.x, geometricEnd.y - geometricStart.y);
      if (length_m <= 0.001) {
        continue;
      }
      const geometricStartNode = ensureNode(nodesByKey, pipe.levelId, geometricStart);
      const geometricEndNode = ensureNode(nodesByKey, pipe.levelId, geometricEnd);
      const fromNode = flowDirection === "backward" ? geometricEndNode : geometricStartNode;
      const toNode = flowDirection === "backward" ? geometricStartNode : geometricEndNode;
      const segmentId = `${pipe.id}:segment:${index}`;
      const pressureDropPa = estimatePipePressureDrop(pipe, length_m);
      const heatLossW = estimatePipeHeatLoss(pipe, length_m);
      fromNode.segmentIds.add(segmentId);
      toNode.segmentIds.add(segmentId);
      fromNode.branchIds.add(pipe.id);
      toNode.branchIds.add(pipe.id);
      segmentIds.push(segmentId);
      branchHeatLossW += heatLossW;
      branchPressureDropPa += pressureDropPa;
      if (!firstSegmentId) {
        firstSegmentId = segmentId;
      }
      lastSegmentId = segmentId;
      segments.push({
        id: segmentId,
        pipeId: pipe.id,
        systemId,
        levelId: pipe.levelId,
        lineRole: role,
        segmentClass,
        flowDirection,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        start: { ...geometricStart },
        end: { ...geometricEnd },
        length_m,
        diameter_mm: pipe.diameter_mm,
        innerDiameter_mm: pipe.innerDiameter_mm ?? Math.max(pipe.diameter_mm - 4, pipe.diameter_mm * 0.82),
        flowRate_kg_s: Math.max(0, pipe.flowRate_kg_s),
        designVelocity_m_s: pipe.designVelocity_m_s ?? estimatePipeVelocity(pipe),
        fluidTemperatureC: pipe.fluidTemperatureC,
        pressureDropPa,
        heatLossW,
      });
    }

    if (segmentIds.length && firstSegmentId && lastSegmentId) {
      const firstSegment = segments.find((segment) => segment.id === firstSegmentId);
      const lastSegment = segments.find((segment) => segment.id === lastSegmentId);
      if (firstSegment && lastSegment) {
        branches.push({
          id: pipe.id,
          pipeId: pipe.id,
          systemId,
          levelId: pipe.levelId,
          role,
          segmentClass,
          fromNodeId: firstSegment.fromNodeId,
          toNodeId: lastSegment.toNodeId,
          segmentIds,
          length_m: polylineLength(pipe.path),
          heatLossW: branchHeatLossW,
          pressureDropPa: branchPressureDropPa,
          flowRate_kg_s: Math.max(0, pipe.flowRate_kg_s),
          localLoadW: 0,
          downstreamLoadW: 0,
          downstreamFlow_kg_s: 0,
          servedRoomIds: [],
          terminalEquipmentIds: [],
          parentBranchId: null,
          childBranchIds: [],
          reachableFromSource: false,
          status: "isolated",
        });
      }
    }
  });

  const systemEquipmentIds = unique(
    pipes.flatMap((pipe) => [...(pipeConnections.get(pipe.id) ?? [])]).filter((equipmentId) => equipmentById.has(equipmentId))
  );

  pipes.forEach((pipe) => {
    const connectedEquipmentIds = [...(pipeConnections.get(pipe.id) ?? [])];
    connectedEquipmentIds.forEach((equipmentId) => {
      const equipment = equipmentById.get(equipmentId);
      if (!equipment) {
        return;
      }
      const nearest = findNearestPathNodeKey(pipe.levelId, pipe.path, equipment.position);
      if (!nearest) {
        return;
      }
      ensureNode(nodesByKey, pipe.levelId, nearest.point).equipmentIds.add(equipmentId);
    });
  });

  const nodes = [...nodesByKey.values()].map((node) =>
    finalizeNode(systemId, node, systemEquipmentIds.map((equipmentId) => equipmentById.get(equipmentId)).filter((entry): entry is Equipment => Boolean(entry)))
  );

  const equipmentConnections = systemEquipmentIds
    .map((equipmentId) => {
      const equipment = equipmentById.get(equipmentId);
      if (!equipment) {
        return null;
      }
      const connectedPipes = pipes.filter((pipe) => (pipeConnections.get(pipe.id) ?? new Set()).has(equipmentId));
      const supplyPipeIds = connectedPipes
        .filter((pipe) => (pipe.flowRole ?? resolvePipeFlowRole(pipe.type)) === "supply")
        .map((pipe) => pipe.id);
      const returnPipeIds = connectedPipes
        .filter((pipe) => (pipe.flowRole ?? resolvePipeFlowRole(pipe.type)) === "return")
        .map((pipe) => pipe.id);
      return {
        equipmentId: equipment.id,
        equipmentType: equipment.type,
        roomId: equipment.roomId,
        systemId,
        loadW: equipment.params.nominalPowerW ?? 0,
        flowRate_kg_s: equipment.params.designFlow_kg_s ?? 0,
        supplyPipeIds,
        returnPipeIds,
        connectionType: equipment.params.connectionType ?? null,
        connected: supplyPipeIds.length > 0 || returnPipeIds.length > 0,
      } satisfies HeatingEquipmentConnection;
    })
    .filter((connection): connection is HeatingEquipmentConnection => Boolean(connection));

  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
  const branchesWithLoad = assignBranchLoads(branches, equipmentConnections);

  const sourceEquipmentIds = equipmentConnections
    .filter((connection) => HEATING_SOURCE_TYPES.has(connection.equipmentType))
    .map((connection) => connection.equipmentId);
  const rootedBranches = buildBranchHierarchy(branchesWithLoad, nodesById, sourceEquipmentIds);
  const branchIssues = buildBranchIssues(systemId, rootedBranches, equipmentConnections, pipes, nodesById);
  const hasSupply = branches.some((branch) => branch.role === "supply");
  const hasReturn = branches.some((branch) => branch.role === "return");
  const totalLength_m = rootedBranches.reduce((sum, branch) => sum + branch.length_m, 0);
  const totalHeatLossW = rootedBranches.reduce((sum, branch) => sum + branch.heatLossW, 0);
  const totalLoadW = equipmentConnections
    .filter((connection) => HEATING_CONSUMER_TYPES.has(connection.equipmentType))
    .reduce((sum, connection) => sum + connection.loadW, 0);
  const supplyTemperatureC = average(
    pipes
      .filter((pipe) => (pipe.flowRole ?? resolvePipeFlowRole(pipe.type)) === "supply")
      .map((pipe) => pipe.fluidTemperatureC),
    highestNumber(
      equipmentConnections
        .map((connection) => equipmentById.get(connection.equipmentId)?.params.supplyTemperatureC)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      70
    )
  );
  const returnTemperatureC = average(
    pipes
      .filter((pipe) => (pipe.flowRole ?? resolvePipeFlowRole(pipe.type)) === "return")
      .map((pipe) => pipe.fluidTemperatureC),
    average(
      equipmentConnections
        .map((connection) => equipmentById.get(connection.equipmentId)?.params.returnTemperatureC)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      50
    )
  );
  const designIndoorTemperatureC = average(
    pipes
      .map((pipe) => pipe.designIndoorTemperatureC)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    21
  );
  const designOutdoorTemperatureC = average(
    pipes
      .map((pipe) => pipe.designOutdoorTemperatureC)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    -18
  );
  const deltaT_C = Math.max(
    1,
    average(
      pipes
        .map((pipe) => pipe.temperatureDropC)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
      supplyTemperatureC - returnTemperatureC
    )
  );
  const estimatedFlow_kg_s = Math.max(
    equipmentConnections.reduce((sum, connection) => sum + Math.max(0, connection.flowRate_kg_s), 0),
    rootedBranches
      .filter((branch) => branch.role === "supply")
      .reduce((sum, branch) => sum + Math.max(0, branch.flowRate_kg_s), 0)
  );
  const danglingNodeIds = nodes
    .filter((node) => node.connectedSegmentIds.length <= 1 && node.connectedEquipmentIds.length === 0 && node.type !== "source")
    .map((node) => node.id);
  const roomIds = unique(rootedBranches.flatMap((branch) => branch.servedRoomIds));
  const rootBranchIds = rootedBranches.filter((branch) => !branch.parentBranchId).map((branch) => branch.id);
  const issues: HeatingIntegrityIssue[] = [
    ...branchIssues,
    ...danglingNodeIds.map((nodeId) => ({
      severity: "warning" as const,
      code: "dangling_node" as const,
      message: `В контуре ${systemName} есть висячий узел без продолжения сети.`,
      systemId,
      nodeId,
    })),
    ...pipes
      .filter(
        (pipe) =>
          !Number.isFinite(pipe.diameter_mm) ||
          pipe.diameter_mm <= 0 ||
          !Number.isFinite(pipe.flowRate_kg_s) ||
          pipe.flowRate_kg_s < 0 ||
          !Number.isFinite(pipe.fluidTemperatureC)
      )
      .map((pipe) => ({
        severity: "error" as const,
        code: "missing_parameters" as const,
        message: `Участок ${pipe.id} содержит неполные или недопустимые инженерные параметры.`,
        systemId,
        pipeId: pipe.id,
        branchId: pipe.id,
      })),
  ];

  return {
    id: systemId,
    name: systemName,
    levelIds: unique(pipes.map((pipe) => pipe.levelId)),
    systemType: pipes.find((pipe) => pipe.heatingSystemKind)?.heatingSystemKind ?? "two_pipe",
    heatCarrier: pipes.find((pipe) => pipe.heatCarrier)?.heatCarrier ?? "water",
    supplyTemperatureC,
    returnTemperatureC,
    designIndoorTemperatureC,
    designOutdoorTemperatureC,
    deltaT_C,
    nodes,
    segments,
    branches: rootedBranches,
    equipmentConnections,
    roomIds,
    sourceEquipmentIds,
    rootBranchIds,
    totalLength_m,
    totalHeatLossW,
    totalLoadW,
    estimatedFlow_kg_s,
    danglingNodeIds,
    hasSupply,
    hasReturn,
    connected: hasSupply && hasReturn && sourceEquipmentIds.length > 0 && danglingNodeIds.length === 0,
    issues,
  };
}

function ensureNode(nodesByKey: Map<string, MutableNode>, levelId: string, point: Vec2): MutableNode {
  const key = pointKey(levelId, point);
  const existing = nodesByKey.get(key);
  if (existing) {
    return existing;
  }
  const node: MutableNode = {
    id: `node:${key}`,
    levelId,
    point: { ...point },
    segmentIds: new Set(),
    branchIds: new Set(),
    equipmentIds: new Set(),
  };
  nodesByKey.set(key, node);
  return node;
}

function cloneBranch(branch: HeatingBranch): HeatingBranch {
  return {
    ...branch,
    segmentIds: [...branch.segmentIds],
    servedRoomIds: [...branch.servedRoomIds],
    terminalEquipmentIds: [...branch.terminalEquipmentIds],
    childBranchIds: [...branch.childBranchIds],
  };
}

function finalizeNode(systemId: string, node: MutableNode, equipment: Equipment[]): HeatingNode {
  const connectedEquipmentIds = [...node.equipmentIds];
  const connectedEquipment = connectedEquipmentIds
    .map((equipmentId) => equipment.find((item) => item.id === equipmentId))
    .filter((item): item is Equipment => Boolean(item));
  const type: NodeType =
    connectedEquipment.some((item) => HEATING_SOURCE_TYPES.has(item.type))
      ? "source"
      : connectedEquipment.length
        ? "equipment"
        : node.segmentIds.size > 2
          ? "junction"
          : node.segmentIds.size <= 1
            ? "terminal"
            : "inline";

  return {
    id: node.id,
    systemId,
    levelId: node.levelId,
    point: { ...node.point },
    type,
    connectedSegmentIds: [...node.segmentIds],
    connectedBranchIds: [...node.branchIds],
    connectedEquipmentIds,
  };
}

function findNearestPathNodeKey(levelId: string, path: Vec2[], point: Vec2): { key: string; point: Vec2 } | null {
  if (!path.length) {
    return null;
  }
  let nearest: { key: string; point: Vec2; distance: number } | null = null;
  for (const pathPoint of path) {
    const distance = Math.hypot(pathPoint.x - point.x, pathPoint.y - point.y);
    if (!nearest || distance < nearest.distance) {
      nearest = {
        key: pointKey(levelId, pathPoint),
        point: pathPoint,
        distance,
      };
    }
  }
  if (!nearest) {
    return null;
  }
  return { key: nearest.key, point: nearest.point };
}

function resolveHeatingEquipment(equipmentItems: Equipment[]): Equipment[] {
  return equipmentItems.filter(
    (equipment) => HEATING_SOURCE_TYPES.has(equipment.type) || HEATING_CONSUMER_TYPES.has(equipment.type)
  );
}

function estimatePipeHeatLoss(pipe: PipeNetwork, length_m: number): number {
  if (typeof pipe.heatLossW === "number" && Number.isFinite(pipe.heatLossW) && pipe.heatLossW > 0) {
    return pipe.heatLossW;
  }
  const delta = Math.max(0, pipe.fluidTemperatureC - (pipe.designIndoorTemperatureC ?? 21));
  const diameterFactor = Math.max(0.018, pipe.diameter_mm / 1000);
  const insulationThickness = Math.max(0.004, (pipe.insulationThickness_mm ?? 12) / 1000);
  const conductivity = Math.max(0.02, pipe.insulationConductivity_W_mK ?? 0.04);
  const resistance = insulationThickness / conductivity;
  return length_m * delta * diameterFactor * (1 / Math.max(0.08, resistance)) * 0.38;
}

function estimatePipePressureDrop(pipe: PipeNetwork, length_m: number): number {
  if (typeof pipe.pressureDropPa === "number" && Number.isFinite(pipe.pressureDropPa) && pipe.pressureDropPa > 0) {
    return pipe.pressureDropPa;
  }
  const diameterM = Math.max(0.01, (pipe.innerDiameter_mm ?? pipe.diameter_mm) / 1000);
  const roughness = Math.max(0.01, (pipe.roughness_mm ?? 0.1) / 1000);
  const flow = Math.max(0.001, pipe.flowRate_kg_s);
  const hydraulicFactor = (flow * flow) / Math.pow(diameterM, 5);
  return length_m * hydraulicFactor * (1 + roughness * 1200) * 160;
}

function estimatePipeVelocity(pipe: PipeNetwork): number {
  const diameterM = Math.max(0.01, (pipe.innerDiameter_mm ?? pipe.diameter_mm) / 1000);
  const area = Math.PI * diameterM * diameterM * 0.25;
  const density = pipe.heatCarrier === "glycol" ? 1030 : 998;
  const volumetricFlow = Math.max(0, pipe.flowRate_kg_s) / density;
  return area > 0 ? volumetricFlow / area : 0;
}

function pointKey(levelId: string, point: Vec2): string {
  return `${levelId}:${Math.round(point.x / NODE_SNAP_TOLERANCE_M)}:${Math.round(point.y / NODE_SNAP_TOLERANCE_M)}`;
}

function link(adjacency: Map<string, Set<string>>, left: string, right: string): void {
  if (left === right) {
    return;
  }
  if (!adjacency.has(left)) {
    adjacency.set(left, new Set());
  }
  if (!adjacency.has(right)) {
    adjacency.set(right, new Set());
  }
  adjacency.get(left)?.add(right);
  adjacency.get(right)?.add(left);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function collectDuplicatePipeIds(pipes: PipeNetwork[]): string[] {
  const signatureToIds = new Map<string, string[]>();
  pipes.forEach((pipe) => {
    const signature = pipeSignature(pipe);
    const next = signatureToIds.get(signature) ?? [];
    next.push(pipe.id);
    signatureToIds.set(signature, next);
  });

  return [...signatureToIds.values()]
    .filter((ids) => ids.length > 1)
    .flat();
}

function pipeSignature(pipe: PipeNetwork): string {
  const forward = pipe.path.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`).join("|");
  const reverse = [...pipe.path]
    .reverse()
    .map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`)
    .join("|");
  const normalizedPath = forward < reverse ? forward : reverse;

  return [
    pipe.levelId,
    pipe.heatingSystemId ?? "",
    pipe.flowRole ?? resolvePipeFlowRole(pipe.type) ?? "distribution",
    normalizedPath,
  ].join("::");
}

function dedupeIssues(issues: HeatingIntegrityIssue[]): HeatingIntegrityIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [
      issue.code,
      issue.systemId,
      issue.pipeId ?? "",
      issue.branchId ?? "",
      issue.equipmentId ?? "",
      issue.nodeId ?? "",
    ].join("::");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function average(values: number[], fallback: number): number {
  if (!values.length) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function highestNumber(values: number[], fallback: number): number {
  if (!values.length) {
    return fallback;
  }
  return Math.max(...values);
}
