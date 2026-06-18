/* eslint-disable */
/**
 * C3e.1：N3.1 灰烬母巢可选精英战 smoke test（patch：flag 补全 + 驿站明确推进 + 基础资源）
 *
 * 覆盖：
 * 1) 数据测试：1 个 optional_elite，id=elite_ash_nest
 * 2) 跳过测试：ash_nest_elite_skipped flag / 不奖励 / 防重复
 * 3) 胜利测试：silver+15, morale+1, emberSeeds+1, ancientMemoryFragments+1, ashMaterials+2
 * 4) 救援测试：currentTutorialNodeId="arrive_first_outpost" / silver-20(最低0) / morale-2(最低0) / caravanHp-20(最低保留20)
 * 5) 互斥测试：skip/victory/rescue 三者互斥
 * 6) 回归：灰烬母巢不在普通战斗列表 / 特殊战斗列表，Boss 数量=0
 * 7) 初始资源：food=22, silver=35, morale=6, caravanHp/caravanMaxHp=100, spareParts=3
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

    // ===== 初始资源测试 =====
    console.log("=== 初始资源测试 ===");
    const initialState = await page.evaluate(() => window.getGameState());
    assert.strictEqual(initialState.food, 22, "初始 food = 22");
    assert.strictEqual(initialState.silver, 35, "初始 silver = 35");
    assert.strictEqual(initialState.morale, 6, "初始 morale = 6");
    assert.strictEqual(initialState.caravanHp, 100, "初始 caravanHp = 100");
    assert.strictEqual(initialState.caravanMaxHp, 100, "初始 caravanMaxHp = 100");
    assert.strictEqual(initialState.spareParts, 3, "初始 spareParts = 3");
    assert.ok(Array.isArray(initialState.caravanParts), "caravanParts 不受影响（仍是数组）");
    console.log("  ✅ 初始资源测试全部通过");

    // ===== 数据测试 =====
    console.log("=== 数据测试 ===");
    const battles = await page.evaluate(() => window.getN31TutorialEliteBattles());
    assert.strictEqual(battles.length, 1, "N3.1 只有 1 个 elite battle");
    assert.strictEqual(battles[0].id, "elite_ash_nest", "id = elite_ash_nest");
    assert.strictEqual(battles[0].nodeId, "ash_nest_elite", "nodeId = ash_nest_elite");
    assert.strictEqual(battles[0].type, "optional_elite", "type = optional_elite");
    assert.strictEqual(battles[0].isBoss, false, "isBoss = false");
    assert.strictEqual(battles[0].isOptional, true, "isOptional = true");
    assert.strictEqual(battles[0].enemies.length, 4, "敌人数量 = 4");

    const core = battles[0].enemies.find((e) => e.id === "ash_nest_core");
    assert.ok(core && core.hp === 120, "灰烬母巢核心 hp = 120");
    const spore = battles[0].enemies.find((e) => e.id === "ash_spore_sac");
    assert.ok(spore && spore.hp === 35, "灰烬孢囊 hp = 35");
    assert.ok(
      spore.tags.some((t) => t.indexOf("max_summon_1") !== -1),
      "灰烬孢囊 max_summon_1 tag 存在（最多召唤 1 次）",
    );

    const byId = await page.evaluate(() =>
      window.getTutorialEliteBattleById("elite_ash_nest"),
    );
    assert.ok(byId && byId.id === "elite_ash_nest", "getTutorialEliteBattleById 正常返回");
    const byNodeId = await page.evaluate(() =>
      window.getTutorialEliteBattleByNodeId("ash_nest_elite"),
    );
    assert.ok(
      byNodeId && byNodeId.id === "elite_ash_nest",
      "getTutorialEliteBattleByNodeId 正常返回",
    );
    const isNode = await page.evaluate(() =>
      window.isTutorialEliteBattleNode("ash_nest_elite"),
    );
    assert.strictEqual(isNode, true, "isTutorialEliteBattleNode('ash_nest_elite') = true");
    console.log("  ✅ 数据测试全部通过");

    // ===== 跳过测试（新增 ash_nest_elite_skipped flag）=====
    console.log("=== 跳过测试 ===");
    const skipState = await page.evaluate(() => {
      const s = {
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
      const next = window.skipTutorialEliteBattle(s, "elite_ash_nest");
      const next2 = window.skipTutorialEliteBattle(next, "elite_ash_nest");
      return { next, next2 };
    });
    // 资源不变
    assert.strictEqual(skipState.next.silver, 35, "skip silver 不变");
    assert.strictEqual(skipState.next.morale, 6, "skip morale 不变");
    assert.strictEqual(skipState.next.emberSeeds, 0, "skip emberSeeds 不变");
    assert.strictEqual(skipState.next.ancientMemoryFragments, 0, "skip ancientMemoryFragments 不变");
    assert.strictEqual(skipState.next.ashMaterials, 0, "skip ashMaterials 不变");
    assert.strictEqual(skipState.next.spareParts, 3, "skip spareParts 不变");
    assert.strictEqual(skipState.next.caravanHp, 100, "skip caravanHp 不变");
    // 明确 skip flag
    assert.ok(
      skipState.next.tutorialEliteBattleFlags.includes("ash_nest_elite_skipped"),
      "skip 写入 ash_nest_elite_skipped flag",
    );
    // 路线节点写入
    assert.ok(
      skipState.next.skippedOptionalTutorialNodeIds.includes("ash_nest_elite"),
      "skip 写入 ash_nest_elite 到 skippedOptionalTutorialNodeIds",
    );
    assert.ok(
      skipState.next.resolvedTutorialEliteBattleIds.includes("elite_ash_nest"),
      "skip 写入 elite_ash_nest 到 resolvedTutorialEliteBattleIds",
    );
    // 防重复
    assert.strictEqual(
      skipState.next2.skippedOptionalTutorialNodeIds.length,
      1,
      "重复 skip 不重复添加 skippedOptionalTutorialNodeIds",
    );
    assert.strictEqual(
      skipState.next2.resolvedTutorialEliteBattleIds.length,
      1,
      "重复 skip 不重复添加 resolvedTutorialEliteBattleIds",
    );
    assert.strictEqual(
      skipState.next2.tutorialEliteBattleFlags.length,
      1,
      "重复 skip 不重复写入 flag",
    );
    console.log("  ✅ 跳过测试全部通过");

    // ===== 胜利测试 =====
    console.log("=== 胜利测试 ===");
    const winState = await page.evaluate(() => {
      const s = {
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
      const next = window.resolveTutorialEliteBattleVictory(s, "elite_ash_nest");
      const next2 = window.resolveTutorialEliteBattleVictory(next, "elite_ash_nest");
      return { next, next2 };
    });
    assert.strictEqual(winState.next.silver, 50, "victory silver = 35+15 = 50");
    assert.strictEqual(winState.next.morale, 7, "victory morale = 6+1 = 7");
    assert.strictEqual(winState.next.emberSeeds, 1, "victory emberSeeds = 1");
    assert.strictEqual(winState.next.ancientMemoryFragments, 1, "victory ancientMemoryFragments = 1");
    assert.strictEqual(winState.next.ashMaterials, 2, "victory ashMaterials = 2");
    assert.strictEqual(winState.next.spareParts, 3, "victory spareParts 不变");
    assert.ok(
      winState.next.tutorialEliteBattleFlags.includes("ash_nest_elite_won"),
      "victory 写入 ash_nest_elite_won flag",
    );
    assert.strictEqual(winState.next2.silver, 50, "重复 victory silver 不增加");
    assert.strictEqual(winState.next2.emberSeeds, 1, "重复 victory emberSeeds 不增加");
    assert.strictEqual(winState.next2.tutorialEliteBattleFlags.length, 1, "重复 victory 不重复写入 flag");
    assert.ok(
      winState.next.resolvedTutorialEliteBattleIds.includes("elite_ash_nest"),
      "victory 后 resolved = true",
    );
    console.log("  ✅ 胜利测试全部通过");

    // ===== 救援测试（明确送到第一个驿站：currentTutorialNodeId = arrive_first_outpost）=====
    console.log("=== 救援测试 ===");
    const rescueState = await page.evaluate(() => {
      const s = {
        silver: 25,
        morale: 6,
        caravanHp: 100,
        caravanMaxHp: 100,
        emberSeeds: 5,
        ancientMemoryFragments: 5,
        ashMaterials: 5,
        spareParts: 3,
        currentTutorialNodeId: null,
        completedTutorialNodeIds: [],
        skippedOptionalTutorialNodeIds: [],
        resolvedTutorialEliteBattleIds: [],
        tutorialEliteBattleFlags: [],
      };
      const next = window.resolveTutorialEliteBattleRescue(s, "elite_ash_nest");
      const next2 = window.resolveTutorialEliteBattleRescue(next, "elite_ash_nest");
      return { next, next2 };
    });
    assert.strictEqual(rescueState.next.silver, 5, "rescue silver = 25-20 = 5");
    assert.strictEqual(rescueState.next.morale, 4, "rescue morale = 6-2 = 4");
    assert.strictEqual(rescueState.next.caravanHp, 80, "rescue caravanHp = 100-20 = 80");
    assert.strictEqual(rescueState.next.spareParts, 3, "rescue spareParts 不变");
    // 不给精英奖励
    assert.strictEqual(rescueState.next.emberSeeds, 5, "rescue 不给 emberSeeds（保持 5）");
    assert.strictEqual(rescueState.next.ancientMemoryFragments, 5, "rescue 不给 ancientMemoryFragments");
    assert.strictEqual(rescueState.next.ashMaterials, 5, "rescue 不给 ashMaterials");
    assert.ok(
      rescueState.next.tutorialEliteBattleFlags.includes("ash_nest_rescued_by_passing_caravan"),
      "rescue 写入 ash_nest_rescued_by_passing_caravan flag",
    );
    // 明确送到第一个驿站
    assert.strictEqual(
      rescueState.next.currentTutorialNodeId,
      "arrive_first_outpost",
      "rescue currentTutorialNodeId = 'arrive_first_outpost'",
    );
    assert.ok(
      rescueState.next.completedTutorialNodeIds.includes("ash_nest_elite"),
      "rescue completedTutorialNodeIds 包含 ash_nest_elite",
    );
    // 防重复惩罚
    assert.strictEqual(rescueState.next2.silver, 5, "重复 rescue silver 不再次减少");
    assert.strictEqual(rescueState.next2.caravanHp, 80, "重复 rescue caravanHp 不再次减少");
    console.log("  ✅ 救援测试全部通过");

    // ===== 资源下限测试 =====
    console.log("=== 资源下限测试 ===");
    const lowState = await page.evaluate(() => {
      const s = {
        silver: 5,
        morale: 1,
        caravanHp: 25,
        caravanMaxHp: 45,
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
      const next = window.resolveTutorialEliteBattleRescue(s, "elite_ash_nest");
      return next;
    });
    assert.strictEqual(lowState.silver, 0, "silver = 5-20, 最低 0");
    assert.strictEqual(lowState.morale, 0, "morale = 1-2, 最低 0");
    assert.strictEqual(lowState.caravanHp, 20, "caravanHp 最低保留 20（25-20=5，但 floor=20）");
    console.log("  ✅ 资源下限测试全部通过");

    // ===== 互斥测试 =====
    console.log("=== 互斥测试 ===");
    // skip → victory
    const m1 = await page.evaluate(() => {
      const s = {
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
      const s2 = window.skipTutorialEliteBattle(s, "elite_ash_nest");
      const s3 = window.resolveTutorialEliteBattleVictory(s2, "elite_ash_nest");
      return { s2, s3 };
    });
    assert.strictEqual(m1.s3.silver, 35, "skip→victory silver 不增加");
    assert.strictEqual(m1.s3.emberSeeds, 0, "skip→victory emberSeeds 不增加");
    assert.ok(
      !m1.s3.tutorialEliteBattleFlags.includes("ash_nest_elite_won"),
      "skip→victory 不写入 ash_nest_elite_won",
    );
    assert.ok(
      m1.s3.tutorialEliteBattleFlags.includes("ash_nest_elite_skipped"),
      "skip→victory 仍保留 ash_nest_elite_skipped",
    );

    // victory → rescue
    const m2 = await page.evaluate(() => {
      const s = {
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
      const s2 = window.resolveTutorialEliteBattleVictory(s, "elite_ash_nest");
      const s3 = window.resolveTutorialEliteBattleRescue(s2, "elite_ash_nest");
      return { s2, s3 };
    });
    assert.strictEqual(m2.s3.silver, 50, "victory→rescue silver 不减少");
    assert.strictEqual(m2.s3.currentTutorialNodeId, null, "victory→rescue currentTutorialNodeId 不变（原为 null）");
    assert.ok(
      !m2.s3.tutorialEliteBattleFlags.includes("ash_nest_rescued_by_passing_caravan"),
      "victory→rescue 不写入救援 flag",
    );

    // rescue → victory
    const m3 = await page.evaluate(() => {
      const s = {
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
      const s2 = window.resolveTutorialEliteBattleRescue(s, "elite_ash_nest");
      const s3 = window.resolveTutorialEliteBattleVictory(s2, "elite_ash_nest");
      return { s2, s3 };
    });
    assert.strictEqual(m3.s3.silver, 15, "rescue→victory silver 不增加（保持 15）");
    assert.strictEqual(m3.s3.emberSeeds, 0, "rescue→victory emberSeeds 仍为 0");
    assert.ok(
      !m3.s3.tutorialEliteBattleFlags.includes("ash_nest_elite_won"),
      "rescue→victory 不写入 victory flag",
    );
    console.log("  ✅ 互斥测试全部通过");

    // ===== 回归测试 =====
    console.log("=== 回归测试 ===");
    const normalBattles = await page.evaluate(() => window.getN31TutorialBattles());
    assert.ok(
      !normalBattles.some((b) => b.id === "elite_ash_nest"),
      "灰烬母巢不在普通战斗列表中",
    );
    assert.strictEqual(normalBattles.length, 4, "普通战斗数量 = 4");

    const specialBattles = await page.evaluate(() => window.getN31TutorialSpecialBattles());
    assert.ok(
      !specialBattles.some((b) => b.id === "elite_ash_nest"),
      "灰烬母巢不在特殊战斗列表中",
    );
    assert.strictEqual(specialBattles.length, 1, "特殊战斗数量 = 1");

    const allBattles = [...normalBattles, ...specialBattles, ...battles];
    const bossCount = allBattles.filter((b) => b.isBoss === true).length;
    assert.strictEqual(bossCount, 0, "所有战斗 isBoss !== true（Boss 数量 = 0）");

    // isTutorialEliteBattleResolved 验证
    const resolvedCheck = await page.evaluate(() => {
      const s = {
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
      const before = window.isTutorialEliteBattleResolved(s, "elite_ash_nest");
      const s2 = window.resolveTutorialEliteBattleVictory(s, "elite_ash_nest");
      const after = window.isTutorialEliteBattleResolved(s2, "elite_ash_nest");
      return { before, after };
    });
    assert.strictEqual(resolvedCheck.before, false, "胜利前 isResolved = false");
    assert.strictEqual(resolvedCheck.after, true, "胜利后 isResolved = true");
    console.log("  ✅ 回归测试全部通过");

    console.log("\n========================================");
    console.log("[C3e.1] N3.1 灰烬母巢精英战（patch）smoke test 全部通过 ✅");
    console.log("========================================");
  } catch (err) {
    console.error("测试失败:", err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
})();
