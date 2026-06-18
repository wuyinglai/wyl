// C3e：N3.1 灰烬母巢可选精英战系统函数
// 纯函数：
//   1) 胜利结算（给 silver/morale/emberSeeds/ancientMemoryFragments/ashMaterials，写 flag）
//   2) 失败救援（扣 silver/morale，扣 caravanHp 但最低保留 20，写救援 flag）
//   3) 绕开（写 skip flag，不奖励不惩罚）
// 三种结算互斥，防重复奖励 / 防重复惩罚。

import {
  getTutorialEliteBattleById,
  TutorialEliteBattleReward,
  TutorialEliteBattleRescuePenalty,
} from "../data/tutorialEliteBattlesN31";

// 精英战进度状态 — 与 GameState.ts 中定义保持一致
export interface TutorialEliteBattleProgressState {
  resolvedTutorialEliteBattleIds: string[];
  tutorialEliteBattleFlags: string[];
}

// GameState 切片 — 仅读写本阶段关心的字段 + 通用资源
export interface TutorialEliteBattleGameStateSlice {
  silver?: number;
  morale?: number;
  caravanHp?: number;
  caravanMaxHp?: number;
  emberSeeds?: number;
  ancientMemoryFragments?: number;
  ashMaterials?: number;
  // 跨局保留：路线已完成节点列表（绕开母巢时写入 skippedOptionalTutorialNodeIds）
  completedTutorialNodeIds?: string[];
  skippedOptionalTutorialNodeIds?: string[];
  // 精英战专用
  resolvedTutorialEliteBattleIds: string[];
  tutorialEliteBattleFlags: string[];
}

// ========== 查询（返回副本，不污染传入对象）==========

export function getTutorialEliteBattleEnemies(
  eliteBattleId: string,
): { id: string; name: string; hp: number; armor: number; tags: string[] }[] {
  const b = getTutorialEliteBattleById(eliteBattleId);
  return b ? b.enemies.map((e) => ({ ...e, tags: [...e.tags] })) : [];
}

export function getTutorialEliteBattleReward(
  eliteBattleId: string,
): TutorialEliteBattleReward | undefined {
  const b = getTutorialEliteBattleById(eliteBattleId);
  return b ? { ...b.reward, flagIds: b.reward.flagIds ? [...b.reward.flagIds] : undefined } : undefined;
}

export function getTutorialEliteBattleRescuePenalty(
  eliteBattleId: string,
): TutorialEliteBattleRescuePenalty | undefined {
  const b = getTutorialEliteBattleById(eliteBattleId);
  return b
    ? {
        ...b.rescue,
        flagIds: b.rescue.flagIds ? [...b.rescue.flagIds] : undefined,
      }
    : undefined;
}

// ========== 互斥与防重 ==========

/**
 * 该 eliteBattle 是否尚未结算（胜利/救援/绕开 均视为已结算）。
 * 未知 id 或已结算 → 返回 false。
 */
export function canResolveTutorialEliteBattle(
  state: TutorialEliteBattleGameStateSlice,
  eliteBattleId: string,
): boolean {
  if (!eliteBattleId) return false;
  const b = getTutorialEliteBattleById(eliteBattleId);
  if (!b) return false;
  const resolved = state.resolvedTutorialEliteBattleIds || [];
  if (resolved.includes(eliteBattleId)) return false;
  return true;
}

export function isTutorialEliteBattleResolved(
  state: TutorialEliteBattleGameStateSlice,
  eliteBattleId: string,
): boolean {
  return (state.resolvedTutorialEliteBattleIds || []).includes(eliteBattleId);
}

// ========== 胜利结算 ==========

/**
 * 胜利结算：
 * - 写入 resolvedTutorialEliteBattleIds（防重复）
 * - 增加 silver / morale / emberSeeds / ancientMemoryFragments / ashMaterials
 * - flag 去重追加
 * - 写入 completedTutorialNodeIds（nodeId），表示路线节点已完成
 *
 * 若已结算（无论何种方式），原样返回 state。
 */
export function resolveTutorialEliteBattleVictory(
  state: TutorialEliteBattleGameStateSlice,
  eliteBattleId: string,
): TutorialEliteBattleGameStateSlice {
  if (!canResolveTutorialEliteBattle(state, eliteBattleId)) return state;

  const battle = getTutorialEliteBattleById(eliteBattleId);
  if (!battle) return state;

  const next: TutorialEliteBattleGameStateSlice = cloneState(state);

  // 奖励
  const r = battle.reward;
  if (typeof r.silver === "number" && r.silver !== 0) {
    next.silver = Math.max(0, (typeof next.silver === "number" ? next.silver : 0) + r.silver);
  }
  if (typeof r.morale === "number" && r.morale !== 0) {
    next.morale = clamp((typeof next.morale === "number" ? next.morale : 0) + r.morale, 0, 10);
  }
  if (typeof r.emberSeeds === "number" && r.emberSeeds !== 0) {
    next.emberSeeds =
      (typeof next.emberSeeds === "number" ? next.emberSeeds : 0) + r.emberSeeds;
  }
  if (typeof r.ancientMemoryFragments === "number" && r.ancientMemoryFragments !== 0) {
    next.ancientMemoryFragments =
      (typeof next.ancientMemoryFragments === "number" ? next.ancientMemoryFragments : 0) +
      r.ancientMemoryFragments;
  }
  if (typeof r.ashMaterials === "number" && r.ashMaterials !== 0) {
    next.ashMaterials =
      (typeof next.ashMaterials === "number" ? next.ashMaterials : 0) + r.ashMaterials;
  }

  // flag 去重
  if (r.flagIds && r.flagIds.length > 0) {
    for (const flagId of r.flagIds) {
      if (!next.tutorialEliteBattleFlags.includes(flagId)) {
        next.tutorialEliteBattleFlags.push(flagId);
      }
    }
  }

  // 写入 resolved + completedTutorialNodeIds（表示路线节点完成）
  next.resolvedTutorialEliteBattleIds.push(eliteBattleId);
  if (!next.completedTutorialNodeIds) next.completedTutorialNodeIds = [];
  if (!next.completedTutorialNodeIds.includes(battle.nodeId)) {
    next.completedTutorialNodeIds.push(battle.nodeId);
  }

  return next;
}

