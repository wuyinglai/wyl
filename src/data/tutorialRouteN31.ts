// C3a：N3.1 固定教学路线数据
// 灰桥镇 → 第一个驿站的 13 个固定节点

export type TutorialRouteNodeType =
  | "start"
  | "small_event"
  | "resource_event"
  | "normal_battle"
  | "special_battle"
  | "optional_elite"
  | "destination";

export interface TutorialRouteNode {
  id: string;
  title: string;
  order: number;
  type: TutorialRouteNodeType;
  required: boolean;
  description: string;
  teachingGoal: string;
  nextNodeIds: string[];
}

// N3.1 路线 ID
export const N31_TUTORIAL_ROUTE_ID = "n31_greybridge_to_first_outpost";

// N3.1 固定路线节点（按顺序，13 个）
export const N31_TUTORIAL_ROUTE_NODES: TutorialRouteNode[] = [
  {
    id: "depart_greybridge",
    title: "出城",
    order: 1,
    type: "start",
    required: true,
    description: "商队从灰桥镇出发，正式踏上远行之路。",
    teachingGoal: "让玩家了解路线起点与远征开始。",
    nextNodeIds: ["broken_road"],
  },
  {
    id: "broken_road",
    title: "断裂路面",
    order: 2,
    type: "small_event",
    required: true,
    description: "旧路面因风化出现大块塌陷，队伍需要小心通过。",
    teachingGoal: "小事件：介绍灰雾世界与团队互动。",
    nextNodeIds: ["young_ash_beast_battle"],
  },
  {
    id: "young_ash_beast_battle",
    title: "灰烬幼兽战",
    order: 3,
    type: "normal_battle",
    required: true,
    description: "一群还未长大的灰烬幼兽在前方游荡。",
    teachingGoal: "第一场普通战斗，介绍基础战斗循环。",
    nextNodeIds: ["cracked_back_ash_beast_battle"],
  },
  {
    id: "cracked_back_ash_beast_battle",
    title: "裂背灰烬兽战",
    order: 4,
    type: "normal_battle",
    required: true,
    description: "一只比幼兽更具攻击性的裂背灰烬兽在路中央发出嘶嘶声。",
    teachingGoal: "介绍普通战斗的连续作战节奏。",
    nextNodeIds: ["injured_traveler"],
  },
  {
    id: "injured_traveler",
    title: "受伤旅人",
    order: 5,
    type: "small_event",
    required: true,
    description: "路边倒着一名衣衫褴褛的旅人，他似乎还活着。",
    teachingGoal: "小事件：玩家需做出选择。",
    nextNodeIds: ["caravan_wreck"],
  },
  {
    id: "caravan_wreck",
    title: "商队残骸",
    order: 6,
    type: "resource_event",
    required: true,
    description: "路旁散落着一个废弃商队的残余，或许还有些可用的物资。",
    teachingGoal: "资源事件：获得额外货物/补给。",
    nextNodeIds: ["bandit_cargo_raid"],
  },
  {
    id: "bandit_cargo_raid",
    title: "劫匪抢货战",
    order: 7,
    type: "special_battle",
    required: true,
    description: "一群劫匪突然从路旁的阴影中出现，目标正是商队的货物。",
    teachingGoal: "特殊战斗：介绍抢货主题战斗。",
    nextNodeIds: ["mixed_ash_beast_battle"],
  },
  {
    id: "mixed_ash_beast_battle",
    title: "混合灰烬兽战",
    order: 8,
    type: "normal_battle",
    required: true,
    description: "不同种类的灰烬兽混杂在一起，形成更复杂的战场。",
    teachingGoal: "普通战斗：多敌人与配合。",
    nextNodeIds: ["abandoned_toolbox"],
  },
  {
    id: "abandoned_toolbox",
    title: "遗弃工具箱",
    order: 9,
    type: "resource_event",
    required: true,
    description: "半埋在土中的工具箱，似乎有些还未被使用过。",
    teachingGoal: "资源事件：工具系统介绍。",
    nextNodeIds: ["double_corroded_ash_beast_battle"],
  },
  {
    id: "double_corroded_ash_beast_battle",
    title: "双灰烬腐蚀兽战",
    order: 10,
    type: "normal_battle",
    required: true,
    description: "两只散发着腐蚀液的灰烬腐蚀兽从两侧包抄而来。",
    teachingGoal: "普通战斗：腐蚀液机制。",
    nextNodeIds: ["outpost_lights"],
  },
  {
    id: "outpost_lights",
    title: "驿站灯火",
    order: 11,
    type: "small_event",
    required: true,
    description: "远远望见前方出现微弱的灯光，似乎是第一个驿站。",
    teachingGoal: "小事件：提示驿站就在前方。",
    nextNodeIds: ["ash_nest_elite", "arrive_first_outpost"],
  },
  {
    id: "ash_nest_elite",
    title: "灰烬母巢",
    order: 12,
    type: "optional_elite",
    required: false,
    description: "一处不断涌出灰烬兽的母巢，从旁绕过去是危险，但或许有惊喜。",
    teachingGoal: "可选精英战：奖励丰厚但风险高。",
    nextNodeIds: ["arrive_first_outpost"],
  },
  {
    id: "arrive_first_outpost",
    title: "到达驿站",
    order: 13,
    type: "destination",
    required: true,
    description: "商队终于到达第一个驿站——第一个驿站在风中摇曳的灯火旁的驿站。",
    teachingGoal: "路线终点：到达第一个驿站。",
    nextNodeIds: [],
  },
];

// 纯函数查询工具
export function getN31TutorialRouteNodes(): TutorialRouteNode[] {
  return [...N31_TUTORIAL_ROUTE_NODES];
}

export function getN31TutorialRouteNodeById(nodeId: string): TutorialRouteNode | undefined {
  return N31_TUTORIAL_ROUTE_NODES.find((n) => n.id === nodeId);
}

export function getFirstN31TutorialRouteNode(): TutorialRouteNode {
  return N31_TUTORIAL_ROUTE_NODES[0];
}

export function getLastN31TutorialRouteNode(): TutorialRouteNode {
  return N31_TUTORIAL_ROUTE_NODES[N31_TUTORIAL_ROUTE_NODES.length - 1];
}
