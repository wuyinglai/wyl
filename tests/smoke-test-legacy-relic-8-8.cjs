/**
 * smoke-test-legacy-relic-8-8.cjs
 * 阶段10.4：验证 legacy 遗产系统已移除
 *
 * 验证：
 * 1. legacyRelics.ts 数据文件已删除
 * 2. legacySystem.ts 系统文件已删除
 * 3. LegacySelectScene.ts 场景文件已删除
 * 4. GameState 中 legacy 字段已移除
 * 5. main.ts 中 legacy API 已移除
 * 6. CargoPrepScene 不再显示遗产提示
 * 7. MapScene 不再显示遗产摘要
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:5173";
const PROJECT_ROOT = path.join(__dirname, "..", "..");
const FAILED = [];
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
    FAILED.push(msg);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log("阶段10.4：验证 legacy 遗产系统已移除");
  console.log("=".repeat(60));

  // ========== 1. legacyRelics.ts 数据文件已删除 ==========
  console.log("1. legacyRelics.ts 数据文件已删除");
  const legacyRelicsPath = path.join(PROJECT_ROOT, "src", "data", "legacyRelics.ts");
  assert(!fs.existsSync(legacyRelicsPath), `src/data/legacyRelics.ts 已删除`);

  // ========== 2. legacySystem.ts 系统文件已删除 ==========
  console.log("2. legacySystem.ts 系统文件已删除");
  const legacySystemPath = path.join(PROJECT_ROOT, "src", "systems", "legacySystem.ts");
  assert(!fs.existsSync(legacySystemPath), `src/systems/legacySystem.ts 已删除`);

  // ========== 3. LegacySelectScene.ts 场景文件已删除 ==========
  console.log("3. LegacySelectScene.ts 场景文件已删除");
  const legacyScenePath = path.join(PROJECT_ROOT, "src", "scenes", "LegacySelectScene.ts");
  assert(!fs.existsSync(legacyScenePath), `src/scenes/LegacySelectScene.ts 已删除`);

  // ========== 4. 启动浏览器验证运行时行为 ==========
  console.log("4. 启动浏览器验证运行时行为");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  page.on("pageerror", err => {
    console.error(`[浏览器错误] ${err.message}`);
    failed++;
  });

  await page.addInitScript(() => {
    window.__EMBER_TEST_MODE__ = true;
  });
  
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

  // ========== 5. window.game 存在 ==========
  console.log("5. window.game 存在");
  assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

  // ========== 6. LegacySelectScene 不在场景配置中 ==========
  console.log("6. LegacySelectScene 不在场景配置中");
  const legacySceneInConfig = await page.evaluate(() => {
    const config = window.game.config;
    if (config && config.scene && Array.isArray(config.scene)) {
      return config.scene.includes("LegacySelectScene");
    }
    return false;
  });
  assert(!legacySceneInConfig, `LegacySelectScene 不在场景配置中`);

  // ========== 7. legacy API 已从 window 对象中移除 ==========
  console.log("7. legacy API 已从 window 对象中移除");
  const legacyApisRemoved = await page.evaluate(() => {
    return typeof window.generateFailureLegacyChoices === 'undefined' &&
           typeof window.applyLegacyRelicToGameState === 'undefined' &&
           typeof window.getLegacyRelicById === 'undefined' &&
           typeof window.LEGACY_RELICS === 'undefined';
  });
  assert(legacyApisRemoved, `遗产 API (generateFailureLegacyChoices, applyLegacyRelicToGameState, getLegacyRelicById, LEGACY_RELICS) 已从 window 对象中移除`);

  // ========== 8. GameState 中不存在 legacy 字段 ==========
  console.log("8. GameState 中不存在 legacy 字段");
  const legacyFieldsRemoved = await page.evaluate(() => {
    const gs = window.getGameState();
    return !('activeLegacyRelicId' in gs) &&
           !('appliedLegacyRelicIdForRun' in gs) &&
           !('legacyChoices' in gs) &&
           !('usedLegacyRelicIds' in gs);
  });
  assert(legacyFieldsRemoved, `GameState 中不存在 activeLegacyRelicId/appliedLegacyRelicIdForRun/legacyChoices/usedLegacyRelicIds 字段`);

  // ========== 9. 进入 CargoPrepScene 验证不显示遗产提示 ==========
  console.log("9. 进入 CargoPrepScene 验证不显示遗产提示");
  // 进入 CargoPrepScene
  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
  });
  await sleep(1000);

  // 选择 3 个角色
  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.characterCards && cs.characterCards.length >= 3) {
      for (let i = 0; i < 3; i++) {
        const card = cs.characterCards[i];
        for (const child of card.list) {
          if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
    }
  });
  await sleep(500);

  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });
  await sleep(1500);

  const cargoPrepReady = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
  assert(cargoPrepReady, "CargoPrepScene 就绪");

  // 检查 CargoPrepScene 中不显示遗产提示
  const cargoUI = await page.evaluate(() => {
    const cp = window.game.scene.getScene("CargoPrepScene");
    if (!cp) return { hasLegacyHint: false };
    const texts = cp.children.list.filter(c => c.type === "Text");
    const legacyText = texts.find(t => t.text && t.text.includes("遗产"));
    return { hasLegacyHint: !!legacyText };
  });
  assert(!cargoUI.hasLegacyHint, `CargoPrepScene 不显示遗产提示`);

  // ========== 10. 进入 MapScene 验证不显示遗产摘要 ==========
  console.log("10. 进入 MapScene 验证不显示遗产摘要");
  await page.evaluate(() => {
    const cp = window.game.scene.getScene("CargoPrepScene");
    if (cp && cp.startExpedition) cp.startExpedition();
  });
  await sleep(1500);

  const mapSceneReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(mapSceneReady, "MapScene 就绪");

  // 检查 MapScene 中不显示遗产摘要
  const mapUI = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { hasLegacyHint: false };
    const texts = ms.children.list.filter(c => c.type === "Text");
    const legacyText = texts.find(t => t.text && t.text.includes("遗产"));
    return { hasLegacyHint: !!legacyText };
  });
  assert(!mapUI.hasLegacyHint, `MapScene 不显示遗产摘要`);

  // ========== 11. 主菜单重置后不保留 legacy 状态 ==========
  console.log("11. 主菜单重置后验证状态");
  await page.evaluate(() => {
    const mm = window.game.scene.getScene("MainMenuScene");
    if (mm && mm.resetGameStateForNewRun) mm.resetGameStateForNewRun();
  });
  await sleep(500);

  const afterReset = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      hasLegacyField: 'activeLegacyRelicId' in gs || 'appliedLegacyRelicIdForRun' in gs || 'legacyChoices' in gs,
      selectedOrderId: gs.selectedOrderId,
      silver: gs.silver,
    };
  });
  assert(!afterReset.hasLegacyField, `主菜单重置后 GameState 不包含 legacy 字段`);
  assert(afterReset.selectedOrderId === null, `主菜单重置后 selectedOrderId=null`);
  assert(afterReset.silver === 50, `主菜单重置后 silver=50`);

  // ========== 12. 尝试进入 LegacySelectScene 应失败 ==========
  console.log("12. 尝试进入 LegacySelectScene 应失败");
  await page.evaluate(() => {
    try {
      window.game.scene.start("LegacySelectScene");
    } catch (e) {
      // 预期失败
    }
  });
  await sleep(500);

  const legacySceneStarted = await page.evaluate(() => {
    // LegacySelectScene 不会启动，检查当前场景
    const currentScene = window.game.scene.getScene("LegacySelectScene");
    return !!currentScene;
  });
  assert(!legacySceneStarted, `无法进入 LegacySelectScene（场景已删除）`);

  // 清理
  await browser.close();

  // ========== 输出结果 ==========
  console.log("=".repeat(60));
  if (failed > 0) {
    console.error(`\n❌ 测试失败: ${passed} 通过, ${failed} 失败`);
    console.error("失败项:");
    FAILED.forEach((msg, i) => console.error(`  ${i + 1}. ${msg}`));
    process.exit(1);
  } else {
    console.log(`\n✅ 测试通过: ${passed} 通过, ${failed} 失败`);
    console.log("\n验证完成：legacy 遗产系统已成功移除");
    process.exit(0);
  }
})();
