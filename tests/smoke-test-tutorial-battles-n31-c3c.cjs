/* eslint-disable */
/**
 * C3c：N3.1 普通战斗 smoke test
 *
 * 覆盖：
 * 1. N3.1 普通战斗数量是 4
 * 2. 每个普通战斗都能通过 nodeId 查询
 * 3. young_ash_beast_battle 有对应 encounter
 * 4. cracked_back_ash_beast_battle 有对应 encounter
 * 5. mixed_ash_beast_battle 有对应 encounter
 * 6. double_corroded_ash_beast_battle 有对应 encounter
 * 7. 所有 encounter 类型都是 normal_battle
 * 8. 第一场难度是 tutorial_easy
 * 9. 至少一场包含 vehicle_damage tag
 * 10. 至少一场包含 armor tag
 * 11. 至少一场包含 ash_corrosion tag
 * 12. 每场 battle 至少有 1 个 enemy
 * 13. 普通战斗不包含 Boss
 * 14. isTutorialBattleNode("bandit_cargo_raid") 返回 false
 * 15. isTutorialBattleNode("ash_nest_elite") 返回 false
 * 16. resolveTutorialBattleVictory 能结算胜利
 * 17. 重复结算不会重复给奖励
 * 18. resolvedTutorialBattleIds 不重复
 * 19. tutorialBattleFlags 不重复
 * 20. 未知 battleId 安全处理
 * 21. 未知 nodeId 安全处理
 * 22. 不影响 C3b 教学事件状态
 * 23. 不影响 C3a 教程路线状态
 * 24. 不影响 C2 主线状态
 * 25. 不影响 C1 Demo 世界地图状态
 * 26. 不影响城市复兴
 * 27. 不影响工具系统
 * 28. 不影响 CargoPrep 关键流程
 */

