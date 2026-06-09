/**
 * 阶段8 8.2 Tooltip UI重叠热修复冒烟测试（真实用户流程版）
 *
 * 原则：
 *  - 不直接调用 scene.start / selectRoute / startExpedition
 *  - 不直接修改 gameState
 *  - 全部使用 clickGamePoint 做真实点击
 *  - 信息文本兼容 _infoPanelTexts
 */

const { chromium } = require("playwright");
const {
  startRealExpeditionToMap,
  hasInfoTextInMapSceneChildren,
  sleep,
} = require("./_real_helpers.cjs");

let passCount = 0;
let failCount = 0;
function mark(pass, msg) {
  if (pass) {
    passCount++;
    console.log("  [PASS] " + msg);
  } else {
    failCount++;
    console.log("  [FAIL] " + msg);
  }
}

async function run() {
  console.log("========================================");
  console.log("Tooltip UI重叠热修复冒烟测试（真实点击版）");
  console.log("========================================");

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    console.log("\n[1] 打开游戏...");
    await page.goto("http://localhost:5173/");
    await page.waitForFunction(() => window.game && window.game.scene);
    console.log("  ✓ window.game 存在");

    console.log("\n[2] 真实用户流程进入 MapScene...");
    const { mapReady, diag } = await startRealExpeditionToMap(page);
    console.log("  activeScenes: " + JSON.stringify(diag.activeScenes));
    console.log("  selectedCharacters: " + diag.selectedCharacters);
    console.log("  currentPosition: " + JSON.stringify(diag.currentPosition));
    mark(mapReady && mapReady.isActive === true, "MapScene active");
    mark(diag.selectedCharacters >= 3, "selectedCharacters >= 3");

    console.log("\n[3] MapScene 信息面板兼容 _infoPanelTexts...");
    const info = await hasInfoTextInMapSceneChildren(page);
    console.log("  hasInfoText: " + info.ok + ", hasGraphics: " + info.hasGraphics + ", _infoPanelTexts: " + info.infoPanelTextsCount);
    console.log("  matches: " + JSON.stringify(info.matches || []));
    mark(info.ok === true, "MapScene 有信息文本（目标/订单）");
    mark(info.hasGraphics === true, "MapScene 有 Graphics 背景框");

    console.log("\n[4] MapScene 没有弹窗覆盖交互...");
    const noModal = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      return !ms.modalContainer;
    });
    mark(noModal === true, "MapScene 无 modalContainer");

    console.log("\n[5] MapScene children 不为空...");
    const childrenCount = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return 0;
      return ms.children.getAll ? ms.children.getAll().length : ms.children.list.length;
    });
    console.log("  children count: " + childrenCount);
    mark(childrenCount > 20, "MapScene children > 20");

    console.log("\n========================================");
    console.log("测试完成: " + passCount + " 通过, " + failCount + " 失败");
    console.log("========================================");

    await browser.close();
    return failCount === 0;
  } catch (err) {
    console.log("\n===== 测试失败 =====");
    console.log(err);
    try { await browser.close(); } catch (e) {}
    return false;
  }
}

run().then((ok) => {
  process.exit(ok ? 0 : 1);
}).catch((e) => { console.error(e); process.exit(1); });
