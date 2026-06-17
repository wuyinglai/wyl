// C3a.1：N3.1 固定教学路线 — 20 天固定旅程
// 节点类型包含 start / peaceful_day / small_event / resource_event / normal_battle / special_battle / optional_elite / destination
// 平静日是固定节点，不是随机事件；不要新增 quietTravelChance / shouldAllowQuietTravel
// 每个节点 timeCostDays = 1，consumesSupply = true，advancesOrderDeadline = true

export type TutorialRouteNodeType =
  | "start"
  | "peaceful_day"
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
  day: number;
  type: TutorialRouteNodeType;
  required: boolean;
  description: string;
  teachingGoal: string;
  timeCostDays: number;
  consumesSupply: boolean;
  advancesOrderDeadline: boolean;
  nextNodeIds: string[];
}

// N3.1 标准路线固定天数（20 天）
export const N31_TUTORIAL_ROUTE_ID = "n31_greybridge_to_first_outpost";
export const N31_STANDARD_ROUTE_DAYS = 20;

export const N31_TUTORIAL_ROUTE_NODES: TutorialRouteNode[] = [
  {
    id: "depart_greybridge",
    title: "出城",
    order: 1,
    day: 1,
    type: "start",
    required: true,
    description: "商队从灰桥镇出发，正式踏上远行之路。",
    teachingGoal: "让玩家了解路线起点与远征开始。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["quiet_old_road_outside_town"],
  },
  {
    id: "quiet_old_road_outside_town",
    title: "镇外旧路",
    order: 2,
    day: 2,
    type: "peaceful_day",
    required: true,
    description:
      "商队离开灰桥镇后，旧路逐渐被灰土覆盖。这一天没有遇到麻烦，只是补给少了一些。",
    teachingGoal:
      "平静日：没有战斗、没有事件、没有奖励，但仍会消耗补给和推进订单时间。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["broken_road"],
  },
  {
    id: "broken_road",
    title: "断裂路面",
    order: 3,
    day: 3,
    type: "small_event",
    required: true,
    description:
      "路面因年久失修而开裂，车辆需要小心通过，或者绕行，或者强行。",
    teachingGoal:
      "教玩家：不同选择会影响货车耐久、零件、补给，后续接入真实结算。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["quiet_ash_slope"],
  },
  {
    id: "quiet_ash_slope",
    title: "灰土长坡",
    order: 4,
    day: 4,
    type: "peaceful_day",
    required: true,
    description:
      "风从破裂的路标间穿过。车轮压过旧辙，商队安静地前进了一天。",
    teachingGoal:
      "平静日：长途行进中并不是每段路都有事件，但仍要消耗补给。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["young_ash_beast_battle"],
  },
  {
    id: "young_ash_beast_battle",
    title: "灰烬幼兽战",
    order: 5,
    day: 5,
    type: "normal_battle",
    required: true,
    description: "几只灰烬幼兽从路边跳出，第一次正经战斗出现在眼前。",
    teachingGoal: "第一次普通战斗：教玩家基础出牌 / 防御 / 护盾。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["quiet_low_wind_road"],
  },
  {
    id: "quiet_low_wind_road",
    title: "低风旧道",
    order: 6,
    day: 6,
    type: "peaceful_day",
    required: true,
    description: "灰风很轻，荒野少见地安静。没人说话，只有货车木架在响。",
    teachingGoal:
      "平静日：给玩家喘息时间，但补给仍然在消耗，订单期限也在推进。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["cracked_back_ash_beast_battle"],
  },
  {
    id: "cracked_back_ash_beast_battle",
    title: "裂背灰烬兽战",
    order: 7,
    day: 7,
    type: "normal_battle",
    required: true,
    description: "一只带着厚甲的灰烬兽从侧面扑来，可能会撞上货车。",
    teachingGoal: "教玩家：敌人可能伤及货车；需要考虑破甲与防御优先级。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["injured_traveler"],
  },
  {
    id: "injured_traveler",
    title: "受伤旅人",
    order: 8,
    day: 8,
    type: "small_event",
    required: true,
    description: "路边躺着一个受伤的旅人，商队可以选择救助、给钱或继续。",
    teachingGoal: "教玩家：补给 / 金钱 / 士气 之间的取舍。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["caravan_wreck"],
  },
  {
    id: "caravan_wreck",
    title: "商队残骸",
    order: 9,
    day: 9,
    type: "resource_event",
    required: true,
    description:
      "一处被烧毁的商队残骸，可搜刮一些补给或零件，并发现劫匪与灰烬兽的痕迹。",
    teachingGoal:
      "资源事件：获得少量资源；同时埋线索，为后续劫匪抢货战和灰蚀战铺垫。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["quiet_grey_fog_gap"],
  },
  {
    id: "quiet_grey_fog_gap",
    title: "灰雾间隙",
    order: 10,
    day: 10,
    type: "peaceful_day",
    required: true,
    description: "灰雾散开了一阵，前方的路勉强能看清。今天适合赶路。",
    teachingGoal:
      "平静日：让玩家在两场战斗/事件之间有一个相对轻松的日程。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["bandit_cargo_raid"],
  },
  {
    id: "bandit_cargo_raid",
    title: "劫匪抢货战",
    order: 11,
    day: 11,
    type: "special_battle",
    required: true,
    description:
      "几名劫匪冲向货车，他们的目标不是杀死玩家，而是抢走货物。",
    teachingGoal:
      "特殊战：教玩家保护货物的战斗，而不只是杀敌；含 protect_cargo 目标。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["quiet_silent_wasteland_road"],
  },
  {
    id: "quiet_silent_wasteland_road",
    title: "荒路沉默",
    order: 12,
    day: 12,
    type: "peaceful_day",
    required: true,
    description: "没有兽群，没有劫匪，也没有新的残骸。只是路还在往前延伸。",
    teachingGoal:
      "平静日：把劫匪抢货战和混合灰烬兽战隔开，避免战斗堆叠。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["mixed_ash_beast_battle"],
  },
  {
    id: "mixed_ash_beast_battle",
    title: "混合灰烬兽战",
    order: 13,
    day: 13,
    type: "normal_battle",
    required: true,
    description: "一只灰烬幼兽与一只裂背灰烬兽同时出现，需要选择优先目标。",
    teachingGoal:
      "综合普通战：同时处理多个敌人；复习护车、流血、破甲的优先级。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["abandoned_toolbox"],
  },
  {
    id: "abandoned_toolbox",
    title: "遗弃工具箱",
    order: 14,
    day: 14,
    type: "resource_event",
    required: true,
    description:
      "路旁一个被遗忘的工具箱，可获得零件或记录。",
    teachingGoal:
      "资源事件：为后续战斗/货车维修兜底；暂不新增 parts:number，只用 flag 记录。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["quiet_old_road_ash_line"],
  },
  {
    id: "quiet_old_road_ash_line",
    title: "旧路灰线",
    order: 15,
    day: 15,
    type: "peaceful_day",
    required: true,
    description:
      "路边的灰烬变厚了，修补师提醒众人检查车轴。今天没有意外。",
    teachingGoal:
      "平静日：在双灰烬腐蚀兽战之前给玩家喘息；暗示前方的危险。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["double_corroded_ash_beast_battle"],
  },
  {
    id: "double_corroded_ash_beast_battle",
    title: "双灰烬腐蚀兽战",
    order: 16,
    day: 16,
    type: "normal_battle",
    required: true,
    description:
      "两只灰烬腐蚀兽扑来，灰雾让空气变得浑浊；它们的攻击会留下灰蚀。",
    teachingGoal:
      "到站前压力战：教玩家灰蚀的存在与净化的重要性（后续接入 BattleScene）。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["quiet_outpost_far_light"],
  },
  {
    id: "quiet_outpost_far_light",
    title: "驿站远光",
    order: 17,
    day: 17,
    type: "peaceful_day",
    required: true,
    description:
      "远处似乎有一点灯光，但还隔着很长一段路。至少今天没有新的麻烦。",
    teachingGoal:
      "平静日：在最后一段路上给玩家心理缓冲，为驿站灯火和可选精英战做节奏铺垫。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["outpost_lights"],
  },
  {
    id: "outpost_lights",
    title: "驿站灯火",
    order: 18,
    day: 18,
    type: "small_event",
    required: true,
    description:
      "前方能看到驿站的灯火，商队士气稍有提升。附近似乎还有一处灰烬母巢的踪迹。",
    teachingGoal:
      "到站前正反馈；同时提示灰烬母巢可选精英战的存在。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["ash_nest_elite"],
  },
  {
    id: "ash_nest_elite",
    title: "灰烬母巢",
    order: 19,
    day: 19,
    type: "optional_elite",
    required: false,
    description:
      "一处不断涌出灰烬兽的母巢。可以绕开，也可以挑战，但会有风险和奖励。",
    teachingGoal:
      "可选精英战：奖励丰厚但风险高；玩家可以选择跳过。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: ["arrive_first_outpost"],
  },
  {
    id: "arrive_first_outpost",
    title: "到达第一个驿站",
    order: 20,
    day: 20,
    type: "destination",
    required: true,
    description:
      "商队终于抵达第一个驿站的外墙下。N3.1 教学路线就此结束。",
    teachingGoal: "路线终点。到达后完成整条 N3.1 教学路线。",
    timeCostDays: 1,
    consumesSupply: true,
    advancesOrderDeadline: true,
    nextNodeIds: [],
  },
];

