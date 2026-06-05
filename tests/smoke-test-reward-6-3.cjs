/**
 * smoke-test-reward-6-3.cjs
 * 阶段6.3 战斗胜利奖励选卡闭环冒烟测试（严格版）
 *
 * 失败时 process.exit(1)，成功时 process.exit(0)
 *
 * 验证要点:
 * 1. 游戏加载，window.game 存在
 * 2. 能启动远征
 * 3. 能进入 BattleScene
 * 4. onBattleEnd(true) 后 _rewardCards 存在且 >= 3
 * 5. selectRewardCard(card) 后返回 MapScene
 * 6. 对应角色 deck 数量 +1
 * 7. 新增卡在对应角色 deck 中能找到
 * 8. 再次进入 BattleScene 后，新增卡仍在角色 deck 中
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
  console.log("阶段6.3 战斗胜利奖励选卡闭环冒烟测试（严格版）");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", msg => {
    const text = msg.text();
    if (text.includes("[奖励]") || text.includes("[战斗]") || text.includes("获得卡牌") || text.includes("[部件]")) {
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
    await proceedFromCharacterSelectToMap(page, sleep, assert);

    const mapReady = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      const gs = window.getGameState();
      return { mapSceneExists: !!ms, hasMapCells: !!gs.mapCells };
    });
    assert(mapReady.mapSceneExists, "MapScene 已启动");
    assert(mapReady.hasMapCells, "GameState.mapCells 已初始化");

    // ========== 3. 进入 BattleScene ==========
    console.log("3. 进入 BattleScene");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.currentBattleType = "normal";
      window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);

    const battleStarted = await page.evaluate(() => !!window.game.scene.getScene("BattleScene"));
    assert(battleStarted, "BattleScene 已启动");

    // ========== 4. 触发胜利，验证奖励卡 ==========
    console.log("4. 触发胜利，验证奖励卡");
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
        firstCard: cards && cards[0] ? { name: cards[0].name, charId: cards[0].characterId } : null,
      };
    });
    assert(rewardInfo.hasRewardCards, "胜利后 _rewardCards 存在");
    assert(rewardInfo.count >= 3, `奖励卡数量 >= 3 (实际: ${rewardInfo.count})`);
    assert(rewardInfo.firstCard !== null, "第一张奖励卡存在");
    console.log(`    奖励卡: ${rewardInfo.firstCard.name} (${rewardInfo.firstCard.charId})`);

    // ========== 5. 记录选择前牌组，选择奖励卡 ==========
    console.log("5. 选择奖励卡");
    const charId = rewardInfo.firstCard.charId;
    const cardName = rewardInfo.firstCard.name;

    const beforeSelect = await page.evaluate((cid) => {
      const gs = window.getGameState();
      return gs.characterStates[cid]?.deck?.length || 0;
    }, charId);
    console.log(`    选择前 ${charId} 牌组数量: ${beforeSelect}`);

    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs && bs._rewardCards && bs._rewardCards[0]) {
        bs.selectRewardCard(bs._rewardCards[0]);
      }
    });
    await sleep(2000);

    // ========== 6. 验证返回 MapScene ==========
    console.log("6. 验证返回 MapScene");
    const mapActive = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapActive, "选择奖励卡后返回 MapScene");

    // ========== 7. 验证卡牌加入牌组 ==========
    console.log("7. 验证卡牌加入牌组");
    const afterSelect = await page.evaluate((cid) => {
      const gs = window.getGameState();
      return gs.characterStates[cid]?.deck?.length || 0;
    }, charId);
    const deckAdded = afterSelect - beforeSelect;
    assert(deckAdded === 1, `牌组数量 +1 (选择前: ${beforeSelect}, 选择后: ${afterSelect})`);

    const cardInDeck = await page.evaluate(({ cid, cname }) => {
      const gs = window.getGameState();
      const deck = gs.characterStates[cid]?.deck || [];
      return deck.some(c => c.name === cname);
    }, { cid: charId, cname: cardName });
    assert(cardInDeck, `新增卡 "${cardName}" 在 ${charId} 的 deck 中找到`);

    // ========== 8. 再次进入战斗，验证新增卡仍在 deck ==========
    console.log("8. 再次进入战斗，验证新增卡仍在 deck");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.currentBattleType = "normal";
      window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);

    const battleActive = await page.evaluate(() => !!window.game.scene.getScene("BattleScene"));
    assert(battleActive, "再次进入 BattleScene 成功");

    const cardStillInDeck = await page.evaluate(({ cid, cname }) => {
      const gs = window.getGameState();
      const deck = gs.characterStates[cid]?.deck || [];
      return deck.some(c => c.name === cname);
    }, { cid: charId, cname: cardName });
    assert(cardStillInDeck, `再次进入战斗后 "${cardName}" 仍在 ${charId} 的 deck 中`);

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log("阶段6.3 战斗胜利奖励选卡闭环: ✅ 全部通过");
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
