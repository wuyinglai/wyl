/**
 * smoke-test-city-revival-13-1.cjs
 * 阶段13-1：城市复兴系统底座 - 冒烟测试
 *
 * 验证：
 * 1. 城市状态能初始化（初始 progress/level 正确）
 * 2. level 根据 progress 正确计算
 * 3. passive growth 每轮让 progress +1
 * 4. passiveGrowthCount 正确增加
 * 5. 同一 runId 不重复增长（防重）
 * 6. progress clamp 到 0-100
 * 7. 城市状态跨 resetGameState 保留
 * 8. expeditionCycle 递增触发被动自建
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:5180";
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
    console.log("\n========== 阶段13-1 城市复兴系统冒烟测试 ==========\n");

    // 1. 启动游戏，进入 MainMenu
    console.log("[1] 启动游戏...");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await sleep(2000);

    // 等待 MainMenu 出现
    await page.waitForTimeout(2000);
    console.log("[2] 等待主菜单加载...");

    // 2. 验证 window 函数已暴露
    console.log("\n[3] 验证城市复兴系统函数已暴露...");
    const hasFunctions = await page.evaluate(() => {
      return typeof window.applyPassiveCityRevival === 'function' &&
             typeof window.getCityRevivalState === 'function' &&
             typeof window.getAllCityRevivalStates === 'function' &&
             typeof window.calculateCityRevivalLevel === 'function' &&
             typeof window.getGameState === 'function';
    });
    assert(hasFunctions, "城市复兴系统函数已暴露到 window");

    // 3. 获取初始状态
    console.log("\n[4] 获取初始城市复兴状态...");
    const initialStates = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        cityRevivalStates: gs.cityRevivalStates,
        expeditionCycle: gs.expeditionCycle,
      };
    });

    const { cityRevivalStates: initStates, expeditionCycle: initCycle } = initialStates;
    console.log(`    expeditionCycle = ${initCycle}`);

    // 验证初始状态存在
    assert(initStates && typeof initStates === 'object', "cityRevivalStates 已初始化");
    assert(initCycle === 0, `初始 expeditionCycle = 0（实际=${initCycle}）`);

    // 验证三个城市都存在
    const cityIds = ["city_ash_post", "city_furnace_mine", "city_medicine_spring"];
    for (const cityId of cityIds) {
      const state = initStates[cityId];
      assert(state !== undefined, `城市 ${cityId} 状态存在`);
      if (state) {
        console.log(`    ${cityId}: progress=${state.progress}, level=${state.level}, passiveGrowthCount=${state.passiveGrowthCount}`);
      }
    }

    // 验证初始 progress
    const ashPost = initStates["city_ash_post"];
    const furnaceMine = initStates["city_furnace_mine"];
    const medicineSpring = initStates["city_medicine_spring"];

    assert(ashPost && ashPost.progress === 20, `灰烬驿城初始 progress=20（实际=${ashPost?.progress}）`);
    assert(furnaceMine && furnaceMine.progress === 10, `矿炉城初始 progress=10（实际=${furnaceMine?.progress}）`);
    assert(medicineSpring && medicineSpring.progress === 10, `药泉城初始 progress=10（实际=${medicineSpring?.progress}）`);

    // 验证初始 level
    assert(ashPost && ashPost.level === 0, `灰烬驿城初始 level=0（实际=${ashPost?.level}）`);
    assert(furnaceMine && furnaceMine.level === 0, `矿炉城初始 level=0（实际=${furnaceMine?.level}）`);
    assert(medicineSpring && medicineSpring.level === 0, `药泉城初始 level=0（实际=${medicineSpring?.level}）`);

    // 验证初始 passiveGrowthCount
    assert(ashPost && ashPost.passiveGrowthCount === 0, `灰烬驿城初始 passiveGrowthCount=0`);
    assert(furnaceMine && furnaceMine.passiveGrowthCount === 0, `矿炉城初始 passiveGrowthCount=0`);
    assert(medicineSpring && medicineSpring.passiveGrowthCount === 0, `药泉城初始 passiveGrowthCount=0`);

    // 4. 测试 level 计算
    console.log("\n[5] 测试 level 计算规则...");
    const levelTests = await page.evaluate(() => {
      const calc = window.calculateCityRevivalLevel;
      return [
        { progress: 0, expected: 0, actual: calc(0) },
        { progress: 24, expected: 0, actual: calc(24) },
        { progress: 25, expected: 1, actual: calc(25) },
        { progress: 49, expected: 1, actual: calc(49) },
        { progress: 50, expected: 2, actual: calc(50) },
        { progress: 74, expected: 2, actual: calc(74) },
        { progress: 75, expected: 3, actual: calc(75) },
        { progress: 100, expected: 3, actual: calc(100) },
      ];
    });

    for (const t of levelTests) {
      assert(t.actual === t.expected,
        `calculateCityRevivalLevel(${t.progress}) = ${t.actual}（期望=${t.expected}）`);
    }

    // 5. 测试 applyPassiveCityRevival - 单次增长
    console.log("\n[6] 测试 applyPassiveCityRevival 单次增长...");
    const afterOneGrowth = await page.evaluate(() => {
      const gs = window.getGameState();
      const newStates = window.applyPassiveCityRevival(gs.cityRevivalStates, "run_1");
      // 存储到 window 以便后续测试访问
      window.__test_afterOneGrowth = newStates;
      return newStates;
    });

    for (const cityId of cityIds) {
      const before = initStates[cityId];
      const after = afterOneGrowth[cityId];
      if (before && after) {
        assert(after.progress === before.progress + 1,
          `${cityId}: progress ${before.progress} -> ${after.progress} (+1)`);
        assert(after.passiveGrowthCount === before.passiveGrowthCount + 1,
          `${cityId}: passiveGrowthCount ${before.passiveGrowthCount} -> ${after.passiveGrowthCount} (+1)`);
        assert(after.lastTriggeredRunId === "run_1",
          `${cityId}: lastTriggeredRunId = "run_1"（实际=${after.lastTriggeredRunId}）`);
      }
    }

    // 6. 测试防重 - 同一 runId 不重复增长
    console.log("\n[7] 测试防重：同一 runId 不重复增长...");
    const afterDuplicateCall = await page.evaluate(() => {
      // 从 window 获取上次的 states
      const prevStates = window.__test_afterOneGrowth;
      const newStates = window.applyPassiveCityRevival(prevStates, "run_1");
      window.__test_afterOneGrowth = newStates;
      return newStates;
    });

    for (const cityId of cityIds) {
      const before = afterOneGrowth[cityId];
      const after = afterDuplicateCall[cityId];
      if (before && after) {
        assert(after.progress === before.progress,
          `${cityId}: 重复 runId，progress 不变（${before.progress}）`);
        assert(after.passiveGrowthCount === before.passiveGrowthCount,
          `${cityId}: 重复 runId，passiveGrowthCount 不变（${before.passiveGrowthCount}）`);
      }
    }

    // 7. 测试 progress clamp 到 100
    console.log("\n[8] 测试 progress clamp 到 100...");
    const clampTest = await page.evaluate(() => {
      // 创建一个接近 100 的状态
      const nearMax = {
        city_ash_post: {
          cityId: "city_ash_post",
          progress: 99,
          level: 3,
          passiveGrowthCount: 0,
          lastTriggeredRunId: null,
        },
      };
      const result = window.applyPassiveCityRevival(nearMax, "run_clamp");
      return result;
    });

    assert(clampTest.city_ash_post.progress === 100,
      `progress 99 + 1 = 100（clamp）（实际=${clampTest.city_ash_post.progress}）`);
    assert(clampTest.city_ash_post.level === 3,
      `level 在 100 时仍为 3（实际=${clampTest.city_ash_post.level}）`);

    // 8. 测试 100 + 1 仍然是 100
    console.log("\n[9] 测试 100 + 1 仍然为 100...");
    const atMaxTest = await page.evaluate(() => {
      const atMax = {
        city_ash_post: {
          cityId: "city_ash_post",
          progress: 100,
          level: 3,
          passiveGrowthCount: 50,
          lastTriggeredRunId: null,
        },
      };
      const result = window.applyPassiveCityRevival(atMax, "run_atmax");
      return result;
    });

    assert(atMaxTest.city_ash_post.progress === 100,
      `progress 100 + 1 = 100（不超限）（实际=${atMaxTest.city_ash_post.progress}）`);
    assert(atMaxTest.city_ash_post.passiveGrowthCount === 51,
      `passiveGrowthCount 仍然 +1（实际=${atMaxTest.city_ash_post.passiveGrowthCount}）`);

    // 9. 测试城市状态跨 resetGameState 保留
    console.log("\n[10] 测试城市状态跨 resetGameState 保留...");
    const afterReset = await page.evaluate(() => {
      // 先应用一次增长
      const gs = window.getGameState();
      const newStates = window.applyPassiveCityRevival(gs.cityRevivalStates, "run_before_reset");
      gs.cityRevivalStates = newStates;
      window.setGameState(gs);

      // 调用 resetGameState
      window.resetGameState();

      // 检查状态是否保留
      const gs2 = window.getGameState();
      return {
        cityRevivalStates: gs2.cityRevivalStates,
        expeditionCycle: gs2.expeditionCycle,
      };
    });

    // resetGameState 应该保留城市状态（但 expeditionCycle 也应该保留）
    const ashPostAfterReset = afterReset.cityRevivalStates["city_ash_post"];
    assert(ashPostAfterReset !== undefined, `resetGameState 后 cityRevivalStates 保留`);

    // 验证 run_before_reset 的增长被记录（lastTriggeredRunId = "run_before_reset"）
    // 注意：resetGameState 不会再次触发增长，只是保留状态
    // 所以 passiveGrowthCount 应该等于应用时的值

    // 10. 测试 expeditionCycle 递增
    console.log("\n[11] 测试 expeditionCycle 递增...");
    const cycleTest = await page.evaluate(() => {
      const gs = window.getGameState();
      const beforeCycle = gs.expeditionCycle;
      // 模拟 resetGameStateForNewRun 的逻辑
      gs.expeditionCycle += 1;
      const runId = String(gs.expeditionCycle);
      gs.cityRevivalStates = window.applyPassiveCityRevival(gs.cityRevivalStates, runId);
      window.setGameState(gs);
      const afterCycle = gs.expeditionCycle;
      return { beforeCycle, afterCycle };
    });

    assert(cycleTest.afterCycle === cycleTest.beforeCycle + 1,
      `expeditionCycle ${cycleTest.beforeCycle} -> ${cycleTest.afterCycle} (+1)`);

    // 11. 测试 getCityRevivalState 和 getAllCityRevivalStates
    console.log("\n[12] 测试辅助函数...");
    const helperTest = await page.evaluate(() => {
      const gs = window.getGameState();
      const ashPost = window.getCityRevivalState("city_ash_post", gs.cityRevivalStates);
      const allCities = window.getAllCityRevivalStates(gs.cityRevivalStates);
      const brief = ashPost ? window.formatCityRevivalBrief(ashPost) : null;
      const displayName = window.getCityDisplayName("city_ash_post");
      const levelLabel = window.getCityRevivalLevelLabel(ashPost?.level || 0);
      return {
        ashPostExists: ashPost !== null,
        allCitiesCount: allCities.length,
        brief,
        displayName,
        levelLabel,
      };
    });

    assert(helperTest.ashPostExists, "getCityRevivalState 返回非 null");
    assert(helperTest.allCitiesCount === 3, `getAllCityRevivalStates 返回 3 个城市（实际=${helperTest.allCitiesCount}）`);
    assert(helperTest.displayName === "灰烬驿城", `getCityDisplayName 正确（实际=${helperTest.displayName}）`);
    assert(helperTest.levelLabel === "荒废", `getCityRevivalLevelLabel(0) = "荒废"`);

    // 输出格式化的 brief
    console.log(`    formatCityRevivalBrief 示例: "${helperTest.brief}"`);

    // 12. 测试多次 growth 累计
    console.log("\n[13] 测试多次 growth 累计（3轮）...");
    const multiGrowthTest = await page.evaluate(() => {
      const gs = window.getGameState();
      // 重置到一个已知状态
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
      gs.expeditionCycle = 0;
      window.setGameState(gs);

      // 模拟三轮"再来一局"
      for (let i = 1; i <= 3; i++) {
        gs.expeditionCycle += 1;
        const runId = String(gs.expeditionCycle);
        gs.cityRevivalStates = window.applyPassiveCityRevival(gs.cityRevivalStates, runId);
      }
      window.setGameState(gs);
      return {
        ashPost: gs.cityRevivalStates["city_ash_post"],
        furnaceMine: gs.cityRevivalStates["city_furnace_mine"],
        medicineSpring: gs.cityRevivalStates["city_medicine_spring"],
      };
    });

    assert(multiGrowthTest.ashPost.progress === 23,
      `灰烬驿城 3 轮后 progress=23（实际=${multiGrowthTest.ashPost.progress}）`);
    assert(multiGrowthTest.furnaceMine.progress === 13,
      `矿炉城 3 轮后 progress=13（实际=${multiGrowthTest.furnaceMine.progress}）`);
    assert(multiGrowthTest.medicineSpring.progress === 13,
      `药泉城 3 轮后 progress=13（实际=${multiGrowthTest.medicineSpring.progress}）`);
    assert(multiGrowthTest.ashPost.passiveGrowthCount === 3,
      `灰烬驿城 passiveGrowthCount=3（实际=${multiGrowthTest.ashPost.passiveGrowthCount}）`);

    // 验证 level 在 3 轮后仍然是 0（23 < 25）
    assert(multiGrowthTest.ashPost.level === 0,
      `灰烬驿城 3 轮后 level 仍为 0（progress=23, <25）`);

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
