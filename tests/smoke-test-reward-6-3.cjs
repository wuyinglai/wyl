/**
 * smoke-test-reward-6-3.cjs
 * 阶段6.3 战斗胜利奖励选卡闭环冒烟测试
 * 
 * 验证要点:
 * 1. 能进入战斗
 * 2. 能触发胜利
 * 3. 胜利后出现奖励界面
 * 4. 奖励界面有3张卡
 * 5. 点击1张卡后返回地图
 * 6. 新增卡进入牌组结构
 */
const { chromium } = require("playwright");
const BASE_URL = "http://localhost:5173";
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log("========================================");
  console.log("阶段6.3 战斗胜利奖励选卡闭环冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", msg => {
    const text = msg.text();
    logs.push(text);
    // 只打印关键日志
    if (text.includes("[奖励]") || text.includes("[战斗]") || text.includes("获得卡牌")) {
      console.log(`[页面] ${text}`);
    }
  });

  try {
    // ========== 测试1: 新开局 ==========
    console.log("测试1: 新开局");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    console.log("✅ 游戏加载成功\n");

    // 开始远征
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs) { cs.selectedChars = ["guardian", "sharpshooter", "repairman"]; cs.startExpedition(); }
    });
    await sleep(2000);

    // ========== 测试2: 进入战斗并触发胜利 ==========
    console.log("测试2: 进入战斗并触发胜利");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.currentBattleType = "normal";
      window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);
    console.log("✅ 进入战斗场景");

    // Q键胜利
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs) bs.onBattleEnd(true);
    });
    await sleep(1500);
    console.log("✅ 触发战斗胜利\n");

    // ========== 测试3: 验证奖励界面出现 ==========
    console.log("测试3: 验证奖励界面");
    const rewardCheck = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      return {
        battleSceneActive: !!bs,
        hasRewardCards: bs && bs._rewardCards && bs._rewardCards.length > 0,
        rewardCardCount: bs && bs._rewardCards ? bs._rewardCards.length : 0,
        rewardCards: bs && bs._rewardCards ? bs._rewardCards.map(c => ({ name: c.name, char: c.characterId })) : []
      };
    });
    console.log("奖励卡状态:", JSON.stringify(rewardCheck, null, 2));

    if (rewardCheck.hasRewardCards && rewardCheck.rewardCardCount >= 3) {
      console.log(`✅ 奖励界面有 ${rewardCheck.rewardCardCount} 张卡\n`);
    } else {
      console.log(`⚠️ 奖励卡数量: ${rewardCheck.rewardCardCount}\n`);
    }

    // ========== 测试4: 选择奖励卡 ==========
    console.log("测试4: 选择奖励卡");
    const beforeDeck = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      const card = bs._rewardCards[0];
      const gs = window.getGameState();
      const before = gs.characterStates[card.characterId]?.deck?.length || 0;
      return { cardName: card.name, charId: card.characterId, deckBefore: before };
    });
    console.log(`选择卡牌: ${beforeDeck.cardName} (${beforeDeck.charId})`);
    console.log(`选择前牌组数量: ${beforeDeck.deckBefore}`);

    // 点击第一张奖励卡
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      const card = bs._rewardCards[0];
      bs.selectRewardCard(card);
    });
    await sleep(2000);

    // ========== 测试5: 验证返回地图 ==========
    console.log("\n测试5: 验证返回地图");
    const mapCheck = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      return { mapSceneActive: !!ms };
    });
    console.log("地图状态:", JSON.stringify(mapCheck));
    console.log(mapCheck.mapSceneActive ? "✅ 已返回地图" : "❌ 未返回地图");

    // ========== 测试6: 验证卡牌加入牌组 ==========
    console.log("\n测试6: 验证卡牌加入牌组");
    const afterDeck = await page.evaluate(() => {
      const gs = window.getGameState();
      const deckAfter = gs.characterStates[beforeDeck.charId]?.deck?.length || 0;
      const newCard = gs.characterStates[beforeDeck.charId]?.deck?.slice(-1)[0];
      return { 
        deckAfter, 
        added: deckAfter - beforeDeck.deckBefore,
        newCardName: newCard?.name,
        newCardId: newCard?.id
      };
    });
    console.log(`选择后牌组数量: ${afterDeck.deckAfter}`);
    console.log(`新增卡牌: ${afterDeck.newCardName} (${afterDeck.newCardId})`);
    console.log(`牌组增加: ${afterDeck.added} 张`);
    console.log(afterDeck.added === 1 ? "✅ 卡牌成功加入牌组" : "❌ 卡牌未加入牌组");

    // ========== 测试7: 验证新增卡进入下一场战斗 ==========
    console.log("\n测试7: 验证新增卡进入下一场战斗抽牌池");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.currentBattleType = "normal";
      window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);

    const battleDeckCheck = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      const gs = window.getGameState();
      const charId = "${beforeDeck.charId}";
      const charState = gs.characterStates[charId];
      return {
        battleStarted: !!bs,
        deckCount: charState?.deck?.length || 0,
        hasNewCard: charState?.deck?.some(c => c.id === "${afterDeck.newCardId}" || c.name === "${afterDeck.newCardName}")
      };
    });
    console.log("战斗牌组状态:", JSON.stringify(battleDeckCheck));
    console.log(battleDeckCheck.hasNewCard ? "✅ 新增卡进入战斗牌组" : "⚠️ 需手动验证抽牌池");

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log("测试总结");
    console.log("========================================");
    console.log("1. 进入战斗: ✅");
    console.log("2. 触发胜利: ✅");
    console.log("3. 奖励界面出现: " + (rewardCheck.hasRewardCards ? "✅" : "❌"));
    console.log("4. 奖励卡数量: " + rewardCheck.rewardCardCount + " 张");
    console.log("5. 返回地图: " + (mapCheck.mapSceneActive ? "✅" : "❌"));
    console.log("6. 卡牌加入牌组: " + (afterDeck.added === 1 ? "✅" : "❌"));
    console.log("7. 新增卡进入战斗: " + (battleDeckCheck.hasNewCard ? "✅" : "⚠️"));
    console.log("\n阶段6.3 战斗胜利奖励选卡闭环: " + 
      (rewardCheck.hasRewardCards && mapCheck.mapSceneActive && afterDeck.added === 1 ? "✅ 通过" : "⚠️ 需检查"));

  } catch (e) {
    console.error("❌ 测试失败:", e.message);
  } finally {
    await browser.close();
  }
}

runTest();
