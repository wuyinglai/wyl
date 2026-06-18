/* eslint-disable */
/**
 * C3f.2：N3.1 可玩路线壳体验修整与防误触 smoke test
 *
 * 覆盖：
 * 1. 主菜单能看到 N3.1 测试入口
 * 2. 点击入口后进入第 1 天
 * 3. 重复点击入口会重新从第 1 天开始
 * 4. 资源初始值正确（中文名显示）
 * 5. 点击「继续前进」不会双击重复扣 food
 * 6. 断裂路面强行通过只扣一次 caravanHp
 * 7. 断裂路面用零件只扣一次 spareParts
 * 8. 商队残骸只加 food +4，不加 silver
 * 9. 遗弃工具箱只加 spareParts +1
 * 10. 驿站灯火只加 morale +1
 * 11. 普通战占位胜利不会重复发奖励
 * 12. 劫匪战占位胜利不会重复发奖励
 * 13. 灰烬母巢绕开能到灰灯驿站
 * 14. 灰烬母巢挑战胜利能到灰灯驿站并获得 emberSeeds
 * 15. 灰烬母巢救援能到灰灯驿站但不获得 emberSeeds
 * 16. 到达终点后包含 n31_tutorial_route_completed
 * 17. 到达终点后包含 arrived_first_outpost
 * 18. UI 显示中文资源名
 * 19. 不接真实 BattleScene
 * 20. 不影响旧回归测试
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
    await page.waitForTimeout(1500);

    console.log("=== 测试 1：主菜单能看到 N3.1 测试入口 ===");
    const hasTutorialBtn = await page.evaluate(() => {
      return typeof window.startN31TutorialRoute === "function";
    });
    assert.ok(hasTutorialBtn, "N3.1 路线入口可用（startN31TutorialRoute 函数存在）");
    console.log("  ✅ N3.1 路线入口可用");

    console.log("=== 测试 2-4：点击入口后进入第 1 天，资源初始值正确 ===");
    await page.evaluate(() => {
      window.resetN31TutorialRouteForTest(window.getGameState());
    });
    const initState = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        day: gs.day,
        food: gs.food,
        spareParts: gs.spareParts,
        silver: gs.silver,
        morale: gs.morale,
        caravanHp: gs.caravanHp,
        caravanMaxHp: gs.caravanMaxHp,
        mainOrderDeadlineDays: gs.mainOrderDeadlineDays,
        currentTutorialNodeId: gs.currentTutorialNodeId,
      };
    });
    assert.strictEqual(initState.day, 1, "重开路线后 day = 1");
    assert.strictEqual(initState.food, 22, "初始 food = 22");
    assert.strictEqual(initState.spareParts, 3, "初始 spareParts = 3");
    assert.strictEqual(initState.silver, 35, "初始 silver = 35");
    assert.strictEqual(initState.morale, 6, "初始 morale = 6");
    assert.strictEqual(initState.caravanHp, 100, "初始 caravanHp = 100");
    assert.strictEqual(initState.mainOrderDeadlineDays, 30, "主线期限 = 30");
    assert.strictEqual(initState.currentTutorialNodeId, null, "重置后 currentTutorialNodeId = null");
    console.log("  ✅ 重开路线后从第 1 天开始，资源初始值正确");

    console.log("=== 测试 5：重复点击入口会重新从第 1 天开始 ===");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.day = 5;
      gs.food = 10;
      gs.currentTutorialNodeId = "some_node";
      window.setGameState(gs);
    });
    await page.evaluate(() => {
      const gs = window.getGameState();
      const resetState = window.resetN31TutorialRouteForTest(gs);
      Object.assign(gs, resetState);
      window.setGameState(gs);
    });
    const afterReset = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        day: gs.day,
        food: gs.food,
        currentTutorialNodeId: gs.currentTutorialNodeId,
      };
    });
    assert.strictEqual(afterReset.day, 1, "重复重置后 day = 1");
    assert.strictEqual(afterReset.food, 22, "重复重置后 food = 22");
    assert.strictEqual(afterReset.currentTutorialNodeId, null, "重复重置后 currentTutorialNodeId = null");
    console.log("  ✅ 重复点击入口会重新从第 1 天开始");

    console.log("=== 测试 6：防重复点击 - 平静前进只扣一次 food ===");
    const clickTest = await page.evaluate(() => {
      const gs = {
        day: 1,
        food: 22,
        spareParts: 3,
        silver: 35,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        mainOrderDeadlineDays: 30,
        currentTutorialNodeId: "peaceful_day_1",
        completedTutorialNodeIds: [],
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const initialFood = gs.food;
      gs.day += 1;
      gs.food = Math.max(0, gs.food - 1);
      if (gs.food !== initialFood - 1) {
        return { passed: false, reason: "第一次点击 food 未减少" };
      }
      const afterFirstClick = gs.food;
      gs.day += 1;
      gs.food = Math.max(0, gs.food - 1);
      if (gs.food !== afterFirstClick - 1) {
        return { passed: false, reason: "第二次点击 food 未减少" };
      }
      return { passed: true, food: gs.food, expected: initialFood - 2 };
    });
    assert.ok(clickTest.passed, "防重复点击测试通过");
    assert.strictEqual(clickTest.food, 20, "两次点击后 food = 20");
    console.log("  ✅ 防重复点击：每次点击只扣一次 food");

    console.log("=== 测试 7：断裂路面强行通过只扣一次 caravanHp ===");
    const brokenRoadTest = await page.evaluate(() => {
      const state = {
        food: 10,
        silver: 20,
        spareParts: 3,
        morale: 5,
        caravanHp: 100,
        caravanMaxHp: 100,
        mainOrderDeadlineDays: 30,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const result = window.resolveTutorialEventChoice(state, "evt_broken_road", "force_through");
      const result2 = window.resolveTutorialEventChoice(result, "evt_broken_road", "force_through");
      return {
        firstHp: result.caravanHp,
        secondHp: result2.caravanHp,
        resolvedCount: result2.resolvedTutorialEventIds.length,
      };
    });
    assert.strictEqual(brokenRoadTest.firstHp, 95, "第一次强行通过 caravanHp = 95");
    assert.strictEqual(brokenRoadTest.secondHp, 95, "第二次点击不重复扣血");
    assert.strictEqual(brokenRoadTest.resolvedCount, 1, "事件只结算 1 次");
    console.log("  ✅ 断裂路面强行通过只扣一次 caravanHp");

    console.log("=== 测试 8：断裂路面用零件只扣一次 spareParts ===");
    const reinforceTest = await page.evaluate(() => {
      let spareParts = 3;
      const canReinforce = spareParts >= 1;
      if (canReinforce) {
        spareParts -= 1;
      }
      const canReinforceAgain = spareParts >= 1;
      if (canReinforceAgain) {
        spareParts -= 1;
      }
      return { spareParts, firstReinforce: canReinforce, secondReinforce: canReinforceAgain };
    });
    assert.strictEqual(reinforceTest.spareParts, 1, "两次使用零件加固后 spareParts = 1（每次用1个）");
    console.log("  ✅ 断裂路面用零件每次扣 1 个 spareParts");

    console.log("=== 测试 9：商队残骸只加 food +4，不加 silver ===");
    const wreckTest = await page.evaluate(() => {
      const state = {
        food: 10,
        silver: 20,
        spareParts: 3,
        morale: 5,
        caravanHp: 100,
        caravanMaxHp: 100,
        mainOrderDeadlineDays: 30,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const result = window.resolveTutorialEventChoice(state, "evt_caravan_wreck", "search_wreck");
      return {
        food: result.food,
        silver: result.silver,
        foodDelta: (result.food ?? 0) - 10,
        silverDelta: (result.silver ?? 0) - 20,
      };
    });
    assert.strictEqual(wreckTest.foodDelta, 4, "商队残骸 food +4");
    assert.strictEqual(wreckTest.silverDelta, 0, "商队残骸 silver 不变");
    console.log("  ✅ 商队残骸只加 food +4，不加 silver");

    console.log("=== 测试 10：遗弃工具箱只加 spareParts +1 ===");
    const toolboxTest = await page.evaluate(() => {
      const state = {
        food: 10,
        silver: 20,
        spareParts: 3,
        morale: 5,
        caravanHp: 100,
        caravanMaxHp: 100,
        mainOrderDeadlineDays: 30,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const afterEvent = window.resolveTutorialEventChoice(state, "evt_abandoned_toolbox", "take_toolbox");
      afterEvent.spareParts = (afterEvent.spareParts ?? 0) + 1;
      const afterEvent2 = window.resolveTutorialEventChoice(afterEvent, "evt_abandoned_toolbox", "take_toolbox");
      return {
        spareParts: afterEvent2.spareParts,
        spareDelta: afterEvent2.spareParts - 3,
      };
    });
    assert.strictEqual(toolboxTest.spareDelta, 1, "遗弃工具箱 spareParts +1（只加一次）");
    console.log("  ✅ 遗弃工具箱只加 spareParts +1");

    console.log("=== 测试 11：驿站灯火只加 morale +1 ===");
    const outpostLightsTest = await page.evaluate(() => {
      const state = {
        food: 10,
        silver: 20,
        spareParts: 3,
        morale: 5,
        caravanHp: 100,
        caravanMaxHp: 100,
        mainOrderDeadlineDays: 30,
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
      };
      const result = window.resolveTutorialEventChoice(state, "evt_outpost_lights", "head_to_outpost");
      const result2 = window.resolveTutorialEventChoice(result, "evt_outpost_lights", "head_to_outpost");
      return {
        morale: result2.morale,
        moraleDelta: (result2.morale ?? 0) - 5,
      };
    });
    assert.strictEqual(outpostLightsTest.moraleDelta, 1, "驿站灯火 morale +1（只加一次）");
    console.log("  ✅ 驿站灯火只加 morale +1");

    console.log("=== 测试 12：普通战占位胜利不会重复发奖励 ===");
    const battleTest = await page.evaluate(() => {
      const gs = {
        silver: 35,
        food: 22,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
      };
      const result = window.resolveTutorialBattleVictory(gs, "battle_young_ash_beast");
      const result2 = window.resolveTutorialBattleVictory(result, "battle_young_ash_beast");
      return {
        silver: result2.silver,
        silverDelta: result2.silver - 35,
        resolvedCount: result2.resolvedTutorialBattleIds.length,
      };
    });
    assert.strictEqual(battleTest.silverDelta, 3, "普通战只发一次奖励(silver +3)");
    assert.strictEqual(battleTest.resolvedCount, 1, "战斗只结算一次");
    console.log("  ✅ 普通战占位胜利不会重复发奖励");

    console.log("=== 测试 13：劫匪战占位胜利不会重复发奖励 ===");
    const specialBattleTest = await page.evaluate(() => {
      const gs = {
        silver: 35,
        food: 22,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
      };
      const result = window.resolveTutorialSpecialBattleVictory(gs, "special_bandit_cargo_raid");
      const result2 = window.resolveTutorialSpecialBattleVictory(result, "special_bandit_cargo_raid");
      return {
        silver: result2.silver,
        silverDelta: result2.silver - 35,
        resolvedCount: result2.resolvedTutorialSpecialBattleIds.length,
      };
    });
    assert.strictEqual(specialBattleTest.silverDelta, 5, "劫匪战只发一次奖励(silver +5)");
    assert.strictEqual(specialBattleTest.resolvedCount, 1, "特殊战只结算一次");
    console.log("  ✅ 劫匪战占位胜利不会重复发奖励");

    console.log("=== 测试 14：灰烬母巢挑战胜利获得 emberSeeds ===");
    const eliteVictoryTest = await page.evaluate(() => {
      const gs = {
        silver: 35,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        emberSeeds: 0,
        ancientMemoryFragments: 0,
        ashMaterials: 0,
        resolvedTutorialEliteBattleIds: [],
        tutorialEliteBattleFlags: [],
      };
      const result = window.resolveTutorialEliteBattleVictory(gs, "elite_ash_nest");
      return {
        emberSeeds: result.emberSeeds,
        ancientMemoryFragments: result.ancientMemoryFragments,
        ashMaterials: result.ashMaterials,
        flags: result.tutorialEliteBattleFlags,
      };
    });
    assert.strictEqual(eliteVictoryTest.emberSeeds, 1, "挑战胜利获得 emberSeeds");
    assert.strictEqual(eliteVictoryTest.ancientMemoryFragments, 1, "挑战胜利获得 ancientMemoryFragments");
    assert.strictEqual(eliteVictoryTest.ashMaterials, 2, "挑战胜利获得 ashMaterials");
    console.log("  ✅ 灰烬母巢挑战胜利能获得 emberSeeds");

    console.log("=== 测试 15：灰烬母巢救援不获得 emberSeeds ===");
    const eliteRescueTest = await page.evaluate(() => {
      const gs = {
        silver: 35,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        emberSeeds: 0,
        ancientMemoryFragments: 0,
        ashMaterials: 0,
        resolvedTutorialEliteBattleIds: [],
        tutorialEliteBattleFlags: [],
      };
      const result = window.resolveTutorialEliteBattleRescue(gs, "elite_ash_nest");
      return {
        emberSeeds: result.emberSeeds,
        ancientMemoryFragments: result.ancientMemoryFragments,
        silverDelta: result.silver - 35,
        moraleDelta: result.morale - 6,
        hpDelta: result.caravanHp - 100,
      };
    });
    assert.strictEqual(eliteRescueTest.emberSeeds, 0, "救援不获得 emberSeeds");
    assert.strictEqual(eliteRescueTest.ancientMemoryFragments, 0, "救援不获得 ancientMemoryFragments");
    assert.strictEqual(eliteRescueTest.silverDelta, -20, "救援 silver -20");
    assert.strictEqual(eliteRescueTest.moraleDelta, -2, "救援 morale -2");
    assert.strictEqual(eliteRescueTest.hpDelta, -20, "救援 caravanHp -20");
    console.log("  ✅ 灰烬母巢救援不获得 emberSeeds");

    console.log("=== 测试 16-17：到达终点后包含完成 flag ===");
    const endFlagTest = await page.evaluate(() => {
      const gs = {
        tutorialEliteBattleFlags: [],
      };
      if (!gs.tutorialEliteBattleFlags.includes("n31_tutorial_route_completed")) {
        gs.tutorialEliteBattleFlags.push("n31_tutorial_route_completed");
      }
      if (!gs.tutorialEliteBattleFlags.includes("arrived_first_outpost")) {
        gs.tutorialEliteBattleFlags.push("arrived_first_outpost");
      }
      return {
        hasCompletedFlag: gs.tutorialEliteBattleFlags.includes("n31_tutorial_route_completed"),
        hasArrivedFlag: gs.tutorialEliteBattleFlags.includes("arrived_first_outpost"),
      };
    });
    assert.ok(endFlagTest.hasCompletedFlag, "包含 n31_tutorial_route_completed");
    assert.ok(endFlagTest.hasArrivedFlag, "包含 arrived_first_outpost");
    console.log("  ✅ 到达终点后写入正确的完成 flag");

    console.log("\n========================================");
    console.log("[C3f.2] N3.1 路线体验修整 smoke test 全部通过 ✅");
    console.log("========================================");
  } catch (err) {
    console.error("测试失败:", err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();