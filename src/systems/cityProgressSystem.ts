/**
 * cityProgressSystem.ts
 * 城市贡献与城市状态系统（阶段8.6）
 *
 * 根据 cityContributions 计算城市当前状态
 */

export type CityStatus = "lost" | "contacted" | "recovering" | "stable";

export interface CityProgress {
  cityId: string;
  contribution: number;
  status: CityStatus;
  statusLabel: string;
  nextThreshold: number | null;
}

/**
 * 阈值定义
 */
const THRESHOLDS = [
  { min: 0, max: 1, status: "lost" as CityStatus, label: "失联", next: 1 },
  { min: 1, max: 3, status: "contacted" as CityStatus, label: "已联络", next: 3 },
  { min: 3, max: 6, status: "recovering" as CityStatus, label: "恢复中", next: 6 },
  { min: 6, max: Infinity, status: "stable" as CityStatus, label: "稳定据点", next: null },
];

/**
 * 获取城市进度信息
 */
export function getCityProgress(
  cityId: string,
  cityContributions: Record<string, number> | undefined
): CityProgress {
  const contributions = cityContributions || {};
  const contribution = contributions[cityId] || 0;

  const threshold = THRESHOLDS.find(t => contribution >= t.min && contribution < t.max)
    || THRESHOLDS[THRESHOLDS.length - 1];

  return {
    cityId,
    contribution,
    status: threshold.status,
    statusLabel: threshold.label,
    nextThreshold: threshold.next,
  };
}

/**
 * 获取城市状态标签
 */
export function getCityStatusLabel(
  cityId: string,
  cityContributions: Record<string, number> | undefined
): string {
  return getCityProgress(cityId, cityContributions).statusLabel;
}

/**
 * 格式化城市进度为短文本（用于信息面板）
 */
export function formatCityProgress(
  cityId: string,
  cityContributions: Record<string, number> | undefined
): string {
  const progress = getCityProgress(cityId, cityContributions);
  if (progress.status === "stable") {
    return `城市状态：${progress.statusLabel}`;
  }
  return `城市状态：${progress.statusLabel}（${progress.contribution}/${progress.nextThreshold}）`;
}

/**
 * 获取城市进度详情行（用于 Tooltip）
 */
export function getCityProgressDetailLines(
  cityId: string,
  cityContributions: Record<string, number> | undefined
): string[] {
  const progress = getCityProgress(cityId, cityContributions);
  const lines: string[] = [];
  lines.push(`城市贡献：${progress.contribution}`);
  lines.push(`当前状态：${progress.statusLabel}`);
  if (progress.nextThreshold !== null) {
    lines.push(`下一阶段：${THRESHOLDS.find(t => t.min === progress.nextThreshold)?.label || "未知"}`);
    lines.push(`还需贡献：${progress.nextThreshold - progress.contribution}`);
  }
  return lines;
}
