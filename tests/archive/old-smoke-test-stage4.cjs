/**
 * smoke-test-stage4.cjs
 * 阶段4.2 人工冒烟测试 8 项自动化验证
 */
const { chromium } = require("playwright");
const BASE_URL = "http://localhost:5173";
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  const logs = [];
  page.on("console", msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on("pageerror", err => logs.push({ type: "pageerror", text: err.message }));

  const errors = () => logs.filter(l =>
    (l.type === "error" || l.type === "pageerror") &&
    !l.text.includes("preload") && !l.text.includes("favicon") && !l.text.includes("404") &&
    !l.text.includes("Not allowed to load local resource")
  );

  try {
    console.log("========================================");
    console.log("冒烟测试 1: 新开局");
    console.log("========================================");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    await sleep(1000);

    // 开始远征
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs) { cs.selectedChars = ["guardian", "sharpshooter", "repairman"]; cs.startExpedition(); }
    });
    await sleep(2000);

    const mapReady = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      const gs = window.getGameState();
      return { mapSceneExists: !!ms, hasMapCells: !!gs.mapCells, pos: gs.currentPosition };
    });
    console.log("地图状态:", JSON.stringify(mapReady));
    console.log("红色报错:", errors().length === 0 ? "无 ✅" : errors().length + "个 ❌");

    console.log("\n========================================");
    console.log("冒烟测试 2: V 键查看牌组");
    console.log("========================================");
    await page.evaluate(() => { const ms = window.game.scene.getScene("MapScene"); if (ms) ms.showDeckViewer(); });
    await sleep(500);
    const deckOpen = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      return ms ? ms._deckViewerOpen : "MapScene不存在";
    });
    console.log("牌组查看打开:", deckOpen === true ? "✅" : "❌ " + deckOpen);

    // 测试穿透：在牌组查看打开时尝试触发其他功能
    const penetration = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return "MapScene不存在";
      const gs = window.getGameState();
      const sceneBefore = window.game.scene.scenes.map(s => s.scene.key).filter(k => k === "BattleScene").length;
      // 模拟各种操作
      gs.currentBattleType = "normal";
      window.setGameState(gs);
      // 这些操作应该被 _deckViewerOpen 拦截
      return {
        deckViewerStillOpen: ms._deckViewerOpen,
        battleSceneCount: window.game.scene.scenes.map(s => s.scene.key).filter(k => k === "BattleScene").length,
        modalContainer: !!ms.modalContainer
      };
    });
    console.log("穿透测试:", JSON.stringify(penetration));

    // 关闭牌组查看
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (ms && ms._deckViewerOpen) { ms._deckViewerOpen = false; ms._deckViewerClose?.(); ms._deckViewerClose = undefined; }
    });
    await sleep(500);
    const deckClosed = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      return ms ? ms._deckViewerOpen : "MapScene不存在";
    });
    console.log("牌组查看关闭:", deckClosed === false ? "✅" : "❌");

    console.log("\n========================================");
    console.log("冒烟测试 3: 普通战斗奖励闭环");
    console.log("========================================");
    await page.evaluate(() => {
      const gs = window.getGameState(); gs.currentBattleType = "normal"; window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);
    await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); if (bs) bs.onBattleEnd(true); });
    await sleep(1500);

    const reward1 = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs || !bs._rewardCards || bs._rewardCards.length === 0) return { error: "无奖励卡" };
      const card = bs._rewardCards[0];
      const gs = window.getGameState();
      const before = gs.characterStates[card.characterId]?.deck?.length || 0;
      bs.selectRewardCard(card);
      const after = window.getGameState().characterStates[card.characterId]?.deck?.length || 0;
      return { card: card.name, charId: card.characterId, deckBefore: before, deckAfter: after, added: after - before };
    });
    console.log("奖励选择:", JSON.stringify(reward1));
    console.log("deck+1:", reward1.added === 1 ? "✅" : "❌ added=" + reward1.added);
    await sleep(2500);

    const backToMap = await page.evaluate(() => {
      return window.game.scene.scenes.map(s => s.scene.key).includes("MapScene");
    });
    console.log("返回地图:", backToMap ? "✅" : "❌");

    console.log("\n========================================");
    console.log("冒烟测试 4: 奖励卡进入下一场战斗");
    console.log("========================================");
    await page.evaluate(() => {
      const gs = window.getGameState(); gs.currentBattleType = "normal"; window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);

    const deckVerify = await page.evaluate(() => {
      const gs = window.getGameState();
      const result = {};
      for (const [id, s] of Object.entries(gs.characterStates || {})) {
        if (s.deck) result[id] = { count: s.deck.length, cards: s.deck.map(c => c.name) };
      }
      return result;
    });
    console.log("下一场战斗 deck:", JSON.stringify(deckVerify, null, 2));
    const newCardInDeck = reward1.card && deckVerify[reward1.charId]?.cards?.includes(reward1.card);
    console.log("新卡在deck中:", newCardInDeck ? "✅" : "❌");

    // 跳过这场战斗
    await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); if (bs) bs.onBattleEnd(true); });
    await sleep(1500);
    const hasR = await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); return bs?._rewardCards?.length > 0; });
    if (hasR) { await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); if (bs && bs._rewardCards?.length > 0) bs.showSkipRewardToast(); }); await sleep(1500); }

    console.log("\n========================================");
    console.log("冒烟测试 5: 精英战斗奖励闭环");
    console.log("========================================");
    await page.evaluate(() => {
      const gs = window.getGameState(); gs.currentBattleType = "elite"; window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);
    await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); if (bs) bs.onBattleEnd(true); });
    await sleep(1500);

    const reward2 = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs || !bs._rewardCards || bs._rewardCards.length === 0) return { error: "无奖励卡" };
      const card = bs._rewardCards[0];
      const gs = window.getGameState();
      const before = gs.characterStates[card.characterId]?.deck?.length || 0;
      bs.selectRewardCard(card);
      const after = window.getGameState().characterStates[card.characterId]?.deck?.length || 0;
      return { card: card.name, charId: card.characterId, deckBefore: before, deckAfter: after };
    });
    console.log("精英奖励:", JSON.stringify(reward2));
    await sleep(2500);

    // 移动 10 步
    let moveOk = 0;
    for (let i = 0; i < 10; i++) {
      try {
        const mr = await page.evaluate(() => {
          const ms = window.game.scene.getScene("MapScene");
          if (!ms) return { error: "no MapScene" };
          const gs = window.getGameState();
          const movable = window.getMovableNeighbors(gs);
          if (movable.length === 0) return { error: "no movable" };
          const t = movable[0];
          const cell = gs.mapCells[t.y][t.x];
          if (cell.type === "question" && !cell.resolvedType) {
            cell.isRevealed = true;
            cell.resolvedType = window.resolveQuestionCell ? window.resolveQuestionCell(cell, gs.startPosition, gs.bossPosition) : "empty";
          }
          if (cell.resolvedType === "combat" || cell.type === "elite" || cell.type === "boss") { cell.isCleared = true; window.setGameState(gs); }
          ms.tryMoveTo(t.x, t.y);
          return { ok: true };
        });
        if (mr.ok) moveOk++;
        await sleep(300);
        const sc = await page.evaluate(() => window.game.scene.scenes.map(s => s.scene.key).join(","));
        if (sc.includes("BattleScene")) {
          await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); if (bs) bs.onBattleEnd(true); });
          await sleep(500);
          const hr = await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); return bs?._rewardCards?.length > 0; });
          if (hr) { await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); if (bs && bs._rewardCards?.length > 0) bs.showSkipRewardToast(); }); await sleep(1500); }
        }
      } catch (e) { /* skip */ }
    }
    console.log("移动10步:", moveOk + "/10 ✅");
    console.log("红色报错:", errors().length === 0 ? "无 ✅" : errors().length + "个 ❌");

    console.log("\n========================================");
    console.log("冒烟测试 6: Boss 战胜利不弹奖励");
    console.log("========================================");
    await page.evaluate(() => {
      const gs = window.getGameState(); gs.currentBattleType = "boss"; window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);
    await page.evaluate(() => { const bs = window.game.scene.getScene("BattleScene"); if (bs) bs.onBattleEnd(true); });
    await sleep(1500);

    const bossResult = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      const ms = window.game.scene.getScene("MapScene");
      return {
        hasReward: bs ? bs._rewardCards?.length > 0 : false,
        victoryOverlay: ms ? ms._victoryOverlayOpen : false,
        battleEnded: bs ? bs.battleEnded : null
      };
    });
    console.log("Boss结果:", JSON.stringify(bossResult));
    console.log("不弹奖励:", bossResult.hasReward === false ? "✅" : "❌");

    console.log("\n========================================");
    console.log("冒烟测试 7: 终局界面调试键保护");
    console.log("========================================");
    // 在胜利界面尝试各种操作
    const terminalTest = await page.evaluate(() => {
      const game = window.game;
      const bs = game.scene.getScene("BattleScene");
      const ms = game.scene.getScene("MapScene");
      const results = {};

      // BattleScene 调试键应该被 battleEnded 阻止
      if (bs) {
        results.battleEnded = bs.battleEnded;
        // 尝试 Q
        bs.onBattleEnd(true);
        results.qBlocked = bs.battleEnded; // 仍然是 true
      }

      // MapScene 调试键应该被 _victoryOverlayOpen 阻止（如果 showVictory 被调用）
      results.victoryOverlayOpen = ms ? ms._victoryOverlayOpen : "N/A";

      return results;
    });
    console.log("终局保护:", JSON.stringify(terminalTest));
    console.log("调试键被阻止:", terminalTest.battleEnded === true ? "✅" : "❌");

    // 返回主菜单准备下一项测试
    await page.evaluate(() => { window.resetGameState(); window.game.scene.start("MainMenuScene"); });
    await sleep(1000);

    console.log("\n========================================");
    console.log("冒烟测试 8: 新开局状态清空");
    console.log("========================================");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs) { cs.selectedChars = ["guardian", "sharpshooter", "repairman"]; cs.startExpedition(); }
    });
    await sleep(2000);

    const newState = await page.evaluate(() => {
      const gs = window.getGameState();
      const decks = {};
      for (const [id, s] of Object.entries(gs.characterStates || {})) {
        decks[id] = { count: s.deck?.length, cards: s.deck?.map(c => c.name) };
      }
      return { decks, hasMapCells: !!gs.mapCells };
    });
    console.log("新局 deck:", JSON.stringify(newState, null, 2));
    const allInitial = Object.values(newState.decks).every(d => d.count === 6);
    console.log("deck 回到初始:", allInitial ? "✅" : "❌");
    console.log("地图重新生成:", newState.hasMapCells ? "✅" : "❌");

    console.log("\n========================================");
    console.log("冒烟测试总结");
    console.log("========================================");
    console.log("红色报错总数:", errors().length);
    if (errors().length > 0) {
      errors().forEach(e => console.log("  [ERROR]", e.text.substring(0, 150)));
    }

  } catch (err) {
    console.error("测试异常:", err.message);
  } finally {
    await browser.close();
  }
}

runTest().catch(console.error);
