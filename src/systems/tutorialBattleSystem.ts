// C3c：N3.1 普通战斗系统函数
// 纯函数：只处理胜利结算，不实现失败、不实现敌人 AI、不大改 BattleScene

import {
  getTutorialBattleById,
  TutorialBattleEncounter,
  TutorialBattleEnemy,
  TutorialBattleReward,
} from "../data/tutorialBattlesN31";

// 战斗结算状态 — 与 GameState.ts 中定义保持一致
export interface TutorialBattleProgressState {
  resolvedTutorialBattleIds: string[];
  tutorialBattleFlags: string[];
}

// 结算战斗需要访问的 GameState 资源字段
export interface TutorialBattleGameStateSlice {
  silver?: number;
  food?: number;
  morale?: number;
  caravanHp?: number;
  caravanMaxHp?: number;
  resolvedTutorialBattleIds: string[];
  tutorialBattleFlags: string[];
}

// ========== 查询 ==========

export function getTutorialBattleEnemies(
  battleId: string,
): TutorialBattleEnemy[] {
  const b = getTutorialBattleById(battleId);
  if (!b) return [];
  return [...b.enemies];
}

export function getTutorialBattleReward(
  battleId: string,
): TutorialBattleReward | undefined {
  const b = getTutorialBattleById(battleId);
  if (!b) return undefined;
  return { ...b.reward };
}

// ========== 结算 ==========

/**
 * 判断战斗是否可胜利结算（未知 battleId / 已结算过 → false）
 */
export function canResolveTutorialBattle(
  state: TutorialBattleGameStateSlice,
  battleId: string,
): boolean {
  if (!battleId) return false;
  const battle = getTutorialBattleById(battleId);
  if (!battle) return false;
  if ((state.resolvedTutorialBattleIds || []).includes(battleId)) return false;
  return true;
}

export function isTutorialBattleResolved(
  state: TutorialBattleGameStateSlice,
  battleId: string,
): boolean {
  return (state.resolvedTutorialBattleIds || []).includes(battleId);
}

/**
 * 胜利结算：写入 battleId + 应用奖励（silver / food / morale / flag）。
 * - 未知 battleId → 原样返回
 * - 已结算 → 原样返回（防重复奖励）
 */
export function resolveTutorialBattleVictory(
  state: TutorialBattleGameStateSlice,
  battleId: string,
): TutorialBattleGameStateSlice {
  if (!canResolveTutorialBattle(state, battleId)) {
    return state;
  }
  const battle = getTutorialBattleById(battleId);
  if (!battle) return state;

  const next: TutorialBattleGameStateSlice = {
    ...state,
    resolvedTutorialBattleIds: [...(state.resolvedTutorialBattleIds || []), battleId],
    tutorialBattleFlags: [...(state.tutorialBattleFlags || [])],
  };

  // 奖励：silver
  if (typeof battle.reward.silver === "number" && battle.reward.silver !== 0) {
    const prev = typeof next.silver === "number" ? next.silver : 0;
    next.silver = Math.max(0, prev + battle.reward.silver);
  }

  // 奖励：food
  if (typeof battle.reward.food === "number" && battle.reward.food !== 0) {
    const prev = typeof next.food === "number" ? next.food : 0;
    next.food = Math.max(0, prev + battle.reward.food);
  }

  // 奖励：morale（clamp 到 0-10）
  if (typeof battle.reward.morale === "number" && battle.reward.morale !== 0) {
    const prev = typeof next.morale === "number" ? next.morale : 0;
    next.morale = Math.max(0, Math.min(10, prev + battle.reward.morale));
  }

  // flag：不重复添加
  if (battle.reward.flagIds && battle.reward.flagIds.length > 0) {
    for (const flagId of battle.reward.flagIds) {
      if (!next.tutorialBattleFlags.includes(flagId)) {
        next.tutorialBattleFlags.push(flagId);
      }
    }
  }

  return next;
}

// ========== 初始状态 ==========

export function createInitialTutorialBattleState(): TutorialBattleProgressState {
  return {
    resolvedTutorialBattleIds: [],
    tutorialBattleFlags: [],
  };
}

// 未使用引用抑制
void (null as TutorialBattleEncounter | null);
