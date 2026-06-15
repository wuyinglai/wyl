// 远征工具系统（阶段12.1）
// 工具数据结构与工具目录
// 本阶段只做数据层，不做真实工具效果

export type ToolRarity = "common" | "uncommon" | "rare";

export type ToolCategory =
| "cargo"
| "mobility"
| "scouting"
| "survival"
| "combat"
| "utility";

export type ToolEffectType =
| "protect_cargo"
| "reduce_retreat_cost"
| "reveal_risk"
| "reduce_encounter_risk"
| "weather_resistance"
| "combat_support"
| "none";

export interface ExpeditionTool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  rarity: ToolRarity;
  effectType: ToolEffectType;
  isImplemented: boolean;
}

// 工具目录
const EXPEDITION_TOOLS: ExpeditionTool[] = [
  {
    id: "sealed_crate",
    name: "密封货箱",
    description: "用于保护易损货物，后续可降低货物损坏风险。",
    category: "cargo",
    rarity: "common",
    effectType: "protect_cargo",
    isImplemented: false,
  },
  {
    id: "spare_axle",
    name: "备用轮轴",
    description: "用于远征途中修复车轮，后续可降低撤退补给消耗。",
    category: "mobility",
    rarity: "common",
    effectType: "reduce_retreat_cost",
    isImplemented: false,
  },
  {
    id: "range_scope",
    name: "测距镜",
    description: "用于观察远方地形与威胁，后续可提前查看路线风险。",
    category: "scouting",
    rarity: "uncommon",
    effectType: "reveal_risk",
    isImplemented: false,
  },
  {
    id: "camouflage_cloth",
    name: "伪装布",
    description: "用于遮掩商队踪迹，后续可降低遭遇敌人的概率。",
    category: "survival",
    rarity: "uncommon",
    effectType: "reduce_encounter_risk",
    isImplemented: false,
  },
  {
    id: "waterproof_tarp",
    name: "防水油布",
    description: "用于遮盖货物和营地，后续可降低暴雨天气影响。",
    category: "survival",
    rarity: "common",
    effectType: "weather_resistance",
    isImplemented: false,
  },
  {
    id: "sand_mask",
    name: "沙尘面罩",
    description: "用于沙暴与尘土环境，后续可降低恶劣天气带来的损耗。",
    category: "survival",
    rarity: "common",
    effectType: "weather_resistance",
    isImplemented: false,
  },
  {
    id: "signal_flare",
    name: "信号焰火",
    description: "用于紧急联络和求援，后续可用于特殊事件或撤退选项。",
    category: "utility",
    rarity: "rare",
    effectType: "none",
    isImplemented: false,
  },
  {
    id: "reinforced_shield",
    name: "加固护板",
    description: "用于强化商队防护，后续可在战斗或伏击中提供保护。",
    category: "combat",
    rarity: "uncommon",
    effectType: "combat_support",
    isImplemented: false,
  },
];

const CATEGORY_CN: Record<ToolCategory, string> = {
  cargo: "货物",
  mobility: "机动",
  scouting: "侦察",
  survival: "生存",
  combat: "战斗",
  utility: "通用",
};

const RARITY_CN: Record<ToolRarity, string> = {
  common: "普通",
  uncommon: "精良",
  rare: "稀有",
};

const VALID_CATEGORIES: ToolCategory[] = ["cargo", "mobility", "scouting", "survival", "combat", "utility"];
const VALID_RARITIES: ToolRarity[] = ["common", "uncommon", "rare"];
const VALID_EFFECTS: ToolEffectType[] = [
  "protect_cargo",
  "reduce_retreat_cost",
  "reveal_risk",
  "reduce_encounter_risk",
  "weather_resistance",
  "combat_support",
  "none",
];

/**
 * 返回所有工具（返回副本，避免外部修改）
 */
export function getAllTools(): ExpeditionTool[] {
  return EXPEDITION_TOOLS.map((t) => ({ ...t }));
}

/**
 * 根据工具 ID 返回工具定义
 */
export function getToolById(toolId: string): ExpeditionTool | undefined {
  const found = EXPEDITION_TOOLS.find((t) => t.id === toolId);
  return found ? { ...found } : undefined;
}

/**
 * 根据 category 返回对应的工具列表
 */
export function getToolsByCategory(category: ToolCategory): ExpeditionTool[] {
  return EXPEDITION_TOOLS
    .filter((t) => t.category === category)
    .map((t) => ({ ...t }));
}

/**
 * 根据 rarity 返回对应的工具列表
 */
export function getToolsByRarity(rarity: ToolRarity): ExpeditionTool[] {
  return EXPEDITION_TOOLS
    .filter((t) => t.rarity === rarity)
    .map((t) => ({ ...t }));
}

/**
 * 判断工具 ID 是否存在
 */
export function isKnownToolId(toolId: string): boolean {
  return EXPEDITION_TOOLS.some((t) => t.id === toolId);
}

/**
 * 格式化工具摘要信息
 */
export function formatToolSummary(tool: ExpeditionTool): string {
  const category = CATEGORY_CN[tool.category] ?? tool.category;
  const rarity = RARITY_CN[tool.rarity] ?? tool.rarity;
  const status = tool.isImplemented ? "" : "效果未接入";
  return `${tool.name}｜${category}｜${rarity}｜${status}`;
}

/**
 * 工具分类中文（用于 UI 显示）
 */
export function getCategoryLabel(category: ToolCategory): string {
  return CATEGORY_CN[category] ?? category;
}

/**
 * 工具稀有度中文（用于 UI 显示）
 */
export function getRarityLabel(rarity: ToolRarity): string {
  return RARITY_CN[rarity] ?? rarity;
}

/**
 * 判断 category 是否合法（数据校验）
 */
export function isValidCategory(category: string): boolean {
  return VALID_CATEGORIES.includes(category as ToolCategory);
}

/**
 * 判断 rarity 是否合法（数据校验）
 */
export function isValidRarity(rarity: string): boolean {
  return VALID_RARITIES.includes(rarity as ToolRarity);
}

/**
 * 判断 effectType 是否合法（数据校验）
 */
export function isValidEffectType(effectType: string): boolean {
  return VALID_EFFECTS.includes(effectType as ToolEffectType);
}

/**
 * 阶段12.3：获取当前携带的工具摘要
 * @param toolId 已选择的工具 ID，null 表示未携带
 * @returns 携带工具的显示文本
 */
export function formatCarriedToolText(toolId: string | null): string {
  if (!toolId) {
    return "当前携带：无";
  }
  const tool = getToolById(toolId);
  if (!tool) {
    return "当前携带：无";
  }
  return `当前携带：${tool.name}`;
}

/**
 * 阶段12.3：获取工具详细显示文本（用于 UI 面板）
 * @param toolId 已选择的工具 ID，null 表示未携带
 * @returns 工具详细信息行
 */
export function formatToolDisplayLine(toolId: string | null): string {
  if (!toolId) {
    return "携带工具：无";
  }
  const tool = getToolById(toolId);
  if (!tool) {
    return "携带工具：无";
  }
  const summary = formatToolSummary(tool);
  return summary;
}