// ========== 查询函数 ==========

export function getN31TutorialRouteNodes(): TutorialRouteNode[] {
  return [...N31_TUTORIAL_ROUTE_NODES];
}

export function getN31TutorialRouteNodeById(
  nodeId: string,
): TutorialRouteNode | undefined {
  return N31_TUTORIAL_ROUTE_NODES.find((n) => n.id === nodeId);
}

export function getFirstN31TutorialRouteNode(): TutorialRouteNode {
  return N31_TUTORIAL_ROUTE_NODES[0];
}

export function getLastN31TutorialRouteNode(): TutorialRouteNode {
  return N31_TUTORIAL_ROUTE_NODES[N31_TUTORIAL_ROUTE_NODES.length - 1];
}

export function getN31StandardRouteDays(): number {
  return N31_STANDARD_ROUTE_DAYS;
}

export function getN31PeacefulDayNodes(): TutorialRouteNode[] {
  return N31_TUTORIAL_ROUTE_NODES.filter((n) => n.type === "peaceful_day");
}

export function isPeacefulDayNode(nodeId: string): boolean {
  const node = N31_TUTORIAL_ROUTE_NODES.find((n) => n.id === nodeId);
  return node !== undefined && node.type === "peaceful_day";
}

export function getN31RouteNodeByDay(day: number): TutorialRouteNode | undefined {
  return N31_TUTORIAL_ROUTE_NODES.find((n) => n.day === day);
}

export function getN31TotalTimeCostDays(): number {
  return N31_TUTORIAL_ROUTE_NODES.reduce(
    (sum, node) => sum + (typeof node.timeCostDays === "number" ? node.timeCostDays : 1),
    0,
  );
}
