// C3b：N3.1 教学事件系统函数
// 纯函数：接收 state（任何符合 GameState 片段的对象），返回新的 state
// 零件相关效果暂时用 tutorialEventFlags 记录，不新增 parts:number
// 不修改 caravanParts / 工具系统 / 城市复兴 / 订单系统

import {
  getTutorialEventById,
  TutorialEvent,
  TutorialEventEffect,
} from "../data/tutorialEventsN31";

// 事件结算状态 —— 与 GameState.ts 中定义保持一致
export interface TutorialEventProgressState {
  resolvedTutorialEventIds: string[];
  tutorialEventFlags: string[];
}

// 结算事件需要访问的 GameState 资源字段
export interface TutorialEventGameStateSlice {
  food?: number;
  silver?: number;
  morale?: number;
  caravanHp?: number;
  caravanMaxHp?: number;
  resolvedTutorialEventIds: string[];
  tutorialEventFlags: string[];
}

// ========== 辅助：clamp ==========

function clampInt(v: number, min: number, max: number): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// ========== 事件结算核心 ==========

/**
 * 判断事件是否可结算。
 * - 未知 eventId → false
 * - 已结算过 → false（避免重复给奖励）
 */
export function canResolveTutorialEvent(
  state: TutorialEventGameStateSlice,
  eventId: string,
): boolean {
  if (!eventId) return false;
  const event = getTutorialEventById(eventId);
  if (!event) return false;
  if ((state.resolvedTutorialEventIds || []).includes(eventId)) return false;
  return true;
}

/**
 * 判断事件是否已结算。
 */
export function isTutorialEventResolved(
  state: TutorialEventGameStateSlice,
  eventId: string,
): boolean {
  return (state.resolvedTutorialEventIds || []).includes(eventId);
}

/**
 * 结算单个 effect，返回一个部分更新对象，由调用方合并到 state。
 */
function applyEffect(
  current: TutorialEventGameStateSlice,
  effect: TutorialEventEffect,
): TutorialEventGameStateSlice {
  const next: TutorialEventGameStateSlice = { ...current };

  switch (effect.type) {
    case "food": {
      if (typeof effect.value === "number") {
        const prev = typeof next.food === "number" ? next.food : 0;
        next.food = Math.max(0, prev + effect.value);
      }
      break;
    }
    case "silver": {
      if (typeof effect.value === "number") {
        const prev = typeof next.silver === "number" ? next.silver : 0;
        next.silver = Math.max(0, prev + effect.value);
      }
      break;
    }
    case "morale": {
      if (typeof effect.value === "number") {
        const prev = typeof next.morale === "number" ? next.morale : 0;
        next.morale = clampInt(prev + effect.value, 0, 10);
      }
      break;
    }
    case "vehicle_hp": {
      if (typeof effect.value === "number") {
        const prev = typeof next.caravanHp === "number" ? next.caravanHp : 0;
        const max = typeof next.caravanMaxHp === "number" ? next.caravanMaxHp : prev;
        next.caravanHp = clampInt(prev + effect.value, 0, max);
      }
      break;
    }
    case "flag": {
      if (effect.flagId) {
        const flags = next.tutorialEventFlags || [];
        if (!flags.includes(effect.flagId)) {
          next.tutorialEventFlags = [...flags, effect.flagId];
        }
      }
      break;
    }
    case "hint": {
      // hint 不影响 state，仅用于 UI 提示
      break;
    }
    default:
      break;
  }

  return next;
}

/**
 * 结算事件选择。
 * - 未知 eventId → 原样返回 state
 * - 未知 choiceId → 原样返回 state
 * - 已结算过 → 原样返回 state（防重复奖励）
 */
export function resolveTutorialEventChoice(
  state: TutorialEventGameStateSlice,
  eventId: string,
  choiceId: string,
): TutorialEventGameStateSlice {
  if (!canResolveTutorialEvent(state, eventId)) {
    return state;
  }
  const event = getTutorialEventById(eventId);
  if (!event) return state;
  const choice = event.choices.find((c) => c.id === choiceId);
  if (!choice) return state;

  // 先把 eventId 写入已结算列表（避免重复）
  const resolvedIds = [...(state.resolvedTutorialEventIds || []), eventId];
  let current: TutorialEventGameStateSlice = {
    ...state,
    resolvedTutorialEventIds: resolvedIds,
  };

  for (const effect of choice.effects) {
    current = applyEffect(current, effect);
  }

  return current;
}

// ========== 初始状态（可用于 createInitialGameState 或测试） ==========
export function createInitialTutorialEventState(): TutorialEventProgressState {
  return {
    resolvedTutorialEventIds: [],
    tutorialEventFlags: [],
  };
}

// ========== 查询：某个 flag 是否存在 ==========
export function hasTutorialEventFlag(
  state: TutorialEventGameStateSlice,
  flagId: string,
): boolean {
  return (state.tutorialEventFlags || []).includes(flagId);
}

// ========== 查询：某个事件是否可结算（别名，更直观） ==========
export function isEventAvailableForResolve(
  state: TutorialEventGameStateSlice,
  eventId: string,
): boolean {
  return canResolveTutorialEvent(state, eventId);
}

// 未使用变量抑制
void (null as TutorialEvent | null);
