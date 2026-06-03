/**
 * count-test-asserts.cjs
 * 统计 tests/*.cjs 中每个文件的 assert 调用数
 *
 * 统计口径：assert 调用数（不含函数定义、不含注释）
 * 匹配规则：
 *   - 行以 assert( 开头（允许前导空白）
 *   - 或行内包含 assert( 但不在注释中（// 或 /*）
 *   - 排除 function assert(...) 定义行
 */

const fs = require("fs");
const path = require("path");

const TESTS_DIR = path.join(__dirname, "..", "tests");

// 20 个测试文件（按运行顺序）
const TEST_FILES = [
  "smoke-test-reward-6-3.cjs",
  "smoke-test-reward-skip-6-4.cjs",
  "smoke-test-map-node-clear-6-5.cjs",
  "smoke-test-route-select-7-1.cjs",
  "smoke-test-route-select-edge-7-1.cjs",
  "smoke-test-city-order-7-2.cjs",
  "smoke-test-city-order-edge-7-2.cjs",
  "smoke-test-goods-8-1.cjs",
  "smoke-test-cargo-state-8-2.cjs",
  "smoke-test-ui-overlap-and-camp-8-hotfix.cjs",
  "smoke-test-ui-overlap-tooltip-hotfix.cjs",
  "smoke-test-ui-overlap-tooltip-realflow.cjs",
  "smoke-test-order-cargo-8-3.cjs",
  "smoke-test-order-delivery-8-4.cjs",
  "smoke-test-order-delivery-real-goal-8-4-1.cjs",
  "smoke-test-cargo-prep-8-5.cjs",
  "smoke-test-city-progress-8-6.cjs",
  "smoke-test-expedition-result-8-7.cjs",
  "smoke-test-legacy-relic-8-8.cjs",
  "smoke-test-retreat-legacy-8-9.cjs",
];

function countAssertCalls(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let count = 0;

  for (const line of lines) {
    // 去除行首空白
    const trimmed = line.trim();

    // 跳过空行
    if (!trimmed) continue;

    // 跳过纯注释行（// 开头）
    if (trimmed.startsWith("//")) continue;

    // 跳过块注释行（/* 开头或 * 开头在块注释中）
    if (trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;

    // 跳过函数定义行：function assert(...)
    if (/^function\s+assert\s*\(/.test(trimmed)) continue;

    // 检查是否包含 assert( 调用
    // 排除行内注释中的 assert(
    let codePart = trimmed;
    const inlineCommentIdx = trimmed.indexOf("//");
    if (inlineCommentIdx >= 0) {
      codePart = trimmed.substring(0, inlineCommentIdx);
    }

    if (codePart.includes("assert(")) {
      count++;
    }
  }

  return count;
}

console.log("=".repeat(60));
console.log("断言统计（口径：assert 调用数，不含函数定义、不含注释）");
console.log("=".repeat(60));

let total = 0;
const results = [];

for (const fileName of TEST_FILES) {
  const filePath = path.join(TESTS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`  ${fileName}: 文件不存在`);
    continue;
  }
  const count = countAssertCalls(filePath);
  total += count;
  results.push({ fileName, count });
  console.log(`  ${fileName}: ${count}`);
}

console.log("-".repeat(60));
console.log(`  TOTAL (20 tests): ${total}`);
console.log("=".repeat(60));

// 验证：逐项相加
const sumCheck = results.reduce((s, r) => s + r.count, 0);
if (sumCheck !== total) {
  console.error(`ERROR: 逐项相加 ${sumCheck} != 总数 ${total}`);
  process.exit(1);
} else {
  console.log(`验证：逐项相加 = ${sumCheck} ✓`);
}

process.exit(0);
