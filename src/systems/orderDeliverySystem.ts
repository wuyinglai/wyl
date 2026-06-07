/**
 * orderDeliverySystem.ts
 * 阶段8.4：订单交付系统 v1
 *
 * 提供纯函数处理订单交付逻辑，不直接操作 Phaser 场景。
 */

import type { Cargo } from "./cargoSystem";
import type { CityOrder } from "../data/cityOrders";
import { markOrderCompleted } from "./GameState";

/**
 * 订单交付结果
 */
export interface OrderDeliveryResult {
  ok: boolean;
  reason:
    | "delivered"
    | "missing_order"
    | "already_delivered"
    | "not_enough_cargo"
    | "invalid_state";
  message: string;
  updatedCargo: Record<string, number>;
  rewardSilver: number;
  rewardEmbers: number;
  cityContribution: number;
}

/**
 * 执行订单交付
 *
 * @param params.order 订单（可能 undefined）
 * @param params.cargo 当前货物（可能 undefined）
 * @param params.completedOrderIds 已完成订单ID列表
 * @returns OrderDeliveryResult 交付结果（不修改原 cargo）
 */
export function deliverOrder(params: {
  order: CityOrder | undefined;
  cargo: Cargo | undefined;
  completedOrderIds: string[] | undefined;
}): OrderDeliveryResult {
  const { order, completedOrderIds } = params;
  const safeCargo = params.cargo ?? {};
  const safeCompleted = completedOrderIds ?? [];

  // 无订单
  if (!order) {
    return {
      ok: false,
      reason: "missing_order",
      message: "没有当前订单",
      updatedCargo: { ...safeCargo },
      rewardSilver: 0,
      rewardEmbers: 0,
      cityContribution: 0,
    };
  }

  // 已交付过
  if (safeCompleted.includes(order.id)) {
    return {
      ok: false,
      reason: "already_delivered",
      message: `订单「${order.title}」已完成`,
      updatedCargo: { ...safeCargo },
      rewardSilver: 0,
      rewardEmbers: 0,
      cityContribution: 0,
    };
  }

  // 检查货物是否满足
  const requiredGoods = order.requiredGoods ?? {};
  for (const [goodId, requiredCount] of Object.entries(requiredGoods)) {
    const currentCount = safeCargo[goodId] ?? 0;
    if (currentCount < requiredCount) {
      return {
        ok: false,
        reason: "not_enough_cargo",
        message: "货物不足，无法交付",
        updatedCargo: { ...safeCargo },
        rewardSilver: 0,
        rewardEmbers: 0,
        cityContribution: 0,
      };
    }
  }

  // 扣除货物，生成新 cargo
  const updatedCargo: Record<string, number> = { ...safeCargo };
  for (const [goodId, requiredCount] of Object.entries(requiredGoods)) {
    const remaining = (updatedCargo[goodId] ?? 0) - requiredCount;
    if (remaining <= 0) {
      delete updatedCargo[goodId];
    } else {
      updatedCargo[goodId] = remaining;
    }
  }

  // 标记订单完成（阶段10.2）
  markOrderCompleted(order.id);

  return {
    ok: true,
    reason: "delivered",
    message: `订单完成：${order.title}`,
    updatedCargo,
    rewardSilver: order.rewardSilver ?? 0,
    rewardEmbers: order.rewardEmbers ?? 0,
    cityContribution: order.cityContribution ?? 0,
  };
}
