// 开发/测试配置（阶段6.6）
// 用于控制调试快捷键等 dev-only 功能

/**
 * 判断是否启用开发作弊功能
 * 
 * 启用条件（满足任一）：
 * 1. import.meta.env.DEV 为 true（Vite 开发模式）
 * 2. window.__EMBER_TEST_MODE__ 为 true（自动化测试模式）
 * 
 * 正式构建/普通运行时返回 false
 */
export function isDevCheatEnabled(): boolean {
  // Vite 开发模式（使用类型断言避免 TS 错误）
  try {
    const meta = import.meta as any;
    if (meta && meta.env && meta.env.DEV) {
      return true;
    }
  } catch {
    // ignore
  }
  // 自动化测试模式
  if (typeof window !== "undefined" && (window as any).__EMBER_TEST_MODE__) {
    return true;
  }
  return false;
}

/**
 * 设置测试模式（供自动化测试调用）
 */
export function setTestMode(enabled: boolean): void {
  if (typeof window !== "undefined") {
    (window as any).__EMBER_TEST_MODE__ = enabled;
  }
}
