/**
 * smoke-test-city-revival-order-13-2.cjs
 * 阶段13-2：订单完成 → 城市复兴进度联动 - 冒烟测试
 *
 * 验证：
 * 1. calculateOrderRevivalGain 根据 difficulty 返回正确增益
 * 2. applyOrderCityRevival 只给目标城市加 progress
 * 3. 非目标城市不受影响
 * 4. 同一订单不能重复加（防重）
 * 5. cityRevivalAppliedOrderIds 正确记录
 * 6. progress clamp 到 100
 * 7. level 随 progress 自动更新
 * 8. passive growth 仍然正常
 * 9. cityRevivalAppliedOrderIds 跨 resetGameState 保留
 * 10. GameState 有 cityRevivalAppliedOrderIds 字段
 */

const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const PASSED = [], FAILED = [];
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
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", err => {
    console.error(`[浏览器错误] ${err.message}`);
    failed++;
  });

  try {
    console.log("\n========== 阶段13-2 订单联动城市复兴冒烟测试 ==========\n");

    // 1. 启动游戏
    console.log("[1] 启动游戏...");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await sleep(2000);
    await page.waitForTimeout(2000);

    // 2. 验证 window 函数已暴露
    console.log("\n[2] 验证城市复兴订单联动函数已暴露...");
    const hasFunctions = await page.evaluate(() => {
      return typeof window.applyOrderCityRevival === 'function' &&
             typeof window.calculateOrderRevivalGain === 'function' &&
             typeof window.hasOrderRevivalApplied === 'function' &&
             typeof window.getGameState === 'function';
    });
    assert(hasFunctions, "订单联动函数已暴露到 window");

    // 3. 验证 GameState 有 cityRevivalAppliedOrderIds 字段
    console.log("\n[3] 验证 GameState 字段...");
    const gsCheck = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        hasAppliedOrderIds: Array.isArray(gs.cityRevivalAppliedOrderIds),
        appliedOrderIds: gs.cityRevivalAppliedOrderIds,
        hasRevivalStates: typeof gs.cityRevivalStates === 'object',
      };
    });
    assert(gsCheck.hasAppliedOrderIds, "GameState 有 cityRevivalAppliedOrderIds 字段（数组）");
    assert(Array.isArray(gsCheck.appliedOrderIds) && gsCheck.appliedOrderIds.length === 0,
      "初始 cityRevivalAppliedOrderIds 为空数组");
    assert(gsCheck.hasRevivalStates, "GameState 有 cityRevivalStates 字段");

    // 4. 测试 calculateOrderRevivalGain
    console.log("\n[4] 测试 calculateOrderRevivalGain...");
    const gainResults = await page.evaluate(() => {
      const calc = window.calculateOrderRevivalGain;
      return [
        { difficulty: "low", expected: 3, actual: calc("low") },
        { difficulty: "low_medium", expected: 3, actual: calc("low_medium") },
        { difficulty: "medium", expected: 5, actual: calc("medium") },
        { difficulty: "high", expected: 8, actual: calc("high") },
        { difficulty: "critical", expected: 8, actual: calc("critical") },
        { difficulty: undefined, expected: 3, actual: calc(undefined) },
        { difficulty: "unknown", expected: 3, actual: calc("unknown") },
      ];
    });

    for (const t of gainResults) {
      assert(t.actual === t.expected,
        `calculateOrderRevivalGain("${t.difficulty}") = ${t.actual}（期望=${t.expected}）`);
    }

    // 5. 测试 applyOrderCityRevival 单次加成
    console.log("\n[5] 测试 applyOrderCityRevival 单次加成...");
    const test5Result = await page.evaluate(() => {
      const gs = window.getGameState();
      // 保存原始状态
      const originalStates = JSON.parse(JSON.stringify(gs.cityRevivalStates));
      const originalApplied = [...gs.cityRevivalAppliedOrderIds];

      const gain = window.calculateOrderRevivalGain("low");
      const { updatedStates, updatedAppliedOrderIds } = window.applyOrderCityRevival(
        gs.cityRevivalStates,
        "order_test_5",
        "city_ash_post",
        gain,
        gs.cityRevivalAppliedOrderIds,
      );

      const ashPost = updatedStates["city_ash_post"];
      return {
        beforeProgress: originalStates["city_ash_post"].progress,
        afterProgress: ashPost ? ashPost.progress : null,
        gainExpected: gain,
        appliedIds: updatedAppliedOrderIds,
        originalProgress: originalStates["city_ash_post"].progress,
      };
    });

    assert(test5Result.afterProgress === test5Result.originalProgress + test5Result.gainExpected,
      `灰烬驿城获得订单加成 +${test5Result.gainExpected}（${test5Result.originalProgress} → ${test5Result.afterProgress}）`);
    assert(test5Result.appliedIds.includes("order_test_5"),
      `cityRevivalAppliedOrderIds 包含 order_test_5`);

    // 6. 测试非目标城市不受影响
    console.log("\n[6] 测试非目标城市不受订单加成影响...");
    const nonTargetTest = await page.evaluate(() => {
      const gs = window.getGameState();
      // 使用 applyOrderCityRevival 修改 ash_post，验证其他城市不变
      const gain = window.calculateOrderRevivalGain("low");
      const { updatedStates } = window.applyOrderCityRevival(
        gs.cityRevivalStates,
        "order_test_6",
        "city_ash_post",
        gain,
        gs.cityRevivalAppliedOrderIds,
      );

      return {
        furnaceProgress: updatedStates["city_furnace_mine"]?.progress,
        medicineProgress: updatedStates["city_medicine_spring"]?.progress,
        ashProgress: updatedStates["city_ash_post"]?.progress,
      };
    });

    assert(nonTargetTest.furnaceProgress === 10,
      `矿炉城不受 order 影响（保持 10）`);
    assert(nonTargetTest.medicineProgress === 10,
      `药泉城不受 order 影响（保持 10）`);
    assert(nonTargetTest.ashProgress > 10,
      `灰烬驿城获得了加成（>10）`);

    // 7. 测试防重：同一订单不能重复加
    console.log("\n[7] 测试防重：同一订单不能重复加...");
    const duplicateTest = await page.evaluate(() => {
      // 用一个独立的 fresh state，避免受前面测试影响
      const freshState = {
        city_ash_post: {
          cityId: "city_ash_post",
          progress: 20,
          level: 0,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
        city_furnace_mine: {
          cityId: "city_furnace_mine",
          progress: 10,
          level: 0,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
        city_medicine_spring: {
          cityId: "city_medicine_spring",
          progress: 10,
          level: 0,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
      };

      // 第一次应用（appliedOrderIds 为空，应该成功）
      const { updatedStates: states1, updatedAppliedOrderIds: applied1 } =
        window.applyOrderCityRevival(
          freshState,
          "order_dup_test",
          "city_ash_post",
          3,
          [],
        );

      // 第二次应用（appliedOrderIds 已包含 order_dup_test，应该被防重）
      const { updatedStates: states2 } = window.applyOrderCityRevival(
        freshState, // 用同一个 freshState（防重时返回原 state 引用）
        "order_dup_test",
        "city_ash_post",
        3,
        applied1, // 已包含 order_dup_test
      );

      return {
        firstProgress: states1["city_ash_post"].progress,
        secondProgress: states2["city_ash_post"].progress,
        // 防重时返回原 state 引用（不是新对象）
        secondIsSameRef: states2 === freshState,
      };
    });

    assert(duplicateTest.firstProgress === 23,
      `首次应用正确增加到 23（实际=${duplicateTest.firstProgress}）`);
    assert(duplicateTest.secondProgress === 20,
      `重复订单被防重，progress 保持 20（实际=${duplicateTest.secondProgress}）`);
    assert(duplicateTest.secondIsSameRef,
      `防重时返回原 state 引用`);

    // 8. 测试 progress clamp 到 100
    console.log("\n[8] 测试 progress clamp 到 100...");
    const clampTest = await page.evaluate(() => {
      const nearMaxStates = {
        city_ash_post: {
          cityId: "city_ash_post",
          progress: 98,
          level: 3,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
      };
      const gain = window.calculateOrderRevivalGain("low");
      const { updatedStates } = window.applyOrderCityRevival(
        nearMaxStates,
        "order_clamp",
        "city_ash_post",
        gain,
        [],
      );
      return {
        progress: updatedStates["city_ash_post"].progress,
        level: updatedStates["city_ash_post"].level,
      };
    });

    assert(clampTest.progress === 100,
      `progress 98 + 3 = 100（clamp）（实际=${clampTest.progress}）`);
    assert(clampTest.level === 3,
      `level 在 100 时仍为 3（实际=${clampTest.level}）`);

    // 9. 测试 level 随 progress 自动更新
    console.log("\n[9] 测试 level 随 progress 自动更新...");
    const levelUpdateTest = await page.evaluate(() => {
      const gs = window.getGameState();
      const before = gs.cityRevivalStates["city_ash_post"];

      // 应用 +5（从 20 变 25，正好跨 level 边界）
      const { updatedStates } = window.applyOrderCityRevival(
        gs.cityRevivalStates,
        "order_lv_test",
        "city_ash_post",
        5,
        gs.cityRevivalAppliedOrderIds,
      );

      const after = updatedStates["city_ash_post"];
      return {
        beforeLevel: before.level,
        afterLevel: after.level,
        afterProgress: after.progress,
      };
    });

    assert(levelUpdateTest.afterLevel === 1,
      `level 从 ${levelUpdateTest.beforeLevel} 变为 ${levelUpdateTest.afterLevel}（progress=${levelUpdateTest.afterProgress} >= 25）`);

    // 10. 测试被动自建仍然正常
    console.log("\n[10] 测试被动自建（applyPassiveCityRevival）仍然正常...");
    const passiveTest = await page.evaluate(() => {
      // 显式重置到一个已知状态，确保测试隔离
      const gs = window.getGameState();
      // 重置城市状态到初始值
      gs.cityRevivalStates = {
        city_ash_post: {
          cityId: "city_ash_post",
          progress: 20,
          level: 0,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
        city_furnace_mine: {
          cityId: "city_furnace_mine",
          progress: 10,
          level: 0,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
        city_medicine_spring: {
          cityId: "city_medicine_spring",
          progress: 10,
          level: 0,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
      };
      window.setGameState(gs);

      const gs2 = window.getGameState();
      const citiesBefore = gs2.cityRevivalStates;
      const beforeAsh = citiesBefore["city_ash_post"];
      const beforeFurnace = citiesBefore["city_furnace_mine"];

      // 应用一轮被动自建
      const updatedStates = window.applyPassiveCityRevival(citiesBefore, "run_test_passive");

      return {
        ashBefore: beforeAsh.progress,
        ashAfter: updatedStates["city_ash_post"].progress,
        furnaceBefore: beforeFurnace.progress,
        furnaceAfter: updatedStates["city_furnace_mine"].progress,
        ashPassiveCount: updatedStates["city_ash_post"].passiveGrowthCount,
      };
    });

    assert(passiveTest.ashAfter === passiveTest.ashBefore + 1,
      `被动自建：灰烬驿城 +1（${passiveTest.ashBefore} → ${passiveTest.ashAfter}）`);
    assert(passiveTest.furnaceAfter === passiveTest.furnaceBefore + 1,
      `被动自建：矿炉城 +1（${passiveTest.furnaceBefore} → ${passiveTest.furnaceAfter}）`);
    assert(passiveTest.ashPassiveCount > 0,
      `被动自建次数 passiveGrowthCount 增加`);

    // 11. 测试 cityRevivalAppliedOrderIds 跨 resetGameState 保留
    console.log("\n[11] 测试 cityRevivalAppliedOrderIds 跨 resetGameState 保留...");
    const resetPersistenceTest = await page.evaluate(() => {
      // 先确保有数据
      const gs = window.getGameState();
      gs.cityRevivalAppliedOrderIds = ["order_preserve_test"];
      window.setGameState(gs);

      // 调用 resetGameState
      window.resetGameState();
      const gs2 = window.getGameState();

      return {
        preserved: gs2.cityRevivalAppliedOrderIds.includes("order_preserve_test"),
        appliedCount: gs2.cityRevivalAppliedOrderIds.length,
      };
    });

    assert(resetPersistenceTest.preserved,
      `resetGameState 后 cityRevivalAppliedOrderIds 保留`);
    assert(resetPersistenceTest.appliedCount >= 1,
      `cityRevivalAppliedOrderIds 长度 >= 1（实际=${resetPersistenceTest.appliedCount}）`);

    // 12. 测试 hasOrderRevivalApplied 辅助函数
    console.log("\n[12] 测试 hasOrderRevivalApplied 辅助函数...");
    const hasAppliedTest = await page.evaluate(() => {
      const gs = window.getGameState();
      const applied = gs.cityRevivalAppliedOrderIds || [];
      return {
        appliedContains: window.hasOrderRevivalApplied("order_preserve_test", applied),
        notAppliedContains: window.hasOrderRevivalApplied("order_not_exists", applied),
      };
    });

    assert(hasAppliedTest.appliedContains,
      `hasOrderRevivalApplied("order_preserve_test") = true`);
    assert(!hasAppliedTest.notAppliedContains,
      `hasOrderRevivalApplied("order_not_exists") = false`);

    // 13. 测试多个不同订单加成不同城市
    console.log("\n[13] 测试多个订单加成不同城市...");
    const multiOrderTest = await page.evaluate(() => {
      const gs = window.getGameState();
      // 从原始状态开始
      const initAsh = gs.cityRevivalStates["city_ash_post"].progress;
      const initFurnace = gs.cityRevivalStates["city_furnace_mine"].progress;
      const initMedicine = gs.cityRevivalStates["city_medicine_spring"].progress;

      // 应用矿炉城订单（gain=5）
      const { updatedStates: afterFurnace } = window.applyOrderCityRevival(
        gs.cityRevivalStates,
        "order_multi_furnace",
        "city_furnace_mine",
        5,
        gs.cityRevivalAppliedOrderIds,
      );

      // 应用药泉城订单（gain=3）
      const { updatedStates: afterMedicine } = window.applyOrderCityRevival(
        afterFurnace,
        "order_multi_medicine",
        "city_medicine_spring",
        3,
        gs.cityRevivalAppliedOrderIds,
      );

      return {
        ashUnchanged: afterMedicine["city_ash_post"].progress === initAsh,
        furnaceGained: afterMedicine["city_furnace_mine"].progress === initFurnace + 5,
        medicineGained: afterMedicine["city_medicine_spring"].progress === initMedicine + 3,
      };
    });

    assert(multiOrderTest.ashUnchanged,
      `非目标城市（灰烬驿城）不受影响`);
    assert(multiOrderTest.furnaceGained,
      `矿炉城订单 +5 progress`);
    assert(multiOrderTest.medicineGained,
      `药泉城订单 +3 progress`);

    // 14. 测试 level 边界情况
    console.log("\n[14] 测试 level 边界...");
    const levelBoundaryTest = await page.evaluate(() => {
      const calc = window.calculateCityRevivalLevel;
      return [
        { progress: 0, expectedLevel: 0 },
        { progress: 24, expectedLevel: 0 },
        { progress: 25, expectedLevel: 1 },
        { progress: 49, expectedLevel: 1 },
        { progress: 50, expectedLevel: 2 },
        { progress: 74, expectedLevel: 2 },
        { progress: 75, expectedLevel: 3 },
        { progress: 100, expectedLevel: 3 },
      ].map(t => ({ ...t, actual: calc(t.progress) }));
    });

    for (const t of levelBoundaryTest) {
      assert(t.actual === t.expectedLevel,
        `level(${t.progress}) = ${t.actual}（期望=${t.expectedLevel}）`);
    }

    console.log("\n========== 测试完成 ==========");
    console.log(`总计: ${passed} passed, ${failed} failed\n`);

    if (FAILED.length > 0) {
      console.error("失败项:");
      FAILED.forEach(f => console.error(`  - ${f}`));
      process.exit(1);
    }

  } catch (err) {
    console.error("测试异常:", err);
    failed++;
    process.exit(1);
  } finally {
    await browser.close();
  }

  process.exit(failed > 0 ? 1 : 0);
})();
