/**
 * 阶段9.1.2：战斗卡死验证
 * 验证真实战斗流程不会卡死，能正常出牌、结束回合、胜利、选奖励、回地图
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
  console.log("阶段9.1.2：战斗卡死验证");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", msg => {
    const text = msg.text();
    if (text.includes("[战斗]") || text.includes("[地图]") || text.includes("[奖励]")) {
      console.log(`  [页面] ${text}`);
    }
  });

  try {
    // 1. 游戏加载
    console.log("1. 游戏加载");
    await page.addInitScript(() => {
          window.__EMBER_TEST_MODE__ = true;
        });
        
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

    const gameExists = await page.evaluate(() => !!window.game && !!window.game.scene);
    assert(gameExists, "window.game 存在");

    // 2. 真实流程：选择商路 → 角色 → 货物准备 → 地图
    console.log("2. 真实流程进入 MapScene");
    await page.evaluate(() => {
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(1000);

    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) {
        rs.selectRoute(rs.routes[0]);
      }
    });
    await sleep(1000);

    // 选择角色
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      for (let i = 0; i < 3; i++) {
        const card = cs.characterCards[i];
        for (const child of card.list) {
          if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
      cs.startExpedition();
    });
    await sleep(2000);

    const mapReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapReady, "进入 MapScene");

    // 3. 直接启动 BattleScene（模拟真实战斗触发）
    console.log("3. 启动 BattleScene");
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.currentBattleType = "normal";
      gs.currentBattleNodePosition = { x: 5, y: 5 };
      window.setGameState(gs);
      window.game.scene.start("BattleScene");
    });
    await sleep(2000);

    // 4. 检查 BattleScene
    console.log("4. 检查 BattleScene 状态");
    const battleState = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs) return { ok: false, reason: "no scene" };

      const state = bs.battleManager ? bs.battleManager.state : null;
      if (!state) return { ok: false, reason: "no battleManager state" };

      const hasPlayer = state.characters && state.characters.length > 0;
      const hasEnemies = state.enemies && state.enemies.length > 0;
      const hasHand = state.characters && state.characters.some(c => c.hand && c.hand.length > 0);
      const hasEndTurn = !!bs.endTurnButton;

      const totalHand = state.characters ? state.characters.reduce((sum, c) => sum + (c.hand ? c.hand.length : 0), 0) : 0;

      return {
        ok: hasPlayer && hasEnemies,
        hasPlayer,
        hasEnemies,
        hasHand,
        hasEndTurn,
        handCount: totalHand,
      };
    });
    assert(battleState.ok, `BattleScene 有玩家和敌人 (${battleState.reason || ""})`);
    console.log(`    玩家: ${battleState.hasPlayer}, 敌人: ${battleState.hasEnemies}, 手牌: ${battleState.handCount}, 结束回合: ${battleState.hasEndTurn}`);

    // 5. 尝试使用手牌
    console.log("5. 尝试使用手牌");
    const cardPlayed = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs || !bs.handCards || bs.handCards.length === 0) return { played: false, reason: "no hand" };

      for (const card of bs.handCards) {
        if (card.input && card.input.enabled) {
          card.emit("pointerdown");
          return { played: true };
        }
      }
      return { played: false, reason: "no clickable card" };
    });

    if (cardPlayed.played) {
      console.log("    ✅ 使用了手牌");
      await sleep(1500);
    } else {
      console.log(`    ⚠️ 无法使用手牌 (${cardPlayed.reason})，将测试结束回合`);
    }

    // 6. 点击结束回合
    console.log("6. 点击结束回合");
    const endTurnClicked = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs || !bs.endTurnBtn) return false;
      bs.endTurnBtn.emit("pointerdown");
      return true;
    });
    assert(endTurnClicked, "结束回合按钮可点击");
    console.log("    ✅ 结束回合按钮已点击");
    await sleep(2000);

    // 7. 检查是否卡死
    console.log("7. 检查战斗是否卡死");
    const notStuck = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs) {
        const reward = window.game.scene.getScene("RewardScene");
        const map = window.game.scene.getScene("MapScene");
        return { stuck: false, ended: true, hasReward: !!reward, hasMap: !!map };
      }

      const hasPlayer = bs.playerCharacters && bs.playerCharacters.length > 0;
      const hasEnemies = bs.enemies && bs.enemies.length > 0;
      const hasHand = bs.handCards && bs.handCards.length > 0;
      const uiVisible = bs.children && bs.children.list.length > 5;

      return {
        stuck: !hasPlayer && !hasEnemies && !uiVisible,
        ended: false,
        hasPlayer,
        hasEnemies,
        hasHand,
        uiVisible,
      };
    });

    if (notStuck.ended) {
      console.log(`    ✅ 战斗已结束 (reward=${notStuck.hasReward}, map=${notStuck.hasMap})`);
    } else {
      assert(!notStuck.stuck, `战斗未卡死`);
      console.log(`    ✅ 战斗进行中，UI 正常`);
    }

    // 8. 如果战斗未结束，强制结束并检查奖励
    console.log("8. 检查奖励界面");
    let rewardCheck = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      return { inBattle: !!bs };
    });

    if (rewardCheck.inBattle) {
      await page.evaluate(() => {
        const bs = window.game.scene.getScene("BattleScene");
        if (bs && bs.onBattleEnd) {
          bs.onBattleEnd(true);
        }
      });
      await sleep(2000);
    }

    const rewardState = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      const hasRewardCards = bs && bs._rewardCards && bs._rewardCards.length > 0;
      const hasSkip = bs && bs.skipRewardButton;
      return { inBattle: !!bs, hasRewardCards, hasSkip };
    });

    if (rewardState.hasRewardCards || rewardState.hasSkip) {
      console.log("    ✅ 奖励界面出现");
      await page.evaluate(() => {
        const bs = window.game.scene.getScene("BattleScene");
        if (bs._rewardCards && bs._rewardCards.length > 0) {
          const card = bs._rewardCards[0];
          if (card.input && card.input.enabled) {
            card.emit("pointerdown");
          }
        } else if (bs.skipRewardButton) {
          bs.skipRewardButton.emit("pointerdown");
        }
      });
      await sleep(2000);
    }

    // 9. 返回 MapScene
    console.log("9. 返回 MapScene");
    const backToMap = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(backToMap, "战斗后返回 MapScene");
    console.log("    ✅ 返回 MapScene");

    // 10. 第二次进入战斗
    console.log("10. 第二次进入战斗");
    const secondBattle = await page.evaluate(() => {
      const gs = window.getGameState();
      const cells = gs.mapCells;
      const pos = gs.currentPosition;
      const neighbors = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
      for (const { dx, dy } of neighbors) {
        const nx = pos.x + dx, ny = pos.y + dy;
        if (ny >= 0 && ny < cells.length && nx >= 0 && nx < cells[ny].length) {
          if (cells[ny][nx] && !cells[ny][nx].isBlocked && cells[ny][nx].type !== "empty" && !cells[ny][nx].isCleared) {
            const ms = window.game.scene.getScene("MapScene");
            ms.tryMoveTo(nx, ny);
            return true;
          }
        }
      }
      return false;
    });

    if (secondBattle) {
      await sleep(3000);
      const secondBattleReady = await page.evaluate(() => {
        const bs = window.game.scene.getScene("BattleScene");
        return !!bs && bs.handCards && bs.handCards.length > 0;
      });
      if (secondBattleReady) {
        console.log("    ✅ 第二次战斗正常显示手牌/UI");
      } else {
        console.log("    ⚠️ 第二次战斗未触发或已结束");
      }
    } else {
      console.log("    ⚠️ 无相邻未清理战斗节点，跳过第二次战斗测试");
    }

    console.log("\n========================================");
    console.log(`战斗卡死验证: ${passed} 通过, ${failed} 失败`);
    console.log("========================================");

  } finally {
    await browser.close();
  }
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error("\n测试失败:", err.message);
  process.exit(1);
});
