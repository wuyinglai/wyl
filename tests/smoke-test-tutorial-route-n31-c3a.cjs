/* eslint-disable */
/**
 * C3a.1：N3.1 固定教学路线 smoke test（20 天固定旅程 + 7 个平静日）
 *
 * 覆盖：
 * 1. N3.1 路线节点数量 = 20
 * 2. 标准路线天数 = 20
 * 3. 第一个节点是 depart_greybridge
 * 4. 最后一个节点是 arrive_first_outpost
 * 5. 平静日数量 = 7
 * 6. 所有 peaceful_day 节点 required = true
 * 7. 所有 peaceful_day 节点 timeCostDays = 1
 * 8. 所有 peaceful_day 节点 consumesSupply = true
 * 9. 所有 peaceful_day 节点 advancesOrderDeadline = true
 * 10. 小事件数量 = 3
 * 11. 资源事件数量 = 2
 * 12. 普通战斗数量 = 4
 * 13. 特殊战斗数量 = 1
 * 14. 可选精英数量 = 1
 * 15. Boss 数量 = 0
 * 16. getN31RouteNodeByDay(1) = depart_greybridge
 * 17. getN31RouteNodeByDay(20) = arrive_first_outpost
 * 18. isPeacefulDayNode(quiet_old_road_outside_town) = true
 * 19. isPeacefulDayNode(broken_road) = false
 * 20. route advance 能从第 1 天推进到第 2 天
 * 21. route advance 能推进到第 20 天
 * 22. 完成 arrive_first_outpost 后路线 completed
 * 23. 不影响 C3b 教学事件状态
 * 24. 不影响 C3c 普通战斗状态
 * 25. 不影响 C3d 特殊战状态
 * 26. 不影响 C2 主线状态
 * 27. 不影响 C1 Demo 世界地图状态
 * 28. 不影响城市复兴
 * 29. 不影响工具系统
 */

const { chromium } = require("playwright");
const assert = require("assert");

