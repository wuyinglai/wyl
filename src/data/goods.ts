// 商品数据系统（阶段8.1）
// 定义游戏中的基础商品，提供商品查询、格式化和校验功能

export interface GoodDefinition {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  weight: number;
  tags: string[];
  riskTags: string[];
  uses: string[];
}

export const GOODS: GoodDefinition[] = [
  {
    id: "grain",
    name: "粮食",
    description: "基础补给品，可用于订单、交易和后续食物消耗系统。",
    basePrice: 10,
    weight: 1,
    tags: ["food", "supply", "common"],
    riskTags: ["hunger_target"],
    uses: ["order", "trade", "supply"],
  },
  {
    id: "medicine",
    name: "药材",
    description: "可用于城市订单、救援事件和后续治疗系统。",
    basePrice: 18,
    weight: 1,
    tags: ["medicine", "healing", "valuable"],
    riskTags: ["moral_choice"],
    uses: ["order", "trade", "healing", "event"],
  },
  {
    id: "iron",
    name: "铁器",
    description: "可用于修桥、修车、城市建设和工业订单。",
    basePrice: 15,
    weight: 2,
    tags: ["metal", "tool", "heavy"],
    riskTags: ["heavy_load"],
    uses: ["order", "trade", "repair", "event"],
  },
  {
    id: "parts",
    name: "旧零件",
    description: "旧世界残留零件，可用于机械、废墟和修理工相关事件。",
    basePrice: 20,
    weight: 1,
    tags: ["parts", "machine", "rare"],
    riskTags: ["machine_attract"],
    uses: ["order", "trade", "repair", "ruin"],
  },
];

/**
 * 根据商品ID获取商品定义
 */
export function getGoodById(goodId: string): GoodDefinition | undefined {
  return GOODS.find((g) => g.id === goodId);
}

/**
 * 获取商品中文名，未知ID返回原文
 */
export function getGoodName(goodId: string): string {
  const good = getGoodById(goodId);
  return good ? good.name : goodId;
}

/**
 * 格式化商品需求为中文名
 * { grain: 5, medicine: 2 } → "粮食 x5、药材 x2"
 * 空对象 → "无"
 * 未知商品ID → 显示原ID，不崩溃
 */
export function formatGoodsRequirement(goods: Record<string, number>): string {
  const entries = Object.entries(goods);
  if (entries.length === 0) return "无";
  return entries
    .map(([id, count]) => `${getGoodName(id)} x${count}`)
    .join("、");
}

/**
 * 商品校验结果
 */
export interface GoodsValidationError {
  goodId: string;
  field: string;
  message: string;
}

export interface GoodsValidationResult {
  valid: boolean;
  errors: GoodsValidationError[];
}

/**
 * 校验商品数据完整性
 */
export function validateGoods(): GoodsValidationResult {
  const errors: GoodsValidationError[] = [];
  const seenIds = new Set<string>();

  for (const good of GOODS) {
    // ID 唯一性
    if (seenIds.has(good.id)) {
      errors.push({ goodId: good.id, field: "id", message: `商品 ID 重复: ${good.id}` });
    }
    seenIds.add(good.id);

    // name 非空
    if (!good.name || good.name.trim().length === 0) {
      errors.push({ goodId: good.id, field: "name", message: `商品 ${good.id} 的 name 为空` });
    }

    // basePrice > 0
    if (good.basePrice <= 0) {
      errors.push({ goodId: good.id, field: "basePrice", message: `商品 ${good.id} 的 basePrice <= 0: ${good.basePrice}` });
    }

    // weight > 0
    if (good.weight <= 0) {
      errors.push({ goodId: good.id, field: "weight", message: `商品 ${good.id} 的 weight <= 0: ${good.weight}` });
    }

    // tags 至少 1 个
    if (good.tags.length === 0) {
      errors.push({ goodId: good.id, field: "tags", message: `商品 ${good.id} 的 tags 为空` });
    }

    // uses 至少 1 个
    if (good.uses.length === 0) {
      errors.push({ goodId: good.id, field: "uses", message: `商品 ${good.id} 的 uses 为空` });
    }
  }

  return { valid: errors.length === 0, errors };
}
