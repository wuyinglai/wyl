// C1：Demo 中型地图底座系统函数
// 提供节点/路线解锁查询、解锁、状态管理等纯函数
// 不接入正式 UI，仅为后续阶段提供数据底座

import {
  DEMO_WORLD_NODES,
  DEMO_ROUTE_SEGMENTS,
  getDemoWorldNodeById,
  getDemoWorldRouteById,
  getDemoWorldNodes,
  getDemoWorldRoutes,
  DemoWorldNode,
  DemoRouteSegment,
  DemoWorldNodeStatus,
} from "../data/demoWorldMap";

export interface DemoWorldMapState {
  currentDemoWorldNodeId: string;
  unlockedDemoWorldNodeIds: string[];
  unlockedDemoWorldRouteIds: string[];
  knownDemoWorldRumorIds: string[];
}

/**
 * 创建初始 Demo 地图状态：
 * - 当前节点：greybridge（灰桥镇）
 * - 已解锁节点：[greybridge]
 * - 已解锁路线：[greybridge_to_first_outpost]
 * - 已知传闻：[]
 */
export function createInitialDemoWorldMapState(): DemoWorldMapState {
  return {
    currentDemoWorldNodeId: "greybridge",
    unlockedDemoWorldNodeIds: ["greybridge"],
    unlockedDemoWorldRouteIds: ["greybridge_to_first_outpost"],
    knownDemoWorldRumorIds: [],
  };
}

// ==================== 节点查询 ====================

export function getAllDemoWorldNodes(): DemoWorldNode[] {
  return getDemoWorldNodes();
}

export function getDemoWorldNode(nodeId: string): DemoWorldNode | undefined {
  return getDemoWorldNodeById(nodeId);
}

/**
 * 检查节点是否已解锁
 */
export function isDemoWorldNodeUnlocked(
  state: DemoWorldMapState,
  nodeId: string,
): boolean {
  return state.unlockedDemoWorldNodeIds.includes(nodeId);
}

/**
 * 列出所有已解锁的节点（按数据中的顺序返回）
 */
export function getUnlockedDemoWorldNodes(
  state: DemoWorldMapState,
): DemoWorldNode[] {
  return getAllDemoWorldNodes().filter((n) =>
    state.unlockedDemoWorldNodeIds.includes(n.id),
  );
}

// ==================== 路线段查询 ====================

export function getAllDemoWorldRoutes(): DemoRouteSegment[] {
  return getDemoWorldRoutes();
}

export function getDemoWorldRoute(routeId: string): DemoRouteSegment | undefined {
  return getDemoWorldRouteById(routeId);
}

/**
 * 检查路线段是否已解锁
 */
export function isDemoWorldRouteUnlocked(
  state: DemoWorldMapState,
  routeId: string,
): boolean {
  return state.unlockedDemoWorldRouteIds.includes(routeId);
}

/**
 * 列出所有已解锁的路线段
 */
export function getUnlockedDemoWorldRoutes(
  state: DemoWorldMapState,
): DemoRouteSegment[] {
  return getAllDemoWorldRoutes().filter((r) =>
    state.unlockedDemoWorldRouteIds.includes(r.id),
  );
}

// ==================== 解锁操作 ====================

/**
 * 解锁一个节点（防重）
 * 返回新的 state（纯函数风格）
 */
export function unlockDemoWorldNode(
  state: DemoWorldMapState,
  nodeId: string,
): DemoWorldMapState {
  if (state.unlockedDemoWorldNodeIds.includes(nodeId)) {
    return state;
  }
  return {
    ...state,
    unlockedDemoWorldNodeIds: [...state.unlockedDemoWorldNodeIds, nodeId],
  };
}

/**
 * 解锁一个路线段（防重）
 * 返回新的 state
 */
export function unlockDemoWorldRoute(
  state: DemoWorldMapState,
  routeId: string,
): DemoWorldMapState {
  if (state.unlockedDemoWorldRouteIds.includes(routeId)) {
    return state;
  }
  return {
    ...state,
    unlockedDemoWorldRouteIds: [...state.unlockedDemoWorldRouteIds, routeId],
  };
}

/**
 * 切换当前所在节点
 */
export function setCurrentDemoWorldNode(
  state: DemoWorldMapState,
  nodeId: string,
): DemoWorldMapState {
  return {
    ...state,
    currentDemoWorldNodeId: nodeId,
  };
}

/**
 * 添加一条已知传闻
 */
export function addKnownDemoWorldRumor(
  state: DemoWorldMapState,
  rumorNodeId: string,
): DemoWorldMapState {
  if (state.knownDemoWorldRumorIds.includes(rumorNodeId)) {
    return state;
  }
  return {
    ...state,
    knownDemoWorldRumorIds: [...state.knownDemoWorldRumorIds, rumorNodeId],
  };
}

// ==================== 初始默认状态辅助 ====================

/**
 * 获取节点在初始状态下的显示状态（用于外部系统判断是否展示该节点）
 * unlocked: 可见且可交互
 * locked: 可见但不可交互（例如显示「未开放」）
 * hidden: 完全不可见
 */
export function getNodeInitialStatus(nodeId: string): DemoWorldNodeStatus | null {
  const node = getDemoWorldNodeById(nodeId);
  return node ? node.initialStatus : null;
}

/**
 * 获取路线段在初始状态下的显示状态
 */
export function getRouteInitialStatus(routeId: string): DemoWorldNodeStatus | null {
  const route = getDemoWorldRouteById(routeId);
  return route ? route.initialStatus : null;
}