// ========== 失败救援（路过商队救援）==========

/**
 * 失败救援：
 * - silver -20（最低 0）
 * - morale -2（最低 0）
 * - caravanHp -20（最低保留 20，若 maxHp 存在但 < 20 则以 maxHp 为准）
 * - 不给 emberSeeds / ancientMemoryFragments / ashMaterials
 * - 写入 ash_nest_rescued_by_passing_caravan flag
 * - 写入 resolvedTutorialEliteBattleIds（视为已处理，不再重复）
 * - 写入 completedTutorialNodeIds（表示路线节点已完成，推进至下一节点）
 *
 * 若已结算（无论何种方式），原样返回 state。
 */
export function resolveTutorialEliteBattleRescue(
  state: TutorialEliteBattleGameStateSlice,
  eliteBattleId: string,
): TutorialEliteBattleGameStateSlice {
  if (!canResolveTutorialEliteBattle(state, eliteBattleId)) return state;

  const battle = getTutorialEliteBattleById(eliteBattleId);
  if (!battle) return state;

  const next: TutorialEliteBattleGameStateSlice = cloneState(state);

  // 惩罚
  const p = battle.rescue;
  if (typeof p.silver === "number" && p.silver !== 0) {
    next.silver = Math.max(0, (typeof next.silver === "number" ? next.silver : 0) + p.silver);
  }
  if (typeof p.morale === "number" && p.morale !== 0) {
    next.morale = Math.max(0, (typeof next.morale === "number" ? next.morale : 0) + p.morale);
  }
  if (typeof p.caravanHp === "number" && p.caravanHp !== 0) {
    const currentHp = typeof next.caravanHp === "number" ? next.caravanHp : 45;
    const maxHp = typeof next.caravanMaxHp === "number" ? next.caravanMaxHp : currentHp;
    const floor = Math.min(20, Math.max(1, maxHp)); // caravanHp 最低保留 20（若 maxHp < 20 则保留 maxHp）
    next.caravanHp = Math.max(floor, currentHp + p.caravanHp);
  }

  // 不给 emberSeeds / ancientMemoryFragments / ashMaterials

  // flag 去重
  if (p.flagIds && p.flagIds.length > 0) {
    for (const flagId of p.flagIds) {
      if (!next.tutorialEliteBattleFlags.includes(flagId)) {
        next.tutorialEliteBattleFlags.push(flagId);
      }
    }
  }

  // 写入 resolved + completedTutorialNodeIds
  next.resolvedTutorialEliteBattleIds.push(eliteBattleId);
  if (!next.completedTutorialNodeIds) next.completedTutorialNodeIds = [];
  if (!next.completedTutorialNodeIds.includes(battle.nodeId)) {
    next.completedTutorialNodeIds.push(battle.nodeId);
  }

  return next;
}

// ========== 绕开（跳过）==========

/**
 * 绕开：
 * - 不奖励
 * - 不惩罚
 * - 写入 skippedOptionalTutorialNodeIds（nodeId）
 * - 写入 resolvedTutorialEliteBattleIds（不再重复触发）
 * - 不写入 tutorialEliteBattleFlags（胜利/救援才会有 flag）
 *
 * 若已结算（无论何种方式），原样返回 state。
 */
export function skipTutorialEliteBattle(
  state: TutorialEliteBattleGameStateSlice,
  eliteBattleId: string,
): TutorialEliteBattleGameStateSlice {
  if (!canResolveTutorialEliteBattle(state, eliteBattleId)) return state;

  const battle = getTutorialEliteBattleById(eliteBattleId);
  if (!battle) return state;

  const next: TutorialEliteBattleGameStateSlice = cloneState(state);

  next.resolvedTutorialEliteBattleIds.push(eliteBattleId);

  if (!next.skippedOptionalTutorialNodeIds) next.skippedOptionalTutorialNodeIds = [];
  if (!next.skippedOptionalTutorialNodeIds.includes(battle.nodeId)) {
    next.skippedOptionalTutorialNodeIds.push(battle.nodeId);
  }

  return next;
}

// ========== 工具函数 ==========

function clamp(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function cloneState(
  state: TutorialEliteBattleGameStateSlice,
): TutorialEliteBattleGameStateSlice {
  return {
    ...state,
    resolvedTutorialEliteBattleIds: [...(state.resolvedTutorialEliteBattleIds || [])],
    tutorialEliteBattleFlags: [...(state.tutorialEliteBattleFlags || [])],
    completedTutorialNodeIds: state.completedTutorialNodeIds
      ? [...state.completedTutorialNodeIds]
      : undefined,
    skippedOptionalTutorialNodeIds: state.skippedOptionalTutorialNodeIds
      ? [...state.skippedOptionalTutorialNodeIds]
      : undefined,
  };
}
