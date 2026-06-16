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
  price: number;
  isImplemented: boolean;
}

// 工具目录
const EXPEDITION_TOOLS: ExpeditionTool[] = [
  {
    id: "sealed_crate",
    name: "密封货箱",
    description: "用于保护易损货物，可降低货物损坏风险。",
    category: "cargo",
    rarity: "common",
    effectType: "protect_cargo",
    price: 30,
    isImplemented: true,
  },
  {
    id: "spare_axle",
    name: "备用轮轴",
    description: "用于远征途中修复车轮，可降低撤退补给消耗。",
    category: "mobility",
    rarity: "common",
    effectType: "reduce_retreat_cost",
    price: 45,
    isImplemented: true,
  },
  {
    id: "range_scope",
    name: "测距镜",
    description: "用于观察远方地形与威胁。",
    category: "scouting",
    rarity: "uncommon",
    effectType: "reveal_risk",
    price: 60,
    isImplemented: true,
  },
  {
    id: "camouflage_cloth",
    name: "伪装布",
    description: "用于遮掩商队踪迹，可降低遭遇敌人的概率。",
    category: "survival",
    rarity: "uncommon",
    effectType: "reduce_encounter_risk",
    price: 50,
    isImplemented: true,
  },
  {
    id: "waterproof_tarp",
    name: "防水油布",
    description: "用于遮盖货物和营地，可降低暴雨天气影响。",
    category: "survival",
    rarity: "common",
    effectType: "weather_resistance",
    price: 25,
    isImplemented: true,
  },
  {
    id: "sand_mask",
    name: "沙尘面罩",
    description: "用于沙暴与尘土环境，可降低恶劣天气带来的损耗。",
    category: "survival",
    rarity: "common",
    effectType: "weather_resistance",
    price: 20,
    isImplemented: true,
  },
  {
    id: "signal_flare",
    name: "信号焰火",
    description: "用于紧急联络和求援。",
    category: "utility",
    rarity: "rare",
    effectType: "none",
    price: 100,
    isImplemented: false,
  },
  {
    id: "reinforced_shield",
    name: "加固护板",
    description: "用于强化商队防护，可降低商队本体受到的伤害。",
    category: "combat",
    rarity: "uncommon",
    effectType: "combat_support",
    price: 55,
    isImplemented: true,
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

/**
 * 判断工具是否已拥有
 * @param ownedToolIds 已拥有的工具 ID 列表
 * @param toolId 要检查的工具 ID
 */
export function isToolOwned(ownedToolIds: string[] | null | undefined, toolId: string): boolean {
  if (!ownedToolIds) return false;
  return ownedToolIds.includes(toolId);
}

/**
 * 购买工具结果类型
 */
export interface BuyToolResult {
  success: boolean;
  reason?: string;
  message?: string;
  tool?: ExpeditionTool;
  newOwned?: string[];
  newSilver?: number;
}

/**
 * 尝试购买工具
 * @param ownedToolIds 当前已拥有的工具 ID 列表
 * @param silver 当前银币数量
 * @param toolId 要购买的工具 ID
 */
export function tryBuyTool(
  ownedToolIds: string[] | null | undefined,
  silver: number,
  toolId: string,
): BuyToolResult {
  const tool = getToolById(toolId);
  if (!tool) {
    return { success: false, reason: "unknown_tool", message: "未知工具" };
  }
  if (!tool.isImplemented) {
    return { success: false, reason: "not_implemented", message: "该工具暂未开放", tool };
  }
  const currentOwned = ownedToolIds ? [...ownedToolIds] : [];
  if (currentOwned.includes(toolId)) {
    return { success: false, reason: "already_owned", message: "已拥有该工具", tool };
  }
  if (silver < tool.price) {
    return { success: false, reason: "insufficient_silver", message: `银币不足，需要 ${tool.price} 银`, tool };
  }
  currentOwned.push(toolId);
  return {
    success: true,
    reason: "success",
    message: `购买成功！花费 ${tool.price} 银`,
    tool,
    newOwned: currentOwned,
    newSilver: silver - tool.price,
  };
}

/**
 * 格式化工具卡片摘要（用于商店显示）
 */
export function formatToolCardSummary(tool: ExpeditionTool): string {
  const category = CATEGORY_CN[tool.category] ?? tool.category;
  const rarity = RARITY_CN[tool.rarity] ?? tool.rarity;
  return `${tool.name}｜${category}｜${rarity}｜${tool.price}银`;
}

/**
 * 格式化购买结果消息
 */
export function formatBuyResultMessage(result: BuyToolResult): string {
  return result.message ?? "操作失败";
}

/**
 * 获取工具效果摘要
 */
export function getToolEffectDescription(tool: ExpeditionTool): string {
  switch (tool.effectType) {
    case "protect_cargo":
      return "降低货物损失概率";
    case "reduce_retreat_cost":
      return "降低撤退补给消耗";
    case "reveal_risk":
      return "查看路线风险";
    case "reduce_encounter_risk":
      return "降低遭遇敌人概率";
    case "weather_resistance":
      return "降低天气伤害";
    case "combat_support":
      return "降低商队本体伤害";
    case "none":
    default:
      return "无特殊效果";
  }
}

/**
 * 获取当前携带工具的效果摘要
 * @param selectedToolId 已选择的工具 ID，null 表示未携带
 */
export function getActiveToolEffectSummary(selectedToolId: string | null): string {
  if (!selectedToolId) {
    return "未携带工具";
  }
  const tool = getToolById(selectedToolId);
  if (!tool) {
    return "未携带工具";
  }
  const effectDesc = getToolEffectDescription(tool);
  return `${tool.name}：${effectDesc}`;
}

/**
 * 工具效果应用上下文
 */
export interface ToolEffectContext {
  selectedToolId: string | null;
}

/**
 * 应用货物保护效果（密封货箱）
 * @param baseLossProbability 基础损失概率
 * @param context 工具效果上下文
 * @returns 应用效果后的损失概率
 */
export function applyCargoProtection(baseLossProbability: number, context: ToolEffectContext): number {
  if (!context.selectedToolId) return baseLossProbability;
  const tool = getToolById(context.selectedToolId);
  if (!tool || tool.effectType !== "protect_cargo") return baseLossProbability;
  return Math.max(0, baseLossProbability * 0.6);
}

/**
 * 应用撤退成本折扣（备用轮轴）
 * @param context 工具效果上下文
 * @returns 折扣系数
 */
export function applyRetreatCostDiscount(context: ToolEffectContext): number {
  if (!context.selectedToolId) return 1.0;
  const tool = getToolById(context.selectedToolId);
  if (!tool || tool.effectType !== "reduce_retreat_cost") return 1.0;
  return 0.7;
}

/**
 * 应用遭遇概率降低（伪装布）
 * @param baseCombatProbability 基础战斗概率
 * @param context 工具效果上下文
 * @returns 应用效果后的战斗概率
 */
export function applyEncounterReduction(baseCombatProbability: number, context: ToolEffectContext): number {
  if (!context.selectedToolId) return baseCombatProbability;
  const tool = getToolById(context.selectedToolId);
  if (!tool || tool.effectType !== "reduce_encounter_risk") return baseCombatProbability;
  return Math.max(0, baseCombatProbability * 0.75);
}

/**
 * 应用天气伤害减免（防水油布/沙尘面罩）
 * @param baseDamage 基础伤害
 * @param context 工具效果上下文
 * @param weatherType 天气类型（rain/storm/sand/dust）
 * @returns 应用效果后的伤害
 */
export function applyWeatherResistance(baseDamage: number, context: ToolEffectContext, weatherType: "rain" | "storm" | "sand" | "dust"): number {
  if (!context.selectedToolId) return baseDamage;
  const tool = getToolById(context.selectedToolId);
  if (!tool || tool.effectType !== "weather_resistance") return baseDamage;

  const isRainy = weatherType === "rain" || weatherType === "storm";
  const isDusty = weatherType === "sand" || weatherType === "dust";

  if ((tool.id === "waterproof_tarp" && isRainy) || (tool.id === "sand_mask" && isDusty)) {
    return Math.max(0, Math.floor(baseDamage * 0.5));
  }
  return baseDamage;
}

/**
 * 应用商队防护效果（加固护板）
 * @param baseDamage 基础伤害
 * @param context 工具效果上下文
 * @returns 应用效果后的伤害
 */
export function applyCaravanProtection(baseDamage: number, context: ToolEffectContext): number {
  if (!context.selectedToolId) return baseDamage;
  const tool = getToolById(context.selectedToolId);
  if (!tool || tool.effectType !== "combat_support") return baseDamage;
  return Math.max(0, Math.floor(baseDamage * 0.7));
}
