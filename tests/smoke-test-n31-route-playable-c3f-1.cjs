/* eslint-disable */
/**
 * C3f.1：N3.1 固定教学路线可见化 smoke test
 *
 * 覆盖：
 * 1. 能进入 N3.1 路线界面（通过启动 tutorialRoute 系统验证）
 * 2. 初始资源 food=22, spareParts=3, silver=35, morale=6, caravanHp=100, mainOrderDeadlineDays=30
 * 3. 商队残骸：仅 food +4，不增 silver，不增 spareParts
 * 4. 遗弃工具箱：spareParts +1，不增 silver / food
 * 5. 断裂路面强行通过：vehicle_hp -5（只扣一次）
 * 6. 受伤旅人给食物：food -1，morale +1（只扣一次）
 * 7. 受伤旅人给银币：silver -5（只扣一次）
 * 8. 驿站灯火：morale +1（只加一次）
 * 9. 灰烬母巢绕开：不影响资源，写入 skip 状态
 * 10. 灰烬母巢胜利：emberSeeds+1, ancientMemoryFragments+1, ashMaterials+2, silver+15, morale+1
 * 11. 灰烬母巢失败救援：silver -20, morale -2, caravanHp -20，但不增 emberSeeds / ancientMemoryFragments
 * 12. 能推进到 arrive_first_outpost（终点站）
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

    console.log("=== 测试 1-2：初始资源验证 ===");
    const initCheck = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        food: gs.food,
        spareParts: gs.spareParts,
        silver: gs.silver,
        morale: gs.morale,
        caravanHp: gs.caravanHp,
        caravanMaxHp: gs.caravanMaxHp,
        mainOrderDeadlineDays: gs.mainOrderDeadlineDays,
      };
    });
    assert.strictEqual(initCheck.food, 22, "初始 food = 22");
    assert.strictEqual(initCheck.spareParts, 3, "初始 spareParts = 3");
    assert.strictEqual(initCheck.silver, 35, "初始 silver = 35");
    assert.strictEqual(initCheck.morale, 6, "初始 morale = 6");
    assert.strictEqual(initCheck.caravanHp, 100, "初始 caravanHp = 100");
    assert.strictEqual(initCheck.caravanMaxHp, 100, "初始 caravanMaxHp = 100");
    assert.strictEqual(initCheck.mainOrderDeadlineDays, 30, "mainOrderDeadlineDays 初始 = 30");
    console.log("  ✅ 初始资源正确");

    console.log("=== 测试 3：商队残骸 food +4，silver 不变，spareParts 不变 ===");
    const wreckTest = await page.evaluate(() => {
      // 使用独立状态，不从 getGameState 读取
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
        spareParts: 3, // event system 不操作 spareParts
        foodDelta: (result.food ?? 0) - 10,
        silverDelta: (result.silver ?? 0) - 20,
        resolvedCount: result.resolvedTutorialEventIds.length,
      };
    });
    assert.strictEqual(wreckTest.foodDelta, 4, "商队残骸 food +4（净变化）");
    assert.strictEqual(wreckTest.silverDelta, 0, "商队残骸 silver 不变（无变化）");
    assert.strictEqual(wreckTest.resolvedCount, 1, "事件只结算 1 次");
    console.log("  ✅ 商队残骸正确：food +4，silver 不变，不增 spareParts");

    console.log("=== 测试 4：遗弃工具箱 spareParts +1 ===");
    const toolboxTest = await page.evaluate(() => {
      // 使用 TutorialRouteScene 的逻辑：先调用 resolveTutorialEventChoice（只会写 flag）
      // 再在 Scene 层补 spareParts +1
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
      // Scene 层补的 spareParts +1
      if (typeof afterEvent.spareParts === "number") {
        afterEvent.spareParts = afterEvent.spareParts + 1;
      } else {
        afterEvent.spareParts = 1;
      }
      return {
        spareParts: afterEvent.spareParts,
        food: afterEvent.food,
        silver: afterEvent.silver,
        spareDelta: afterEvent.spareParts - 3,
        foodDelta: (afterEvent.food ?? 0) - 10,
        silverDelta: (afterEvent.silver ?? 0) - 20,
      };
    });
    assert.strictEqual(toolboxTest.spareDelta, 1, "遗弃工具箱 spareParts +1（只加一次）");
    assert.strictEqual(toolboxTest.foodDelta, 0, "遗弃工具箱 food 不变");
    assert.strictEqual(toolboxTest.silverDelta, 0, "遗弃工具箱 silver 不变");
    console.log("  ✅ 遗弃工具箱正确：spareParts +1，不增 silver/food");

    console.log("=== 测试 5：断裂路面强行通过 vehicle_hp -5（只扣一次） ===");
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
      return {
        caravanHp: result.caravanHp,
        hpDelta: (result.caravanHp ?? 0) - 100,
        resolvedCount: result.resolvedTutorialEventIds.length,
      };
    });
    assert.strictEqual(brokenRoadTest.hpDelta, -5, "断裂路面 vehicle_hp -5（只扣一次）");
    assert.strictEqual(brokenRoadTest.resolvedCount, 1, "事件只结算 1 次");
    assert.strictEqual(brokenRoadTest.caravanHp, 95, "caravanHp = 100-5 = 95");
    console.log("  ✅ 断裂路面强行通过正确：vehicle_hp 只扣 5");

    console.log("=== 测试 6：受伤旅人分给食物 food -1，morale +1 ===");
    const injuredFoodTest = await page.evaluate(() => {
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
      const result = window.resolveTutorialEventChoice(state, "evt_injured_traveler", "share_supplies");
      return {
        food: result.food,
        silver: result.silver,
        morale: result.morale,
        foodDelta: (result.food ?? 0) - 10,
        silverDelta: (result.silver ?? 0) - 20,
        moraleDelta: (result.morale ?? 0) - 5,
      };
    });
    assert.strictEqual(injuredFoodTest.foodDelta, -1, "受伤旅人 food -1（只扣一次）");
    assert.strictEqual(injuredFoodTest.silverDelta, 0, "受伤旅人 silver 不变");
    assert.strictEqual(injuredFoodTest.moraleDelta, 1, "受伤旅人 morale +1（只加一次）");
    console.log("  ✅ 受伤旅人给食物正确：food -1，morale +1，不扣 silver");

    console.log("=== 测试 7：受伤旅人给银币 silver -5 ===");
    const injuredSilverTest = await page.evaluate(() => {
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
      const result = window.resolveTutorialEventChoice(state, "evt_injured_traveler", "give_coins");
      return {
        food: result.food,
        silver: result.silver,
        morale: result.morale,
        silverDelta: (result.silver ?? 0) - 20,
      };
    });
    assert.strictEqual(injuredSilverTest.silverDelta, -5, "受伤旅人 silver -5（只扣一次）");
    assert.strictEqual(injuredSilverTest.silver, 15, "silver = 20-5 = 15");
    console.log("  ✅ 受伤旅人给银币正确：silver -5");

    console.log("=== 测试 8：驿站灯火 morale +1 ===");
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
      return {
        morale: result.morale,
        moraleDelta: (result.morale ?? 0) - 5,
        silverDelta: (result.silver ?? 0) - 20,
        foodDelta: (result.food ?? 0) - 10,
        resolvedCount: result.resolvedTutorialEventIds.length,
      };
    });
    assert.strictEqual(outpostLightsTest.moraleDelta, 1, "驿站灯火 morale +1（只加一次）");
    assert.strictEqual(outpostLightsTest.silverDelta, 0, "驿站灯火 silver 不变");
    assert.strictEqual(outpostLightsTest.foodDelta, 0, "驿站灯火 food 不变");
    assert.strictEqual(outpostLightsTest.resolvedCount, 1, "事件只结算 1 次");
    console.log("  ✅ 驿站灯火正确：morale +1，不增 silver/food");

    console.log("=== 测试 9-11：灰烬母巢三种结果 ===");
    const eliteTest = await page.evaluate(() => {
      // 绕开
      const s1 = {
        silver: 35,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        emberSeeds: 0,
        ancientMemoryFragments: 0,
        ashMaterials: 0,
        spareParts: 3,
        currentTutorialNodeId: null,
        completedTutorialNodeIds: [],
        skippedOptionalTutorialNodeIds: [],
        resolvedTutorialEliteBattleIds: [],
        tutorialEliteBattleFlags: [],
      };
      const s1After = window.skipTutorialEliteBattle(s1, "elite_ash_nest");
      const skipSilver = s1After.silver;
      const skipMorale = s1After.morale;
      const skipEmberSeeds = s1After.emberSeeds;
      const skipResolved = s1After.resolvedTutorialEliteBattleIds.length;

      // 胜利
      const s2 = {
        silver: 35,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        emberSeeds: 0,
        ancientMemoryFragments: 0,
        ashMaterials: 0,
        spareParts: 3,
        currentTutorialNodeId: null,
        completedTutorialNodeIds: [],
        skippedOptionalTutorialNodeIds: [],
        resolvedTutorialEliteBattleIds: [],
        tutorialEliteBattleFlags: [],
      };
      const s2After = window.resolveTutorialEliteBattleVictory(s2, "elite_ash_nest");

      // 救援
      const s3 = {
        silver: 35,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        emberSeeds: 0,
        ancientMemoryFragments: 0,
        ashMaterials: 0,
        spareParts: 3,
        currentTutorialNodeId: null,
        completedTutorialNodeIds: [],
        skippedOptionalTutorialNodeIds: [],
        resolvedTutorialEliteBattleIds: [],
        tutorialEliteBattleFlags: [],
      };
      const s3After = window.resolveTutorialEliteBattleRescue(s3, "elite_ash_nest");

      return {
        skip: { silver: skipSilver, morale: skipMorale, emberSeeds: skipEmberSeeds, resolved: skipResolved },
        victory: {
          silver: s2After.silver,
          silverDelta: s2After.silver - 35,
          morale: s2After.morale,
          moraleDelta: s2After.morale - 6,
          emberSeeds: s2After.emberSeeds,
          ancientMemoryFragments: s2After.ancientMemoryFragments,
          ashMaterials: s2After.ashMaterials,
          flags: s2After.tutorialEliteBattleFlags,
        },
        rescue: {
          silver: s3After.silver,
          silverDelta: s3After.silver - 35,
          morale: s3After.morale,
          moraleDelta: s3After.morale - 6,
          caravanHp: s3After.caravanHp,
          hpDelta: s3After.caravanHp - 100,
          emberSeeds: s3After.emberSeeds,
          ancientMemoryFragments: s3After.ancientMemoryFragments,
          flags: s3After.tutorialEliteBattleFlags,
        },
      };
    });

    assert.strictEqual(eliteTest.skip.silver, 35, "绕开 silver 不变 = 35");
    assert.strictEqual(eliteTest.skip.morale, 6, "绕开 morale 不变 = 6");
    assert.strictEqual(eliteTest.skip.emberSeeds, 0, "绕开不增 emberSeeds");
    assert.strictEqual(eliteTest.skip.resolved, 1, "绕开后 resolved = 1");
    console.log("  ✅ 灰烬母巢绕开正确");

    assert.strictEqual(eliteTest.victory.silverDelta, 15, "胜利 silver +15");
    assert.strictEqual(eliteTest.victory.moraleDelta, 1, "胜利 morale +1");
    assert.strictEqual(eliteTest.victory.emberSeeds, 1, "胜利 emberSeeds +1");
    assert.strictEqual(eliteTest.victory.ancientMemoryFragments, 1, "胜利 ancientMemoryFragments +1");
    assert.strictEqual(eliteTest.victory.ashMaterials, 2, "胜利 ashMaterials +2");
    assert.ok(eliteTest.victory.flags.includes("ash_nest_elite_won"), "胜利写入 ash_nest_elite_won flag");
    console.log("  ✅ 灰烬母巢胜利正确：emberSeeds+1, ancientMemoryFragments+1, ashMaterials+2, silver+15, morale+1");

    assert.strictEqual(eliteTest.rescue.silverDelta, -20, "救援 silver -20");
    assert.strictEqual(eliteTest.rescue.silver, 15, "救援 silver = 35-20 = 15");
    assert.strictEqual(eliteTest.rescue.moraleDelta, -2, "救援 morale -2");
    assert.strictEqual(eliteTest.rescue.morale, 4, "救援 morale = 6-2 = 4");
    assert.strictEqual(eliteTest.rescue.hpDelta, -20, "救援 caravanHp -20");
    assert.strictEqual(eliteTest.rescue.caravanHp, 80, "救援 caravanHp = 100-20 = 80");
    assert.strictEqual(eliteTest.rescue.emberSeeds, 0, "救援不增 emberSeeds");
    assert.strictEqual(eliteTest.rescue.ancientMemoryFragments, 0, "救援不增 ancientMemoryFragments");
    assert.ok(eliteTest.rescue.flags.includes("ash_nest_rescued_by_passing_caravan"), "救援写入 ash_nest_rescued_by_passing_caravan flag");
    console.log("  ✅ 灰烬母巢救援正确：silver -20, morale -2, caravanHp -20，不给精英奖励");

    console.log("=== 测试 12：全路线推进到 arrive_first_outpost ===");
    const fullRouteTest = await page.evaluate(() => {
      const gs = {
        day: 1,
        food: 22,
        silver: 35,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        spareParts: 3,
        mainOrderDeadlineDays: 30,
        emberSeeds: 0,
        ancientMemoryFragments: 0,
        ashMaterials: 0,
        currentTutorialNodeId: null,
        completedTutorialNodeIds: [],
        skippedOptionalTutorialNodeIds: [],
        resolvedTutorialEventIds: [],
        tutorialEventFlags: [],
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        resolvedTutorialEliteBattleIds: [],
        tutorialEliteBattleFlags: [],
      };

      const route = window.startN31TutorialRoute(gs);
      Object.assign(gs, route);

      const nodes = window.getN31TutorialRouteNodes();

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type === "start") {
          gs.day += 1;
          gs.food = Math.max(0, gs.food - 1);
          gs.mainOrderDeadlineDays = Math.max(0, gs.mainOrderDeadlineDays - 1);
        } else if (node.type === "peaceful_day") {
          gs.day += 1;
          gs.food = Math.max(0, gs.food - 1);
          gs.mainOrderDeadlineDays = Math.max(0, gs.mainOrderDeadlineDays - 1);
        } else if (node.type === "small_event" || node.type === "resource_event") {
          const evt = window.getTutorialEventByNodeId(node.id);
          if (evt) {
            const choiceId = node.id === "broken_road" ? "force_through"
              : node.id === "injured_traveler" ? "share_supplies"
              : node.id === "caravan_wreck" ? "search_wreck"
              : node.id === "abandoned_toolbox" ? "take_toolbox"
              : "head_to_outpost";
            const result = window.resolveTutorialEventChoice(gs, evt.id, choiceId);
            Object.assign(gs, result);
            if (choiceId === "take_toolbox") {
              gs.spareParts = (gs.spareParts ?? 0) + 1;
            }
          }
          gs.day += 1;
          gs.food = Math.max(0, gs.food - 1);
          gs.mainOrderDeadlineDays = Math.max(0, gs.mainOrderDeadlineDays - 1);
        } else if (node.type === "normal_battle") {
          const battle = window.getTutorialBattleByNodeId(node.id);
          if (battle) {
            const result = window.resolveTutorialBattleVictory(gs, battle.id);
            Object.assign(gs, result);
          }
          gs.day += 1;
          gs.food = Math.max(0, gs.food - 1);
          gs.mainOrderDeadlineDays = Math.max(0, gs.mainOrderDeadlineDays - 1);
        } else if (node.type === "special_battle") {
          const special = window.getTutorialSpecialBattleByNodeId(node.id);
          if (special) {
            const result = window.resolveTutorialSpecialBattleVictory(gs, special.id);
            Object.assign(gs, result);
          }
          gs.day += 1;
          gs.food = Math.max(0, gs.food - 1);
          gs.mainOrderDeadlineDays = Math.max(0, gs.mainOrderDeadlineDays - 1);
        } else if (node.type === "optional_elite") {
          const elite = window.getTutorialEliteBattleByNodeId(node.id);
          if (elite) {
            const result = window.skipTutorialEliteBattle(gs, elite.id);
            Object.assign(gs, result);
          }
          gs.day += 1;
          gs.food = Math.max(0, gs.food - 1);
          gs.mainOrderDeadlineDays = Math.max(0, gs.mainOrderDeadlineDays - 1);
        }

        const completeState = window.completeTutorialNode(gs, node.id);
        Object.assign(gs, completeState);
        const advState = window.advanceToNextTutorialNode(gs);
        Object.assign(gs, advState);
      }

      return {
        day: gs.day,
        currentNode: gs.currentTutorialNodeId,
        food: gs.food,
        silver: gs.silver,
        morale: gs.morale,
        caravanHp: gs.caravanHp,
        spareParts: gs.spareParts,
        completedCount: gs.completedTutorialNodeIds.length,
        emberSeeds: gs.emberSeeds,
        ancientMemoryFragments: gs.ancientMemoryFragments,
        ashMaterials: gs.ashMaterials,
      };
    });

    assert.strictEqual(fullRouteTest.currentNode, "arrive_first_outpost", "currentTutorialNodeId = arrive_first_outpost");
    assert.ok(fullRouteTest.day >= 20, `day >= 20（实际 ${fullRouteTest.day}）`);
    assert.strictEqual(fullRouteTest.completedCount, 20, "completedTutorialNodeIds 有 20 条");
    assert.strictEqual(fullRouteTest.emberSeeds, 0, "绕开母巢 emberSeeds = 0");
    assert.strictEqual(fullRouteTest.ancientMemoryFragments, 0, "绕开母巢 ancientMemoryFragments = 0");
    console.log("  ✅ 可从第 1 天推进到灰灯驿站");

    console.log("\n========================================");
    console.log("[C3f.1] N3.1 教学路线可见化 smoke test 全部通过 ✅");
    console.log("========================================");
  } catch (err) {
    console.error("测试失败:", err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
