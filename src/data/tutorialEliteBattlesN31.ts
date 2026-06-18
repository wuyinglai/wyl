// C3e：N3.1 灰烬母巢可选精英战数据底座
// 类型 = optional_elite，isBoss = false，isOptional = true
// 不属于普通战斗，不属于特殊战斗（劫匪抢货战），不属于 Boss
// 结算流程：绕开 → 跳过；挑战胜利 → 给奖励；挑战失败 → 路过商队救援

export type TutorialEliteBattleType = "optional_elite";

export interface TutorialEliteBattleEnemy {
  id: string;
  name: string;
  role: string;
  hp: number;
  armor: number;
  tags: string[];
}

export interface TutorialEliteBattleReward {
  silver?: number;
  morale?: number;
  emberSeeds?: number;
  ancientMemoryFragments?: number;
  ashMaterials?: number;
  flagIds?: string[];
  hintText?: string;
}

export interface TutorialEliteBattleRescuePenalty {
  silver?: number;
  morale?: number;
  caravanHp?: number;
  flagIds?: string[];
  hintText?: string;
}

export interface TutorialEliteBattleEncounter {
  id: string;
  nodeId: string;
  title: string;
  type: TutorialEliteBattleType;
  isBoss: boolean;
  isOptional: boolean;
  teachingGoal: string;
  enemies: TutorialEliteBattleEnemy[];
  reward: TutorialEliteBattleReward;
  rescue: TutorialEliteBattleRescuePenalty;
}

export const N31_TUTORIAL_ELITE_BATTLES: TutorialEliteBattleEncounter[] = [
  {
    id: "elite_ash_nest",
    nodeId: "ash_nest_elite",
    title: "灰烬母巢",
    type: "optional_elite",
    isBoss: false,
    isOptional: true,
    teachingGoal:
      "可选精英战：玩家可绕开，也可挑战母巢获取火种；失败则触发商队救援。",
    enemies: [
      {
        id: "ash_nest_core",
        name: "灰烬母巢核心",
        role: "核心单位",
        hp: 120,
        armor: 0,
        tags: ["core", "ash_nest"],
      },
      {
        id: "ash_spore_sac",
        name: "灰烬孢囊",
        role: "召唤型单位（第3回合可召唤1只灰烬幼兽，最多1次）",
        hp: 35,
        armor: 0,
        tags: ["spore", "summoner", "max_summon_1"],
      },
      {
        id: "ash_cub_a",
        name: "灰烬幼兽",
        role: "近战幼兽",
        hp: 18,
        armor: 0,
        tags: ["cub", "melee"],
      },
      {
        id: "ash_cub_b",
        name: "灰烬幼兽",
        role: "近战幼兽",
        hp: 18,
        armor: 0,
        tags: ["cub", "melee"],
      },
    ],
    reward: {
      silver: 15,
      morale: 1,
      emberSeeds: 1,
      ancientMemoryFragments: 1,
      ashMaterials: 2,
      flagIds: ["ash_nest_elite_won"],
      hintText:
        "母巢崩溃，余烬商队带回火种与古代记忆碎片。这是首个可选精英战胜利。",
    },
    rescue: {
      silver: -20,
      morale: -2,
      caravanHp: -20,
      flagIds: ["ash_nest_rescued_by_passing_caravan"],
      hintText:
        "挑战失败，路过的商队救下了余烬商队。损失银币与士气，商队车架受损。",
    },
  },
];

// 纯函数查询工具
export function getN31TutorialEliteBattles(): TutorialEliteBattleEncounter[] {
  return [...N31_TUTORIAL_ELITE_BATTLES];
}

export function getTutorialEliteBattleById(
  eliteBattleId: string,
): TutorialEliteBattleEncounter | undefined {
  return N31_TUTORIAL_ELITE_BATTLES.find((b) => b.id === eliteBattleId);
}

export function getTutorialEliteBattleByNodeId(
  nodeId: string,
): TutorialEliteBattleEncounter | undefined {
  return N31_TUTORIAL_ELITE_BATTLES.find((b) => b.nodeId === nodeId);
}

const ELITE_NODE_IDS = new Set(N31_TUTORIAL_ELITE_BATTLES.map((b) => b.nodeId));

export function isTutorialEliteBattleNode(nodeId: string): boolean {
  return ELITE_NODE_IDS.has(nodeId);
}
