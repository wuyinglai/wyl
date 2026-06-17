// C2：Demo 主线 - 余烬核心主任务数据
// 定义余烬核心状态类型、主线阶段类型、主线订单数据

/**
 * 余烬核心的状态流转：
 * discovered_at_greybridge → 灰桥镇发现核心
 * carried_by_caravan     → 商队带着核心出发
 * delivered_to_daan       → 抵达大安并点亮
 * network_activation_started → 开始激活余烬网络（第二城方向）
 */
export type EmberCoreStatus =
  | "discovered_at_greybridge"
  | "carried_by_caravan"
  | "delivered_to_daan"
  | "network_activation_started";

/**
 * Demo 主线阶段：
 * greybridge_start        → 灰桥镇开局（玩家在此出发）
 * go_to_first_outpost     → 沿旧路前往第一个驿站（N3.1 教学）
 * go_to_daan              → 从驿站前往大安（N3.2 半随机路）
 * daan_activated          → 抵达大安，点亮城市
 * daan_outskirts_open     → 大安周边开放，短途经营
 * second_city_hint_found  → 发现第二城线索
 * go_to_second_city       → 前往第二城
 * second_city_activated   → 点亮第二城，Demo 闭环
 */
export type DemoMainQuestStage =
  | "greybridge_start"
  | "go_to_first_outpost"
  | "go_to_daan"
  | "daan_activated"
  | "daan_outskirts_open"
  | "second_city_hint_found"
  | "go_to_second_city"
  | "second_city_activated";

/**
 * 主线订单数据结构（Demo 主线用，区别于普通 cityOrders）
 */
export interface DemoMainQuestOrder {
  id: string;
  title: string;
  description: string;
  originNodeId: string;
  targetNodeId: string;
  /** 当前步骤的目标节点（例如第一站先去 first_outpost） */
  currentStepTargetNodeId: string;
  isMainQuest: true;
}

// ============================================================
// 主线订单：护送余烬核心前往大安
// ============================================================

export const DEMO_MAIN_QUEST_ORDER: DemoMainQuestOrder = {
  id: "main_deliver_ember_core_to_daan",
  title: "护送余烬核心前往大安",
  description:
    "灰桥镇发现了一枚仍在发光的余烬核心。这里不是城市，无法激活。商队必须先沿旧路抵达第一个驿站补给修车，再继续前往大安，在大安点亮第一座城市。",
  originNodeId: "greybridge",
  targetNodeId: "daan",
  currentStepTargetNodeId: "first_outpost",
  isMainQuest: true,
};

/**
 * 主线目标文本表：不同阶段返回不同提示文案
 */
export const DEMO_MAIN_QUEST_OBJECTIVE_TEXT: Record<DemoMainQuestStage, string> = {
  greybridge_start: "你带着余烬核心，准备从灰桥镇出发。",
  go_to_first_outpost: "沿旧路前往第一个驿站，途中注意补给与敌人。",
  go_to_daan: "从第一个驿站出发，半随机路线前往大安。余烬核心接近城市时会有所反应。",
  daan_activated: "大安已点亮！城市开始缓慢复兴。",
  daan_outskirts_open: "大安周边开放，开始短途订单与商队经营。",
  second_city_hint_found: "在大安周边发现了关于第二座城市的传闻线索。",
  go_to_second_city: "沿中程商路，向第二座城市方向出发。",
  second_city_activated: "第二座城市也被点亮，余烬商队完成了第一阶段的使命。",
};

/**
 * 主线标题文本表（用于 UI 顶部的主线名）
 */
export const DEMO_MAIN_QUEST_TITLE_TEXT: Record<DemoMainQuestStage, string> = {
  greybridge_start: "主线：灰桥镇启程",
  go_to_first_outpost: "主线：护送余烬核心前往大安",
  go_to_daan: "主线：护送余烬核心前往大安",
  daan_activated: "主线：大安已点亮",
  daan_outskirts_open: "主线：大安周边开放",
  second_city_hint_found: "主线：第二座城市的线索",
  go_to_second_city: "主线：前往第二座城市",
  second_city_activated: "主线：第二座城市已点亮",
};
