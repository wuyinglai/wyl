/**
 * smoke-test-route-select-7-1.cjs
 * 阶段7.1 商路与目标城市选择系统冒烟测试（严格版）
 *
 * 失败时 process.exit(1)，成功时 process.exit(0)
 *
 * 验证要点:
 * 1. window.game 存在
 * 2. 能进入 RouteSelectScene
 * 3. 场景中存在 3 条商路数据
 * 4. 选择第一条商路后 selectedRouteId 写入 GameState
 * 5. selectedCityId 写入 GameState
 * 6. 成功进入 CharacterSelectScene
 * 7. 完成角色选择后进入 MapScene
 * 8. MapScene 中仍能读取 selectedRouteId / selectedCityId
 * 9. 进入 BattleScene 并返回地图后 selectedRouteId / selectedCityId 不丢失
 */
const { chromium } = require("playwright");
const { proceedFromCharacterSelectToMap } = require("./helpers/cargo-prep-flow.cjs");
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
  console.log("阶段7.1 商路与目标城市选择系统冒烟测试（严格版）");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", msg => {
    const text = msg.text();
    if (text.includes("[商路选择]") || text.includes("[地图V2]") || text.includes("[战斗]")) {
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
    // 点击开始按钮进入商路选择
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MainMenuScene");
      if (ms) {
        // 模拟点击开始按钮
        ms.scene.start("RouteSelectScene");
      }
    });
    await sleep(1500);

    const routeSceneActive = await page.evaluate(() => !!window.game.scene.getScene("RouteSelectScene"));
    assert(routeSceneActive, "能进入 RouteSelectScene");

    // ========== 3. 验证 3 条商路数据 ==========
    console.log("3. 验证 3 条商路数据");
    const routeCount = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      return rs && rs.routeCards ? rs.routeCards.length : 0;
    });
    assert(routeCount === 3, `场景中存在 3 条商路数据 (实际: ${routeCount})`);

    // ========== 4-5. 选择第一条商路，验证 GameState 写入 ==========
    console.log("4-5. 选择第一条商路，验证 GameState 写入");
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routeCards && rs.routeCards[0]) {
        // 模拟点击第一张卡片
        const card = rs.routeCards[0];
        // 找到卡片的 hitArea 并触发 pointerdown
        const hitArea = card.list.find(c => c.input && c.input.enabled);
        if (hitArea) {
          hitArea.emit("pointerdown");
        }
      }
    });
    await sleep(1500);

    // 验证 GameState
    const routeState = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        selectedRouteId: gs.selectedRouteId,
        selectedCityId: gs.selectedCityId,
      };
    });
    console.log(`    GameState: ${JSON.stringify(routeState)}`);
    assert(routeState.selectedRouteId !== null, "selectedRouteId 写入 GameState");
    assert(routeState.selectedCityId !== null, "selectedCityId 写入 GameState");

    // ========== 6. 进入 CharacterSelectScene ==========
    console.log("6. 进入 CharacterSelectScene");
    const charSceneActive = await page.evaluate(() => !!window.game.scene.getScene("CharacterSelectScene"));
    assert(charSceneActive, "成功进入 CharacterSelectScene");

    // ========== 7. 完成角色选择后进入 MapScene ==========
    console.log("7. 完成角色选择后进入 MapScene");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs) {
        cs.selectedChars = ["guardian", "sharpshooter", "repairman"];
        cs.startExpedition();
      }
    });
    await proceedFromCharacterSelectToMap(page, sleep, assert);

    const mapSceneActive = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapSceneActive, "成功进入 MapScene");

    // ========== 8. MapScene 中仍能读取 selectedRouteId / selectedCityId ==========
    console.log("8. MapScene 中仍能读取商路信息");
    const mapRouteState = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        selectedRouteId: gs.selectedRouteId,
        selectedCityId: gs.selectedCityId,
      };
    });
    console.log(`    MapScene GameState: ${JSON.stringify(mapRouteState)}`);
    assert(mapRouteState.selectedRouteId === routeState.selectedRouteId, "MapScene 中 selectedRouteId 不丢失");
    assert(mapRouteState.selectedCityId === routeState.selectedCityId, "MapScene 中 selectedCityId 不丢失");

    // ========== 9. 进入 BattleScene 并返回后商路信息不丢失 ==========
    console.log("9. 进入 BattleScene 并返回后商路信息不丢失");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.currentBattleType = "normal";
      window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);

    const battleSceneActive = await page.evaluate(() => !!window.game.scene.getScene("BattleScene"));
    assert(battleSceneActive, "成功进入 BattleScene");

    // 触发胜利返回地图
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs) bs.onBattleEnd(true);
    });
    await sleep(2000);

    // 选择奖励卡
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs && bs._rewardCards && bs._rewardCards[0]) {
        bs.selectRewardCard(bs._rewardCards[0]);
      }
    });
    await sleep(2000);

    // 验证返回 MapScene 且商路信息仍在
    const backToMap = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(backToMap, "返回 MapScene");

    const finalRouteState = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        selectedRouteId: gs.selectedRouteId,
        selectedCityId: gs.selectedCityId,
      };
    });
    console.log(`    战斗返回后 GameState: ${JSON.stringify(finalRouteState)}`);
    assert(finalRouteState.selectedRouteId === routeState.selectedRouteId, "战斗返回后 selectedRouteId 不丢失");
    assert(finalRouteState.selectedCityId === routeState.selectedCityId, "战斗返回后 selectedCityId 不丢失");

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log("阶段7.1 商路与目标城市选择系统: ✅ 全部通过");
    console.log("========================================");
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
