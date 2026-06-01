// 货物工具系统（阶段8.1）
// 提供纯工具函数，不直接操作 GameState
// 本阶段只做数据层面的货物增删查算

import { getGoodById, formatGoodsRequirement } from "../data/goods";

export type Cargo = Record<string, number>;

/**
 * 创建空货物对象
 */
export function createEmptyCargo(): Cargo {
  return {};
}

/**
 * 复制并清理货物（过滤数量 <= 0 的项目）
 */
export function createCargo(initial: Cargo): Cargo {
  const result: Cargo = {};
  for (const [goodId, qty] of Object.entries(initial)) {
    if (qty > 0) {
      result[goodId] = qty;
    }
  }
  return result;
}

/**
 * 获取货物中某商品的数量
 */
export function getCargoQuantity(cargo: Cargo, goodId: string): number {
  return cargo[goodId] ?? 0;
}

/**
 * 添加货物（不修改原对象，返回新对象）
 * quantity <= 0 时安全返回原 cargo 的拷贝
 * 未知 goodId 允许但 console.warn
 */
export function addCargo(cargo: Cargo, goodId: string, quantity: number): Cargo {
  if (quantity <= 0) {
    return { ...cargo };
  }

  const good = getGoodById(goodId);
  if (!good) {
    console.warn(`[货物] 未知商品 ID: ${goodId}，仍允许添加`);
  }

  const result = { ...cargo };
  result[goodId] = (result[goodId] ?? 0) + quantity;
  return result;
}

/**
 * 移除货物（不修改原对象）
 * 不允许数量减成负数
 * 减到 0 时删除该 key
 * quantity <= 0 时安全返回
 */
export function removeCargo(cargo: Cargo, goodId: string, quantity: number): Cargo {
  if (quantity <= 0) {
    return { ...cargo };
  }

  const current = cargo[goodId] ?? 0;
  if (current === 0) {
    return { ...cargo };
  }

  const result = { ...cargo };
  const newQty = Math.max(0, current - quantity);
  if (newQty === 0) {
    delete result[goodId];
  } else {
    result[goodId] = newQty;
  }
  return result;
}

/**
 * 检查货物是否满足需求
 */
export function hasCargo(cargo: Cargo, required: Cargo): boolean {
  for (const [goodId, qty] of Object.entries(required)) {
    if ((cargo[goodId] ?? 0) < qty) {
      return false;
    }
  }
  return true;
}

/**
 * 计算货物总重量
 * 未知商品按 weight = 0 处理，console.warn
 */
export function calculateCargoWeight(cargo: Cargo): number {
  let totalWeight = 0;
  for (const [goodId, qty] of Object.entries(cargo)) {
    const good = getGoodById(goodId);
    if (!good) {
      console.warn(`[货物] 未知商品 ID: ${goodId}，重量按 0 计算`);
      continue;
    }
    totalWeight += good.weight * qty;
  }
  return totalWeight;
}

/**
 * 格式化货物为中文名（复用 goods.ts 的格式化）
 * 空 cargo 显示"无"
 */
export function formatCargo(cargo: Cargo): string {
  return formatGoodsRequirement(cargo);
}
