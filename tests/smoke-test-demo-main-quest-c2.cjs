/**
 * smoke-test-demo-main-quest-c2.cjs
 * C2：灰桥镇开局与余烬核心主线状态 - 冒烟测试
 *
 * 验证：
 * 1. 初始 emberCoreStatus = carried_by_caravan
 * 2. 初始 demoMainQuestStage = go_to_first_outpost
 * 3. activeMainQuestOrderId = main_deliver_ember_core_to_daan
 * 4. 当前主线目标文本包含"第一个驿站"
 * 5. 主线订单最终目标指向大安（daan）
 * 6. isEmberCoreCarried 返回 true
 * 7. isMainQuestTargetNode("first_outpost") 在当前阶段返回 true
 * 8. isMainQuestTargetNode("daan") 在当前阶段作为最终目标识别
 * 9. advanceDemoMainQuestStage 能推进到 go_to_daan
 * 10. setEmberCoreStatus 能修改状态
 * 11. resetGameState 后 Demo 主线状态保留
 * 12. 不影响 C1 Demo 地图状态
 * 13. 不影响 cityRevivalStates
 * 14. 不影响工具系统
 * 15. 不影响 CargoPrep 关键流程
 */

const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", err => {
    console.error(`[浏览器错误] ${err.message}`);
    failed++;
  });

  try {
    console.log("\n========== C2：Demo 主线状态冒烟测试 ==========\n");

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await sleep(2000);
    console.log("[1] 页面加载完成");

    // ============================================================
    // 1. 初始 emberCoreStatus = carried_by_caravan
    // ============================================================
    console.log("\n[2] 验证初始状态...");
    const state = await page.evaluate(() => {
      const s = window.getGameState();
      return {
        emberCoreStatus: s.emberCoreStatus,
        demoMainQuestStage: s.demoMainQuestStage,
        activeMainQuestOrderId: s.activeMainQuestOrderId,
        completedMainQuestOrderIds: s.completedMainQuestOrderIds,
        // C1 验证
        currentDemoWorldNodeId: s.currentDemoWorldNodeId,
        unlockedDemoWorldNodeIds: s.unlockedDemoWorldNodeIds,
        unlockedDemoWorldRouteIds: s.unlockedDemoWorldRouteIds,
      };
    });

    assert(
      state.emberCoreStatus === "carried_by_caravan",
      `初始 emberCoreStatus = "${state.emberCoreStatus}"（期望 "carried_by_caravan"）`,
    );

    // ============================================================
    // 2. 初始 demoMainQuestStage = go_to_first_outpost
    // ============================================================
    assert(
      state.demoMainQuestStage === "go_to_first_outpost",
      `初始 demoMainQuestStage = "${state.demoMainQuestStage}"（期望 "go_to_first_outpost"）`,
    );

    // ============================================================
    // 3. activeMainQuestOrderId = main_deliver_ember_core_to_daan
    // ============================================================
    assert(
      state.activeMainQuestOrderId === "main_deliver_ember_core_to_daan",
      `activeMainQuestOrderId = "${state.activeMainQuestOrderId}"（期望 "main_deliver_ember_core_to_daan"）`,
    );

    // ============================================================
    // 4. 当前主线目标文本包含"第一个驿站"
    // ============================================================
    console.log("\n[3] 验证主线目标文本...");
    const objective = await page.evaluate((s) => {
      return window.getCurrentMainQuestObjective(s);
    }, state);
    assert(
      objective.includes("第一个驿站"),
      `主线目标文本 = "${objective}"（需包含"第一个驿站"）`,
    );

    // ============================================================
    // 5. 主线订单最终目标指向大安（daan）
    // ============================================================
    const orderData = await page.evaluate(() => {
      return window.getCurrentMainQuestOrder();
    });
    assert(
      orderData.targetNodeId === "daan",
      `主线订单最终目标 = "${orderData.targetNodeId}"（期望 "daan"）`,
    );
    assert(
      orderData.currentStepTargetNodeId === "first_outpost",
      `主线订单当前步骤目标 = "${orderData.currentStepTargetNodeId}"（期望 "first_outpost"）`,
    );

    // ============================================================
    // 6. isEmberCoreCarried 返回 true
    // ============================================================
    const carried = await page.evaluate((s) => {
      return window.isEmberCoreCarried(s);
    }, state);
    assert(carried === true, `isEmberCoreCarried 返回 ${carried}（期望 true）`);

    // ============================================================
    // 7. isMainQuestTargetNode("first_outpost") 返回 true
    // ============================================================
    const isFirstOutpostTarget = await page.evaluate((s) => {
      return window.isMainQuestTargetNode(s, "first_outpost");
    }, state);
    assert(
      isFirstOutpostTarget === true,
      `isMainQuestTargetNode("first_outpost") = ${isFirstOutpostTarget}（期望 true）`,
    );

    // ============================================================
    // 8. isMainQuestTargetNode("daan") 也是 true（最终目标）
    // ============================================================
    const isDaanTarget = await page.evaluate((s) => {
      return window.isMainQuestTargetNode(s, "daan");
    }, state);
    assert(
      isDaanTarget === true,
      `isMainQuestTargetNode("daan") = ${isDaanTarget}（期望 true，作为最终目标）`,
    );

    // 其他节点应返回 false
    const isGreybridgeTarget = await page.evaluate((s) => {
      return window.isMainQuestTargetNode(s, "greybridge");
    }, state);
    assert(
      isGreybridgeTarget === false,
      `isMainQuestTargetNode("greybridge") = ${isGreybridgeTarget}（期望 false）`,
    );

    // ============================================================
    // 9. advanceDemoMainQuestStage 能推进到 go_to_daan
    // ============================================================
    console.log("\n[4] 验证阶段推进...");
    const advancedState = await page.evaluate((s) => {
      return window.advanceDemoMainQuestStage(s, "go_to_daan");
    }, state);
    assert(
      advancedState.demoMainQuestStage === "go_to_daan",
      `advance 后 stage = "${advancedState.demoMainQuestStage}"（期望 "go_to_daan"）`,
    );

    // ============================================================
    // 10. setEmberCoreStatus 能修改状态
    // ============================================================
    const emberUpdatedState = await page.evaluate((s) => {
      return window.setEmberCoreStatus(s, "delivered_to_daan");
    }, state);
    assert(
      emberUpdatedState.emberCoreStatus === "delivered_to_daan",
      `setEmberCoreStatus 后 = "${emberUpdatedState.emberCoreStatus}"（期望 "delivered_to_daan"）`,
    );

    // ============================================================
    // 11. resetGameState 保留 Demo 主线状态
    // ============================================================
    console.log("\n[5] 验证 resetGameState 保留主线状态...");
    const preserved = await page.evaluate(() => {
      // 先手动设置一个已知状态
      const s1 = window.getGameState();
      const updated = window.advanceDemoMainQuestStage(s1, "go_to_daan");
      const update2 = window.setEmberCoreStatus(updated, "delivered_to_daan");

      // 设置到全局
      window.setGameState({
        ...s1,
        demoMainQuestStage: update2.demoMainQuestStage,
        emberCoreStatus: update2.emberCoreStatus,
        completedMainQuestOrderIds: ["main_deliver_ember_core_to_daan"],
      });

      // 触发 reset
      window.resetGameState();

      const s2 = window.getGameState();
      return {
        demoMainQuestStage: s2.demoMainQuestStage,
        emberCoreStatus: s2.emberCoreStatus,
        completedMainQuestOrderIds: s2.completedMainQuestOrderIds,
      };
    });

    assert(
      preserved.demoMainQuestStage === "go_to_daan",
      `reset 后 demoMainQuestStage = "${preserved.demoMainQuestStage}"（期望 "go_to_daan"）`,
    );
    assert(
      preserved.emberCoreStatus === "delivered_to_daan",
      `reset 后 emberCoreStatus = "${preserved.emberCoreStatus}"（期望 "delivered_to_daan"）`,
    );

    // ============================================================
    // 12. 不影响 C1 Demo 地图状态
    // ============================================================
    console.log("\n[6] 验证跨系统兼容...");
    assert(
      state.currentDemoWorldNodeId === "greybridge",
      `C1 currentDemoWorldNodeId = "${state.currentDemoWorldNodeId}"（期望 "greybridge"，C1 兼容）`,
    );
    assert(
      Array.isArray(state.unlockedDemoWorldNodeIds),
      "C1 unlockedDemoWorldNodeIds 是数组（未破坏）",
    );

    // ============================================================
    // 13. 不影响 cityRevivalStates
    // ============================================================
    const revivalIntact = await page.evaluate(() => {
      const s = window.getGameState();
      return !!s.cityRevivalStates && Object.keys(s.cityRevivalStates).length >= 1;
    });
    assert(revivalIntact, "cityRevivalStates 未受影响");

    // ============================================================
    // 14. 不影响工具系统
    // ============================================================
    const toolsIntact = await page.evaluate(() => {
      const s = window.getGameState();
      return Array.isArray(s.ownedTools);
    });
    assert(toolsIntact, "工具系统 ownedTools 仍为数组");

    // ============================================================
    // 15. 不影响 CargoPrep 关键流程
    // ============================================================
    const cargoIntact = await page.evaluate(() => {
      const s = window.getGameState();
      return Array.isArray(s.unfinishedOrderIds) && typeof s.maxCargoWeight === "number";
    });
    assert(cargoIntact, "CargoPrep 相关字段存在（unfinishedOrderIds + maxCargoWeight）");

    // ============================================================
    // 总结
    // ============================================================
    console.log(`\n========== 测试完成：${passed} 通过，${failed} 失败 ==========`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (e) {
    console.error("[致命错误]", e);
    failed++;
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
