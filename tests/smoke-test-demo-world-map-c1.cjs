/**
 * smoke-test-demo-world-map-c1.cjs
 * C1：Demo 中型地图底座 - 冒烟测试
 *
 * 验证：
 * 1. Demo 世界节点数量正确（7 个）
 * 2. 必须存在 greybridge / first_outpost / daan / daan_outskirts / mid_route_01 / second_city_hint / second_city
 * 3. 初始 currentDemoWorldNodeId 是 greybridge
 * 4. 初始 unlockedDemoWorldNodeIds 包含 greybridge
 * 5. 初始 unlockedDemoWorldRouteIds 包含 greybridge_to_first_outpost
 * 6. hidden 节点初始不可见或不可用
 * 7. unlockDemoWorldNode 能解锁 first_outpost
 * 8. unlockDemoWorldRoute 能解锁 first_outpost_to_daan
 * 9. 重复 unlock 不会产生重复 ID
 * 10. 不影响 cityRevivalStates
 * 11. 不影响 toolSystem
 * 12. 不影响 CargoPrep 关键流程
 */

const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL || "http://localhost:5180";
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
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
    console.log("\n========== C1：Demo 中型地图底座冒烟测试 ==========\n");

    // 启动游戏
    console.log("[1] 启动游戏...");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await sleep(2000);

    console.log("[2] 等待主菜单加载...");
    await sleep(2000);

    // ------------------------------------------------------------
    // 1. Demo 世界节点数量正确
    // ------------------------------------------------------------
    console.log("\n[3] 验证 Demo 世界节点数据...");
    const nodeCount = await page.evaluate(() => {
      return window.DEMO_WORLD_NODES ? window.DEMO_WORLD_NODES.length : -1;
    });
    assert(nodeCount === 7, `节点数量 = ${nodeCount}（期望 7）`);

    // ------------------------------------------------------------
    // 2. 必须存在 7 个关键节点
    // ------------------------------------------------------------
    const requiredNodeIds = [
      "greybridge",
      "first_outpost",
      "daan",
      "daan_outskirts",
      "mid_route_01",
      "second_city_hint",
      "second_city",
    ];
    for (const id of requiredNodeIds) {
      const exists = await page.evaluate((nodeId) => {
        return window.getDemoWorldNodeById ? !!window.getDemoWorldNodeById(nodeId) : false;
      }, id);
      assert(exists, `节点 ${id} 存在`);
    }

    // ------------------------------------------------------------
    // 路线段数量和关键路线
    // ------------------------------------------------------------
    const routeCount = await page.evaluate(() => {
      return window.DEMO_ROUTE_SEGMENTS ? window.DEMO_ROUTE_SEGMENTS.length : -1;
    });
    assert(routeCount === 6, `路线段数量 = ${routeCount}（期望 6）`);

    const requiredRouteIds = [
      "greybridge_to_first_outpost",
      "first_outpost_to_daan",
      "daan_to_outskirts",
      "outskirts_to_mid_route",
      "mid_route_to_second_hint",
      "second_hint_to_second_city",
    ];
    for (const id of requiredRouteIds) {
      const exists = await page.evaluate((routeId) => {
        return window.getDemoWorldRouteById ? !!window.getDemoWorldRouteById(routeId) : false;
      }, id);
      assert(exists, `路线段 ${id} 存在`);
    }

    // ------------------------------------------------------------
    // 3. 初始 currentDemoWorldNodeId 是 greybridge
    // ------------------------------------------------------------
    console.log("\n[4] 验证 GameState 初始 Demo 地图状态...");
    const initialState = await page.evaluate(() => {
      const s = window.getGameState();
      return {
        currentDemoWorldNodeId: s.currentDemoWorldNodeId,
        unlockedDemoWorldNodeIds: s.unlockedDemoWorldNodeIds,
        unlockedDemoWorldRouteIds: s.unlockedDemoWorldRouteIds,
        knownDemoWorldRumorIds: s.knownDemoWorldRumorIds,
      };
    });

    assert(
      initialState.currentDemoWorldNodeId === "greybridge",
      `初始 currentDemoWorldNodeId = "${initialState.currentDemoWorldNodeId}"（期望 "greybridge"）`,
    );

    // ------------------------------------------------------------
    // 4. 初始 unlockedDemoWorldNodeIds 包含 greybridge
    // ------------------------------------------------------------
    const hasGreybridge = initialState.unlockedDemoWorldNodeIds.includes("greybridge");
    assert(hasGreybridge, `初始 unlockedDemoWorldNodeIds 包含 greybridge（实际: [${initialState.unlockedDemoWorldNodeIds}]）`);

    // ------------------------------------------------------------
    // 5. 初始 unlockedDemoWorldRouteIds 包含 greybridge_to_first_outpost
    // ------------------------------------------------------------
    const hasFirstRoute = initialState.unlockedDemoWorldRouteIds.includes("greybridge_to_first_outpost");
    assert(hasFirstRoute, `初始 unlockedDemoWorldRouteIds 包含 greybridge_to_first_outpost（实际: [${initialState.unlockedDemoWorldRouteIds}]）`);

    // ------------------------------------------------------------
    // 6. hidden 节点初始不在 unlocked 中，且 initialStatus 为 hidden
    // ------------------------------------------------------------
    console.log("\n[5] 验证 hidden 节点初始状态...");
    const hiddenNodesInfo = await page.evaluate(() => {
      const hidden = [];
      for (const node of window.DEMO_WORLD_NODES) {
        if (node.initialStatus === "hidden") {
          hidden.push({ id: node.id, status: node.initialStatus });
        }
      }
      return hidden;
    });
    assert(hiddenNodesInfo.length > 0, `存在 initialStatus=hidden 的节点（数量: ${hiddenNodesInfo.length}）`);

    // 检查所有 hidden 节点不在初始 unlocked 列表中
    for (const info of hiddenNodesInfo) {
      const isInUnlocked = initialState.unlockedDemoWorldNodeIds.includes(info.id);
      assert(!isInUnlocked, `hidden 节点 ${info.id} 不在 unlockedDemoWorldNodeIds 中`);
    }

    // ------------------------------------------------------------
    // 7. unlockDemoWorldNode 能解锁 first_outpost
    // ------------------------------------------------------------
    console.log("\n[6] 验证 unlockDemoWorldNode 解锁 first_outpost...");
    const unlockResult1 = await page.evaluate(() => {
      const initial = window.createInitialDemoWorldMapState();
      const after = window.unlockDemoWorldNode(initial, "first_outpost");
      return {
        isUnlocked: after.unlockedDemoWorldNodeIds.includes("first_outpost"),
        count: after.unlockedDemoWorldNodeIds.length,
      };
    });
    assert(unlockResult1.isUnlocked, "unlockDemoWorldNode 能解锁 first_outpost");

    // ------------------------------------------------------------
    // 8. unlockDemoWorldRoute 能解锁 first_outpost_to_daan
    // ------------------------------------------------------------
    console.log("\n[7] 验证 unlockDemoWorldRoute 能解锁 first_outpost_to_daan...");
    const unlockResult2 = await page.evaluate(() => {
      const initial = window.createInitialDemoWorldMapState();
      const after = window.unlockDemoWorldRoute(initial, "first_outpost_to_daan");
      return {
        isUnlocked: after.unlockedDemoWorldRouteIds.includes("first_outpost_to_daan"),
        count: after.unlockedDemoWorldRouteIds.length,
      };
    });
    assert(unlockResult2.isUnlocked, "unlockDemoWorldRoute 能解锁 first_outpost_to_daan");

    // ------------------------------------------------------------
    // 9. 重复 unlock 不会产生重复 ID
    // ------------------------------------------------------------
    console.log("\n[8] 验证重复 unlock 不会产生重复 ID...");
    const dedupResult = await page.evaluate(() => {
      let state = window.createInitialDemoWorldMapState();
      state = window.unlockDemoWorldNode(state, "first_outpost");
      state = window.unlockDemoWorldNode(state, "first_outpost"); // 重复
      state = window.unlockDemoWorldRoute(state, "first_outpost_to_daan");
      state = window.unlockDemoWorldRoute(state, "first_outpost_to_daan"); // 重复
      const nodeIds = state.unlockedDemoWorldNodeIds;
      const routeIds = state.unlockedDemoWorldRouteIds;
      const nodeSet = new Set(nodeIds);
      const routeSet = new Set(routeIds);
      return {
        nodeDup: nodeIds.length === nodeSet.size,
        routeDup: routeIds.length === routeSet.size,
        nodeCount: nodeIds.length,
        routeCount: routeIds.length,
      };
    });
    assert(dedupResult.nodeDup, `节点 ID 去重正确（无重复，长度: ${dedupResult.nodeCount}）`);
    assert(dedupResult.routeDup, `路线 ID 去重正确（无重复，长度: ${dedupResult.routeCount}）`);

    // ------------------------------------------------------------
    // 10. 不影响 cityRevivalStates
    // ------------------------------------------------------------
    console.log("\n[9] 验证不影响城市复兴状态...");
    const cityRevivalIntact = await page.evaluate(() => {
      const s = window.getGameState();
      return !!s.cityRevivalStates && Object.keys(s.cityRevivalStates).length >= 1;
    });
    assert(cityRevivalIntact, "cityRevivalStates 未受影响（存在且非空）");

    // ------------------------------------------------------------
    // 11. 不影响 toolSystem
    // ------------------------------------------------------------
    console.log("\n[10] 验证不影响工具系统...");
    const toolIntact = await page.evaluate(() => {
      const s = window.getGameState();
      return Array.isArray(s.ownedTools);
    });
    assert(toolIntact, "toolSystem 未受影响（ownedTools 是数组）");

    // ------------------------------------------------------------
    // 12. 不影响 CargoPrep 关键流程
    // ------------------------------------------------------------
    console.log("\n[11] 验证不影响货物准备...");
    const cargoIntact = await page.evaluate(() => {
      const s = window.getGameState();
      return Array.isArray(s.unfinishedOrderIds) && typeof s.maxCargoWeight === "number";
    });
    assert(cargoIntact, "CargoPrep 相关状态字段存在（unfinishedOrderIds + maxCargoWeight）");

    // ------------------------------------------------------------
    // 测试 resetGameState 保留 Demo 地图状态
    // ------------------------------------------------------------
    console.log("\n[12] 验证 resetGameState 保留 Demo 地图状态...");
    const resetRetain = await page.evaluate(() => {
      const s1 = window.getGameState();
      const nodesBefore = [...s1.unlockedDemoWorldNodeIds];
      const routesBefore = [...s1.unlockedDemoWorldRouteIds];
      const currentBefore = s1.currentDemoWorldNodeId;

      // 模拟玩家解锁了第一个驿站
      const newState = window.unlockDemoWorldNode(s1, "first_outpost");
      // 注意：unlockDemoWorldNode 返回新 state 对象，不改变全局
      // 这里我们手动设置全局 state 测试 reset 保留
      window.setGameState({
        ...s1,
        unlockedDemoWorldNodeIds: newState.unlockedDemoWorldNodeIds,
      });

      window.resetGameState();
      const s2 = window.getGameState();

      // reset 之后 first_outpost 应该仍被解锁（因为保留了 oldDemoUnlockedNodes）
      const hasFirstOutpost = s2.unlockedDemoWorldNodeIds.includes("first_outpost");
      return {
        hasFirstOutpost,
        currentRetained: s2.currentDemoWorldNodeId !== undefined,
      };
    });
    assert(resetRetain.hasFirstOutpost, "resetGameState 保留已解锁的 first_outpost 节点");

    // 统计
    console.log(`\n========== 测试完成：${passed} 通过，${failed} 失败 ==========`);
    if (failed > 0) {
      process.exit(1);
    }
  } catch (e) {
    console.error("[致命错误]", e);
    failed++;
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
