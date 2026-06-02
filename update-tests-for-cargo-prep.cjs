/**
 * 批量更新测试文件以支持 CargoPrepScene
 */
const fs = require('fs');
const path = require('path');

const testDir = path.join(__dirname, 'tests');

const filesToUpdate = [
  'smoke-test-order-cargo-8-3.cjs',
  'smoke-test-cargo-state-8-2.cjs',
  'smoke-test-ui-overlap-tooltip-realflow.cjs',
  'smoke-test-ui-overlap-tooltip-hotfix.cjs',
  'smoke-test-ui-overlap-and-camp-8-hotfix.cjs',
  'smoke-test-city-order-edge-7-2.cjs',
  'smoke-test-city-order-7-2.cjs',
  'smoke-test-route-select-edge-7-1.cjs',
  'smoke-test-route-select-7-1.cjs',
  'smoke-test-reward-skip-6-4.cjs',
  'smoke-test-reward-6-3.cjs',
  'smoke-test-map-node-clear-6-5.cjs',
];

const oldPattern = `await sleep(500);
  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });
  await sleep(3000);`;

const newPattern = `await sleep(500);
  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });
  await sleep(2000);

  // 阶段8.5：经过 CargoPrepScene
  const cargoPrepReady = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
  assert(cargoPrepReady, "CargoPrepScene 就绪");

  // 点击开始远征
  await page.evaluate(() => {
    const scene = window.game.scene.getScene("CargoPrepScene");
    if (scene && scene.startExpedition) scene.startExpedition();
  });
  await sleep(3000);`;

let updatedCount = 0;

for (const filename of filesToUpdate) {
  const filepath = path.join(testDir, filename);
  if (!fs.existsSync(filepath)) {
    console.log(`Skip: ${filename} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filepath, 'utf-8');

  // 检查是否包含需要替换的模式
  if (content.includes(oldPattern)) {
    content = content.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`Updated: ${filename}`);
    updatedCount++;
  } else {
    console.log(`Skip: ${filename} (pattern not found)`);
  }
}

console.log(`\nTotal updated: ${updatedCount}`);
