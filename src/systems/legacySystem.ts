/**
 * legacySystem.ts
 * 失败遗产系统（阶段8.8）
 *
 * 提供纯函数处理遗产生成和应用
 */

import { GameState } from "./GameState";
import { generateLegacyChoices, getLegacyRelicById } from "../data/legacyRelics";

/**
 * 生成失败遗产候选
 */
export function generateFailureLegacyChoices(): string[] {
  const choices = generateLegacyChoices(3);
  return choices.map((r) => r.id);
}

/**
 * 应用遗产效果到 GameState
 * 返回新对象，不修改原对象
 */
export function applyLegacyRelicToGameState(
  gameState: GameState
): GameState {
  const relicId = gameState.activeLegacyRelicId;
  if (!relicId) return gameState;

  // 防止重复应用
  if (gameState.appliedLegacyRelicIdForRun === relicId) {
    return gameState;
  }

  const relic = getLegacyRelicById(relicId);
  if (!relic) return gameState;

  const newState = { ...gameState };

  switch (relic.effectType) {
    case "starting_medicine":
      newState.cargo = { ...newState.cargo };
      newState.cargo.medicine = (newState.cargo.medicine || 0) + 1;
      break;
    case "starting_silver":
      newState.silver += 10;
      break;
    case "map_hint":
      // 不改变 cargo/silver，只记录
      break;
  }

  newState.appliedLegacyRelicIdForRun = relicId;
  return newState;
}
