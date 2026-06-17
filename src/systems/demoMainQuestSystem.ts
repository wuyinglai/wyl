// C2：Demo 主线系统 - 纯函数
// 提供主线状态查询、阶段推进、余烬核心状态修改等工具

import {
  EmberCoreStatus,
  DemoMainQuestStage,
  DEMO_MAIN_QUEST_ORDER,
  DEMO_MAIN_QUEST_OBJECTIVE_TEXT,
  DEMO_MAIN_QUEST_TITLE_TEXT,
  DemoMainQuestOrder,
} from "../data/demoMainQuest";

export interface DemoMainQuestState {
  emberCoreStatus: EmberCoreStatus;
  demoMainQuestStage: DemoMainQuestStage;
  activeMainQuestOrderId: string;
  completedMainQuestOrderIds: string[];
}

/**
 * 创建初始 Demo 主线状态：
 * - 玩家开局已带着余烬核心
 * - 当前目标是先到第一个驿站（N3.1 教学）
 */
export function createInitialDemoMainQuestState(): DemoMainQuestState {
  return {
    emberCoreStatus: "carried_by_caravan",
    demoMainQuestStage: "go_to_first_outpost",
    activeMainQuestOrderId: "main_deliver_ember_core_to_daan",
    completedMainQuestOrderIds: [],
  };
}

// ==================== 查询函数 ====================

export function getCurrentDemoMainQuestStage(
  state: DemoMainQuestState,
): DemoMainQuestStage {
  return state.demoMainQuestStage;
}

export function getCurrentEmberCoreStatus(
  state: DemoMainQuestState,
): EmberCoreStatus {
  return state.emberCoreStatus;
}

/**
 * 获取当前主线目标的文本描述（用于 UI 提示）
 */
export function getCurrentMainQuestObjective(state: DemoMainQuestState): string {
  return DEMO_MAIN_QUEST_OBJECTIVE_TEXT[state.demoMainQuestStage] ?? "";
}

/**
 * 获取当前主线的标题文本
 */
export function getCurrentMainQuestTitle(state: DemoMainQuestState): string {
  return DEMO_MAIN_QUEST_TITLE_TEXT[state.demoMainQuestStage] ?? "";
}

/**
 * 获取当前激活的主线订单数据
 */
export function getCurrentMainQuestOrder(): DemoMainQuestOrder {
  return DEMO_MAIN_QUEST_ORDER;
}

/**
 * 当前玩家是否正在携带余烬核心
 */
export function isEmberCoreCarried(state: DemoMainQuestState): boolean {
  return (
    state.emberCoreStatus === "carried_by_caravan" ||
    // 如果已经送达大安，就不再"携带"，而是"已交付"
    // 如果还在 discovered_at_greybridge，也不算携带
    false
  );
}

/**
 * 指定节点是否为当前主线阶段的目标节点
 * - 当前步骤目标（currentStepTargetNodeId）返回 true
 * - 最终目标（targetNodeId）也返回 true（用于 UI 最终目的地提示）
 */
export function isMainQuestTargetNode(
  state: DemoMainQuestState,
  nodeId: string,
): boolean {
  const order = DEMO_MAIN_QUEST_ORDER;
  return (
    nodeId === order.currentStepTargetNodeId || nodeId === order.targetNodeId
  );
}

/**
 * 指定节点是否为当前步骤的直接目标
 */
export function isCurrentStepTargetNode(
  state: DemoMainQuestState,
  nodeId: string,
): boolean {
  const order = DEMO_MAIN_QUEST_ORDER;
  return nodeId === order.currentStepTargetNodeId;
}

/**
 * 指定节点是否为订单的最终目标城市
 */
export function isFinalTargetNode(
  state: DemoMainQuestState,
  nodeId: string,
): boolean {
  const order = DEMO_MAIN_QUEST_ORDER;
  return nodeId === order.targetNodeId;
}

// ==================== 修改函数（纯函数，返回新 state） ====================

/**
 * 推进主线阶段到下一阶段
 */
export function advanceDemoMainQuestStage(
  state: DemoMainQuestState,
  nextStage: DemoMainQuestStage,
): DemoMainQuestState {
  return {
    ...state,
    demoMainQuestStage: nextStage,
  };
}

/**
 * 修改余烬核心的状态
 */
export function setEmberCoreStatus(
  state: DemoMainQuestState,
  nextStatus: EmberCoreStatus,
): DemoMainQuestState {
  return {
    ...state,
    emberCoreStatus: nextStatus,
  };
}

/**
 * 将当前订单标记为已完成（例如抵达大安时调用）
 */
export function markActiveMainQuestCompleted(
  state: DemoMainQuestState,
): DemoMainQuestState {
  const id = state.activeMainQuestOrderId;
  if (state.completedMainQuestOrderIds.includes(id)) {
    return state;
  }
  return {
    ...state,
    completedMainQuestOrderIds: [...state.completedMainQuestOrderIds, id],
  };
}

// ==================== 辅助：按阶段组合的便利函数 ====================

/**
 * 抵达第一个驿站时的推荐推进
 * stage: go_to_first_outpost → go_to_daan
 */
export function advanceOnFirstOutpost(
  state: DemoMainQuestState,
): DemoMainQuestState {
  return advanceDemoMainQuestStage(state, "go_to_daan");
}

/**
 * 抵达大安并点亮城市
 */
export function advanceOnDaanActivated(
  state: DemoMainQuestState,
): DemoMainQuestState {
  let s = advanceDemoMainQuestStage(state, "daan_activated");
  s = setEmberCoreStatus(s, "delivered_to_daan");
  s = markActiveMainQuestCompleted(s);
  return s;
}

/**
 * 发现第二城线索
 */
export function advanceOnSecondCityHint(
  state: DemoMainQuestState,
): DemoMainQuestState {
  return advanceDemoMainQuestStage(state, "second_city_hint_found");
}

/**
 * 点亮第二城
 */
export function advanceOnSecondCityActivated(
  state: DemoMainQuestState,
): DemoMainQuestState {
  let s = advanceDemoMainQuestStage(state, "second_city_activated");
  s = setEmberCoreStatus(s, "network_activation_started");
  return s;
}
