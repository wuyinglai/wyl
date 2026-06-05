const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 扫描 tests/ 目录下的 smoke-test-*.cjs，排除 archive 和 production
const testsDir = path.join(__dirname, 'tests');
const testFiles = [];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // 跳过 archive 和 production 目录
      if (entry.name === 'archive' || entry.name === 'production') continue;
      scanDir(fullPath);
    } else if (entry.name.startsWith('smoke-test-') && entry.name.endsWith('.cjs')) {
      testFiles.push(fullPath);
    }
  }
}

scanDir(testsDir);

// 按文件名排序
testFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

console.log('========================================');
console.log(`找到 ${testFiles.length} 个 smoke-test`);
console.log('========================================\n');

let passed = 0;
let failed = 0;

for (const testFile of testFiles) {
  const testName = path.basename(testFile);
  console.log(`[${passed + failed + 1}/${testFiles.length}] 运行: ${testName}`);
  
  const result = spawnSync('node', [testFile], {
    cwd: __dirname,
    stdio: 'inherit',
  });
  
  if (result.status === 0) {
    console.log(`✅ ${testName} 通过\n`);
    passed++;
  } else {
    console.log(`❌ ${testName} 失败 (exit code: ${result.status})\n`);
    failed++;
  }
}

console.log('========================================');
console.log(`结果: ${passed}/${testFiles.length} 通过, ${failed} 失败`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
