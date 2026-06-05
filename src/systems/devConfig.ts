// 开发/测试配置（阶段9.3.1）
// 用于控制调试快捷键等 dev-only 功能

/**
 * 判断是否启用开发作弊功能
 * 
 * 启用条件（满足任一）：
 * 1. __EMBER_DEV__ 为 true（Vite 构建时定义）
 * 2. window.__EMBER_TEST_MODE__ 为 true（自动化测试模式）
 * 
 * 正式构建/普通运行时返回 false
 */
export function isDevCheatEnabled(): boolean {
  // 自动化测试模式
  if (typeof window !== "undefined" && (window as any).__EMBER_TEST_MODE__) {
    return true;
  }

  // 构建时定义的开发标志
  try {
    if (typeof __EMBER_DEV__ !== "undefined" && __EMBER_DEV__) {
      return true;
    }
  } catch {
    // ignore
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
