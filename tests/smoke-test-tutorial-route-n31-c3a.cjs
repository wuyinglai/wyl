/* eslint-disable */
/**
 * C3a：N3.1 固定教学路线数据底座 smoke test
 */

const { chromium } = require("playwright");
const assert = require("assert");

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL);

    // 等待页面脚本初始化
    await page.evaluate(async () => {
      let attempt = 0;
      while (!window.getN31TutorialRouteNodes && attempt < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempt++;
      }
    });

    // 1) N3.1 路线节点数量是 13
    const nodes = await page.evaluate(() => window.getN31TutorialRouteNodes());
    assert(Array.isArray(nodes), "getN31TutorialRouteNodes 返回数组");
    assert(nodes.length === 13, "N3.1 节点数量 = " + nodes.length + "（期望 13）");

    // 2) 节点顺序正确
    const ids = nodes.map((n) => n.id);
    const expectedOrder = [
      "depart_greybridge",
      "broken_road",
      "young_ash_beast_battle",
      "cracked_back_ash_beast_battle",
      "injured_traveler",
      "caravan_wreck",
      "bandit_cargo_raid",
      "mixed_ash_beast_battle",
      "abandoned_toolbox",
      "double_corroded_ash_beast_battle",
      "outpost_lights",
      "ash_nest_elite",
      "arrive_first_outpost",
    ];
    assert(
      JSON.stringify(ids) === JSON.stringify(expectedOrder),
      "节点顺序正确"
    );

    const first = await page.evaluate(() => window.getFirstN31TutorialRouteNode());
    const last = await page.evaluate(() => window.getLastN31TutorialRouteNode());

    // 3) 第一个节点
    assert(first.id === "depart_greybridge", "第一个节点 = " + first.id + "（期望 depart_greybridge）");

    // 4) 最后一个节点
    assert(last.id === "arrive_first_outpost", "最后一个节点 = " + last.id + "（期望 arrive_first_outpost）");

    // 5-8) 节点类型统计
    const typeCounts = {};
    for (const n of nodes) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }
    assert(typeCounts.normal_battle === 4, "normal_battle 数量 = " + typeCounts.normal_battle + "（期望 4）");
    assert(typeCounts.small_event === 3, "small_event 数量 = " + typeCounts.small_event + "（期望 3）");
    assert(typeCounts.resource_event === 2, "resource_event 数量 = " + typeCounts.resource_event + "（期望 2）");
    assert(typeCounts.special_battle === 1, "special_battle 数量 = " + typeCounts.special_battle + "（期望 1）");
    assert(typeCounts.optional_elite === 1, "optional_elite 数量 = " + typeCounts.optional_elite + "（期望 1）");
    assert(typeCounts.destination === 1, "destination 数量 = " + typeCounts.destination + "（期望 1）");
    assert(typeCounts.start === 1, "start 数量 = " + typeCounts.start + "（期望 1）");
    assert(
      typeCounts.boss === undefined || typeCounts.boss === 0,
      "Boss 数量 = " + (typeCounts.boss || 0) + "（期望 0）"
    );

    // 9) ash_nest_elite 验证
    const ashNest = nodes.find((n) => n.id === "ash_nest_elite");
    assert(ashNest !== undefined, "ash_nest_elite 存在");
    assert(ashNest.type === "optional_elite", "ash_nest_elite 类型 = " + ashNest.type + "（期望 optional_elite）");
    assert(ashNest.required === false, "ash_nest_elite.required = " + ashNest.required + "（期望 false）");

    // 10) 所有其他主线节点 required === true
    for (const n of nodes) {
      if (n.id !== "ash_nest_elite") {
        assert(n.required === true, "节点 " + n.id + " required = " + n.required + "（期望 true）");
      }
    }

    // 11) startN31TutorialRoute 后 currentTutorialNodeId 是 depart_greybridge
    const startResult = await page.evaluate(() => {
      let state = window.createInitialTutorialRouteProgressState();
      state = window.startN31TutorialRoute(state);
      return state;
    });
    assert(
      startResult.currentTutorialNodeId === "depart_greybridge",
      "startN31TutorialRoute 后 currentTutorialNodeId = " + startResult.currentTutorialNodeId + "（期望 depart_greybridge）"
    );
    assert(startResult.activeTutorialRouteId !== null, "startN31TutorialRoute 后 activeTutorialRouteId 不为 null");

    // 12) completeTutorialNode 不重复记录
    const completeResult = await page.evaluate(() => {
      let state = window.createInitialTutorialRouteProgressState();
      state = window.startN31TutorialRoute(state);
      state = window.completeTutorialNode(state, "depart_greybridge");
      state = window.completeTutorialNode(state, "depart_greybridge");
      return state;
    });
    const completedCount = completeResult.completedTutorialNodeIds.filter((id) => id === "depart_greybridge").length;
    assert(completedCount === 1, "completeTutorialNode 不重复记录：depart_greybridge 出现 " + completedCount + " 次（期望 1）");

    // 13) advanceToNextTutorialNode 可以从出城推进到断裂路面
    const advanceResult = await page.evaluate(() => {
      let state = window.createInitialTutorialRouteProgressState();
      state = window.startN31TutorialRoute(state);
      state = window.completeTutorialNode(state, "depart_greybridge");
      state = window.advanceToNextTutorialNode(state);
      return state;
    });
    assert(
      advanceResult.currentTutorialNodeId === "broken_road",
      "advanceToNextTutorialNode 推进后 currentTutorialNodeId = " + advanceResult.currentTutorialNodeId + "（期望 broken_road）"
    );

    // 14) 必经节点不能 skip
    const skipRequiredResult = await page.evaluate(() => {
      let state = window.createInitialTutorialRouteProgressState();
      state = window.startN31TutorialRoute(state);
      state = window.skipOptionalTutorialNode(state, "broken_road");
      return state;
    });
    assert(
      skipRequiredResult.skippedOptionalTutorialNodeIds.length === 0,
      "必经节点 skip 不应被记录：skippedOptionalTutorialNodeIds 长度 = " + skipRequiredResult.skippedOptionalTutorialNodeIds.length + "（期望 0）"
    );

    // 15) 可选精英节点可以 skip
    const skipOptionalResult = await page.evaluate(() => {
      let state = window.createInitialTutorialRouteProgressState();
      state = window.startN31TutorialRoute(state);
      state = window.skipOptionalTutorialNode(state, "ash_nest_elite");
      return state;
    });
    assert(
      skipOptionalResult.skippedOptionalTutorialNodeIds.includes("ash_nest_elite"),
      "可选精英节点可以 skip：skippedOptionalTutorialNodeIds 应包含 ash_nest_elite"
    );

    // 16) 完成 arrive_first_outpost 后路线 completed
    const isCompletedCheck = await page.evaluate(() => {
      let state1 = window.createInitialTutorialRouteProgressState();
      state1 = window.startN31TutorialRoute(state1);
      const notDone = window.isTutorialRouteCompleted(state1);
      const allIds = [
        "depart_greybridge",
        "broken_road",
        "young_ash_beast_battle",
        "cracked_back_ash_beast_battle",
        "injured_traveler",
        "caravan_wreck",
        "bandit_cargo_raid",
        "mixed_ash_beast_battle",
        "abandoned_toolbox",
        "double_corroded_ash_beast_battle",
        "outpost_lights",
        "arrive_first_outpost",
      ];
      let state2 = window.createInitialTutorialRouteProgressState();
      state2 = window.startN31TutorialRoute(state2);
      for (const id of allIds) {
        state2 = window.completeTutorialNode(state2, id);
      }
      const done = window.isTutorialRouteCompleted(state2);
      return { notDone, done };
    });
    assert(isCompletedCheck.notDone === false, "未完成时 isTutorialRouteCompleted = false");
    assert(isCompletedCheck.done === true, "完成后 isTutorialRouteCompleted = true");

    // 17-20) 不影响 C1/C2/城市复兴/工具系统
    const crossCheck = await page.evaluate(() => {
      const gs1 = window.getGameState();
      const c1 = {
        node: gs1.currentDemoWorldNodeId,
        nodes: gs1.unlockedDemoWorldNodeIds.length,
        routes: gs1.unlockedDemoWorldRouteIds.length,
        rumors: gs1.knownDemoWorldRumorIds.length,
      };
      const c2 = {
        ember: gs1.emberCoreStatus,
        stage: gs1.demoMainQuestStage,
        activeQuest: gs1.activeMainQuestOrderId,
      };
      const city = {
        cycle: gs1.expeditionCycle,
        revivalCount: Object.keys(gs1.cityRevivalStates).length,
      };
      const tool = {
        toolCount: (gs1.ownedToolIds || gs1.ownedTools || []).length,
      };

      let state = window.createInitialTutorialRouteProgressState();
      state = window.startN31TutorialRoute(state);
      state = window.completeTutorialNode(state, "depart_greybridge");

      const gs2 = window.getGameState();
      const c1After = {
        node: gs2.currentDemoWorldNodeId,
        nodes: gs2.unlockedDemoWorldNodeIds.length,
        routes: gs2.unlockedDemoWorldRouteIds.length,
        rumors: gs2.knownDemoWorldRumorIds.length,
      };
      const c2After = {
        ember: gs2.emberCoreStatus,
        stage: gs2.demoMainQuestStage,
        activeQuest: gs2.activeMainQuestOrderId,
      };
      const cityAfter = {
        cycle: gs2.expeditionCycle,
        revivalCount: Object.keys(gs2.cityRevivalStates).length,
      };
      const toolAfter = {
        toolCount: (gs2.ownedToolIds || gs2.ownedTools || []).length,
      };

      return {
        c1: JSON.stringify(c1) === JSON.stringify(c1After),
        c2: JSON.stringify(c2) === JSON.stringify(c2After),
        city: JSON.stringify(city) === JSON.stringify(cityAfter),
        tool: JSON.stringify(tool) === JSON.stringify(toolAfter),
      };
    });
    assert(crossCheck.c1, "C1 Demo 世界地图状态不受影响");
    assert(crossCheck.c2, "C2 主线状态不受影响");
    assert(crossCheck.city, "城市复兴状态不受影响");
    assert(crossCheck.tool, "工具系统状态不受影响");

    console.log("[C3a] N3.1 固定教学路线数据底座 smoke test 全部通过");
  } catch (err) {
    console.error("[C3a] 测试失败：", err);
    process.exit(1);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
})();
