/**
 * count-test-asserts.cjs
 * 统计 tests/smoke-test-*.cjs 中每个文件的 assert 调用数
 *
 * 统计口径：assert 调用数（不含函数定义、不含注释）
 * 自动扫描 tests/ 目录下所有 smoke-test-*.cjs 文件
 */

const fs = require("fs");
const path = require("path");

const TESTS_DIR = path.join(__dirname, "..", "tests");

// 自动扫描所有 smoke-test-*.cjs 文件
const TEST_FILES = fs.readdirSync(TESTS_DIR)
  .filter(f => f.startsWith("smoke-test-") && f.endsWith(".cjs"))
  .sort();

function countAssertCalls(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("/*") || trimmed.startsWith("*")) continue;
    if (/^function\s+assert\s*\(/.test(trimmed)) continue;

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
console.log(`断言统计（口径：assert 调用数，不含函数定义、不含注释）`);
console.log(`自动扫描 ${TEST_FILES.length} 个 smoke-test 文件`);
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
console.log(`  TOTAL (${results.length} tests): ${total}`);
console.log("=".repeat(60));

const sumCheck = results.reduce((s, r) => s + r.count, 0);
if (sumCheck !== total) {
  console.error(`ERROR: 逐项相加 ${sumCheck} != 总数 ${total}`);
  process.exit(1);
} else {
  console.log(`验证：逐项相加 = ${sumCheck} ✓`);
}

process.exit(0);
