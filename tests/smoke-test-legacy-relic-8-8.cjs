/**
 * smoke-test-legacy-relic-8-8.cjs
 * 阶段8.8：失败遗产系统 v1
 *
 * 验证：
 * 1. 遗产数据存在
 * 2. 纯函数 generateFailureLegacyChoices 返回 3 个候选
 * 3. LegacySelectScene 显示 3 张遗产卡
 * 4. 选择遗产后 activeLegacyRelicId 设置正确
 * 5. CargoPrepScene 应用遗产效果（银币+10 / 药材+1）
 * 6. 防止重复应用
 * 7. MapScene 显示遗产摘要
 * 8. 跳过遗产功能
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/legacy-relic");
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
  const fs = require("fs");
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

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

  console.log("阶段8.8：失败遗产系统 v1 测试");
  console.log("=".repeat(60));

  // ========== 1. window.game 存在 ==========
  console.log("1. window.game 存在");
  assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

  // ========== 2. LEGACY_RELICS 至少 3 个 ==========
  console.log("2. LEGACY_RELICS 至少 3 个");
  const relicCount = await page.evaluate(() => window.LEGACY_RELICS.length);
  assert(relicCount >= 3, `LEGACY_RELICS 数量 >= 3 (实际: ${relicCount})`);

  // ========== 3. generateFailureLegacyChoices 返回 3 个候选 ==========
  console.log("3. generateFailureLegacyChoices 返回 3 个候选");
  const choices = await page.evaluate(() => window.generateFailureLegacyChoices());
  assert(choices.length === 3, `遗产候选 = 3 (实际: ${choices.length})`);

  // ========== 4. 每个遗产 id 唯一 ==========
  console.log("4. 每个遗产 id 唯一");
  const uniqueIds = new Set(choices);
  assert(uniqueIds.size === choices.length, "遗产 id 唯一");

  // ========== 5. getLegacyRelicById 可返回遗失药箱 ==========
  console.log("5. getLegacyRelicById 可返回遗失药箱");
  const medkit = await page.evaluate(() => window.getLegacyRelicById("lost_medkit"));
  assert(!!medkit, "getLegacyRelicById('lost_medkit') 存在");
  assert(medkit.name === "遗失药箱", `name = 遗失药箱 (实际: ${medkit.name})`);
  assert(medkit.effectType === "starting_medicine", `effectType = starting_medicine`);

  // ========== 6. 进入 LegacySelectScene 后显示 3 张遗产卡 ==========
  console.log("6. LegacySelectScene 显示 3 张遗产卡");
  // 先设置 legacyChoices
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs.legacyChoices = window.generateFailureLegacyChoices();
    window.setGameState(gs);
  });
  await page.evaluate(() => { window.game.scene.start("LegacySelectScene"); });
  await sleep(2000);

  const sceneCheck = await page.evaluate(() => {
    const ls = window.game.scene.getScene("LegacySelectScene");
    if (!ls) return { ok: false, cardCount: 0, texts: [] };
    const texts = [];
    const searchChildren = (obj) => {
      if (!obj) return;
      if (obj.list && Array.isArray(obj.list)) {
        for (const child of obj.list) {
          if (child.type === "Text" && child.text) texts.push(child.text);
          searchChildren(child);
        }
      }
      if (obj.children && obj.children.list && Array.isArray(obj.children.list)) {
        for (const child of obj.children.list) {
          if (child.type === "Text" && child.text) texts.push(child.text);
          searchChildren(child);
        }
      }
    };
    searchChildren(ls);
    if (ls.children && ls.children.list) {
      for (const child of ls.children.list) searchChildren(child);
    }
    const cardCount = texts.filter(t => t === "普通" || t === "稀有").length;
    return { ok: true, cardCount, texts };
  });
  assert(sceneCheck.ok, "LegacySelectScene 场景存在");
  assert(sceneCheck.cardCount >= 3, `显示 >= 3 张遗产卡 (实际: ${sceneCheck.cardCount})`);
  assert(sceneCheck.texts.some(t => t.includes("烧焦地图")), `显示"烧焦地图"`);
  assert(sceneCheck.texts.some(t => t.includes("遗失药箱")), `显示"遗失药箱"`);
  assert(sceneCheck.texts.some(t => t.includes("断裂商旗")), `显示"断裂商旗"`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "legacy-select-scene.png") });

  // ========== 7. 选择 lost_medkit 后状态正确 ==========
  console.log("7. 选择 lost_medkit 后状态正确");
  await page.evaluate(() => {
    const ls = window.game.scene.getScene("LegacySelectScene");
    if (!ls) return;
    // 找到遗失药箱卡片并点击（通过 Container 搜索）
    const containers = ls.children.list.filter(c => c.type === "Container");
    for (const container of containers) {
      const texts = [];
      const searchTexts = (obj) => {
        if (!obj) return;
        if (obj.list && Array.isArray(obj.list)) {
          for (const child of obj.list) {
            if (child.type === "Text" && child.text) texts.push(child.text);
            searchTexts(child);
          }
        }
      };
      searchTexts(container);
      if (texts.some(t => t.includes("遗失药箱"))) {
        // 点击卡片的背景 Rectangle
        for (const child of container.list) {
          if (child.type === "Rectangle" && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
        break;
      }
    }
  });
  await sleep(1500);

  const afterSelect = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      activeLegacyRelicId: gs.activeLegacyRelicId,
      legacyChoices: gs.legacyChoices,
      usedLegacyRelicIds: gs.usedLegacyRelicIds,
      inRouteSelect: !!window.game.scene.getScene("RouteSelectScene"),
    };
  });
  assert(afterSelect.activeLegacyRelicId === "lost_medkit", `activeLegacyRelicId = lost_medkit (实际: ${afterSelect.activeLegacyRelicId})`);
  assert(afterSelect.legacyChoices.length === 0, `legacyChoices 被清空`);
  assert(afterSelect.usedLegacyRelicIds.includes("lost_medkit"), `usedLegacyRelicIds 包含 lost_medkit`);
  assert(afterSelect.inRouteSelect, "选择后进入 RouteSelectScene");

  // ========== 8. 进入下一局 CargoPrepScene 后 cargo.medicine 增加 1 ==========
  console.log("8. CargoPrepScene 应用遗产效果（药材+1）");
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

  const cargoCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      medicine: gs.cargo.medicine || 0,
      activeLegacyRelicId: gs.activeLegacyRelicId,
      appliedLegacyRelicIdForRun: gs.appliedLegacyRelicIdForRun,
    };
  });
  assert(cargoCheck.medicine >= 1, `cargo.medicine >= 1 (实际: ${cargoCheck.medicine})`);
  assert(cargoCheck.appliedLegacyRelicIdForRun === "lost_medkit", `appliedLegacyRelicIdForRun = lost_medkit`);

  // 检查 UI 显示遗产提示
  const cargoUI = await page.evaluate(() => {
    const cp = window.game.scene.getScene("CargoPrepScene");
    if (!cp) return { hasLegacyHint: false };
    const texts = cp.children.list.filter(c => c.type === "Text");
    const legacyText = texts.find(t => t.text && t.text.includes("遗产："));
    return { hasLegacyHint: !!legacyText, text: legacyText ? legacyText.text : "" };
  });
  assert(cargoUI.hasLegacyHint, `CargoPrepScene 显示遗产提示: "${cargoUI.text}"`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "cargo-prep-legacy.png") });

  // ========== 9. 重复刷新 CargoPrepScene 不会重复增加 medicine ==========
  console.log("9. 防止重复应用遗产");
  const medicineBefore = cargoCheck.medicine;

  // 模拟重新进入 CargoPrepScene（通过 scene restart）
  await page.evaluate(() => { window.game.scene.start("CargoPrepScene"); });
  await sleep(1500);

  const medicineAfter = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.cargo.medicine || 0;
  });
  assert(medicineAfter === medicineBefore, `重复进入不增加 medicine: ${medicineBefore} → ${medicineAfter}`);

  // ========== 10. 进入 MapScene 后显示遗产摘要 ==========
  console.log("10. MapScene 显示遗产摘要");
  await page.evaluate(() => {
    const scene = window.game.scene.getScene("CargoPrepScene");
    if (scene && scene.startExpedition) scene.startExpedition();
  });
  await sleep(2500);

  const mapReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(mapReady, "MapScene 就绪");

  const mapLegacy = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { hasLegacy: false };
    const texts = ms.children.list.filter(c => c.type === "Text");
    const legacyText = texts.find(t => t.text && t.text.includes("遗产："));
    return { hasLegacy: !!legacyText, text: legacyText ? legacyText.text : "" };
  });
  assert(mapLegacy.hasLegacy, `MapScene 显示遗产: "${mapLegacy.text}"`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "map-legacy-hint.png") });

  // ========== 11. 测试 broken_banner（银币+10）==========
  console.log("11. 测试 broken_banner（银币+10）");
  // 重置并选择断裂商旗
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs.activeLegacyRelicId = "broken_banner";
    gs.appliedLegacyRelicIdForRun = undefined;
    gs.cargo = {};
    gs.silver = 100;
    window.setGameState(gs);
  });
  await page.evaluate(() => { window.game.scene.start("CargoPrepScene"); });
  await sleep(1500);

  const silverCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      silver: gs.silver,
      appliedLegacyRelicIdForRun: gs.appliedLegacyRelicIdForRun,
    };
  });
  assert(silverCheck.silver === 110, `silver = 110 (实际: ${silverCheck.silver})`);
  assert(silverCheck.appliedLegacyRelicIdForRun === "broken_banner", `appliedLegacyRelicIdForRun = broken_banner`);

  // 再次进入不应重复增加
  await page.evaluate(() => { window.game.scene.start("CargoPrepScene"); });
  await sleep(1500);
  const silverAfterRepeat = await page.evaluate(() => window.getGameState().silver);
  assert(silverAfterRepeat === 110, `重复进入不增加 silver: ${silverAfterRepeat}`);

  // ========== 12. 测试 burned_map（MapScene 显示）==========
  console.log("12. 测试 burned_map（MapScene 显示）");
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs.activeLegacyRelicId = "burned_map";
    gs.appliedLegacyRelicIdForRun = undefined;
    window.setGameState(gs);
  });
  await page.evaluate(() => { window.game.scene.start("MapScene"); });
  await sleep(1500);

  const mapBurned = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { hasLegacy: false };
    const texts = ms.children.list.filter(c => c.type === "Text");
    const legacyText = texts.find(t => t.text && t.text.includes("遗产：烧焦地图"));
    return { hasLegacy: !!legacyText, text: legacyText ? legacyText.text : "" };
  });
  assert(mapBurned.hasLegacy, `MapScene 显示烧焦地图: "${mapBurned.text}"`);

  // ========== 13. 测试跳过遗产 ==========
  console.log("13. 测试跳过遗产");
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs.legacyChoices = window.generateFailureLegacyChoices();
    gs.activeLegacyRelicId = undefined;
    window.setGameState(gs);
  });
  await page.evaluate(() => { window.game.scene.start("LegacySelectScene"); });
  await sleep(2000);

  await page.evaluate(() => {
    const ls = window.game.scene.getScene("LegacySelectScene");
    if (!ls) return;
    // 点击"跳过遗产"按钮
    for (const child of ls.children.list) {
      if (child.type === "Rectangle" && child.input && child.input.enabled) {
        const textObj = ls.children.list.find(c => c.type === "Text" && c.y === child.y && c.text && c.text.includes("跳过"));
        if (textObj) {
          child.emit("pointerdown");
          break;
        }
      }
    }
  });
  await sleep(1500);

  const skipCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      activeLegacyRelicId: gs.activeLegacyRelicId,
      legacyChoices: gs.legacyChoices,
      inRouteSelect: !!window.game.scene.getScene("RouteSelectScene"),
    };
  });
  assert(!skipCheck.activeLegacyRelicId, `跳过遗产后 activeLegacyRelicId 为空`);
  assert(skipCheck.legacyChoices.length === 0, `跳过遗产后 legacyChoices 被清空`);
  assert(skipCheck.inRouteSelect, "跳过遗产后进入 RouteSelectScene");

  // ========== 总结 ==========
  console.log("=".repeat(60));
  console.log(`测试完成: ${passed} passed, ${failed} failed`);
  if (FAILED.length > 0) {
    console.error("失败项:");
    FAILED.forEach(f => console.error(`  - ${f}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
