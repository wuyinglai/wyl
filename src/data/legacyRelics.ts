/**
 * legacyRelics.ts
 * 失败遗产数据定义（阶段8.8）
 */

export type LegacyRelicEffectType =
  | "map_hint"
  | "starting_medicine"
  | "starting_silver";

export interface LegacyRelic {
  id: string;
  name: string;
  description: string;
  effectType: LegacyRelicEffectType;
  effectText: string;
  rarity: "common" | "rare";
}

export const LEGACY_RELICS: LegacyRelic[] = [
  {
    id: "burned_map",
    name: "烧焦地图",
    description: "上一支商队留下的残缺路线图。",
    effectType: "map_hint",
    effectText: "下一局地图上显示目标方向提示。",
    rarity: "common",
  },
  {
    id: "lost_medkit",
    name: "遗失药箱",
    description: "商队残骸中找到的旧药箱。",
    effectType: "starting_medicine",
    effectText: "下一局开局额外获得药材 x1。",
    rarity: "common",
  },
  {
    id: "broken_banner",
    name: "断裂商旗",
    description: "仍能辨认出商队徽记的旗帜。",
    effectType: "starting_silver",
    effectText: "下一局开局额外获得银币 +10。",
    rarity: "common",
  },
];

export function getLegacyRelicById(id: string): LegacyRelic | undefined {
  return LEGACY_RELICS.find((r) => r.id === id);
}

/**
 * 生成遗产候选列表
 * 第一版直接返回前三个遗产，不随机
 */
export function generateLegacyChoices(count = 3): LegacyRelic[] {
  return LEGACY_RELICS.slice(0, count);
}
