// C3d：N3.1 特殊战斗系统函数
// 纯函数：胜利结算 + 货物完整度模拟损失
// 不实现真实失败流程，不大改 BattleScene

import {
  getTutorialSpecialBattleById,
  TutorialSpecialBattleObjective,
  TutorialSpecialBattleEnemy,
  TutorialSpecialBattleReward,
} from "../data/tutorialSpecialBattlesN31";

// 特殊战进度状态 — 与 GameState.ts 中定义保持一致
export interface TutorialSpecialBattleProgressState {
  resolvedTutorialSpecialBattleIds: string[];
  tutorialSpecialBattleFlags: string[];
  tutorialSpecialBattleCargoIntegrityById: Record<string, number>;
}

// GameState 切片 — 仅读写本阶段关心的字段 + 通用 silver/food/morale
export interface TutorialSpecialBattleGameStateSlice {
  silver?: number;
  food?: number;
  morale?: number;
  resolvedTutorialSpecialBattleIds: string[];
  tutorialSpecialBattleFlags: string[];
  tutorialSpecialBattleCargoIntegrityById: Record<string, number>;
}

// ========== 查询 ==========

export function getTutorialSpecialBattleObjectives(
  specialBattleId: string,
): TutorialSpecialBattleObjective[] {
  const b = getTutorialSpecialBattleById(specialBattleId);
  return b ? [...b.objectives] : [];
}

export function getTutorialSpecialBattleEnemies(
  specialBattleId: string,
): TutorialSpecialBattleEnemy[] {
  const b = getTutorialSpecialBattleById(specialBattleId);
  return b ? [...b.enemies] : [];
}

export function getTutorialSpecialBattleReward(
  specialBattleId: string,
): TutorialSpecialBattleReward | undefined {
  const b = getTutorialSpecialBattleById(specialBattleId);
  return b ? { ...b.reward } : undefined;
}

// ========== 初始目标状态 ==========

/**
 * 根据特殊战定义生成初始目标状态。
 * 目前主要返回 cargoIntegrity 的初始值（100）。
 * 未知 specialBattleId → 返回空对象。
 */
export function createInitialSpecialBattleObjectiveState(
  specialBattleId: string,
): Record<string, number> {
  const b = getTutorialSpecialBattleById(specialBattleId);
  if (!b) return {};

  const result: Record<string, number> = {};
  for (const obj of b.objectives) {
    if (obj.type === "protect_cargo") {
      const initial = typeof obj.initialCargoIntegrity === "number"
        ? obj.initialCargoIntegrity
        : 100;
      result.cargoIntegrity = clamp(initial, 0, 100);
    }
  }
  return result;
}

// ========== 结算 ==========

/**
 * 未知 specialBattleId / 已结算 → 返回 false；
 * 否则返回 true。
 */
export function canResolveTutorialSpecialBattle(
  state: TutorialSpecialBattleGameStateSlice,
  specialBattleId: string,
): boolean {
  if (!specialBattleId) return false;
  const b = getTutorialSpecialBattleById(specialBattleId);
  if (!b) return false;
  if ((state.resolvedTutorialSpecialBattleIds || []).includes(specialBattleId)) {
    return false;
  }
  return true;
}

export function isTutorialSpecialBattleResolved(
  state: TutorialSpecialBattleGameStateSlice,
  specialBattleId: string,
): boolean {
  return (state.resolvedTutorialSpecialBattleIds || []).includes(specialBattleId);
}

/**
 * 胜利结算：
 * - 写入 resolvedTutorialSpecialBattleIds（防重复）
 * - 按 reward 增加 silver/food/morale
 * - flag 去重追加
 */
export function resolveTutorialSpecialBattleVictory(
  state: TutorialSpecialBattleGameStateSlice,
  specialBattleId: string,
): TutorialSpecialBattleGameStateSlice {
  if (!canResolveTutorialSpecialBattle(state, specialBattleId)) {
    return state;
  }
  const battle = getTutorialSpecialBattleById(specialBattleId);
  if (!battle) return state;

  const next: TutorialSpecialBattleGameStateSlice = {
    ...state,
    resolvedTutorialSpecialBattleIds: [
      ...(state.resolvedTutorialSpecialBattleIds || []),
      specialBattleId,
    ],
    tutorialSpecialBattleFlags: [...(state.tutorialSpecialBattleFlags || [])],
    tutorialSpecialBattleCargoIntegrityById: {
      ...(state.tutorialSpecialBattleCargoIntegrityById || {}),
    },
  };

  if (typeof battle.reward.silver === "number" && battle.reward.silver !== 0) {
    const prev = typeof next.silver === "number" ? next.silver : 0;
    next.silver = Math.max(0, prev + battle.reward.silver);
  }
  if (typeof battle.reward.food === "number" && battle.reward.food !== 0) {
    const prev = typeof next.food === "number" ? next.food : 0;
    next.food = Math.max(0, prev + battle.reward.food);
  }
  if (typeof battle.reward.morale === "number" && battle.reward.morale !== 0) {
    const prev = typeof next.morale === "number" ? next.morale : 0;
    next.morale = clamp(prev + battle.reward.morale, 0, 10);
  }
  if (battle.reward.flagIds && battle.reward.flagIds.length > 0) {
    for (const flagId of battle.reward.flagIds) {
      if (!next.tutorialSpecialBattleFlags.includes(flagId)) {
        next.tutorialSpecialBattleFlags.push(flagId);
      }
    }
  }

  return next;
}

/**
 * 模拟货物完整度损失：
 * - 未知 specialBattleId → 原样返回
 * - cargoIntegrity clamp 到 [0, 100]
 * - 不增加 resolvedTutorialSpecialBattleIds（胜利由单独的胜利结算函数处理）
 */
export function resolveTutorialSpecialBattleCargoLoss(
  state: TutorialSpecialBattleGameStateSlice,
  specialBattleId: string,
  cargoIntegrityLoss: number,
): TutorialSpecialBattleGameStateSlice {
  if (!specialBattleId) return state;
  const battle = getTutorialSpecialBattleById(specialBattleId);
  if (!battle) return state;
  if (typeof cargoIntegrityLoss !== "number" || Number.isNaN(cargoIntegrityLoss)) {
    return state;
  }

  const current = (state.tutorialSpecialBattleCargoIntegrityById || {})[
    specialBattleId
  ];
  const base = typeof current === "number" ? current : getDefaultCargoIntegrity(battle);
  const nextValue = clamp(base - cargoIntegrityLoss, 0, 100);

  return {
    ...state,
    tutorialSpecialBattleCargoIntegrityById: {
      ...(state.tutorialSpecialBattleCargoIntegrityById || {}),
      [specialBattleId]: nextValue,
    },
  };
}

// ========== 工具函数 ==========

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function getDefaultCargoIntegrity(
  battle: { objectives: TutorialSpecialBattleObjective[] },
): number {
  for (const obj of battle.objectives) {
    if (obj.type === "protect_cargo") {
      const initial = typeof obj.initialCargoIntegrity === "number"
        ? obj.initialCargoIntegrity
        : 100;
      return clamp(initial, 0, 100);
    }
  }
  return 100;
}
