// C3b：N3.1 教学事件数据
// 只做 5 个非战斗节点：断裂路面 / 受伤旅人 / 商队残骸 / 遗弃工具箱 / 驿站灯火
// 零件相关效果暂时用 tutorialEventFlags 记录，不新增 parts:number 字段

export type TutorialEventType = "small_event" | "resource_event";

export type TutorialEventEffectType =
  | "food"
  | "silver"
  | "morale"
  | "vehicle_hp"
  | "flag"
  | "hint";

export interface TutorialEventEffect {
  type: TutorialEventEffectType;
  value?: number;
  flagId?: string;
  text?: string;
}

export interface TutorialEventChoice {
  id: string;
  label: string;
  description: string;
  effects: TutorialEventEffect[];
}

export interface TutorialEvent {
  id: string;
  nodeId: string;
  title: string;
  type: TutorialEventType;
  description: string;
  choices: TutorialEventChoice[];
}

// N3.1 教学事件（5 个）
export const N31_TUTORIAL_EVENTS: TutorialEvent[] = [
  {
    id: "evt_broken_road",
    nodeId: "broken_road",
    title: "断裂路面",
    type: "small_event",
    description:
      "旧路面因风化出现大块塌陷，队伍必须选择如何通过。这是第一段旅程的第一次压力测试。",
    choices: [
      {
        id: "careful_detour",
        label: "小心绕行",
        description: "绕开最危险的区域，但要多走一些路。",
        effects: [
          { type: "food", value: -1 },
          { type: "flag", flagId: "safe_detour_broken_road" },
          { type: "hint", text: "多走一些路会消耗补给，但避免了货车损伤。" },
        ],
      },
      {
        id: "reinforce_with_spare",
        label: "用零件加固通过",
        description: "把临时零件垫在车轮下方，安全通过但消耗一个临时零件。",
        effects: [
          { type: "flag", flagId: "used_spare_part_to_cross_broken_road" },
          { type: "hint", text: "消耗了一个临时零件来避免货车损伤。" },
        ],
      },
      {
        id: "force_through",
        label: "强行通过",
        description: "直接开过去，快但危险。",
        effects: [
          { type: "vehicle_hp", value: -5 },
          { type: "flag", flagId: "forced_through_broken_road" },
        ],
      },
    ],
  },
  {
    id: "evt_injured_traveler",
    nodeId: "injured_traveler",
    title: "受伤旅人",
    type: "small_event",
    description:
      "路边倒着一名衣衫褴褛的旅人，他似乎还活着。队伍必须决定如何对待他。",
    choices: [
      {
        id: "share_supplies",
        label: "分出补给救助",
        description: "给他一些食物和水。",
        effects: [
          { type: "food", value: -1 },
          { type: "morale", value: 1 },
          { type: "flag", flagId: "helped_injured_traveler" },
        ],
      },
      {
        id: "give_coins",
        label: "给少量钱",
        description: "留下一些银币让他自行求生。",
        effects: [
          { type: "silver", value: -5 },
          { type: "flag", flagId: "paid_injured_traveler" },
        ],
      },
      {
        id: "keep_moving",
        label: "继续赶路",
        description: "资源紧张，无法分心。",
        effects: [
          { type: "flag", flagId: "ignored_injured_traveler" },
          { type: "hint", text: "这是一个艰难的决定，但资源有限。" },
        ],
      },
    ],
  },
  {
    id: "evt_caravan_wreck",
    nodeId: "caravan_wreck",
    title: "商队残骸",
    type: "resource_event",
    description:
      "路旁散落着一个废弃商队的残余，或许还有些可用的物资，以及一些令人不安的线索。",
    choices: [
      {
        id: "search_wreck",
        label: "搜索残骸",
        description: "在残骸中翻找有用的物品。",
        effects: [
          { type: "food", value: 4 },
          { type: "flag", flagId: "found_bandit_blade" },
          { type: "flag", flagId: "found_ash_corrosion_slime" },
          {
            type: "hint",
            text: "残骸中有劫匪的弯刀与灰烬腐蚀黏液——这里似乎发生过劫匪与灰烬兽的冲突。",
          },
        ],
      },
      {
        id: "skip_wreck",
        label: "快速通过",
        description: "不冒险停留。",
        effects: [
          { type: "flag", flagId: "skipped_caravan_wreck" },
        ],
      },
    ],
  },
  {
    id: "evt_abandoned_toolbox",
    nodeId: "abandoned_toolbox",
    title: "遗弃工具箱",
    type: "resource_event",
    description:
      "半埋在土中的工具箱，有些工具还未被使用过。这是途中的一次补给机会。",
    choices: [
      {
        id: "take_toolbox",
        label: "打开并收集工具",
        description: "获得一份有用的临时零件与工具。",
        effects: [
          { type: "flag", flagId: "found_abandoned_toolbox" },
          { type: "flag", flagId: "gained_tutorial_spare_part" },
          {
            type: "hint",
            text: "获得临时零件一枚，稍后遇到货车损伤时可能有用。",
          },
        ],
      },
      {
        id: "leave_toolbox",
        label: "不动它",
        description: "不在这里停留。",
        effects: [
          { type: "flag", flagId: "skipped_abandoned_toolbox" },
        ],
      },
    ],
  },
  {
    id: "evt_outpost_lights",
    nodeId: "outpost_lights",
    title: "驿站灯火",
    type: "small_event",
    description:
      "远远望见前方出现微弱的灯光。第一个驿站就在前方不远处，但附近似乎还有别的东西。",
    choices: [
      {
        id: "head_to_outpost",
        label: "向灯火前进",
        description: "直接朝驿站方向前进。",
        effects: [
          { type: "morale", value: 1 },
          { type: "flag", flagId: "outpost_lights_seen" },
          { type: "flag", flagId: "ash_nest_hint_seen" },
          {
            type: "hint",
            text: "前方能看到驿站灯火。附近似乎还有一处灰烬母巢，可以绕开，也可以挑战。",
          },
        ],
      },
    ],
  },
];

// 纯函数查询工具
export function getN31TutorialEvents(): TutorialEvent[] {
  return [...N31_TUTORIAL_EVENTS];
}

export function getTutorialEventByNodeId(nodeId: string): TutorialEvent | undefined {
  return N31_TUTORIAL_EVENTS.find((e) => e.nodeId === nodeId);
}

export function getTutorialEventById(eventId: string): TutorialEvent | undefined {
  return N31_TUTORIAL_EVENTS.find((e) => e.id === eventId);
}
