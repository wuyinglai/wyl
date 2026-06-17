/**
 * cityRevivalSystem.ts
 * 城市复兴系统（阶段13.1）
 *
 * 设计原则：
 * - 城市不是完全靠玩家拯救，城市自己也会慢慢恢复
 * - 玩家完成订单只是让恢复更快（本条仅实现被动自建，主动加速放到 13-2）
 * - 本条只实现"城市自己慢慢恢复"的底座
 *
 * 核心概念：
 * - 每个城市有 progress（0-100）和 level（0-3）
 * - 每次"再来一局"触发被动自建，所有城市 +1 progress
 * - level 根据 progress 自动计算
 * - 状态跨局保留（不像 cargo 那样每局清空）
 */

/**
 * 城市复兴等级：0-3，对应 progress 区间
 * level 0: 0-24   — 荒废
 * level 1: 25-49  — 重建中
 * level 2: 50-74  — 发展期
 * level 3: 75-100 — 繁荣
 */
export type CityRevivalLevel = 0 | 1 | 2 | 3;

/**
 * 单个城市复兴状态
 */
export interface CityRevivalState {
  cityId: string;
  /** 复兴进度，0-100，到 100 后不再增长 */
  progress: number;
  /** 复兴等级，0-3，由 progress 自动计算 */
  level: CityRevivalLevel;
  /** 被动自建累计次数（每次"再来一局"+1） */
  passiveGrowthCount: number;
  /** 上次触发被动增长的 runId，防止同一轮重复增长 */
  lastTriggeredRunId: string | null;
}

/** 初始复兴进度（每个城市起始值） */
const INITIAL_PROGRESS: Record<string, number> = {
  city_ash_post: 20,       // 灰烬驿城：起始略高，新手城市
  city_furnace_mine: 10,   // 矿炉城：低，工矿城市
  city_medicine_spring: 10, // 药泉城：低，边远城市
};

/**
 * 根据 progress 计算复兴等级
 * level = Math.min(3, Math.floor(progress / 25))
 */
export function calculateCityRevivalLevel(progress: number): CityRevivalLevel {
  const level = Math.min(3, Math.floor(progress / 25));
  return level as CityRevivalLevel;
}

/**
 * 获取所有城市 ID 列表（与 cityRoutes.ts 保持一致）
 */
export function getAllCityIds(): string[] {
  return ["city_ash_post", "city_furnace_mine", "city_medicine_spring"];
}

/**
 * 获取城市显示名称
 */
export function getCityDisplayName(cityId: string): string {
  const names: Record<string, string> = {
    city_ash_post: "灰烬驿城",
    city_furnace_mine: "矿炉城",
    city_medicine_spring: "药泉城",
  };
  return names[cityId] || cityId;
}

/**
 * 获取城市复兴状态标签（中文）
 */
export function getCityRevivalLevelLabel(level: CityRevivalLevel): string {
  const labels: Record<CityRevivalLevel, string> = {
    0: "荒废",
    1: "重建中",
    2: "发展期",
    3: "繁荣",
  };
  return labels[level];
}

/**
 * 初始化所有城市的复兴状态（在 createInitialGameState 中调用）
 * 所有城市从初始 progress 开始
 */
export function initializeCityRevivalStates(): Record<string, CityRevivalState> {
  const states: Record<string, CityRevivalState> = {};
  for (const cityId of getAllCityIds()) {
    const progress = INITIAL_PROGRESS[cityId] ?? 10;
    states[cityId] = {
      cityId,
      progress,
      level: calculateCityRevivalLevel(progress),
      passiveGrowthCount: 0,
      lastTriggeredRunId: null,
    };
  }
  return states;
}

/**
 * 获取单个城市复兴状态
 */
export function getCityRevivalState(
  cityId: string,
  revivalStates: Record<string, CityRevivalState> | undefined,
): CityRevivalState | null {
  if (!revivalStates) return null;
  return revivalStates[cityId] || null;
}

/**
 * 获取所有城市复兴状态
 */
export function getAllCityRevivalStates(
  revivalStates: Record<string, CityRevivalState> | undefined,
): CityRevivalState[] {
  if (!revivalStates) return [];
  return getAllCityIds().map((id) => revivalStates[id]).filter(Boolean);
}

/**
 * 对所有城市应用一轮被动自建（每次"再来一局"时调用一次）
 *
 * 规则：
 * - 所有城市 progress +1（clamp 到 100）
 * - passiveGrowthCount +1
 * - lastTriggeredRunId 记录当前 runId
 * - 如果 cityId 不存在则跳过（防御性）
 *
 * @param revivalStates 当前城市复兴状态
 * @param runId 当前 runId（用于防重）
 * @returns 更新后的状态（不修改原对象）
 */
export function applyPassiveCityRevival(
  revivalStates: Record<string, CityRevivalState>,
  runId: string,
): Record<string, CityRevivalState> {
  const updated: Record<string, CityRevivalState> = {};

  for (const cityId of getAllCityIds()) {
    const existing = revivalStates[cityId];
    if (!existing) {
      // 防御性：城市不在状态中则跳过
      continue;
    }

    // 防重：同一 runId 不重复增长
    if (existing.lastTriggeredRunId === runId) {
      // 已经触发过，直接复制
      updated[cityId] = { ...existing };
      continue;
    }

    const newProgress = Math.min(100, existing.progress + 1);
    updated[cityId] = {
      cityId,
      progress: newProgress,
      level: calculateCityRevivalLevel(newProgress),
      passiveGrowthCount: existing.passiveGrowthCount + 1,
      lastTriggeredRunId: runId,
    };
  }

  return updated;
}

/**
 * 格式化城市复兴状态为短文本（用于调试 / 轻量显示）
 * 例如："灰烬驿城 Lv.0 20%"
 */
export function formatCityRevivalBrief(state: CityRevivalState): string {
  return `${getCityDisplayName(state.cityId)} Lv.${state.level} ${state.progress}%`;
}

/**
 * 获取城市复兴详情行（用于 Tooltip 或调试）
 */
export function getCityRevivalDetailLines(state: CityRevivalState): string[] {
  const lines: string[] = [];
  lines.push(`复兴进度：${state.progress}%`);
  lines.push(`复兴等级：Lv.${state.level} ${getCityRevivalLevelLabel(state.level)}`);
  lines.push(`被动自建：${state.passiveGrowthCount} 次`);
  lines.push(`当前状态：${formatCityRevivalBrief(state)}`);
  return lines;
}
