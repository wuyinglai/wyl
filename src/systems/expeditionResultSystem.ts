/**
 * expeditionResultSystem.ts
 * 远征结算系统（阶段8.7）
 *
 * 提供纯函数生成远征结算结果
 */

import { CityOrder } from "../data/cityOrders";
import { getCityStatusLabel, formatCityProgress } from "./cityProgressSystem";

export type ExpeditionResultType = "success" | "failed" | "retreated";

export interface ExpeditionResult {
  resultType: ExpeditionResultType;
  orderId?: string;
  orderTitle?: string;
  cityId?: string;
  cityName?: string;
  silverGained: number;
  embersGained: number;
  cityContributionGained: number;
  finalCityStatus?: string;
  remainingCargo: Record<string, number>;
  completedOrderIds: string[];
  summaryLines: string[];
}

interface CreateSuccessParams {
  order: CityOrder;
  cityName: string;
  deliveryResult: {
    ok: boolean;
    rewardSilver: number;
    rewardEmbers: number;
    cityContribution: number;
    updatedCargo: Record<string, number>;
  };
  gameState: {
    cityContributions: Record<string, number>;
    completedOrderIds: string[];
  };
}

/**
 * 创建成功远征结算结果
 */
export function createSuccessExpeditionResult(
  params: CreateSuccessParams
): ExpeditionResult {
  const { order, cityName, deliveryResult, gameState } = params;

  const finalCityStatus = getCityStatusLabel(
    order.cityId,
    gameState.cityContributions
  );

  const remainingCargo = deliveryResult.updatedCargo || {};
  const hasRemaining = Object.values(remainingCargo).some(v => v > 0);

  const summaryLines: string[] = [];
  summaryLines.push(`订单完成：${order.title}`);
  summaryLines.push(`抵达城市：${cityName}`);
  summaryLines.push(`获得银币：${deliveryResult.rewardSilver}`);
  summaryLines.push(`获得火种：${deliveryResult.rewardEmbers}`);
  summaryLines.push(`城市贡献：+${deliveryResult.cityContribution}`);
  summaryLines.push(`城市状态：${finalCityStatus}`);
  summaryLines.push(`剩余货物：${hasRemaining ? Object.entries(remainingCargo).filter(([_, v]) => v > 0).map(([k, v]) => `${k} x${v}`).join(", ") : "无"}`);

  return {
    resultType: "success",
    orderId: order.id,
    orderTitle: order.title,
    cityId: order.cityId,
    cityName,
    silverGained: deliveryResult.rewardSilver,
    embersGained: deliveryResult.rewardEmbers,
    cityContributionGained: deliveryResult.cityContribution,
    finalCityStatus,
    remainingCargo,
    completedOrderIds: [...gameState.completedOrderIds],
    summaryLines,
  };
}

/**
 * 创建撤退远征结算结果
 */
export function createRetreatedExpeditionResult(
  gameState: {
    cargo: Record<string, number>;
    selectedOrderId?: string;
  }
): ExpeditionResult {
  const remainingCargo = gameState.cargo || {};
  const hasRemaining = Object.values(remainingCargo).some(v => v > 0);

  const summaryLines: string[] = [];
  summaryLines.push("远征撤退");
  summaryLines.push("商队保住了余火");
  summaryLines.push("获得火种：+1");
  summaryLines.push("可选择一项失败遗产");
  summaryLines.push(`剩余货物：${hasRemaining ? Object.entries(remainingCargo).filter(([_, v]) => v > 0).map(([k, v]) => `${k} x${v}`).join(", ") : "无"}`);

  return {
    resultType: "retreated",
    orderId: gameState.selectedOrderId,
    silverGained: 0,
    embersGained: 1,
    cityContributionGained: 0,
    remainingCargo,
    completedOrderIds: [],
    summaryLines,
  };
}

/**
 * 创建失败远征结算结果
 */
export function createFailedExpeditionResult(
  gameState: {
    cargo: Record<string, number>;
    selectedOrderId?: string;
  }
): ExpeditionResult {
  const remainingCargo = gameState.cargo || {};
  const hasRemaining = Object.values(remainingCargo).some(v => v > 0);

  const summaryLines: string[] = [];
  summaryLines.push("远征失败");
  summaryLines.push("商队未能抵达目标");
  summaryLines.push("获得火种：+1");
  summaryLines.push("可选择一项失败遗产");
  summaryLines.push(`剩余货物：${hasRemaining ? Object.entries(remainingCargo).filter(([_, v]) => v > 0).map(([k, v]) => `${k} x${v}`).join(", ") : "无"}`);

  return {
    resultType: "failed",
    orderId: gameState.selectedOrderId,
    silverGained: 0,
    embersGained: 1,
    cityContributionGained: 0,
    remainingCargo,
    completedOrderIds: [],
    summaryLines,
  };
}

/**
 * 格式化结算结果为可显示文本数组
 */
export function formatExpeditionResult(result: ExpeditionResult): string[] {
  const lines: string[] = [];

  if (result.resultType === "success") {
    lines.push("远征成功");
  } else if (result.resultType === "retreated") {
    lines.push("远征撤退");
  } else if (result.resultType === "failed") {
    lines.push("远征失败");
  }
  lines.push("");

  if (result.orderTitle) {
    lines.push(`订单完成：${result.orderTitle}`);
  }
  if (result.cityName) {
    lines.push(`目标城市：${result.cityName}`);
  }

  if (result.silverGained > 0) {
    lines.push(`获得银币：+${result.silverGained}`);
  }
  if (result.embersGained > 0) {
    lines.push(`获得火种：+${result.embersGained}`);
  }
  if (result.cityContributionGained > 0) {
    lines.push(`城市贡献：+${result.cityContributionGained}`);
  }

  if (result.finalCityStatus) {
    lines.push(`城市状态：${result.finalCityStatus}`);
  }

  const hasRemaining = Object.values(result.remainingCargo).some(v => v > 0);
  lines.push(`剩余货物：${hasRemaining ? Object.entries(result.remainingCargo).filter(([_, v]) => v > 0).map(([k, v]) => `${k} x${v}`).join(", ") : "无"}`);

  return lines;
}
