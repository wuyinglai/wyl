// 商队部件系统 - 阶段6
// 类似"遗物"的长期被动奖励系统

export type CaravanPartTrigger =
  | "passive" // 获得时立即生效，或持续生效
  | "battle_start" // 战斗开始时触发
  | "battle_end" // 战斗结束时触发
  | "map_move" // 地图移动时触发
  | "card_play" // 打出特定卡牌时触发
  | "supply_repair"; // 补给点修复时触发

export interface CaravanPart {
  id: string;
  name: string;
  description: string;
  trigger: CaravanPartTrigger;
  effectType: string;
  value?: number;
}

// 商队部件池（8个部件）
export const PART_POOL: CaravanPart[] = [
  {
    id: "reinforced_carriage",
    name: "加固车厢",
    description: "商队最大耐久 +10，获得时当前耐久也 +10",
    trigger: "passive",
    effectType: "max_hp_bonus",
    value: 10,
  },
  {
    id: "medical_kit",
    name: "医疗箱",
    description: "每场战斗胜利后，随机一名未死亡角色恢复 3 HP",
    trigger: "battle_end",
    effectType: "heal_random_character",
    value: 3,
  },
  {
    id: "tactical_banner",
    name: "战术旗帜",
    description: "每场战斗开始时，所有参战角色获得 2 护甲",
    trigger: "battle_start",
    effectType: "armor_all_characters",
    value: 2,
  },
  {
    id: "spare_axle",
    name: "备用轮轴",
    description: "地图移动时 20% 概率不增加天数",
    trigger: "map_move",
    effectType: "skip_day_chance",
    value: 0.2,
  },
  {
    id: "ammo_box",
    name: "弹药箱",
    description: "每场战斗中，射手第一张攻击牌伤害 +2（暂未生效）",
    trigger: "card_play",
    effectType: "sharpshooter_first_attack_bonus",
    value: 2,
  },
  {
    id: "water_barrel",
    name: "净水桶",
    description: "营地恢复时，所有角色额外恢复 2 HP（暂未生效）",
    trigger: "passive",
    effectType: "camp_heal_bonus",
    value: 2,
  },
  {
    id: "scout_lens",
    name: "侦察镜",
    description: "地图上相邻问号格显示类型预告（暂未生效）",
    trigger: "passive",
    effectType: "reveal_adjacent_question",
  },
  {
    id: "repair_toolkit",
    name: "修理工具箱",
    description: "补给点修复商队时，额外修复 +10 耐久",
    trigger: "supply_repair",
    effectType: "repair_bonus",
    value: 10,
  },
];

// 获取随机未拥有的部件
export function getRandomUnownedPart(
  ownedParts: CaravanPart[],
): CaravanPart | null {
  const ownedIds = new Set(ownedParts.map((p) => p.id));
  const available = PART_POOL.filter((p) => !ownedIds.has(p.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