const { chromium } = require("playwright");
const assert = require("assert");

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:5173");

    // 等待页面脚本初始化
    await page.evaluate(async () => {
      let attempt = 0;
      while (!window.getN31TutorialBattles && attempt < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempt++;
      }
    });

    // 1. N3.1 普通战斗数量是 4
    const battles = await page.evaluate(() => window.getN31TutorialBattles());
    assert(Array.isArray(battles), "getN31TutorialBattles 返回数组");
    assert(battles.length === 4, "N3.1 普通战斗数量 = " + battles.length + "（期望 4）");

    // 2. 每个普通战斗都能通过 nodeId 查询
    const nodeIds = [
      "young_ash_beast_battle",
      "cracked_back_ash_beast_battle",
      "mixed_ash_beast_battle",
      "double_corroded_ash_beast_battle",
    ];
    for (const nodeId of nodeIds) {
      const b = await page.evaluate((id) => window.getTutorialBattleByNodeId(id), nodeId);
      assert(b !== undefined, "能通过 nodeId=" + nodeId + " 查询到战斗");
    }

    // 3-6. 指定节点有对应 encounter
    assert(
      (await page.evaluate(() => window.getTutorialBattleByNodeId("young_ash_beast_battle"))) !== undefined,
      "young_ash_beast_battle 有对应 encounter"
    );
    assert(
      (await page.evaluate(() => window.getTutorialBattleByNodeId("cracked_back_ash_beast_battle"))) !== undefined,
      "cracked_back_ash_beast_battle 有对应 encounter"
    );
    assert(
      (await page.evaluate(() => window.getTutorialBattleByNodeId("mixed_ash_beast_battle"))) !== undefined,
      "mixed_ash_beast_battle 有对应 encounter"
    );
    assert(
      (await page.evaluate(() => window.getTutorialBattleByNodeId("double_corroded_ash_beast_battle"))) !== undefined,
      "double_corroded_ash_beast_battle 有对应 encounter"
    );

    // 7. 所有 encounter 类型都是 normal_battle
    for (const b of battles) {
      assert(b.type === "normal_battle", b.id + " 类型 = " + b.type + "（期望 normal_battle）");
    }

    // 8. 第一场难度是 tutorial_easy
    assert(battles[0].difficulty === "tutorial_easy", "第一场难度 = " + battles[0].difficulty + "（期望 tutorial_easy）");

    // 9. 至少一场包含 vehicle_damage tag
    let hasVehicleDamage = false;
    for (const b of battles) {
      if (b.tags.includes("vehicle_damage")) { hasVehicleDamage = true; break; }
    }
    assert(hasVehicleDamage, "至少一场普通战斗包含 vehicle_damage tag");

    // 10. 至少一场包含 armor tag
    let hasArmor = false;
    for (const b of battles) {
      if (b.tags.includes("armor")) { hasArmor = true; break; }
    }
    assert(hasArmor, "至少一场普通战斗包含 armor tag");

    // 11. 至少一场包含 ash_corrosion tag
    let hasAshCorrosion = false;
    for (const b of battles) {
      if (b.tags.includes("ash_corrosion")) { hasAshCorrosion = true; break; }
    }
    assert(hasAshCorrosion, "至少一场普通战斗包含 ash_corrosion tag");

    // 12. 每场 battle 至少有 1 个 enemy
    for (const b of battles) {
      assert(Array.isArray(b.enemies) && b.enemies.length >= 1, b.id + " 至少有 1 个 enemy");
    }

    // 13. 普通战斗不包含 Boss
    for (const b of battles) {
      assert(b.type !== "boss" && b.difficulty !== "boss", b.id + " 不是 Boss");
    }

    // 14. isTutorialBattleNode("bandit_cargo_raid") 返回 false
    const isBandit = await page.evaluate(() => window.isTutorialBattleNode("bandit_cargo_raid"));
    assert(isBandit === false, "bandit_cargo_raid 不是普通战斗节点（劫匪特殊战在 C3d 处理）");

    // 15. isTutorialBattleNode("ash_nest_elite") 返回 false
    const isNest = await page.evaluate(() => window.isTutorialBattleNode("ash_nest_elite"));
    assert(isNest === false, "ash_nest_elite 不是普通战斗节点（精英战在 C3e 处理）");

    // 16. resolveTutorialBattleVictory 能结算胜利
    const afterVictory = await page.evaluate(() => {
      const state = {
        silver: 0,
        food: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
      };
      const next = window.resolveTutorialBattleVictory(state, "battle_young_ash_beast");
      return {
        resolved: next.resolvedTutorialBattleIds.includes("battle_young_ash_beast"),
        silverDelta: next.silver - state.silver,
        flagsLen: next.tutorialBattleFlags.length,
        hasFlag: next.tutorialBattleFlags.includes("first_tutorial_battle_won"),
      };
    });
    assert(afterVictory.resolved, "resolveTutorialBattleVictory 能写入 resolvedTutorialBattleIds");
    assert(afterVictory.silverDelta >= 3, "resolveTutorialBattleVictory 至少奖励 3 silver");
    assert(afterVictory.hasFlag, "resolveTutorialBattleVictory 能写入 first_tutorial_battle_won flag");

    // 17. 重复结算不会重复给奖励
    const repeatResult = await page.evaluate(() => {
      let state = {
        silver: 0,
        food: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
      };
      const first = window.resolveTutorialBattleVictory(state, "battle_young_ash_beast");
      const second = window.resolveTutorialBattleVictory(first, "battle_young_ash_beast");
      return {
        sameLen: first.resolvedTutorialBattleIds.length === second.resolvedTutorialBattleIds.length,
        sameSilver: first.silver === second.silver,
        sameFlags: first.tutorialBattleFlags.length === second.tutorialBattleFlags.length,
      };
    });
    assert(repeatResult.sameLen, "重复结算不增加 resolvedTutorialBattleIds 长度");
    assert(repeatResult.sameSilver, "重复结算不重复 silver 奖励");
    assert(repeatResult.sameFlags, "重复结算不重复 flag");

    // 18. resolvedTutorialBattleIds 不重复 —— 连续结算 4 场
    const fourBattles = await page.evaluate(() => {
      let state = {
        silver: 0,
        food: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
      };
      const ids = [
        "battle_young_ash_beast",
        "battle_cracked_back_ash_beast",
        "battle_mixed_ash_beast",
        "battle_double_corroded_ash_beast",
      ];
      for (const id of ids) {
        state = window.resolveTutorialBattleVictory(state, id);
        // 故意再调一次，检查不会重复加入
        state = window.resolveTutorialBattleVictory(state, id);
      }
      const seen = {};
      let duplicates = 0;
      for (const id of state.resolvedTutorialBattleIds) {
        seen[id] = (seen[id] || 0) + 1;
        if (seen[id] > 1) duplicates++;
      }
      return { duplicates, totalLen: state.resolvedTutorialBattleIds.length };
    });
    assert(fourBattles.duplicates === 0, "resolvedTutorialBattleIds 不重复（4 场胜利结算）");
    assert(fourBattles.totalLen === 4, "resolvedTutorialBattleIds 长度应为 4，实际 = " + fourBattles.totalLen);

    // 19. tutorialBattleFlags 不重复
    const flagsRepeat = await page.evaluate(() => {
      let state = {
        silver: 0,
        food: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
      };
      state = window.resolveTutorialBattleVictory(state, "battle_young_ash_beast");
      state = window.resolveTutorialBattleVictory(state, "battle_young_ash_beast");
      state = window.resolveTutorialBattleVictory(state, "battle_young_ash_beast");
      const seen = {};
      let dup = 0;
      for (const f of state.tutorialBattleFlags) {
        seen[f] = (seen[f] || 0) + 1;
        if (seen[f] > 1) dup++;
      }
      return { dup, totalLen: state.tutorialBattleFlags.length };
    });
    assert(flagsRepeat.dup === 0, "tutorialBattleFlags 不重复");

    // 20. 未知 battleId 安全处理
    const unknownBattle = await page.evaluate(() => {
      const state = {
        silver: 0,
        food: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
      };
      const next = window.resolveTutorialBattleVictory(state, "battle_nonexistent");
      return {
        emptyIds: next.resolvedTutorialBattleIds.length === 0,
        emptyFlags: next.tutorialBattleFlags.length === 0,
        sameSilver: next.silver === 0,
        canResolve: window.canResolveTutorialBattle(state, "battle_nonexistent"),
      };
    });
    assert(unknownBattle.emptyIds, "未知 battleId：resolvedTutorialBattleIds 仍为空");
    assert(unknownBattle.emptyFlags, "未知 battleId：tutorialBattleFlags 仍为空");
    assert(unknownBattle.sameSilver, "未知 battleId：silver 不变");
    assert(unknownBattle.canResolve === false, "canResolveTutorialBattle(未知) 应返回 false");

    // 21. 未知 nodeId 安全处理
    const unknownNode = await page.evaluate(() => {
      const b1 = window.getTutorialBattleByNodeId("nonexistent_battle_node");
      const b2 = window.isTutorialBattleNode("nonexistent_battle_node");
      const b3 = window.getTutorialBattleById("battle_nonexistent");
      return { byNodeId: b1, isNode: b2, byBattleId: b3 };
    });
    assert(unknownNode.byNodeId === undefined, "未知 nodeId 查询 getTutorialBattleByNodeId 返回 undefined");
    assert(unknownNode.isNode === false, "未知 nodeId 查询 isTutorialBattleNode 返回 false");
    assert(unknownNode.byBattleId === undefined, "未知 battleId 查询 getTutorialBattleById 返回 undefined");

    // 22-28. 不影响其他系统状态
    const crossCheck = await page.evaluate(() => {
      const gs1 = window.getGameState();
      const snapshot = {
        c3b: { resolvedIds: gs1.resolvedTutorialEventIds.length, flags: gs1.tutorialEventFlags.length },
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

      // 对独立 state 调用一次胜利结算
      const testState = {
        silver: 0,
        food: 0,
        morale: 3,
        caravanHp: 45,
        caravanMaxHp: 45,
        resolvedTutorialBattleIds: [],
        tutorialBattleFlags: [],
      };
      window.resolveTutorialBattleVictory(testState, "battle_young_ash_beast");

      const gs2 = window.getGameState();
      const after = {
        c3b: { resolvedIds: gs2.resolvedTutorialEventIds.length, flags: gs2.tutorialEventFlags.length },
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
        c3b: JSON.stringify(snapshot.c3b) === JSON.stringify(after.c3b),
        c3a: JSON.stringify(snapshot.c3a) === JSON.stringify(after.c3a),
        c2: JSON.stringify(snapshot.c2) === JSON.stringify(after.c2),
        c1: JSON.stringify(snapshot.c1) === JSON.stringify(after.c1),
        city: JSON.stringify(snapshot.city) === JSON.stringify(after.city),
        tool: JSON.stringify(snapshot.tool) === JSON.stringify(after.tool),
        cargo: JSON.stringify(snapshot.cargo) === JSON.stringify(after.cargo),
      };
    });
    assert(crossCheck.c3b, "不影响 C3b 教学事件状态");
    assert(crossCheck.c3a, "不影响 C3a 教程路线状态");
    assert(crossCheck.c2, "不影响 C2 主线状态");
    assert(crossCheck.c1, "不影响 C1 Demo 世界地图状态");
    assert(crossCheck.city, "不影响城市复兴");
    assert(crossCheck.tool, "不影响工具系统");
    assert(crossCheck.cargo, "不影响 CargoPrep 关键流程");

    console.log("[C3c] N3.1 普通战斗 smoke test 全部通过");
  } catch (err) {
    console.error("[C3c] 测试失败：", err);
    process.exit(1);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
})();
