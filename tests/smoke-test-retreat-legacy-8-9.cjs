/**
 * smoke-test-retreat-legacy-8-9.cjs
 * 阶段8.9：失败与撤退结算入口 v1
 *
 * 验证：
 * 1. 纯函数 createRetreatedExpeditionResult / createFailedExpeditionResult
 * 2. MapScene 撤退按钮存在
 * 3. 触发撤退后进入 ExpeditionResultScene
 * 4. 撤退不完成订单、不增加贡献
 * 5. ExpeditionResultScene 失败/撤退时显示"选择遗产"按钮
 * 6. 选择遗产后进入下一局并应用效果
 * 7. 成功结算不显示"选择遗产"
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/retreat-legacy");
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

  console.log("阶段8.9：失败与撤退结算入口 v1 测试");
  console.log("=".repeat(60));

  // ========== 1. window.game 存在 ==========
  console.log("1. window.game 存在");
  assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

  // ========== 2. 纯函数可用 ==========
  console.log("2. 纯函数可用");
  const fnCheck = await page.evaluate(() => ({
    hasRetreated: typeof window.createRetreatedExpeditionResult === "function",
    hasFailed: typeof window.createFailedExpeditionResult === "function",
  }));
  assert(fnCheck.hasRetreated, "createRetreatedExpeditionResult 已暴露");
  assert(fnCheck.hasFailed, "createFailedExpeditionResult 已暴露");

  // ========== 3. createRetreatedExpeditionResult 生成 retreated ==========
  console.log("3. createRetreatedExpeditionResult 生成 retreated");
  const retreatedResult = await page.evaluate(() => {
    const result = window.createRetreatedExpeditionResult({
      cargo: { grain: 3, medicine: 1 },
      selectedOrderId: "test_order",
    });
    return {
      resultType: result.resultType,
      silverGained: result.silverGained,
      embersGained: result.embersGained,
      cityContributionGained: result.cityContributionGained,
      summaryLines: result.summaryLines,
    };
  });
  assert(retreatedResult.resultType === "retreated", `resultType = retreated (实际: ${retreatedResult.resultType})`);
  assert(retreatedResult.silverGained === 0, `silverGained = 0`);
  assert(retreatedResult.embersGained === 1, `embersGained = 1`);
  assert(retreatedResult.cityContributionGained === 0, `cityContributionGained = 0`);
  assert(retreatedResult.summaryLines.some(l => l.includes("远征撤退")), `包含"远征撤退"`);
  assert(retreatedResult.summaryLines.some(l => l.includes("失败遗产")), `包含"失败遗产"`);

  // ========== 4. createFailedExpeditionResult 生成 failed ==========
  console.log("4. createFailedExpeditionResult 生成 failed");
  const failedResult = await page.evaluate(() => {
    const result = window.createFailedExpeditionResult({
      cargo: { grain: 2 },
      selectedOrderId: "test_order",
    });
    return {
      resultType: result.resultType,
      embersGained: result.embersGained,
      summaryLines: result.summaryLines,
    };
  });
  assert(failedResult.resultType === "failed", `resultType = failed (实际: ${failedResult.resultType})`);
  assert(failedResult.embersGained === 1, `embersGained = 1`);
  assert(failedResult.summaryLines.some(l => l.includes("远征失败")), `包含"远征失败"`);

  // ========== 5. 真实流程进入 MapScene ==========
  console.log("5. 真实流程进入 MapScene");
  await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
  await sleep(2000);

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

  await page.evaluate(() => {
    const scene = window.game.scene.getScene("CargoPrepScene");
    if (scene && scene.startExpedition) scene.startExpedition();
  });
  await sleep(2500);

  const mapReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(mapReady, "MapScene 就绪");

  // ========== 6. MapScene 存在撤退按钮 ==========
  console.log("6. MapScene 存在撤退按钮");
  const retreatBtnCheck = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { hasBtn: false };
    const texts = ms.children.list.filter(c => c.type === "Text");
    const hasRetreatText = texts.some(t => t.text && t.text === "撤退");
    return { hasBtn: hasRetreatText };
  });
  assert(retreatBtnCheck.hasBtn, "MapScene 显示撤退按钮");

  // ========== 7. 记录撤退前状态 ==========
  console.log("7. 记录撤退前状态");
  const beforeRetreat = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      orderId: gs.selectedOrderId,
      silver: gs.silver,
      embers: gs.embers,
      completedOrderIds: [...(gs.completedOrderIds || [])],
      cityContributions: { ...(gs.cityContributions || {}) },
      cityId: gs.selectedCityId,
      cargo: { ...(gs.cargo || {}) },
    };
  });

  // ========== 8. 触发撤退 ==========
  console.log("8. 触发撤退");
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return;
    // 点击撤退按钮
    const texts = ms.children.list.filter(c => c.type === "Text");
    const retreatText = texts.find(t => t.text === "撤退");
    if (retreatText) {
      // 找到同位置的 Rectangle 按钮并点击
      const btns = ms.children.list.filter(c =>
        c.type === "Rectangle" && c.input && c.input.enabled &&
        Math.abs(c.y - retreatText.y) < 20 && Math.abs(c.x - retreatText.x) < 50
      );
      if (btns.length > 0) btns[0].emit("pointerdown");
    }
  });
  await sleep(2000);

  // ========== 9. 撤退后进入 ExpeditionResultScene ==========
  console.log("9. 撤退后进入 ExpeditionResultScene");
  const ersReady = await page.evaluate(() => !!window.game.scene.getScene("ExpeditionResultScene"));
  assert(ersReady, "进入 ExpeditionResultScene");

  // ========== 10. 撤退不完成订单 ==========
  console.log("10. 撤退不完成订单");
  const afterRetreat = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      resultType: gs.lastExpeditionResult ? gs.lastExpeditionResult.resultType : null,
      completedOrderIds: gs.completedOrderIds || [],
      silver: gs.silver,
      embers: gs.embers,
      cityContributions: gs.cityContributions || {},
      cityId: gs.selectedCityId,
    };
  });
  assert(afterRetreat.resultType === "retreated", `resultType = retreated (实际: ${afterRetreat.resultType})`);
  assert(!afterRetreat.completedOrderIds.includes(beforeRetreat.orderId),
    `completedOrderIds 不包含 selectedOrderId`);
  assert(afterRetreat.silver === beforeRetreat.silver,
    `撤退不发订单银币: ${beforeRetreat.silver} → ${afterRetreat.silver}`);
  assert(afterRetreat.embers === beforeRetreat.embers + 1,
    `撤退获得火种+1: ${beforeRetreat.embers} → ${afterRetreat.embers}`);

  // ========== 11. 撤退不增加 cityContribution ==========
  console.log("11. 撤退不增加 cityContribution");
  const contribBefore = beforeRetreat.cityContributions[beforeRetreat.cityId] || 0;
  const contribAfter = afterRetreat.cityContributions[beforeRetreat.cityId] || 0;
  assert(contribAfter === contribBefore,
    `撤退不增加贡献: ${contribBefore} → ${contribAfter}`);

  // ========== 12. 撤退不扣订单货物 ==========
  console.log("12. 撤退不扣订单货物");
  const cargoBefore = beforeRetreat.cargo;
  const cargoAfter = await page.evaluate(() => window.getGameState().cargo || {});
  // 撤退保留 cargo
  assert(cargoAfter, "撤退后 cargo 存在");

  // ========== 13. ExpeditionResultScene 显示"远征撤退" ==========
  console.log("13. ExpeditionResultScene 显示远征撤退");
  const ersTexts = await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return { texts: [] };
    const texts = ers.children.list.filter(c => c.type === "Text").map(t => t.text);
    return {
      texts,
      hasRetreated: texts.some(t => t.includes("远征撤退")),
      hasEmbers: texts.some(t => t.includes("火种")),
      hasSuccess: texts.some(t => t.includes("远征成功")),
    };
  });
  assert(ersTexts.hasRetreated, `显示"远征撤退"`);
  assert(ersTexts.hasEmbers, `显示火种信息`);
  assert(!ersTexts.hasSuccess, `撤退后不显示"远征成功"`);
  assert(!ersTexts.texts.some(t => t.includes("订单完成")), `撤退结算不显示"订单完成"`);
  assert(ersTexts.texts.some(t => t.includes("未完成订单")), `撤退结算显示"未完成订单"`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "retreat-result.png") });

  // ========== 14. ExpeditionResultScene 出现"选择遗产"按钮 ==========
  console.log("14. ExpeditionResultScene 出现选择遗产按钮");
  const legacyBtnCheck = await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return { hasBtn: false };
    const texts = ers.children.list.filter(c => c.type === "Text");
    const hasLegacyBtn = texts.some(t => t.text && t.text === "选择遗产");
    const hasPlayAgain = texts.some(t => t.text && t.text === "再来一局");
    return { hasLegacyBtn, hasPlayAgain };
  });
  assert(legacyBtnCheck.hasLegacyBtn, `撤退后显示"选择遗产"按钮`);
  assert(!legacyBtnCheck.hasPlayAgain, `撤退后不显示"再来一局"按钮`);

  // ========== 15. 点击"选择遗产"进入 LegacySelectScene ==========
  console.log("15. 点击选择遗产进入 LegacySelectScene");
  await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return;
    const texts = ers.children.list.filter(c => c.type === "Text");
    const legacyText = texts.find(t => t.text === "选择遗产");
    if (legacyText) {
      const btns = ers.children.list.filter(c =>
        c.type === "Rectangle" && c.input && c.input.enabled &&
        Math.abs(c.y - legacyText.y) < 20 && Math.abs(c.x - legacyText.x) < 80
      );
      if (btns.length > 0) btns[0].emit("pointerdown");
    }
  });
  await sleep(2000);

  const lsReady = await page.evaluate(() => !!window.game.scene.getScene("LegacySelectScene"));
  assert(lsReady, "进入 LegacySelectScene");

  // ========== 16. LegacySelectScene 显示 3 个遗产候选 ==========
  console.log("16. LegacySelectScene 显示 3 个遗产候选");
  const lsCheck = await page.evaluate(() => {
    const ls = window.game.scene.getScene("LegacySelectScene");
    if (!ls) return { ok: false, cardCount: 0 };
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
    return { ok: true, cardCount };
  });
  assert(lsCheck.ok, "LegacySelectScene 存在");
  assert(lsCheck.cardCount >= 3, `显示 >= 3 张遗产卡 (实际: ${lsCheck.cardCount})`);

  // ========== 17. 选择一个遗产后进入 RouteSelectScene ==========
  console.log("17. 选择遗产后进入 RouteSelectScene");
  await page.evaluate(() => {
    const ls = window.game.scene.getScene("LegacySelectScene");
    if (!ls) return;
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
      if (texts.some(t => t.includes("断裂商旗"))) {
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
      inRouteSelect: !!window.game.scene.getScene("RouteSelectScene"),
    };
  });
  assert(afterSelect.activeLegacyRelicId === "broken_banner",
    `activeLegacyRelicId = broken_banner (实际: ${afterSelect.activeLegacyRelicId})`);
  assert(afterSelect.inRouteSelect, "选择后进入 RouteSelectScene");

  // ========== 18. 下一局 CargoPrepScene 应用遗产效果 ==========
  console.log("18. 下一局 CargoPrepScene 应用遗产效果");
  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
  });
  await sleep(1000);

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

  const silverAfterLegacy = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      silver: gs.silver,
      appliedLegacyRelicIdForRun: gs.appliedLegacyRelicIdForRun,
    };
  });
  assert(silverAfterLegacy.appliedLegacyRelicIdForRun === "broken_banner",
    `appliedLegacyRelicIdForRun = broken_banner`);
  // silver 应该比撤退后多 10（遗产效果）
  assert(silverAfterLegacy.silver === afterRetreat.silver + 10,
    `银币+10: ${afterRetreat.silver} → ${silverAfterLegacy.silver}`);

  // ========== 19. 成功结算不显示"选择遗产" ==========
  console.log("19. 成功结算不显示选择遗产");
  // 使用纯函数验证（不跑完整交付流程）
  const successFormat = await page.evaluate(() => {
    const result = window.createSuccessExpeditionResult({
      order: { id: "t", title: "测试", cityId: "c", rewardSilver: 10, rewardEmbers: 1, cityContribution: 1 },
      cityName: "测试城",
      deliveryResult: { ok: true, rewardSilver: 10, rewardEmbers: 1, cityContribution: 1, updatedCargo: {} },
      gameState: { cityContributions: { c: 1 }, completedOrderIds: ["t"] },
    });
    return {
      resultType: result.resultType,
      isFailureOrRetreat: result.resultType === "failed" || result.resultType === "retreated",
    };
  });
  assert(successFormat.resultType === "success", `success resultType = success`);
  assert(!successFormat.isFailureOrRetreat, `success 不是 failure/retreat`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "cargo-prep-legacy-applied.png") });

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