const BASE_URL = process.env.BASE_URL || "http://localhost:5180";

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // 等待页面脚本初始化
    await page.evaluate(async () => {
      let attempt = 0;
      while (!window.getN31TutorialRouteNodes && attempt < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempt++;
      }
    });

    // 1. N3.1 路线节点数量 = 20
    const nodes = await page.evaluate(() => window.getN31TutorialRouteNodes());
    assert(Array.isArray(nodes), "getN31TutorialRouteNodes 返回数组");
    assert(nodes.length === 20, "节点数量 = " + nodes.length + "（期望 20）");

    // 2. 标准路线天数 = 20
    const days = await page.evaluate(() => window.getN31StandardRouteDays());
    assert(days === 20, "N31 标准路线天数 = " + days + "（期望 20）");

    const totalCost = await page.evaluate(() => window.getN31TotalTimeCostDays());
    assert(totalCost === 20, "N31 总时间成本天数 = " + totalCost + "（期望 20）");

    // 3. 第一个节点是 depart_greybridge
    const firstNode = await page.evaluate(() => window.getFirstN31TutorialRouteNode());
    assert(firstNode.id === "depart_greybridge", "第一个节点 id = " + firstNode.id);
    assert(firstNode.type === "start", "第一个节点类型 = start");

    // 4. 最后一个节点是 arrive_first_outpost
    const lastNode = await page.evaluate(() => window.getLastN31TutorialRouteNode());
    assert(lastNode.id === "arrive_first_outpost", "最后一个节点 id = " + lastNode.id);
    assert(lastNode.type === "destination", "最后一个节点类型 = destination");

    // 5. 平静日数量 = 7
    const peacefulNodes = await page.evaluate(() => window.getN31PeacefulDayNodes());
    assert(peacefulNodes.length === 7, "平静日数量 = " + peacefulNodes.length + "（期望 7）");

    // 6-9. 所有 peaceful_day 节点 required=true, timeCostDays=1, consumesSupply=true, advancesOrderDeadline=true
    for (const n of peacefulNodes) {
      assert(n.required === true, n.id + " required 应为 true");
      assert(n.timeCostDays === 1, n.id + " timeCostDays 应为 1（实际 = " + n.timeCostDays + "）");
      assert(n.consumesSupply === true, n.id + " consumesSupply 应为 true");
      assert(n.advancesOrderDeadline === true, n.id + " advancesOrderDeadline 应为 true");
      assert(n.type === "peaceful_day", n.id + " type 应为 peaceful_day");
    }

    // 10-15. 类型统计：3 small_event / 2 resource_event / 4 normal_battle / 1 special_battle / 1 optional_elite / 0 boss
    const typeCounts = {};
    for (const n of nodes) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }
    assert(typeCounts.small_event === 3, "small_event 数量 = " + typeCounts.small_event + "（期望 3）");
    assert(typeCounts.resource_event === 2, "resource_event 数量 = " + typeCounts.resource_event + "（期望 2）");
    assert(typeCounts.normal_battle === 4, "normal_battle 数量 = " + typeCounts.normal_battle + "（期望 4）");
    assert(typeCounts.special_battle === 1, "special_battle 数量 = " + typeCounts.special_battle + "（期望 1）");
    assert(typeCounts.optional_elite === 1, "optional_elite 数量 = " + typeCounts.optional_elite + "（期望 1）");
    assert(!typeCounts.boss, "Boss 数量 = 0（实际 = " + (typeCounts.boss || 0) + "）");
    assert(typeCounts.peaceful_day === 7, "peaceful_day 数量 = " + typeCounts.peaceful_day + "（期望 7）");

    // 16. getN31RouteNodeByDay(1) = depart_greybridge
    const day1 = await page.evaluate(() => window.getN31RouteNodeByDay(1));
    assert(day1.id === "depart_greybridge", "day 1 节点 = " + day1.id);

    // 17. getN31RouteNodeByDay(20) = arrive_first_outpost
    const day20 = await page.evaluate(() => window.getN31RouteNodeByDay(20));
    assert(day20.id === "arrive_first_outpost", "day 20 节点 = " + day20.id);

    // 18. isPeacefulDayNode(quiet_old_road_outside_town) = true
    const isPeaceful1 = await page.evaluate(() => window.isPeacefulDayNode("quiet_old_road_outside_town"));
    assert(isPeaceful1 === true, "quiet_old_road_outside_town 应识别为平静日");

    // 19. isPeacefulDayNode(broken_road) = false
    const isPeaceful2 = await page.evaluate(() => window.isPeacefulDayNode("broken_road"));
    assert(isPeaceful2 === false, "broken_road 不是平静日");

    // 20. route advance 能从第 1 天推进到第 2 天
    const advance1 = await page.evaluate(() => {
      const initState = window.createInitialTutorialRouteProgressState();
      let s = window.startN31TutorialRoute(initState);
      // 先标记当前节点已完成，再推进
      s = window.completeTutorialNode(s, "depart_greybridge");
      s = window.advanceToNextTutorialNode(s);
      return { currentId: s.currentTutorialNodeId };
    });
    assert(advance1.currentId === "quiet_old_road_outside_town",
      "从第 1 天推进后，currentTutorialNodeId 应为 quiet_old_road_outside_town（实际 = " + advance1.currentId + "）");

    // 21. route advance 能推进到第 20 天（完整推进链条）
    const advanceToEnd = await page.evaluate(() => {
      const initState = window.createInitialTutorialRouteProgressState();
      let s = window.startN31TutorialRoute(initState);
      const order = [
        "depart_greybridge",
        "quiet_old_road_outside_town",
        "broken_road",
        "quiet_ash_slope",
        "young_ash_beast_battle",
        "quiet_low_wind_road",
        "cracked_back_ash_beast_battle",
        "injured_traveler",
        "caravan_wreck",
        "quiet_grey_fog_gap",
        "bandit_cargo_raid",
        "quiet_silent_wasteland_road",
        "mixed_ash_beast_battle",
        "abandoned_toolbox",
        "quiet_old_road_ash_line",
        "double_corroded_ash_beast_battle",
        "quiet_outpost_far_light",
        "outpost_lights",
        "ash_nest_elite",
        "arrive_first_outpost",
      ];
      // 从第二个起，依次 complete + advance 直到最后
      for (let i = 0; i < order.length - 1; i++) {
        s = window.completeTutorialNode(s, order[i]);
        s = window.advanceToNextTutorialNode(s);
      }
      // complete 最后节点
      s = window.completeTutorialNode(s, "arrive_first_outpost");
      return {
        currentId: s.currentTutorialNodeId,
        completedCount: s.completedTutorialNodeIds.length,
        completed: s.completedTutorialNodeIds.includes("arrive_first_outpost"),
      };
    });
    assert(advanceToEnd.currentId === "arrive_first_outpost",
      "推进到终点后 currentId 应为 arrive_first_outpost（实际 = " + advanceToEnd.currentId + "）");
    assert(advanceToEnd.completedCount === 20,
      "completedTutorialNodeIds 数量应为 20（实际 = " + advanceToEnd.completedCount + "）");

    // 22. 完成 arrive_first_outpost 后路线 completed
    const isCompleted = await page.evaluate(() => {
      const initState = window.createInitialTutorialRouteProgressState();
      let s = window.startN31TutorialRoute(initState);
      const order = [
        "depart_greybridge",
        "quiet_old_road_outside_town",
        "broken_road",
        "quiet_ash_slope",
        "young_ash_beast_battle",
        "quiet_low_wind_road",
        "cracked_back_ash_beast_battle",
        "injured_traveler",
        "caravan_wreck",
        "quiet_grey_fog_gap",
        "bandit_cargo_raid",
        "quiet_silent_wasteland_road",
        "mixed_ash_beast_battle",
        "abandoned_toolbox",
        "quiet_old_road_ash_line",
        "double_corroded_ash_beast_battle",
        "quiet_outpost_far_light",
        "outpost_lights",
        "ash_nest_elite",
        "arrive_first_outpost",
      ];
      for (let i = 0; i < order.length - 1; i++) {
        s = window.completeTutorialNode(s, order[i]);
        s = window.advanceToNextTutorialNode(s);
      }
      s = window.completeTutorialNode(s, "arrive_first_outpost");
      return window.isTutorialRouteCompleted(s);
    });
    assert(isCompleted === true, "完成 arrive_first_outpost 后 isTutorialRouteCompleted 应为 true");

    // 验证：complete 不重复记录
    const noDup = await page.evaluate(() => {
      let s = window.createInitialTutorialRouteProgressState();
      s = window.startN31TutorialRoute(s);
      s = window.completeTutorialNode(s, "depart_greybridge");
      s = window.completeTutorialNode(s, "depart_greybridge");
      const count = s.completedTutorialNodeIds.filter((x) => x === "depart_greybridge").length;
      return count;
    });
    assert(noDup === 1, "重复 completeTutorialNode 不应产生重复记录（实际 = " + noDup + "）");

    // 23-29. 不影响其他系统状态
    const crossCheck = await page.evaluate(() => {
      const gs1 = window.getGameState();
      const snapshot = {
        c3b: {
          resolvedIds: gs1.resolvedTutorialEventIds.length,
          flags: gs1.tutorialEventFlags.length,
        },
        c3c: {
          resolvedIds: gs1.resolvedTutorialBattleIds.length,
          flags: gs1.tutorialBattleFlags.length,
        },
        c3d: {
          resolvedIds: gs1.resolvedTutorialSpecialBattleIds.length,
          flags: gs1.tutorialSpecialBattleFlags.length,
          cargoByIdKeys: Object.keys(gs1.tutorialSpecialBattleCargoIntegrityById || {}).length,
        },
        c2: { ember: gs1.emberCoreStatus, stage: gs1.demoMainQuestStage, quest: gs1.activeMainQuestOrderId },
        c1: { node: gs1.currentDemoWorldNodeId, unlockedNodes: gs1.unlockedDemoWorldNodeIds.length },
        city: { cycle: gs1.expeditionCycle, revival: Object.keys(gs1.cityRevivalStates).length },
        tool: { ownedTools: (gs1.ownedTools || []).length, selected: gs1.selectedToolId },
      };

      // 做一次路线 start + advance 操作
      let s = window.createInitialTutorialRouteProgressState();
      s = window.startN31TutorialRoute(s);
      s = window.completeTutorialNode(s, "depart_greybridge");
      s = window.advanceToNextTutorialNode(s);

      const gs2 = window.getGameState();
      const after = {
        c3b: {
          resolvedIds: gs2.resolvedTutorialEventIds.length,
          flags: gs2.tutorialEventFlags.length,
        },
        c3c: {
          resolvedIds: gs2.resolvedTutorialBattleIds.length,
          flags: gs2.tutorialBattleFlags.length,
        },
        c3d: {
          resolvedIds: gs2.resolvedTutorialSpecialBattleIds.length,
          flags: gs2.tutorialSpecialBattleFlags.length,
          cargoByIdKeys: Object.keys(gs2.tutorialSpecialBattleCargoIntegrityById || {}).length,
        },
        c2: { ember: gs2.emberCoreStatus, stage: gs2.demoMainQuestStage, quest: gs2.activeMainQuestOrderId },
        c1: { node: gs2.currentDemoWorldNodeId, unlockedNodes: gs2.unlockedDemoWorldNodeIds.length },
        city: { cycle: gs2.expeditionCycle, revival: Object.keys(gs2.cityRevivalStates).length },
        tool: { ownedTools: (gs2.ownedTools || []).length, selected: gs2.selectedToolId },
      };

      return {
        c3b: JSON.stringify(snapshot.c3b) === JSON.stringify(after.c3b),
        c3c: JSON.stringify(snapshot.c3c) === JSON.stringify(after.c3c),
        c3d: JSON.stringify(snapshot.c3d) === JSON.stringify(after.c3d),
        c2: JSON.stringify(snapshot.c2) === JSON.stringify(after.c2),
        c1: JSON.stringify(snapshot.c1) === JSON.stringify(after.c1),
        city: JSON.stringify(snapshot.city) === JSON.stringify(after.city),
        tool: JSON.stringify(snapshot.tool) === JSON.stringify(after.tool),
      };
    });
    assert(crossCheck.c3b, "不影响 C3b 教学事件状态");
    assert(crossCheck.c3c, "不影响 C3c 普通战斗状态");
    assert(crossCheck.c3d, "不影响 C3d 特殊战状态");
    assert(crossCheck.c2, "不影响 C2 主线状态");
    assert(crossCheck.c1, "不影响 C1 Demo 世界地图状态");
    assert(crossCheck.city, "不影响城市复兴");
    assert(crossCheck.tool, "不影响工具系统");

    console.log("[C3a] N3.1 固定教学路线 smoke test 全部通过");
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
