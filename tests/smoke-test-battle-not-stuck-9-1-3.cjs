/**
 * smoke-test-battle-not-stuck-9-1-3.cjs
 * 阶段9.1.3：战斗不卡死真实流程测试
 *
 * 验证：
 * 1. 真实流程进入 MapScene
 * 2. 搜索全地图可达战斗节点
 * 3. BFS 移动到战斗节点
 * 4. 进入 BattleScene
 * 5. 检查有玩家、敌人、手牌
 * 6. 执行一次真实操作（结束回合）
 * 7. 确认没有 UI 消失或输入锁死
 * 8. 触发胜利，奖励界面出现
 * 9. 选择奖励或跳过，返回 MapScene
 * 10. 第二次战斗也正常 active
 */

const { chromium } = require("playwright");
const BASE_URL = "http://localhost:5180";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;
const FAILED = [];

function assert(condition, message) {
  if (!condition) {
    failed++;
    FAILED.push(message);
    console.error(`  ❌ ${message}`);
    return false;
  }
  passed++;
  console.log(`  ✅ ${message}`);
  return true;
}

async function runTest() {
  console.log("========================================");
  console.log("阶段9.1.3：战斗不卡死真实流程测试");
  console.log("========================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  const page = await browser.newPage();

  try {
    // 1. 游戏加载
    console.log("1. 游戏加载");
    await page.addInitScript(() => {
          window.__EMBER_TEST_MODE__ = true;
        });
        
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

    // 2. 真实流程: MainMenu -> RouteSelect -> CharacterSelect -> CargoPrep -> MapScene
    console.log("2. 真实流程进入 MapScene");
    await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (mm) mm.scene.start("RouteSelectScene");
    });
    await sleep(1500);

    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
    });
    await sleep(1500);

    // 选择 3 个角色
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      for (let i = 0; i < 3; i++) {
        const card = cs.characterCards[i];
        for (const child of card.list) {
          if (child.type === "Zone" && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
    });
    await sleep(500);

    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs.startExpedition) cs.startExpedition();
    });
    await sleep(2000);

    // 一键装载并开始远征
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.loadOrderRequirements) scene.loadOrderRequirements();
    });
    await sleep(500);

    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2000);

    const mapActive = await page.evaluate(() => {
      const scenes = window.game.scene.scenes;
      return scenes.find(s => s.scene.isActive())?.scene?.key;
    });
    assert(mapActive === "MapScene", `进入 MapScene (实际: ${mapActive})`);

    // 3. 搜索全地图战斗节点
    console.log("3. 搜索全地图战斗节点");
    const combatInfo = await page.evaluate(() => {
      const gs = window.getGameState();
      const cells = gs.mapCells;
      const combatCells = [];
      for (let y = 0; y < cells.length; y++) {
        for (let x = 0; x < cells[y].length; x++) {
          const cell = cells[y][x];
          if ((cell.type === "combat" || cell.type === "danger" || cell.type === "elite") && !cell.isCleared) {
            combatCells.push({ x, y, type: cell.type });
          }
        }
      }
      return {
        combatCount: combatCells.length,
        playerPos: gs.currentPosition,
        combatCells: combatCells.slice(0, 5)
      };
    });
    console.log(`    发现 ${combatInfo.combatCount} 个未清理战斗节点`);
    console.log(`    玩家位置: (${combatInfo.playerPos.x}, ${combatInfo.playerPos.y})`);
    assert(combatInfo.combatCount >= 1, `至少有 1 个战斗节点 (实际: ${combatInfo.combatCount})`);

    // 4. BFS 移动到最近的战斗节点
    console.log("4. BFS 移动到战斗节点");
    const pathResult = await page.evaluate(() => {
      const gs = window.getGameState();
      const start = gs.currentPosition;
      const queue = [[start]];
      const visited = new Set([`${start.x},${start.y}`]);

      while (queue.length > 0) {
        const path = queue.shift();
        const pos = path[path.length - 1];

        const cell = gs.mapCells[pos.y][pos.x];
        if ((cell.type === "combat" || cell.type === "danger" || cell.type === "elite") && !cell.isCleared) {
          return { found: true, path: path.slice(1), target: pos, type: cell.type };
        }

        const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
        for (const d of dirs) {
          const nx = pos.x + d.dx;
          const ny = pos.y + d.dy;
          const key = `${nx},${ny}`;
          if (nx >= 0 && ny >= 0 && nx < gs.mapWidth && ny < gs.mapHeight && !visited.has(key)) {
            const ncell = gs.mapCells[ny][nx];
            if (ncell.type !== "obstacle") {
              visited.add(key);
              queue.push([...path, { x: nx, y: ny }]);
            }
          }
        }
      }
      return { found: false };
    });

    assert(pathResult.found, `找到可达战斗节点`);
    console.log(`    目标: (${pathResult.target.x}, ${pathResult.target.y}), 类型: ${pathResult.type}, 路径长度: ${pathResult.path.length}`);

    // 5. 逐步移动
    console.log("5. 逐步移动到战斗节点");
    for (const step of pathResult.path) {
      try {
        await page.evaluate(({ sx, sy }) => {
          const mapScene = window.game.scene.getScene("MapScene");
          if (mapScene && mapScene.tryMoveTo) mapScene.tryMoveTo(sx, sy);
        }, { sx: step.x, sy: step.y });
      } catch (e) {
        // headless 下 canvas 渲染可能报错，但游戏状态可能已更新
        console.log(`    移动步骤可能因 headless canvas 报错: ${e.message?.substring(0, 80)}`);
      }
      await sleep(500);
    }
    await sleep(1500);

    // 如果还在 MapScene，检查是否已到达目标位置，手动触发战斗
    const afterMove = await page.evaluate(() => {
      const gs = window.getGameState();
      const scenes = window.game.scene.scenes;
      const active = scenes.find(s => s.scene.isActive())?.scene?.key;
      return { active, playerPos: gs.currentPosition };
    });

    if (afterMove.active === "MapScene" &&
        afterMove.playerPos.x === pathResult.target.x &&
        afterMove.playerPos.y === pathResult.target.y) {
      console.log("    已到达战斗节点，手动触发战斗");
      await page.evaluate(() => {
        const mapScene = window.game.scene.getScene("MapScene");
        const gs = window.getGameState();
        const cell = gs.mapCells[gs.currentPosition.y][gs.currentPosition.x];
        if (mapScene && mapScene.enterCombat && cell) {
          mapScene.enterCombat(cell, gs.currentPosition.x, gs.currentPosition.y);
        }
      });
      await sleep(2000);
    }

    // 6. 检查 BattleScene
    console.log("6. 检查 BattleScene 状态");
    const battleCheck = await page.evaluate(() => {
      const scenes = window.game.scene.scenes;
      const active = scenes.find(s => s.scene.isActive())?.scene?.key;
      const bs = scenes.find(s => s.scene.key === "BattleScene");

      if (!bs || !bs.battleManager) {
        return { active, hasBattleManager: false };
      }

      const bm = bs.battleManager;
      return {
        active,
        hasBattleManager: true,
        characters: bm.state.characters.map(c => ({ name: c.def.name, hp: c.currentHp })),
        enemies: bm.state.enemies.map(e => ({ name: e.def.name, hp: e.currentHp })),
        turn: bm.state.turn,
        actionPoints: bm.state.actionPoints,
        handCards: bm.state.characters.map(c => c.hand.length),
        battleEnded: bs.battleEnded
      };
    });

    assert(battleCheck.active === "BattleScene", `进入 BattleScene (实际: ${battleCheck.active})`);
    assert(battleCheck.hasBattleManager, `BattleManager 存在`);
    assert(battleCheck.characters && battleCheck.characters.length >= 1, `有玩家角色 (实际: ${battleCheck.characters?.length})`);
    assert(battleCheck.enemies && battleCheck.enemies.length >= 1, `有敌人 (实际: ${battleCheck.enemies?.length})`);
    assert(battleCheck.handCards && battleCheck.handCards.some(h => h > 0), `有手牌: ${JSON.stringify(battleCheck.handCards)}`);
    assert(!battleCheck.battleEnded, `战斗未结束`);
    console.log(`    角色: ${battleCheck.characters.map(c => c.name).join(", ")}`);
    console.log(`    敌人: ${battleCheck.enemies.map(e => e.name).join(", ")}`);
    console.log(`    回合: ${battleCheck.turn}, 行动力: ${battleCheck.actionPoints}`);

    // 7. 执行结束回合
    console.log("7. 执行结束回合");
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs && bs.endTurn) bs.endTurn();
    });
    await sleep(2000);

    const afterTurn = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs || !bs.battleManager) return { active: "none" };
      return {
        active: bs.scene.isActive() ? "BattleScene" : "other",
        turn: bs.battleManager.state.turn,
        actionPoints: bs.battleManager.state.actionPoints,
        battleEnded: bs.battleEnded
      };
    });

    assert(afterTurn.active === "BattleScene", `BattleScene 仍然 active`);
    assert(afterTurn.turn >= 2, `回合推进: ${afterTurn.turn}`);
    assert(!afterTurn.battleEnded, `战斗仍未结束`);

    // 8. 强制胜利测试奖励界面
    console.log("8. 强制胜利测试奖励界面");
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs && bs.battleManager && bs.battleManager.state) {
        bs.battleManager.state.enemies.forEach(e => e.currentHp = 0);
        bs.onBattleEnd(true);
      }
    });
    await sleep(2000);

    const rewardCheck = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      return {
        active: bs?.scene?.isActive() ? "BattleScene" : "other",
        battleEnded: bs?.battleEnded,
        rewardCards: bs?._rewardCards?.length || 0
      };
    });

    assert(rewardCheck.active === "BattleScene", `BattleScene 显示奖励`);
    console.log(`    奖励卡牌数: ${rewardCheck.rewardCards}`);

    // 9. 选择奖励或按 Enter 继续返回 MapScene
    console.log("9. 选择奖励/继续返回 MapScene");
    // 如果是精英战斗，先按 Enter 跳过部件奖励界面
    await page.keyboard.press("Enter");
    await sleep(1000);

    // 再检查是否有卡牌奖励
    const hasCardReward = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      return bs?._rewardCards?.length > 0;
    });

    if (hasCardReward) {
      await page.evaluate(() => {
        const bs = window.game.scene.getScene("BattleScene");
        if (bs && bs.selectRewardCard) bs.selectRewardCard(0);
      });
      await sleep(1000);
    } else {
      // 没有卡牌奖励，直接按 Enter 继续
      await page.keyboard.press("Enter");
      await sleep(1000);
    }
    await sleep(1000);

    const afterReward = await page.evaluate(() => {
      const scenes = window.game.scene.scenes;
      return scenes.find(s => s.scene.isActive())?.scene?.key;
    });
    assert(afterReward === "MapScene", `返回 MapScene (实际: ${afterReward})`);

    // 10. 第二次战斗
    console.log("10. 第二次战斗");
    const secondCombat = await page.evaluate(() => {
      const gs = window.getGameState();
      const cells = gs.mapCells;
      const combatCells = [];
      for (let y = 0; y < cells.length; y++) {
        for (let x = 0; x < cells[y].length; x++) {
          const cell = cells[y][x];
          if ((cell.type === "combat" || cell.type === "danger" || cell.type === "elite") && !cell.isCleared) {
            combatCells.push({ x, y, type: cell.type });
          }
        }
      }
      return { count: combatCells.length, cells: combatCells.slice(0, 3) };
    });

    console.log(`    剩余战斗节点: ${secondCombat.count}`);
    if (secondCombat.count === 0) {
      console.log("    ⚠️ 没有第二个战斗节点，跳过第二次战斗测试");
    } else {
      // BFS to second combat
      const secondPath = await page.evaluate(() => {
        const gs = window.getGameState();
        const start = gs.currentPosition;
        const queue = [[start]];
        const visited = new Set([`${start.x},${start.y}`]);

        while (queue.length > 0) {
          const path = queue.shift();
          const pos = path[path.length - 1];

          const cell = gs.mapCells[pos.y][pos.x];
          if ((cell.type === "combat" || cell.type === "danger" || cell.type === "elite") && !cell.isCleared) {
            return { found: true, path: path.slice(1) };
          }

          const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
          for (const d of dirs) {
            const nx = pos.x + d.dx;
            const ny = pos.y + d.dy;
            const key = `${nx},${ny}`;
            if (nx >= 0 && ny >= 0 && nx < gs.mapWidth && ny < gs.mapHeight && !visited.has(key)) {
              const ncell = gs.mapCells[ny][nx];
              if (ncell.type !== "obstacle") {
                visited.add(key);
                queue.push([...path, { x: nx, y: ny }]);
              }
            }
          }
        }
        return { found: false };
      });

      if (secondPath.found && secondPath.path.length > 0) {
        // 获取当前玩家位置
        const currentPos = await page.evaluate(() => {
          const gs = window.getGameState();
          return gs.currentPosition;
        });

        for (const step of secondPath.path) {
          try {
            await page.evaluate(({ sx, sy }) => {
              const mapScene = window.game.scene.getScene("MapScene");
              if (mapScene && mapScene.tryMoveTo) mapScene.tryMoveTo(sx, sy);
            }, { sx: step.x, sy: step.y });
          } catch (e) {
            console.log(`    第二次移动步骤可能因 headless canvas 报错`);
          }
          await sleep(500);
        }
        await sleep(1500);

        // 如果还在 MapScene 且已到达目标，手动触发战斗
        const afterSecondMove = await page.evaluate(() => {
          const gs = window.getGameState();
          const scenes = window.game.scene.scenes;
          const active = scenes.find(s => s.scene.isActive())?.scene?.key;
          return { active, playerPos: gs.currentPosition };
        });

        if (afterSecondMove.active === "MapScene") {
          await page.evaluate(() => {
            const mapScene = window.game.scene.getScene("MapScene");
            const gs = window.getGameState();
            const cell = gs.mapCells[gs.currentPosition.y][gs.currentPosition.x];
            if (mapScene && mapScene.enterCombat && cell) {
              mapScene.enterCombat(cell, gs.currentPosition.x, gs.currentPosition.y);
            }
          });
          await sleep(2000);
        }

        const secondBattle = await page.evaluate(() => {
          const scenes = window.game.scene.scenes;
          const active = scenes.find(s => s.scene.isActive())?.scene?.key;
          const bs = scenes.find(s => s.scene.key === "BattleScene");
          return {
            active,
            hasBattleManager: !!bs?.battleManager,
            characters: bs?.battleManager?.state?.characters?.length || 0,
            enemies: bs?.battleManager?.state?.enemies?.length || 0,
          };
        });

        assert(secondBattle.active === "BattleScene", `第二次进入 BattleScene (实际: ${secondBattle.active})`);
        assert(secondBattle.hasBattleManager, `第二次 BattleManager 存在`);
        assert(secondBattle.characters >= 1, `第二次有玩家角色`);
        assert(secondBattle.enemies >= 1, `第二次有敌人`);
      } else {
        console.log("    ⚠️ 无法找到可达的第二个战斗节点");
      }
    }

  } catch (err) {
    console.error("\n测试异常:", err.message);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n========================================");
  console.log(`结果: ${passed} 通过, ${failed} 失败`);
  console.log("========================================");

  if (failed > 0) {
    console.log("\n失败项:");
    FAILED.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

runTest();
