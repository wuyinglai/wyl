// C3a.1：N3.1 固定教学路线系统函数（适配 20 天固定旅程 + 7 个平静日）
// 平静日是固定节点，不是随机事件；不要新增 quietTravelChance / shouldAllowQuietTravel
import {
  N31_TUTORIAL_ROUTE_NODES,
  N31_TUTORIAL_ROUTE_ID,
  N31_STANDARD_ROUTE_DAYS,
  getN31TutorialRouteNodeById,
  TutorialRouteNode,
} from "../data/tutorialRouteN31";

export interface TutorialRouteProgressState {
  activeTutorialRouteId: string | null;
  currentTutorialNodeId: string | null;
  completedTutorialNodeIds: string[];
  skippedOptionalTutorialNodeIds: string[];
}

/**
 * 创建初始教程路线进度状态（未开始路线）
 */
export function createInitialTutorialRouteProgressState(): TutorialRouteProgressState {
  return {
    activeTutorialRouteId: null,
    currentTutorialNodeId: null,
    completedTutorialNodeIds: [],
    skippedOptionalTutorialNodeIds: [],
  };
}

/**
 * 开始 N3.1 教学路线。
 * 将 activeTutorialRouteId = N31_TUTORIAL_ROUTE_ID
 * currentTutorialNodeId = 第一个节点 depart_greybridge
 */
export function startN31TutorialRoute(
  state: TutorialRouteProgressState,
): TutorialRouteProgressState {
  return {
    activeTutorialRouteId: N31_TUTORIAL_ROUTE_ID,
    currentTutorialNodeId: N31_TUTORIAL_ROUTE_NODES[0].id,
    completedTutorialNodeIds: [],
    skippedOptionalTutorialNodeIds: [],
  };
}

/**
 * 获取当前路线节点数据
 */
export function getCurrentTutorialRouteNode(
  state: TutorialRouteProgressState,
): TutorialRouteNode | null {
  if (!state.currentTutorialNodeId) return null;
  return getN31TutorialRouteNodeById(state.currentTutorialNodeId) ?? null;
}

/**
 * 完成一个节点（加入 completedTutorialNodeIds）
 * 防重：如果已经在 completed 列表中的不再记录
 */
export function completeTutorialNode(
  state: TutorialRouteProgressState,
  nodeId: string,
): TutorialRouteProgressState {
  if (state.completedTutorialNodeIds.includes(nodeId)) {
    return state;
  }
  return {
    ...state,
    completedTutorialNodeIds: [...state.completedTutorialNodeIds, nodeId],
  };
}

/**
 * 跳过一个可选精英节点
 * 只能跳过 optional_elite 类型的节点
 */
export function skipOptionalTutorialNode(
  state: TutorialRouteProgressState,
  nodeId: string,
): TutorialRouteProgressState {
  const node = getN31TutorialRouteNodeById(nodeId);
  if (!node) return state;
  if (node.required) return state; // 必经节点不可跳过
  if (node.type !== "optional_elite") return state; // 只有可选精英可跳过
  if (state.skippedOptionalTutorialNodeIds.includes(nodeId)) return state;
  return {
    ...state,
    skippedOptionalTutorialNodeIds: [...state.skippedOptionalTutorialNodeIds, nodeId],
  };
}

/**
 * 推进到下一个节点：
 * 若当前节点是小事件/普通战/资源事件/特殊战/start/destination/optional_elite 已经完成，则从当前节点的 nextNodeIds 中选择第一个尚未处理的下一个节点
 */
export function advanceToNextTutorialNode(
  state: TutorialRouteProgressState,
): TutorialRouteProgressState {
  const current = getCurrentTutorialRouteNode(state);
  if (!current) return state;

  // 如果当前节点还未完成，不推进（除非当前节点是 destination 并且已完成）
  const currentCompleted = state.completedTutorialNodeIds.includes(current.id) ||
    state.skippedOptionalTutorialNodeIds.includes(current.id);
  if (!currentCompleted && current.type !== "destination") {
    return state;
  }

  // 选择下一个节点：
  // 优先从当前节点的 nextNodeIds 中选择第一个尚未完成/跳过的节点
  for (const nextId of current.nextNodeIds) {
    const next = getN31TutorialRouteNodeById(nextId);
    if (!next) continue;
    if (
      !state.completedTutorialNodeIds.includes(nextId) &&
      !state.skippedOptionalTutorialNodeIds.includes(nextId)
    ) {
      return { ...state, currentTutorialNodeId: nextId };
    }
  }
  // 所有下一节点全部已经完成/跳过
  return state;
}

/**
 * 检查节点是否已完成
 */
export function isTutorialNodeCompleted(
  state: TutorialRouteProgressState,
  nodeId: string,
): boolean {
  return state.completedTutorialNodeIds.includes(nodeId) ||
    state.skippedOptionalTutorialNodeIds.includes(nodeId);
}

/**
 * 检查教学路线是否已经完成：
 * - activeTutorialRouteId 不为 null
 * - arrive_first_outpost 在 completedTutorialNodeIds 中
 */
export function isTutorialRouteCompleted(
  state: TutorialRouteProgressState,
): boolean {
  if (!state.activeTutorialRouteId) return false;
  return state.completedTutorialNodeIds.includes("arrive_first_outpost");
}

/**
 * 获取当前可用的下一批可访问节点列表（从当前节点的 nextNodeIds 中过滤已完成的）
 */
export function getAvailableNextTutorialNodes(
  state: TutorialRouteProgressState,
): TutorialRouteNode[] {
  const current = getCurrentTutorialRouteNode(state);
  if (!current) return [];
  const result: TutorialRouteNode[] = [];
  for (const id of current.nextNodeIds) {
    const node = getN31TutorialRouteNodeById(id);
    if (!node) continue;
    if (
      !state.completedTutorialNodeIds.includes(id) &&
      !state.skippedOptionalTutorialNodeIds.includes(id)
    ) {
      result.push(node);
    }
  }
  return result;
}

// ========== 新增的日期/平静日查询函数（C3a.1） ==========

/**
 * 返回 N3.1 标准路线的固定天数（20 天）
 */
export function getN31StandardRouteDays(): number {
  return N31_STANDARD_ROUTE_DAYS;
}

/**
 * 返回 N3.1 所有平静日节点（peaceful_day）
 */
export function getN31PeacefulDayNodes(): TutorialRouteNode[] {
  return N31_TUTORIAL_ROUTE_NODES.filter((n) => n.type === "peaceful_day");
}

/**
 * 判断给定 nodeId 是否是平静日节点
 */
export function isPeacefulDayNode(nodeId: string): boolean {
  const node = N31_TUTORIAL_ROUTE_NODES.find((n) => n.id === nodeId);
  return node !== undefined && node.type === "peaceful_day";
}

/**
 * 根据天数获取对应的路线节点（day 范围 1..20）
 */
export function getN31RouteNodeByDay(
  day: number,
): TutorialRouteNode | undefined {
  return N31_TUTORIAL_ROUTE_NODES.find((n) => n.day === day);
}

/**
 * 返回整条 N3.1 路线的总时间成本（每个节点 timeCostDays 之和）
 */
export function getN31TotalTimeCostDays(): number {
  return N31_TUTORIAL_ROUTE_NODES.reduce(
    (sum, node) => sum + (typeof node.timeCostDays === "number" ? node.timeCostDays : 1),
    0,
  );
}
