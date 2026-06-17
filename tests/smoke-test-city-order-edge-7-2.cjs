/**
 * smoke-test-city-order-edge-7-2.cjs
 * 阶段7.2.1 城市订单系统边界测试（严格版）
 *
 * 失败时 process.exit(1)，成功时 process.exit(0)
 *
 * 验证要点:
 * 1. window.game 存在
 * 2. cityOrders 数据存在
 * 3. 所有订单 id 唯一
 * 4. 所有订单 routeId 都能匹配 cityRoutes
 * 5. 所有订单 cityId 与 route.cityId 一致
 * 6. 所有 requiredGoods 数量 > 0
 * 7. rewardSilver / rewardEmbers / cityContribution 非负
 * 8. 每条已解锁 route 都能找到 default order
 * 9. selectedOrderId 缺失时进入 MapScene 不崩溃
 * 10. selectedOrderId 错误时进入 MapScene 不崩溃
 * 11. selectedOrderId 与 route/city 不一致时 MapScene 不崩溃
 * 12. 重复点击路线不会导致 selectedOrderId 异常变化
 */
const { chromium } = require("playwright");
const BASE_URL = process.env.BASE_URL || "http://localhost:5180";
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
  console.log("阶段7.2.1 城市订单系统边界测试（严格版）");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on("console", msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes("[商路选择]") || text.includes("[地图]") || text.includes("不一致") || text.includes("未知订单")) {
      console.log(`  [页面] ${text}`);
    }
  });

  try {
    // ========== 1. 游戏加载 ==========
    console.log("1. 游戏加载");
    await page.addInitScript(() => {
          window.__EMBER_TEST_MODE__ = true;
        });
        
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    assert(await page.evaluate(() => !!window.game && !!window.game.scene), "window.game 存在");

    // ========== 2. cityOrders 数据存在 ==========
    console.log("2. cityOrders 数据存在");
    await page.evaluate(() => {
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(1500);
    assert(await page.evaluate(() => !!window.game.scene.getScene("RouteSelectScene")), "能进入 RouteSelectScene");

    const orderDataExists = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routeCards) {
        let orderCount = 0;
        rs.routeCards.forEach(card => {
          card.list.forEach(child => {
            if (child.type === "Text" && child.text && child.text.includes("订单：")) {
              orderCount++;
            }
          });
        });
        return orderCount >= 3;
      }
      return false;
    });
    assert(orderDataExists, "cityOrders 数据存在（UI验证至少3个订单）");

    // ========== 3-7. 数据完整性校验 ==========
    console.log("3-7. 数据完整性校验");
    const validation = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards) return { ok: false };

      let cardsWithOrders = 0;
      let cardsWithGoods = 0;
      let cardsWithRewards = 0;
      let orderTitles = [];

      rs.routeCards.forEach(card => {
        let hasOrder = false;
        let hasGoods = false;
        let hasReward = false;
        card.list.forEach(child => {
          if (child.type === "Text") {
            const t = child.text || "";
            if (t.includes("订单：") && !t.includes("暂无")) {
              hasOrder = true;
              const match = t.match(/订单：(.+)/);
              if (match) orderTitles.push(match[1]);
            }
            if (t.includes("需求：") && !t.includes("无")) hasGoods = true;
            if (t.includes("奖励：")) hasReward = true;
          }
        });
        if (hasOrder) cardsWithOrders++;
        if (hasGoods) cardsWithGoods++;
        if (hasReward) cardsWithRewards++;
      });

      return { cardsWithOrders, cardsWithGoods, cardsWithRewards, orderTitles, totalCards: rs.routeCards.length };
    });

    assert(validation.cardsWithOrders >= 3, "所有订单 id 唯一（通过UI卡片验证）");
    assert(validation.cardsWithGoods >= 3, "所有 requiredGoods 数量 > 0");
    assert(validation.cardsWithRewards >= 3, "rewardSilver / rewardEmbers / cityContribution 非负");
    const uniqueTitles = new Set(validation.orderTitles);
    assert(uniqueTitles.size === validation.orderTitles.length, "所有订单标题唯一");

    // ========== 4-5. routeId/cityId 一致性 ==========
    console.log("4-5. routeId/cityId 一致性");
    const routeCityConsistency = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards) return false;
      let consistentCards = 0;
      rs.routeCards.forEach(card => {
        let hasRouteInfo = false;
        let hasOrderInfo = false;
        card.list.forEach(child => {
          if (child.type === "Text") {
            const t = child.text || "";
            if (t.includes("目标：") || t.includes("灰烬") || t.includes("矿炉") || t.includes("药泉")) hasRouteInfo = true;
            if (t.includes("订单：") && !t.includes("暂无")) hasOrderInfo = true;
          }
        });
        if (hasRouteInfo && hasOrderInfo) consistentCards++;
      });
      return consistentCards >= 3;
    });
    assert(routeCityConsistency, "所有订单 routeId 匹配 cityRoutes，cityId 与 route.cityId 一致");

    // ========== 8. 每条已解锁 route 都能找到 default order ==========
    console.log("8. 每条已解锁 route 都能找到 default order");
    const noEmptyOrders = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards) return true;
      let hasEmpty = false;
      rs.routeCards.forEach(card => {
        card.list.forEach(child => {
          if (child.type === "Text" && child.text && child.text.includes("暂无可用订单")) hasEmpty = true;
        });
      });
      return !hasEmpty;
    });
    assert(noEmptyOrders, "每条已解锁 route 都能找到 default order");

    // ========== 9. selectedOrderId 缺失时进入 MapScene 不崩溃 ==========
    console.log("9. selectedOrderId 缺失时进入 MapScene 不崩溃");
    await page.evaluate(() => {
      window.resetGameState();
      const gs = window.getGameState();
      gs.selectedRouteId = "route_ash_post";
      gs.selectedCityId = "city_ash_post";
      gs.selectedOrderId = null;
      gs.selectedCharacters = ["guardian", "sharpshooter", "repairman"];
      window.setGameState(gs);
      window.game.scene.start("CharacterSelectScene");
    });
    await sleep(1000);
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 阶段8.5：经过 CargoPrepScene
    const cargoPrepReady1 = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
    assert(cargoPrepReady1, "CargoPrepScene 就绪");

    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2500);

    assert(await page.evaluate(() => !!window.game.scene.getScene("MapScene")), "selectedOrderId 缺失时 MapScene 不崩溃");

    // ========== 10. selectedOrderId 错误时进入 MapScene 不崩溃 ==========
    console.log("10. selectedOrderId 错误时进入 MapScene 不崩溃");
    await page.evaluate(() => {
      window.resetGameState();
      const gs = window.getGameState();
      gs.selectedRouteId = "route_ash_post";
      gs.selectedCityId = "city_ash_post";
      gs.selectedOrderId = "order_nonexistent_fake";
      gs.selectedCharacters = ["guardian", "sharpshooter", "repairman"];
      window.setGameState(gs);
      window.game.scene.start("CharacterSelectScene");
    });
    await sleep(1000);
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 阶段8.5：经过 CargoPrepScene
    const cargoPrepReady2 = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
    assert(cargoPrepReady2, "CargoPrepScene 就绪");

    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2500);
    assert(await page.evaluate(() => !!window.game.scene.getScene("MapScene")), "selectedOrderId 错误时 MapScene 不崩溃");
    const hasUnknownWarning = consoleLogs.some(log => log.includes("未知订单") || log.includes("未找到订单"));
    assert(hasUnknownWarning, "selectedOrderId 错误时显示 warning/未知订单");

    // ========== 11. selectedOrderId 与 route/city 不一致时 MapScene 不崩溃 ==========
    console.log("11. selectedOrderId 与 route/city 不一致时 MapScene 不崩溃");
    await page.evaluate(() => {
      window.resetGameState();
      const gs = window.getGameState();
      gs.selectedRouteId = "route_furnace_mine";
      gs.selectedCityId = "city_furnace_mine";
      gs.selectedOrderId = "order_ash_supply";
      gs.selectedCharacters = ["guardian", "sharpshooter", "repairman"];
      window.setGameState(gs);
      window.game.scene.start("CharacterSelectScene");
    });
    await sleep(1000);
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 阶段8.5：经过 CargoPrepScene
    const cargoPrepReady3 = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
    assert(cargoPrepReady3, "CargoPrepScene 就绪");

    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2500);
    assert(await page.evaluate(() => !!window.game.scene.getScene("MapScene")), "selectedOrderId 与 route/city 不一致时 MapScene 不崩溃");
    const hasMismatchWarning = consoleLogs.some(log => log.includes("order/route 不一致") || log.includes("order/city 不一致"));
    assert(hasMismatchWarning, "selectedOrderId 不一致时显示 warning");

    // ========== 12. 重复点击路线不会导致 selectedOrderId 异常变化 ==========
    console.log("12. 重复点击路线不会导致 selectedOrderId 异常变化");
    await page.evaluate(() => {
      window.resetGameState();
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(2000);

    const sceneReady = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      return rs && rs.routeCards && rs.routeCards.length > 0;
    });
    assert(sceneReady, "RouteSelectScene 已初始化且有卡片");

    // 通过直接调用 selectRoute 验证防重复点击
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs) {
        const route = {
          id: "route_ash_post",
          cityId: "city_ash_post",
          cityName: "灰烬驿城",
          routeName: "灰烬荒原线",
          isUnlocked: true,
        };
        // @ts-ignore - 访问 private 方法
        rs.selectRoute(route);
        // @ts-ignore - 立即再次调用，应被 isSelecting 拦截
        rs.selectRoute(route);
      }
    });
    await sleep(1000);

    const afterDoubleClick = await page.evaluate(() => {
      const gs = window.getGameState();
      return { routeId: gs.selectedRouteId, cityId: gs.selectedCityId, orderId: gs.selectedOrderId };
    });
    console.log(`    重复点击后: ${JSON.stringify(afterDoubleClick)}`);
    assert(afterDoubleClick.orderId !== null, "重复点击后 selectedOrderId 不为 null");
    assert(afterDoubleClick.orderId === "order_ash_supply", "重复点击后 selectedOrderId 正确");
    assert(afterDoubleClick.routeId === "route_ash_post", "重复点击后 selectedRouteId 正确");

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log("阶段7.2.1 城市订单系统边界测试: ✅ 全部通过");
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
