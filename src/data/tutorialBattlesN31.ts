// C3c：N3.1 普通战斗 encounter 模板
// 仅作为教程节点的战斗数据底座，不与现有 BattleScene 深度耦合
// 后续接入真实 BattleScene 时，可将下方 enemy 映射为战斗场景的敌人实例

export type TutorialBattleType = "normal_battle";

export type TutorialBattleDifficulty =
  | "tutorial_easy"
  | "tutorial_standard"
  | "tutorial_pressure";

export type TutorialBattleTag =
  | "basic_attack"
  | "shield"
  | "bleed"
  | "vehicle_damage"
  | "armor"
  | "armor_break"
  | "mixed_threat"
  | "ash_corrosion"
  | "purification_hint";

export interface TutorialBattleEnemy {
  id: string;
  name: string;
  role: string;
  hp: number;
  attackHint: string;
  tags: TutorialBattleTag[];
}

export interface TutorialBattleReward {
  silver?: number;
  food?: number;
  morale?: number;
  flagIds?: string[];
  hintText?: string;
}

export interface TutorialBattleEncounter {
  id: string;
  nodeId: string;
  title: string;
  type: TutorialBattleType;
  difficulty: TutorialBattleDifficulty;
  teachingGoal: string;
  enemies: TutorialBattleEnemy[];
  tags: TutorialBattleTag[];
  reward: TutorialBattleReward;
}

// N3.1 普通战斗（4 场，不含 Boss / 劫匪特殊战 / 灰烬母巢精英）
export const N31_TUTORIAL_BATTLES: TutorialBattleEncounter[] = [
  {
    id: "battle_young_ash_beast",
    nodeId: "young_ash_beast_battle",
    title: "灰烬幼兽战",
    type: "normal_battle",
    difficulty: "tutorial_easy",
    teachingGoal:
      "第一次正式战斗：教玩家基础出牌、敌人攻击意图、简单防御/护盾，不让玩家被压死。",
    enemies: [
      {
        id: "young_ash_beast_1",
        name: "灰烬幼兽",
        role: "初级近战威胁",
        hp: 8,
        attackHint: "基础近战攻击，偶尔会蓄力小爆发。",
        tags: ["basic_attack", "shield"],
      },
    ],
    tags: ["basic_attack", "shield"],
    reward: {
      silver: 3,
      food: 1,
      flagIds: ["first_tutorial_battle_won"],
      hintText: "第一场战斗胜利了！学会了基础出牌和防御。",
    },
  },
  {
    id: "battle_cracked_back_ash_beast",
    nodeId: "cracked_back_ash_beast_battle",
    title: "裂背灰烬兽战",
    type: "normal_battle",
    difficulty: "tutorial_standard",
    teachingGoal:
      "学习：敌人可能会攻击货车；敌人有护甲；破甲 / 集火能显著提高效率。",
    enemies: [
      {
        id: "cracked_back_ash_beast_1",
        name: "裂背灰烬兽",
        role: "带护甲的中程威胁",
        hp: 14,
        attackHint: "会攻击货车耐久；有护甲，需要先破甲。",
        tags: ["vehicle_damage", "armor", "armor_break"],
      },
    ],
    tags: ["vehicle_damage", "armor", "armor_break"],
    reward: {
      silver: 5,
      flagIds: ["cracked_back_beast_won"],
      hintText: "击败了带护甲的裂背灰烬兽！学会了破甲和集火的重要性。",
    },
  },
  {
    id: "battle_mixed_ash_beast",
    nodeId: "mixed_ash_beast_battle",
    title: "混合灰烬兽战",
    type: "normal_battle",
    difficulty: "tutorial_standard",
    teachingGoal:
      "学习：同时处理多个敌人；优先集火目标；综合复习护车、流血、破甲。",
    enemies: [
      {
        id: "young_ash_beast_m1",
        name: "灰烬幼兽",
        role: "低血量近战",
        hp: 8,
        attackHint: "近战攻击；血量较低，适合先清理。",
        tags: ["basic_attack", "bleed"],
      },
      {
        id: "cracked_back_ash_beast_m1",
        name: "裂背灰烬兽",
        role: "中血量带护甲威胁",
        hp: 14,
        attackHint: "会攻击货车；有护甲。",
        tags: ["vehicle_damage", "armor"],
      },
    ],
    tags: ["mixed_threat", "bleed", "armor", "vehicle_damage"],
    reward: {
      silver: 6,
      food: 1,
      flagIds: ["mixed_ash_beast_won"],
      hintText: "同时击退了两只不同的灰烬兽，学会了优先级分配。",
    },
  },
  {
    id: "battle_double_corroded_ash_beast",
    nodeId: "double_corroded_ash_beast_battle",
    title: "双灰烬腐蚀兽战",
    type: "normal_battle",
    difficulty: "tutorial_pressure",
    teachingGoal:
      "学习：灰蚀（先以 tag/hint 表达），净化提示；到站前最后压力战，提醒玩家马上到驿站。",
    enemies: [
      {
        id: "corroded_ash_beast_1",
        name: "灰烬腐蚀兽",
        role: "灰蚀威胁",
        hp: 12,
        attackHint: "会施加灰蚀；血量中等。",
        tags: ["ash_corrosion", "purification_hint", "vehicle_damage"],
      },
      {
        id: "corroded_ash_beast_2",
        name: "灰烬腐蚀兽",
        role: "灰蚀威胁（二号）",
        hp: 12,
        attackHint: "会施加灰蚀；需尽快处理。",
        tags: ["ash_corrosion", "vehicle_damage"],
      },
    ],
    tags: ["ash_corrosion", "purification_hint", "vehicle_damage", "mixed_threat"],
    reward: {
      silver: 7,
      flagIds: ["corroded_beasts_won"],
      hintText:
        "击败了两只灰烬腐蚀兽。前方就是第一个驿站，做好准备。（灰蚀机制后续将接入 BattleScene，当前以 tag 表达）",
    },
  },
];

// 节点 ID → 是否为普通战斗节点（用于快速查询）
export const N31_NORMAL_BATTLE_NODE_IDS: string[] = N31_TUTORIAL_BATTLES.map(
  (b) => b.nodeId,
);

export function getN31TutorialBattles(): TutorialBattleEncounter[] {
  return [...N31_TUTORIAL_BATTLES];
}

export function getTutorialBattleByNodeId(
  nodeId: string,
): TutorialBattleEncounter | undefined {
  return N31_TUTORIAL_BATTLES.find((b) => b.nodeId === nodeId);
}

export function getTutorialBattleById(
  battleId: string,
): TutorialBattleEncounter | undefined {
  return N31_TUTORIAL_BATTLES.find((b) => b.id === battleId);
}

export function isTutorialBattleNode(nodeId: string): boolean {
  return N31_NORMAL_BATTLE_NODE_IDS.includes(nodeId);
}
