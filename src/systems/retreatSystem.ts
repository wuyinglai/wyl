/**
 * retreatSystem.ts
 * 撤退成本系统（阶段10.1）
 *
 * 提供纯函数计算撤退成本和结果
 */

import { MapCell } from "./GameState";

export type RetreatResultType = "safe_retreat" | "failed_retreat";

export interface RetreatCostCheck {
  canRetreatSafely: boolean;
  retreatSupplyCost: number;
  currentSupply: number;
  shortage: number;
  resultType: RetreatResultType;
}

/**
 * 计算撤退所需补给
 * 使用曼哈顿距离（当前位置到起点的距离）
 * @param currentPosition 当前位置
 * @param startPosition 起点位置
 * @param options.costDiscount 成本折扣（0-1，默认为1，即无折扣）
 */
export function calculateRetreatSupplyCost(
  currentPosition: { x: number; y: number },
  startPosition: { x: number; y: number },
  options?: { costDiscount?: number }
): number {
  const distance =
    Math.abs(currentPosition.x - startPosition.x) +
    Math.abs(currentPosition.y - startPosition.y);
  let cost = Math.min(distance, 15);

  // 应用折扣（如果提供）
  if (options?.costDiscount !== undefined && options.costDiscount > 0) {
    cost = Math.max(1, Math.ceil(cost * options.costDiscount));
  }

  return cost;
}

/**
 * 检查撤退成本
 * @param currentPosition 当前位置
 * @param startPosition 起点位置
 * @param currentSupply 当前补给
 * @param options.costDiscount 成本折扣（0-1，默认为1，即无折扣）
 */
export function checkRetreatCost(
  currentPosition: { x: number; y: number },
  startPosition: { x: number; y: number },
  currentSupply: number,
  options?: { costDiscount?: number }
): RetreatCostCheck {
  const retreatSupplyCost = calculateRetreatSupplyCost(currentPosition, startPosition, options);
  const canRetreatSafely = currentSupply >= retreatSupplyCost;
  const shortage = Math.max(0, retreatSupplyCost - currentSupply);
  const resultType: RetreatResultType = canRetreatSafely ? "safe_retreat" : "failed_retreat";

  return {
    canRetreatSafely,
    retreatSupplyCost,
    currentSupply,
    shortage,
    resultType,
  };
}

/**
 * 获取撤退成本的描述文本
 */
export function getRetreatCostText(check: RetreatCostCheck): string[] {
  const lines: string[] = [];

  lines.push(`撤离需要补给：${check.retreatSupplyCost}`);
  lines.push(`当前补给：${check.currentSupply}`);

  if (check.canRetreatSafely) {
    lines.push(`预计结果：安全撤离`);
  } else {
    lines.push(`补给不足，缺少 ${check.shortage}，撤离可能失败`);
  }

  return lines;
}

