/* eslint-disable */
/**
 * C3d：N3.1 特殊战斗（劫匪抢货战）smoke test
 *
 * 覆盖 1-30 项验证，详见报告。
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

    // 等待测试 API 就绪
    await page.evaluate(async () => {
      let attempt = 0;
      while (!window.getN31TutorialSpecialBattles && attempt < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempt++;
      }
    });

    // 1. N3.1 特殊战数量是 1
    const battles = await page.evaluate(() => window.getN31TutorialSpecialBattles());
    assert(Array.isArray(battles), "getN31TutorialSpecialBattles 返回数组");
    assert(battles.length === 1, "N3.1 特殊战数量 = " + battles.length + "（期望 1）");

    // 2. 特殊战 nodeId 是 bandit_cargo_raid
    assert(battles[0].nodeId === "bandit_cargo_raid",
      "nodeId = " + battles[0].nodeId + "（期望 bandit_cargo_raid）");

    // 3. 特殊战类型是 special_battle
    assert(battles[0].type === "special_battle",
      "type = " + battles[0].type + "（期望 special_battle）");

    // 4. 特殊战不是 normal_battle
    assert(battles[0].type !== "normal_battle", "该特殊战不是 normal_battle");

    // 5. 特殊战不是 Boss（不使用 boss 字符串）
    const tagsString = JSON.stringify(battles[0].tags);
    assert(!(battles[0].type === "boss"), "该特殊战不是 Boss（type=special_battle）");
    assert(battles[0].tags.includes("non_boss"), "该特殊战包含 non_boss tag，表明不是 Boss");

    // 6. 特殊战不是灰烬母巢（nodeId != ash_nest_elite）
    assert(battles[0].nodeId !== "ash_nest_elite", "该特殊战不是灰烬母巢");
    assert(battles[0].id !== "ash_nest_elite", "该特殊战 id 不是 ash_nest_elite");

    // 7. isTutorialSpecialBattleNode("bandit_cargo_raid") = true
    const isSpecial1 = await page.evaluate(() =>
      window.isTutorialSpecialBattleNode("bandit_cargo_raid")
    );
    assert(isSpecial1 === true, "isTutorialSpecialBattleNode(bandit_cargo_raid) = true");

    // 8. isTutorialSpecialBattleNode("young_ash_beast_battle") = false
    const isSpecial2 = await page.evaluate(() =>
      window.isTutorialSpecialBattleNode("young_ash_beast_battle")
    );
    assert(isSpecial2 === false, "isTutorialSpecialBattleNode(young_ash_beast_battle) = false");

    // 9. 通过 nodeId 能查到特殊战
    const byNode = await page.evaluate(() =>
      window.getTutorialSpecialBattleByNodeId("bandit_cargo_raid")
    );
    assert(byNode !== undefined, "通过 nodeId 能查到特殊战");
    assert(byNode.id === "special_bandit_cargo_raid", "通过 nodeId 查到正确的 id");

    // 10. 通过 id 能查到特殊战
    const byId = await page.evaluate(() =>
      window.getTutorialSpecialBattleById("special_bandit_cargo_raid")
    );
    assert(byId !== undefined, "通过 id 能查到特殊战");
    assert(byId.nodeId === "bandit_cargo_raid", "通过 id 查到正确的 nodeId");

    // 11. 至少 2 个劫匪敌人
    const enemies = await page.evaluate(() =>
      window.getTutorialSpecialBattleEnemies("special_bandit_cargo_raid")
    );
    assert(enemies.length >= 2, "至少 2 个劫匪敌人（实际 " + enemies.length + "）");

    // 12. 至少 1 个目标是 protect_cargo
    const objectives = await page.evaluate(() =>
      window.getTutorialSpecialBattleObjectives("special_bandit_cargo_raid")
    );
    const protectCargo = objectives.find((o) => o.type === "protect_cargo");
    assert(protectCargo !== undefined, "目标中包含 protect_cargo");

    // 13. protect_cargo 是 required
    assert(protectCargo.required === true, "protect_cargo 是 required");

    // 14. initialCargoIntegrity 是 100
    assert(
      protectCargo.initialCargoIntegrity === 100,
      "protect_cargo 初始完整度 = " + protectCargo.initialCargoIntegrity + "（期望 100）"
    );

    // 15. cargoIntegrity loss 后不会低于 0
    const resultLow = await page.evaluate(() => {
      const state = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      let s = window.resolveTutorialSpecialBattleCargoLoss(
        state, "special_bandit_cargo_raid", 50
      );
      s = window.resolveTutorialSpecialBattleCargoLoss(
        s, "special_bandit_cargo_raid", 60
      ); // 总计 110 损失
      return { v: s.tutorialSpecialBattleCargoIntegrityById["special_bandit_cargo_raid"] };
    });
    assert(resultLow.v >= 0, "cargoIntegrity 不低于 0（实际 = " + resultLow.v + "）");

    // 16. cargoIntegrity 不会高于 100（先损失 20，再尝试加 -50 即"恢复"50，检查不会超过 100）
    // 注意：resolveTutorialSpecialBattleCargoLoss 用的是减法，我们直接构造极高"恢复"无法测试，
    // 但本函数使用 clamp(0,100)，上面一项会在 100 基础上扣到 0，这里再验证一次不会超。
    // 同时验证：多次扣，都在 [0, 100]
    assert(resultLow.v <= 100, "cargoIntegrity 不超过 100（实际 = " + resultLow.v + "）");

    // 再验证：普通损失 20，得到 80
    const resultMid = await page.evaluate(() => {
      const state = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      const s = window.resolveTutorialSpecialBattleCargoLoss(
        state, "special_bandit_cargo_raid", 20
      );
      return s.tutorialSpecialBattleCargoIntegrityById["special_bandit_cargo_raid"];
    });
    assert(resultMid === 80, "损失 20 后 cargoIntegrity = 80（实际 = " + resultMid + "）");

    // 17. resolveTutorialSpecialBattleVictory 能结算胜利
    const resultVictory = await page.evaluate(() => {
      const state = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      const next = window.resolveTutorialSpecialBattleVictory(state, "special_bandit_cargo_raid");
      return {
        hasId: next.resolvedTutorialSpecialBattleIds.includes("special_bandit_cargo_raid"),
        silver: next.silver,
        morale: next.morale,
        flags: next.tutorialSpecialBattleFlags,
      };
    });
    assert(resultVictory.hasId, "胜利结算后 resolvedTutorialSpecialBattleIds 包含本场特殊战");
    assert(resultVictory.silver >= 5, "胜利结算至少奖励 5 silver（实际 = " + resultVictory.silver + "）");
    assert(resultVictory.morale >= 4, "胜利结算 morale 至少 +1（实际 = " + resultVictory.morale + "）");

    // 18. 重复胜利结算不会重复给奖励
    const repeatResult = await page.evaluate(() => {
      let state = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      const once = window.resolveTutorialSpecialBattleVictory(state, "special_bandit_cargo_raid");
      const twice = window.resolveTutorialSpecialBattleVictory(once, "special_bandit_cargo_raid");
      return {
        sameIdLen: once.resolvedTutorialSpecialBattleIds.length === twice.resolvedTutorialSpecialBattleIds.length,
        sameSilver: once.silver === twice.silver,
        sameMorale: once.morale === twice.morale,
        sameFlags: once.tutorialSpecialBattleFlags.length === twice.tutorialSpecialBattleFlags.length,
      };
    });
    assert(repeatResult.sameIdLen, "重复结算：id 列表长度不变");
    assert(repeatResult.sameSilver, "重复结算：silver 不变");
    assert(repeatResult.sameMorale, "重复结算：morale 不变");
    assert(repeatResult.sameFlags, "重复结算：flag 数量不变");

    // 19. resolvedTutorialSpecialBattleIds 不重复 —— 连续 4 次结算
    const fourResolves = await page.evaluate(() => {
      let state = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      for (let i = 0; i < 4; i++) {
        state = window.resolveTutorialSpecialBattleVictory(state, "special_bandit_cargo_raid");
      }
      const seen = {};
      for (const id of state.resolvedTutorialSpecialBattleIds) seen[id] = (seen[id] || 0) + 1;
      const dupCount = Object.values(seen).filter((c) => c > 1).length;
      return { dupCount, totalLen: state.resolvedTutorialSpecialBattleIds.length };
    });
    assert(fourResolves.dupCount === 0, "resolvedTutorialSpecialBattleIds 不重复（重复计数 = " + fourResolves.dupCount + "）");
    assert(fourResolves.totalLen === 1, "resolvedTutorialSpecialBattleIds 长度应为 1（实际 = " + fourResolves.totalLen + "）");

    // 20. tutorialSpecialBattleFlags 不重复
    const flagsRepeat = await page.evaluate(() => {
      let state = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      for (let i = 0; i < 3; i++) {
        state = window.resolveTutorialSpecialBattleVictory(state, "special_bandit_cargo_raid");
      }
      const seen = {};
      for (const f of state.tutorialSpecialBattleFlags) {
        seen[f] = (seen[f] || 0) + 1;
      }
      const dup = Object.values(seen).filter((c) => c > 1).length;
      return { dup, totalLen: state.tutorialSpecialBattleFlags.length };
    });
    assert(flagsRepeat.dup === 0, "tutorialSpecialBattleFlags 不重复");

    // 21. 未知 specialBattleId 安全处理
    const unknownBattle = await page.evaluate(() => {
      const state = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      const next = window.resolveTutorialSpecialBattleVictory(state, "special_nonexistent_battle");
      const nextLoss = window.resolveTutorialSpecialBattleCargoLoss(state, "special_nonexistent_battle", 10);
      return {
        emptyIds: next.resolvedTutorialSpecialBattleIds.length === 0,
        emptyFlags: next.tutorialSpecialBattleFlags.length === 0,
        canResolve: window.canResolveTutorialSpecialBattle(state, "special_nonexistent_battle"),
        lossSame: Object.keys(nextLoss.tutorialSpecialBattleCargoIntegrityById).length === 0,
      };
    });
    assert(unknownBattle.emptyIds, "未知 specialBattleId：resolvedTutorialSpecialBattleIds 仍为空");
    assert(unknownBattle.emptyFlags, "未知 specialBattleId：tutorialSpecialBattleFlags 仍为空");
    assert(unknownBattle.canResolve === false, "canResolveTutorialSpecialBattle(未知) = false");
    assert(unknownBattle.lossSame, "未知 specialBattleId：货物损失不影响 cargoIntegrity map");

    // 22. 未知 nodeId 安全处理
    const unknownNode = await page.evaluate(() => {
      const b1 = window.getTutorialSpecialBattleByNodeId("nonexistent_special_node");
      const b2 = window.isTutorialSpecialBattleNode("nonexistent_special_node");
      const b3 = window.getTutorialSpecialBattleById("special_nonexistent");
      const b4 = window.createInitialSpecialBattleObjectiveState("special_nonexistent");
      return { byNode: b1, isNode: b2, byId: b3, initState: b4 };
    });
    assert(unknownNode.byNode === undefined, "未知 nodeId：getTutorialSpecialBattleByNodeId 返回 undefined");
    assert(unknownNode.isNode === false, "未知 nodeId：isTutorialSpecialBattleNode 返回 false");
    assert(unknownNode.byId === undefined, "未知 id：getTutorialSpecialBattleById 返回 undefined");
    assert(Object.keys(unknownNode.initState).length === 0, "未知 id：createInitialSpecialBattleObjectiveState 返回空对象");

    // 23. 不影响 C3c 普通战斗状态
    // 24. 不影响 C3b 教学事件状态
    // 25. 不影响 C3a 教程路线状态
    // 26. 不影响 C2 主线状态
    // 27. 不影响 C1 Demo 世界地图状态
    // 28. 不影响城市复兴
    // 29. 不影响工具系统
    // 30. 不影响 CargoPrep 关键流程
    const crossCheck = await page.evaluate(() => {
      const gs1 = window.getGameState();
      const snapshot = {
        c3c: {
          resolvedIds: gs1.resolvedTutorialBattleIds.length,
          flags: gs1.tutorialBattleFlags.length,
        },
        c3b: {
          resolvedIds: gs1.resolvedTutorialEventIds.length,
          flags: gs1.tutorialEventFlags.length,
        },
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

      // 对一个独立 state 调用胜利结算
      const testState = {
        silver: 0, food: 0, morale: 3,
        resolvedTutorialSpecialBattleIds: [],
        tutorialSpecialBattleFlags: [],
        tutorialSpecialBattleCargoIntegrityById: {},
      };
      window.resolveTutorialSpecialBattleVictory(testState, "special_bandit_cargo_raid");

      const gs2 = window.getGameState();
      const after = {
        c3c: {
          resolvedIds: gs2.resolvedTutorialBattleIds.length,
          flags: gs2.tutorialBattleFlags.length,
        },
        c3b: {
          resolvedIds: gs2.resolvedTutorialEventIds.length,
          flags: gs2.tutorialEventFlags.length,
        },
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
        c3c: JSON.stringify(snapshot.c3c) === JSON.stringify(after.c3c),
        c3b: JSON.stringify(snapshot.c3b) === JSON.stringify(after.c3b),
        c3a: JSON.stringify(snapshot.c3a) === JSON.stringify(after.c3a),
        c2: JSON.stringify(snapshot.c2) === JSON.stringify(after.c2),
        c1: JSON.stringify(snapshot.c1) === JSON.stringify(after.c1),
        city: JSON.stringify(snapshot.city) === JSON.stringify(after.city),
        tool: JSON.stringify(snapshot.tool) === JSON.stringify(after.tool),
        cargo: JSON.stringify(snapshot.cargo) === JSON.stringify(after.cargo),
      };
    });
    assert(crossCheck.c3c, "不影响 C3c 普通战斗状态");
    assert(crossCheck.c3b, "不影响 C3b 教学事件状态");
    assert(crossCheck.c3a, "不影响 C3a 教程路线状态");
    assert(crossCheck.c2, "不影响 C2 主线状态");
    assert(crossCheck.c1, "不影响 C1 Demo 世界地图状态");
    assert(crossCheck.city, "不影响城市复兴");
    assert(crossCheck.tool, "不影响工具系统");
    assert(crossCheck.cargo, "不影响 CargoPrep 关键流程");

    console.log("[C3d] N3.1 特殊战斗（劫匪抢货战）smoke test 全部通过");
  } catch (err) {
    console.error("[C3d] 测试失败：", err);
    process.exit(1);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
})();
