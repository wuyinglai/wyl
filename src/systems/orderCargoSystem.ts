/**
 * orderCargoSystem.ts
 * 阶段8.3：订单需求与货物状态关联加强
 *
 * 提供纯函数检查订单需求与货物状态，不直接操作 Phaser 场景。
 */

import type { Cargo } from "./cargoSystem";
import type { CityOrder } from "../data/cityOrders";
import { calculateCargoWeight } from "./cargoSystem";
import { formatGoodsRequirement, getGoodName } from "../data/goods";

/**
 * 订单货物检查结果
 */
export interface OrderCargoCheck {
  orderId: string;
  hasOrder: boolean;
  hasEnoughCargo: boolean;
  missingGoods: Record<string, number>;
  requiredGoods: Record<string, number>;
  currentCargo: Record<string, number>;
}

/**
 * 载重检查结果
 */
export interface CargoWeightCheck {
  currentWeight: number;
  maxWeight: number;
  isOverweight: boolean;
  overweightBy: number;
}

/**
 * 检查订单货物状态
 * @param order 订单（可能 undefined）
 * @param cargo 当前货物（可能 undefined）
 * @returns OrderCargoCheck 检查结果
 */
export function checkOrderCargo(
  order: CityOrder | undefined,
  cargo: Cargo | undefined
): OrderCargoCheck {
  // 默认值处理
  const safeCargo = cargo ?? {};
  const safeRequired = order?.requiredGoods ?? {};

  // 计算缺少的货物
  const missingGoods: Record<string, number> = {};
  for (const [goodId, requiredCount] of Object.entries(safeRequired)) {
    const currentCount = safeCargo[goodId] ?? 0;
    if (currentCount < requiredCount) {
      missingGoods[goodId] = requiredCount - currentCount;
    }
  }

  return {
    orderId: order?.id ?? "",
    hasOrder: !!order,
    hasEnoughCargo: Object.keys(missingGoods).length === 0 && !!order,
    missingGoods,
    requiredGoods: { ...safeRequired },
    currentCargo: { ...safeCargo },
  };
}

/**
 * 格式化缺少的货物为中文显示
 * @param missingGoods 缺少的货物记录
 * @returns 格式化后的字符串，如 "粮食 x3、药材 x2"
 */
export function formatMissingGoods(missingGoods: Record<string, number>): string {
  const entries = Object.entries(missingGoods);
  if (entries.length === 0) {
    return "无";
  }

  return entries
    .map(([goodId, count]) => `${getGoodName(goodId)} x${count}`)
    .join("、");
}

/**
 * 获取订单货物状态文本（短摘要）
 * @param order 订单
 * @param cargo 当前货物
 * @returns 状态文本，如 "订单状态：物资已备齐" 或 "订单状态：缺少 粮食 x3"
 */
export function getOrderCargoStatusText(
  order: CityOrder | undefined,
  cargo: Cargo | undefined
): string {
  if (!order) {
    return "订单状态：未选择";
  }

  const check = checkOrderCargo(order, cargo);
  if (check.hasEnoughCargo) {
    return "订单状态：物资已备齐";
  }

  const missingText = formatMissingGoods(check.missingGoods);
  return `订单状态：缺少 ${missingText}`;
}

/**
 * 检查载重状态
 * @param cargo 当前货物
 * @param maxCargoWeight 最大载重（可能 undefined）
 * @returns CargoWeightCheck 载重检查结果
 */
export function checkCargoWeight(
  cargo: Cargo | undefined,
  maxCargoWeight: number | undefined
): CargoWeightCheck {
  const currentWeight = calculateCargoWeight(cargo ?? {});
  const maxWeight = maxCargoWeight ?? 0;
  const isOverweight = currentWeight > maxWeight;
  const overweightBy = Math.max(0, currentWeight - maxWeight);

  return {
    currentWeight,
    maxWeight,
    isOverweight,
    overweightBy,
  };
}

/**
 * 获取载重状态文本
 * @param cargo 当前货物
 * @param maxCargoWeight 最大载重
 * @returns 载重文本，如 "载重：5/20" 或 "载重：25/20（超重 5）"
 */
export function getCargoWeightStatusText(
  cargo: Cargo | undefined,
  maxCargoWeight: number | undefined
): string {
  const check = checkCargoWeight(cargo, maxCargoWeight);

  if (check.isOverweight) {
    return `载重：${check.currentWeight}/${check.maxWeight}（超重 ${check.overweightBy}）`;
  }

  return `载重：${check.currentWeight}/${check.maxWeight}`;
}

/**
 * 获取完整的订单货物详情文本（用于 Tooltip）
 * @param order 订单
 * @param cargo 当前货物
 * @param maxCargoWeight 最大载重
 * @returns 多行详情文本数组
 */
export function getOrderCargoDetailLines(
  order: CityOrder | undefined,
  cargo: Cargo | undefined,
  maxCargoWeight: number | undefined
): string[] {
  const lines: string[] = [];

  // 订单信息
  if (order) {
    lines.push(`订单：${order.title}`);
    lines.push(`需求：${formatGoodsRequirement(order.requiredGoods)}`);
  } else {
    lines.push("订单：未选择");
  }

  // 当前货物
  lines.push("");
  if (cargo && Object.keys(cargo).length > 0) {
    lines.push(`当前货物：${formatGoodsRequirement(cargo)}`);
  } else {
    lines.push("当前货物：无");
  }

  // 缺少货物
  const check = checkOrderCargo(order, cargo);
  if (check.hasOrder && !check.hasEnoughCargo) {
    lines.push(`缺少：${formatMissingGoods(check.missingGoods)}`);
  }

  // 载重状态
  const weightCheck = checkCargoWeight(cargo, maxCargoWeight);
  lines.push("");
  if (weightCheck.isOverweight) {
    lines.push(`载重：${weightCheck.currentWeight}/${weightCheck.maxWeight} ⚠️ 超重 ${weightCheck.overweightBy}`);
  } else {
    lines.push(`载重：${weightCheck.currentWeight}/${weightCheck.maxWeight}`);
  }

  return lines;
}
