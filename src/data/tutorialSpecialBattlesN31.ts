// C3d：N3.1 特殊战斗数据底座（劫匪抢货战）
// 不属于普通战斗 / 不属于 Boss / 不属于灰烬母巢精英战
// 核心特征：存在 protect_cargo 特殊目标，货物完整度可模拟损失

export type TutorialSpecialBattleType = "special_battle";

export type TutorialSpecialBattleObjectiveType =
  | "protect_cargo"
  | "defeat_enemies";

export type TutorialSpecialBattleTag =
  | "cargo_protection"
  | "bandit"
  | "ambush"
  | "non_boss"
  | "tutorial_special"
  | "world_conflict_hint";

export interface TutorialSpecialBattleEnemy {
  id: string;
  name: string;
  role: string;
  hp: number;
  initialHp?: number;
  attackHint: string;
  tags: TutorialSpecialBattleTag[];
}

export interface TutorialSpecialBattleObjective {
  id: string;
  type: TutorialSpecialBattleObjectiveType;
  title: string;
  description: string;
  required: boolean;
  initialCargoIntegrity?: number;
  failureThreshold?: number;
}

export interface TutorialSpecialBattleReward {
  silver?: number;
  food?: number;
  morale?: number;
  flagIds?: string[];
  hintText?: string;
}

export interface TutorialSpecialBattleEncounter {
  id: string;
  nodeId: string;
  title: string;
  type: TutorialSpecialBattleType;
  teachingGoal: string;
  objectives: TutorialSpecialBattleObjective[];
  enemies: TutorialSpecialBattleEnemy[];
  tags: TutorialSpecialBattleTag[];
  reward: TutorialSpecialBattleReward;
}

export const N31_TUTORIAL_SPECIAL_BATTLES: TutorialSpecialBattleEncounter[] = [
  {
    id: "special_bandit_cargo_raid",
    nodeId: "bandit_cargo_raid",
    title: "劫匪抢货战",
    type: "special_battle",
    teachingGoal:
      "这场战斗教玩家：有些战斗不是只看杀敌，还要保护商队货物。",
    objectives: [
      {
        id: "protect_cargo",
        type: "protect_cargo",
        title: "保护货物",
        description:
          "货物完整度初始为 100；任何时候不低于 1，就算保住了货物。",
        required: true,
        initialCargoIntegrity: 100,
        failureThreshold: 1,
      },
      {
        id: "defeat_raiders",
        type: "defeat_enemies",
        title: "击退劫匪",
        description: "把所有劫匪击退后，该特殊战斗视为胜利。",
        required: true,
      },
    ],
    enemies: [
      {
        id: "bandit_raider_a",
        name: "劫匪甲",
        role: "劫匪先锋",
        hp: 15,
        attackHint: "近身攻击，可能偷取少量货物。",
        tags: ["bandit", "ambush", "cargo_protection"],
      },
      {
        id: "bandit_raider_b",
        name: "劫匪乙",
        role: "带伤劫匪（与灰烬兽冲突后留下的痕迹）",
        hp: 10,
        initialHp: 20,
        attackHint: "已有损伤，但仍会抢货。",
        tags: ["bandit", "world_conflict_hint", "cargo_protection"],
      },
    ],
    tags: [
      "cargo_protection",
      "bandit",
      "ambush",
      "non_boss",
      "tutorial_special",
      "world_conflict_hint",
    ],
    reward: {
      silver: 5,
      morale: 1,
      flagIds: [
        "bandit_cargo_raid_won",
        "learned_cargo_protection",
      ],
      hintText:
        "劫匪已被击退。这告诉玩家：有些战斗不是只看杀敌，还要保护商队货物。",
    },
  },
];

// 纯函数查询工具
export function getN31TutorialSpecialBattles(): TutorialSpecialBattleEncounter[] {
  return [...N31_TUTORIAL_SPECIAL_BATTLES];
}

export function getTutorialSpecialBattleByNodeId(
  nodeId: string,
): TutorialSpecialBattleEncounter | undefined {
  return N31_TUTORIAL_SPECIAL_BATTLES.find((b) => b.nodeId === nodeId);
}

export function getTutorialSpecialBattleById(
  specialBattleId: string,
): TutorialSpecialBattleEncounter | undefined {
  return N31_TUTORIAL_SPECIAL_BATTLES.find((b) => b.id === specialBattleId);
}

const SPECIAL_NODE_IDS = new Set(N31_TUTORIAL_SPECIAL_BATTLES.map((b) => b.nodeId));

export function isTutorialSpecialBattleNode(nodeId: string): boolean {
  return SPECIAL_NODE_IDS.has(nodeId);
}
