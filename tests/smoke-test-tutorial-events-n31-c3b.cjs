/* eslint-disable */
/**
 * C3b：N3.1 教学事件 smoke test
 *
 * 覆盖：
 * 1. N3.1 教学事件数量是 5
 * 2. 每个事件都能通过 nodeId 查询
 * 3. broken_road 是 small_event
 * 4. injured_traveler 是 small_event
 * 5. caravan_wreck 是 resource_event
 * 6. abandoned_toolbox 是 resource_event
 * 7. outpost_lights 是 small_event
 * 8. resolveTutorialEventChoice 能结算事件
 * 9. 重复结算同一事件不会重复给奖励
 * 10. 断裂路面选择会影响零件/货车耐久/flag 中至少一项
 * 11. 受伤旅人选择会影响补给/金币/flag 中至少一项
 * 12. 商队残骸能记录劫匪与灰烬兽冲突线索
 * 13. 遗弃工具箱能记录 gained_tutorial_spare_part flag
 * 14. 驿站灯火能记录到站提示和灰烬母巢提示
 * 15. resolvedTutorialEventIds 不重复
 * 16. tutorialEventFlags 不重复
 * 17. 未知 eventId 安全处理
 * 18. 未知 choiceId 安全处理
 * 19. 不影响 C3a 教程路线状态
 * 20. 不影响 C2 主线状态
 * 21. 不影响 C1 Demo 世界地图状态
 * 22. 不影响城市复兴
 * 23. 不影响工具系统
 * 24. 不影响 CargoPrep 关键流程
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

    // 等待页面脚本初始化（依赖 C3b API 已暴露）
    await page.evaluate(async () => {
      let attempt = 0;
      while (!window.getN31TutorialEvents && attempt < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempt++;
      }
    });

    // 1. N3.1 教学事件数量是 5
    const events = await page.evaluate(() => window.getN31TutorialEvents());
    assert(Array.isArray(events), "getN31TutorialEvents 返回数组");
    assert(events.length === 5, "N3.1 教学事件数量 = " + events.length + "（期望 5）");

    // 2. 每个事件都能通过 nodeId 查询
    const nodeIds = ["broken_road", "injured_traveler", "caravan_wreck", "abandoned_toolbox", "outpost_lights"];
    for (const nodeId of nodeIds) {
      const evt = await page.evaluate((id) => window.getTutorialEventByNodeId(id), nodeId);
      assert(evt !== undefined, "能通过 nodeId=" + nodeId + " 查询到事件");
    }

    // 3-7. 事件类型验证
    const evtBrokenRoad = await page.evaluate(() => window.getTutorialEventByNodeId("broken_road"));
    const evtInjured = await page.evaluate(() => window.getTutorialEventByNodeId("injured_traveler"));
    const evtWreck = await page.evaluate(() => window.getTutorialEventByNodeId("caravan_wreck"));
    const evtToolbox = await page.evaluate(() => window.getTutorialEventByNodeId("abandoned_toolbox"));
    const evtLights = await page.evaluate(() => window.getTutorialEventByNodeId("outpost_lights"));

    assert(evtBrokenRoad.type === "small_event", "broken_road 类型 = " + evtBrokenRoad.type + "（期望 small_event）");
    assert(evtInjured.type === "small_event", "injured_traveler 类型 = " + evtInjured.type + "（期望 small_event）");
    assert(evtWreck.type === "resource_event", "caravan_wreck 类型 = " + evtWreck.type + "（期望 resource_event）");
    assert(evtToolbox.type === "resource_event", "abandoned_toolbox 类型 = " + evtToolbox.type + "（期望 resource_event）");
    assert(evtLights.type === "small_event", "outpost_lights 类型 = " + evtLights.type + "（期望 small_event）");

    // small_event / resource_event 数量统计
    const typeCounts = {};
    for (const e of events) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
    assert(typeCounts.small_event === 3, "small_event 数量 = " + typeCounts.small_event + "（期望 3）");
    assert(typeCounts.resource_event === 2, "resource_event 数量 = " + typeCounts.resource_event + "（期望 2）");

    // 8. resolveTutorialEventChoice 能结算事件（使用 caran_wreck 的搜索）
    const beforeState = await page.evaluate(() => ({
      food: window.getGameState().food,
      silver: window.getGameState().silver,
      flags: window.getGameState().tutorialEventFlags,
    }));

    const stateAfterResolve = await page.evaluate(() => {
      const gs = window.getGameState();
      const result = window.resolveTutorialEventChoice(gs, "evt_caravan_wreck", "search_wreck");
      return result;
    });
    assert(
      stateAfterResolve.resolvedTutorialEventIds.includes("evt_caravan_wreck"),
      "resolve 后 resolvedTutorialEventIds 包含 evt_caravan_wreck"
    );

    // 9. 重复结算同一事件不会重复给奖励（第二次 resolve 不会改变 flags 长度）
    const stateAfterRepeat = await page.evaluate(() => {
      const once = window.resolveTutorialEventChoice(window.getGameState(), "evt_caravan_wreck", "search_wreck");
      // 模拟第二次 resolve（基于第一次结果）
      const twice = window.resolveTutorialEventChoice(once, "evt_caravan_wreck", "search_wreck");
      return { once: once.resolvedTutorialEventIds.length, twice: twice.resolvedTutorialEventIds.length };
    });
    assert(stateAfterRepeat.once === stateAfterRepeat.twice, "重复 resolve 不增加 resolvedTutorialEventIds 长度");

    // 10. 断裂路面选择会影响 caravanHp / flag 中至少一项
    const brokenRoadResult = await page.evaluate(() => {
      // 使用一个独立状态，不从 getGameState() 读取以避免污染真实状态
      const state = {
        food: 5,
        silver: 50,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const beforeHp = state.caravanHp;
      const beforeFlagsLen = state.tutorialEventFlags.length;
      const next = window.resolveTutorialEventChoice(state, "evt_broken_road", "force_through");
      return {
        hpDelta: next.caravanHp - beforeHp,
        flagsDelta: next.tutorialEventFlags.length - beforeFlagsLen,
        hasFlag: next.tutorialEventFlags.includes("forced_through_broken_road"),
      };
    });
    assert(
      brokenRoadResult.hpDelta < 0 || brokenRoadResult.flagsDelta > 0 || brokenRoadResult.hasFlag,
      "断裂路面：强行通过后，caravanHp 下降或 flag 新增（实际 hpDelta=" + brokenRoadResult.hpDelta + ", flagsDelta=" + brokenRoadResult.flagsDelta + "）"
    );

    // 11. 受伤旅人选择会影响补给/金币/flag 中至少一项
    const injuredResult = await page.evaluate(() => {
      const state = {
        food: 5,
        silver: 50,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const next = window.resolveTutorialEventChoice(state, "evt_injured_traveler", "share_supplies");
      return {
        foodDelta: next.food - state.food,
        silverDelta: next.silver - state.silver,
        moraleDelta: next.morale - state.morale,
        hasHelp: next.tutorialEventFlags.includes("helped_injured_traveler"),
      };
    });
    assert(
      injuredResult.foodDelta !== 0 || injuredResult.silverDelta !== 0 || injuredResult.moraleDelta !== 0 || injuredResult.hasHelp,
      "受伤旅人：分出补给救助后，food/silver/morale/flag 至少有一项变化（实际 foodDelta=" + injuredResult.foodDelta + "，hasHelp=" + injuredResult.hasHelp + "）"
    );

    // 12. 商队残骸能记录劫匪与灰烬兽冲突线索
    const wreckResult = await page.evaluate(() => {
      const state = {
        food: 0,
        silver: 0,
        morale: 0,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const next = window.resolveTutorialEventChoice(state, "evt_caravan_wreck", "search_wreck");
      return {
        hasBandit: next.tutorialEventFlags.includes("found_bandit_blade"),
        hasAsh: next.tutorialEventFlags.includes("found_ash_corrosion_slime"),
      };
    });
    assert(wreckResult.hasBandit, "商队残骸搜索后应记录 found_bandit_blade flag");
    assert(wreckResult.hasAsh, "商队残骸搜索后应记录 found_ash_corrosion_slime flag");

    // 13. 遗弃工具箱能记录 gained_tutorial_spare_part flag
    const toolboxResult = await page.evaluate(() => {
      const state = {
        food: 0,
        silver: 0,
        morale: 0,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const next = window.resolveTutorialEventChoice(state, "evt_abandoned_toolbox", "take_toolbox");
      return {
        hasFound: next.tutorialEventFlags.includes("found_abandoned_toolbox"),
        hasSpare: next.tutorialEventFlags.includes("gained_tutorial_spare_part"),
      };
    });
    assert(toolboxResult.hasFound, "遗弃工具箱：应记录 found_abandoned_toolbox flag");
    assert(toolboxResult.hasSpare, "遗弃工具箱：应记录 gained_tutorial_spare_part flag（零件暂用 flag 表示，不新增 parts:number）");

    // 14. 驿站灯火能记录到站提示和灰烬母巢提示
    const lightsResult = await page.evaluate(() => {
      const state = {
        food: 0,
        silver: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const next = window.resolveTutorialEventChoice(state, "evt_outpost_lights", "head_to_outpost");
      return {
        hasLights: next.tutorialEventFlags.includes("outpost_lights_seen"),
        hasAshNest: next.tutorialEventFlags.includes("ash_nest_hint_seen"),
        moraleDelta: next.morale - state.morale,
      };
    });
    assert(lightsResult.hasLights, "驿站灯火：应记录 outpost_lights_seen flag");
    assert(lightsResult.hasAshNest, "驿站灯火：应记录 ash_nest_hint_seen flag（提示可选精英战）");

    // 15. resolvedTutorialEventIds 不重复 —— 重复调用 5 次同一事件
    const repeatResolve = await page.evaluate(() => {
      const state = {
        food: 5,
        silver: 50,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = window.resolveTutorialEventChoice(s, "evt_broken_road", "force_through");
      }
      const idCount = s.resolvedTutorialEventIds.filter((x) => x === "evt_broken_road").length;
      return { idCount, totalLen: s.resolvedTutorialEventIds.length };
    });
    assert(repeatResolve.idCount === 1, "resolvedTutorialEventIds 不重复：evt_broken_road 出现 " + repeatResolve.idCount + " 次（期望 1）");

    // 16. tutorialEventFlags 不重复 —— 重复调用多次看是否有重复 flag 进入
    const flagsRepeat = await page.evaluate(() => {
      const state = {
        food: 0,
        silver: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      let s = state;
      // 同一事件选择多次（应该被防重复拦住，但仍要验证 flag 不重复）
      for (let i = 0; i < 5; i++) {
        s = window.resolveTutorialEventChoice(s, "evt_outpost_lights", "head_to_outpost");
      }
      const seen = {};
      for (const f of s.tutorialEventFlags) {
        seen[f] = (seen[f] || 0) + 1;
      }
      const dupCount = Object.values(seen).filter((c) => c > 1).length;
      return { dupCount, totalLen: s.tutorialEventFlags.length };
    });
    assert(flagsRepeat.dupCount === 0, "tutorialEventFlags 不重复：重复 flag 计数 = " + flagsRepeat.dupCount + "（期望 0）");

    // 17. 未知 eventId 安全处理
    const unknownEventResult = await page.evaluate(() => {
      const state = {
        food: 5,
        silver: 50,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const next = window.resolveTutorialEventChoice(state, "evt_nonexistent", "any_choice");
      return {
        sameLen: next.resolvedTutorialEventIds.length === 0,
        flagsSame: next.tutorialEventFlags.length === 0,
      };
    });
    assert(unknownEventResult.sameLen, "未知 eventId 安全处理：resolvedTutorialEventIds 仍为空");
    assert(unknownEventResult.flagsSame, "未知 eventId 安全处理：tutorialEventFlags 仍为空");

    // 18. 未知 choiceId 安全处理
    const unknownChoiceResult = await page.evaluate(() => {
      const state = {
        food: 5,
        silver: 50,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const next = window.resolveTutorialEventChoice(state, "evt_broken_road", "nonexistent_choice");
      return {
        sameLen: next.resolvedTutorialEventIds.length === 0,
        flagsSame: next.tutorialEventFlags.length === 0,
      };
    });
    assert(unknownChoiceResult.sameLen, "未知 choiceId 安全处理：resolvedTutorialEventIds 仍为空");
    assert(unknownChoiceResult.flagsSame, "未知 choiceId 安全处理：tutorialEventFlags 仍为空");

    // 19. 不影响 C3a 教程路线状态
    // 20. 不影响 C2 主线状态
    // 21. 不影响 C1 Demo 世界地图状态
    // 22. 不影响城市复兴
    // 23. 不影响工具系统
    // 24. 不影响 CargoPrep 关键流程
    const crossCheck = await page.evaluate(() => {
      const gs1 = window.getGameState();
      const snapshot = {
        c3a: {
          active: gs1.activeTutorialRouteId,
          current: gs1.currentTutorialNodeId,
          completed: gs1.completedTutorialNodeIds.length,
          skipped: gs1.skippedOptionalTutorialNodeIds.length,
        },
        c2: { ember: gs1.emberCoreStatus, stage: gs1.demoMainQuestStage, quest: gs1.activeMainQuestOrderId },
        c1: { node: gs1.currentDemoWorldNodeId, unlockedNodes: gs1.unlockedDemoWorldNodeIds.length },
        city: { cycle: gs1.expeditionCycle, revival: Object.keys(gs1.cityRevivalStates).length },
        tool: { ownedTools: (gs1.ownedTools || []).length, selected: gs1.selectedToolId },
        cargo: { silver: gs1.silver, maxWeight: gs1.maxCargoWeight, unfinished: gs1.unfinishedOrderIds.length },
      };

      // 运行一个事件结算（使用独立 state，不直接改 getGameState 返回的对象）
      const testState = {
        food: 5,
        silver: 50,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      window.resolveTutorialEventChoice(testState, "evt_broken_road", "careful_detour");

      const gs2 = window.getGameState();
      const after = {
        c3a: {
          active: gs2.activeTutorialRouteId,
          current: gs2.currentTutorialNodeId,
          completed: gs2.completedTutorialNodeIds.length,
          skipped: gs2.skippedOptionalTutorialNodeIds.length,
        },
        c2: { ember: gs2.emberCoreStatus, stage: gs2.demoMainQuestStage, quest: gs2.activeMainQuestOrderId },
        c1: { node: gs2.currentDemoWorldNodeId, unlockedNodes: gs2.unlockedDemoWorldNodeIds.length },
        city: { cycle: gs2.expeditionCycle, revival: Object.keys(gs2.cityRevivalStates).length },
        tool: { ownedTools: (gs2.ownedTools || []).length, selected: gs2.selectedToolId },
        cargo: { silver: gs2.silver, maxWeight: gs2.maxCargoWeight, unfinished: gs2.unfinishedOrderIds.length },
      };

      return {
        c3a: JSON.stringify(snapshot.c3a) === JSON.stringify(after.c3a),
        c2: JSON.stringify(snapshot.c2) === JSON.stringify(after.c2),
        c1: JSON.stringify(snapshot.c1) === JSON.stringify(after.c1),
        city: JSON.stringify(snapshot.city) === JSON.stringify(after.city),
        tool: JSON.stringify(snapshot.tool) === JSON.stringify(after.tool),
        cargo: JSON.stringify(snapshot.cargo) === JSON.stringify(after.cargo),
      };
    });
    assert(crossCheck.c3a, "不影响 C3a 教程路线状态");
    assert(crossCheck.c2, "不影响 C2 主线状态");
    assert(crossCheck.c1, "不影响 C1 Demo 世界地图状态");
    assert(crossCheck.city, "不影响城市复兴");
    assert(crossCheck.tool, "不影响工具系统");
    assert(crossCheck.cargo, "不影响 CargoPrep 关键流程");

    console.log("[C3b] N3.1 教学事件 smoke test 全部通过");
  } catch (err) {
    console.error("[C3b] 测试失败：", err);
    process.exit(1);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
})();
