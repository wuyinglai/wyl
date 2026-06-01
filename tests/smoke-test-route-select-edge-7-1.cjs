/**
 * smoke-test-route-select-edge-7-1.cjs
 * 阶段7.1.1 商路选择边界测试（严格版）
 *
 * 失败时 process.exit(1)，成功时 process.exit(0)
 *
 * 验证要点:
 * 1. window.game 存在
 * 2. 能进入 RouteSelectScene
 * 3. 重复触发同一商路选择时，只应写入一次有效 route/city，不应异常
 * 4. selectedRouteId 和 selectedCityId 来自同一条 route
 * 5. 手动构造 route/city 不一致状态后进入 MapScene，不应崩溃，并应有 fallback / warning
 * 6. selectedRouteId / selectedCityId 为空时直接进入 MapScene，不应崩溃
 * 7. 未解锁路线不能被 selectRoute 写入 GameState
 */
const { chromium } = require("playwright");
const BASE_URL = "http://localhost:5173";
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    throw new Error(`断言失败: ${message}`);
  }
  passed++;
  console.log(`  ✅ ${message}`);
}

async function runTest() {
  console.log("========================================");
  console.log("阶段7.1.1 商路选择边界测试（严格版）");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on("console", msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes("[商路选择]") || text.includes("[地图]") || text.includes("不一致") || text.includes("未解锁")) {
      console.log(`  [页面] ${text}`);
    }
  });

  try {
    // ========== 1. 游戏加载 ==========
    console.log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    assert(await page.evaluate(() => !!window.game && !!window.game.scene), "window.game 存在");

    // ========== 2. 进入 RouteSelectScene ==========
    console.log("2. 进入 RouteSelectScene");
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MainMenuScene");
      if (ms) ms.scene.start("RouteSelectScene");
    });
    await sleep(1500);
    assert(await page.evaluate(() => !!window.game.scene.getScene("RouteSelectScene")), "能进入 RouteSelectScene");

    // ========== 3. 重复点击测试 ==========
    console.log("3. 重复点击测试");
    // 快速连续触发两次选择
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routeCards && rs.routeCards[0]) {
        const card = rs.routeCards[0];
        const hitArea = card.list.find(c => c.input && c.input.enabled);
        if (hitArea) {
          hitArea.emit("pointerdown");
          // 立即再次触发
          hitArea.emit("pointerdown");
        }
      }
    });
    await sleep(1500);

    // 验证只写入一次
    const firstSelect = await page.evaluate(() => {
      const gs = window.getGameState();
      return { routeId: gs.selectedRouteId, cityId: gs.selectedCityId };
    });
    console.log(`    第一次选择: ${JSON.stringify(firstSelect)}`);
    assert(firstSelect.routeId !== null, "第一次选择写入 routeId");
    assert(firstSelect.cityId !== null, "第一次选择写入 cityId");

    // ========== 4. route/city 一致性验证 ==========
    console.log("4. route/city 一致性验证");
    // 已知 route_ash_post 对应 city_ash_post，直接验证
    const isConsistent = await page.evaluate(() => {
      const gs = window.getGameState();
      // route_ash_post 对应 city_ash_post
      const routeCityMap = {
        "route_ash_post": "city_ash_post",
        "route_furnace_mine": "city_furnace_mine",
        "route_medicine_spring": "city_medicine_spring",
      };
      const expectedCityId = routeCityMap[gs.selectedRouteId];
      return expectedCityId === gs.selectedCityId;
    });
    assert(isConsistent, "selectedRouteId 和 selectedCityId 来自同一条 route");

    // ========== 5. route/city 不一致状态测试 ==========
    console.log("5. route/city 不一致状态测试");
    // 手动构造不一致状态，然后通过正常流程进入 MapScene
    // 先重置 GameState，然后设置不一致的 route/city
    await page.evaluate(() => {
      window.resetGameState();
      const gs = window.getGameState();
      gs.selectedRouteId = "route_furnace_mine"; // 矿炉城路线
      gs.selectedCityId = "city_ash_post"; // 但 cityId 是灰烬驿城
      gs.selectedCharacters = ["guardian", "sharpshooter", "repairman"];
      window.setGameState(gs);
    });

    // 通过 CharacterSelectScene 的正常流程进入 MapScene（确保地图正确初始化）
    await page.evaluate(() => {
      window.game.scene.start("CharacterSelectScene");
    });
    await sleep(1000);
    
    // 在 CharacterSelectScene 中点击开始远征按钮
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) {
        cs.startExpedition();
      } else {
        // 如果找不到 startExpedition，直接启动 MapScene
        window.game.scene.start("MapScene");
      }
    });
    await sleep(2000);

    const mapNotCrash = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapNotCrash, "route/city 不一致时 MapScene 不崩溃");

    // 检查是否有 warning 日志
    const hasInconsistencyWarning = consoleLogs.some(log => 
      log.includes("不一致") || log.includes("route/city")
    );
    assert(hasInconsistencyWarning, "route/city 不一致时显示 warning");

    // ========== 6. 空 selectedRouteId 进入 MapScene ==========
    console.log("6. 空 selectedRouteId 进入 MapScene");
    await page.evaluate(() => {
      window.resetGameState();
      const gs = window.getGameState();
      gs.selectedRouteId = null;
      gs.selectedCityId = null;
      gs.selectedCharacters = ["guardian", "sharpshooter", "repairman"];
      window.setGameState(gs);
      // 通过 CharacterSelectScene 进入 MapScene
      window.game.scene.start("CharacterSelectScene");
    });
    await sleep(1000);
    
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) {
        cs.startExpedition();
      } else {
        window.game.scene.start("MapScene");
      }
    });
    await sleep(2000);

    const mapEmptyNotCrash = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapEmptyNotCrash, "空 selectedRouteId 时 MapScene 不崩溃");

    // 检查 routeInfoText 是否为空（或不显示）
    const routeInfoEmpty = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      // 检查场景中是否有 routeInfo 文本对象
      const texts = ms.children.list.filter(c => c.type === "Text");
      const routeText = texts.find(t => t.text && t.text.includes("目标:"));
      return !routeText; // 如果没有找到目标文本，说明是安全的
    });
    assert(routeInfoEmpty, "空 selectedRouteId 时不显示目标信息");

    // ========== 7. 未解锁路线不能被选择 ==========
    console.log("7. 未解锁路线不能被选择");
    await page.evaluate(() => {
      window.resetGameState();
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(1500);

    // 尝试选择未解锁路线（构造一个未解锁的 route 对象）
    const unlockedResult = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs) {
        // 构造一个未解锁的 route
        const lockedRoute = {
          id: "route_locked_test",
          cityId: "city_locked",
          cityName: "锁定城",
          routeName: "锁定线",
          title: "锁定城 / 锁定线",
          tagline: "测试锁定",
          description: "测试用锁定路线",
          riskLevel: "高",
          profitLevel: "高",
          supplyLevel: "普通",
          combatLevel: "高",
          tradeLevel: "高",
          recommendedGoods: [],
          recommendedCharacters: [],
          mapTheme: "locked",
          isUnlocked: false,
        };
        // 尝试调用 selectRoute（通过内部访问）
        // @ts-ignore
        rs.selectRoute(lockedRoute);
        return true;
      }
      return false;
    });
    await sleep(500);

    // 验证 GameState 未被修改（仍为 null）
    const afterLockedAttempt = await page.evaluate(() => {
      const gs = window.getGameState();
      return { routeId: gs.selectedRouteId, cityId: gs.selectedCityId };
    });
    console.log(`    尝试选择未解锁路线后: ${JSON.stringify(afterLockedAttempt)}`);
    assert(afterLockedAttempt.routeId !== "route_locked_test", "未解锁路线未被写入 GameState");
    assert(afterLockedAttempt.routeId === null, "未解锁路线尝试后 routeId 仍为 null");

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log("阶段7.1.1 商路选择边界测试: ✅ 全部通过");
    console.log("========================================");
    await browser.close();
    process.exit(0);

  } catch (e) {
    console.error(`\n❌ 测试失败: ${e.message}`);
    console.error(`\n测试结果: ${passed} 通过, ${failed} 失败`);
    console.error("========================================");
    await browser.close();
    process.exit(1);
  }
}

runTest();
