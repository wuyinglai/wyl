/**
 * smoke-test-reward-skip-6-4.cjs
 * 阶段6.4 跳过奖励冒烟测试（严格版）
 *
 * 失败时 process.exit(1)，成功时 process.exit(0)
 *
 * 验证要点:
 * 1. 游戏加载
 * 2. MapScene 已启动
 * 3. BattleScene 成功启动
 * 4. onBattleEnd(true) 后奖励卡出现
 * 5. 调用 showSkipRewardToast 后返回 MapScene
 * 6. 跳过前后对应角色 deck 数量不变
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
  console.log("阶段6.4 跳过奖励冒烟测试（严格版）");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", msg => {
    const text = msg.text();
    if (text.includes("[奖励]") || text.includes("[战斗]") || text.includes("跳过")) {
      console.log(`  [页面] ${text}`);
    }
  });

  try {
    // ========== 1. 游戏加载 ==========
    console.log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

    const gameExists = await page.evaluate(() => !!window.game && !!window.game.scene);
    assert(gameExists, "window.game 和 window.game.scene 存在");

    // ========== 2. 启动远征 ==========
    console.log("2. 启动远征");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs) {
        cs.selectedChars = ["guardian", "sharpshooter", "repairman"];
        cs.startExpedition();
      }
    });
    await sleep(2000);

    const mapReady = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      const gs = window.getGameState();
      return { mapSceneExists: !!ms, hasMapCells: !!gs.mapCells };
    });
    assert(mapReady.mapSceneExists, "MapScene 已启动");
    assert(mapReady.hasMapCells, "GameState.mapCells 已初始化");

    // ========== 3. 记录所有角色牌组数量 ==========
    console.log("3. 记录所有角色牌组数量");
    const deckBefore = await page.evaluate(() => {
      const gs = window.getGameState();
      const decks = {};
      for (const id of gs.selectedCharacters) {
        decks[id] = gs.characterStates[id]?.deck?.length || 0;
      }
      return decks;
    });
    console.log(`    跳过前牌组: ${JSON.stringify(deckBefore)}`);

    // ========== 4. 进入 BattleScene ==========
    console.log("4. 进入 BattleScene");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.currentBattleType = "normal";
      window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);

    const battleStarted = await page.evaluate(() => !!window.game.scene.getScene("BattleScene"));
    assert(battleStarted, "BattleScene 已启动");

    // ========== 5. 触发胜利，验证奖励卡 ==========
    console.log("5. 触发胜利，验证奖励卡");
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs) bs.onBattleEnd(true);
    });
    await sleep(1500);

    const rewardInfo = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      const cards = bs && bs._rewardCards;
      return {
        hasRewardCards: !!(cards && cards.length > 0),
        count: cards ? cards.length : 0,
      };
    });
    assert(rewardInfo.hasRewardCards, "胜利后 _rewardCards 存在");
    assert(rewardInfo.count >= 3, `奖励卡数量 >= 3 (实际: ${rewardInfo.count})`);

    // ========== 6. 跳过奖励 ==========
    console.log("6. 跳过奖励");
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs) bs.showSkipRewardToast();
    });
    await sleep(2000);

    // ========== 7. 验证返回 MapScene ==========
    console.log("7. 验证返回 MapScene");
    const mapActive = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapActive, "跳过奖励后返回 MapScene");

    // ========== 8. 验证牌组数量不变 ==========
    console.log("8. 验证牌组数量不变");
    const deckAfter = await page.evaluate(() => {
      const gs = window.getGameState();
      const decks = {};
      for (const id of gs.selectedCharacters) {
        decks[id] = gs.characterStates[id]?.deck?.length || 0;
      }
      return decks;
    });
    console.log(`    跳过后牌组: ${JSON.stringify(deckAfter)}`);

    for (const charId of Object.keys(deckBefore)) {
      const before = deckBefore[charId];
      const after = deckAfter[charId];
      assert(
        after === before,
        `${charId} 牌组数量不变 (跳过前: ${before}, 跳过后: ${after})`
      );
    }

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log("阶段6.4 跳过奖励: ✅ 全部通过");
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
