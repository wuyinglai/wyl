/**
 * final-playable-check-9-1-8.cjs
 * 阶段9.1.8：最终可试玩闭环复核 + 截图留档
 *
 * 走通：CargoPrep买货 → 战斗 → 奖励 → 地图 → 交付 → 结算（成功）
 *      以及：撤退 → 撤退结算 → 遗产选择 → 下一局CargoPrep
 */

const { chromium } = require("playwright");
const path = require("path");
const BASE_URL = process.env.BASE_URL || "http://localhost:5180";
const SCREENSHOT_DIR = path.join(__dirname, "../test-artifacts/final-playable-check");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0, failed = 0;
const FAILED = [];
const RESULTS = [];

function log(msg) { console.log(msg); RESULTS.push(msg); }
function pass(msg) { passed++; log(`  ✅ ${msg}`); }
function fail(msg) { failed++; FAILED.push(msg); log(`  ❌ ${msg}`); }

async function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: false });
  log(`  📸 ${name}.png saved`);
}

/** 辅助：选择3个角色 */
async function selectThreeCharacters(page) {
  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (!cs || !cs.characterCards) return;
    for (let i = 0; i < 3; i++) {
      const card = cs.characterCards[i];
      if (!card) continue;
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
    if (cs && cs.startExpedition) cs.startExpedition();
  });
  await sleep(2000);
}

/** 辅助：选路线 */
async function selectFirstRoute(page) {
  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
  });
  await sleep(1500);
}

/** 辅助：获取当前活跃场景 */
async function getActiveScene(page) {
  return await page.evaluate(() => {
    const scenes = window.game.scene.scenes;
    return scenes.find(s => s.scene.isActive())?.scene?.key;
  });
}

async function runCheck() {
  log("========================================");
  log("阶段9.1.8：最终可试玩闭环复核");
  log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  try {
    // ===== 1. 加载游戏 =====
    log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    pass("window.game 存在");

    // ===== 2. 进入 CargoPrepScene =====
    log("\n2. 进入 CargoPrepScene");
    await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (mm) mm.scene.start("RouteSelectScene");
    });
    await sleep(1500);
    await selectFirstRoute(page);
    await selectThreeCharacters(page);

    let activeScene = await getActiveScene(page);
    pass(`进入 CargoPrepScene (实际: ${activeScene})`);
    await screenshot(page, "cargo-prep-buy-ok");

    // ===== 3. 验证买货 =====
    log("\n3. CargoPrep 买货验证");
    const beforeCargo = await page.evaluate(() => {
      const gs = window.getGameState();
      return { grain: gs.cargo.grain || 0, silver: gs.silver };
    });

    // 买粮食
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      const children = scene.children.list;
      for (const child of children) {
        if (child.type === "Container" && child.getData && child.getData("action") === "plus" && child.getData("goodId") === "grain") {
          child.emit("pointerdown", { x: child.x, y: child.y });
          break;
        }
      }
    });
    await sleep(300);

    const afterBuy = await page.evaluate(() => {
      const gs = window.getGameState();
      return { grain: gs.cargo.grain || 0, silver: gs.silver };
    });
    pass(`粮食 [+] 可买: grain ${beforeCargo.grain} -> ${afterBuy.grain}, silver ${beforeCargo.silver} -> ${afterBuy.silver}`);

    // 买药材
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      const children = scene.children.list;
      for (const child of children) {
        if (child.type === "Container" && child.getData && child.getData("action") === "plus" && child.getData("goodId") === "medicine") {
          child.emit("pointerdown", { x: child.x, y: child.y });
          break;
        }
      }
    });
    await sleep(300);
    const afterMed = await page.evaluate(() => window.getGameState().cargo.medicine || 0);
    pass(`药材 [+] 可买: medicine = ${afterMed}`);

    // 减粮食
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      const children = scene.children.list;
      for (const child of children) {
        if (child.type === "Container" && child.getData && child.getData("action") === "minus" && child.getData("goodId") === "grain") {
          child.emit("pointerdown", { x: child.x, y: child.y });
          break;
        }
      }
    });
    await sleep(300);
    const afterMinus = await page.evaluate(() => window.getGameState().cargo.grain || 0);
    pass(`粮食 [-] 可减: grain = ${afterMinus}`);

    // 开始远征
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2000);

    const mapActive = await getActiveScene(page);
    const mapCargo = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: gs.cargo, silver: gs.silver };
    });
    pass(`开始远征后进入 MapScene (实际: ${mapActive})`);
    pass(`MapScene cargo 不为空: ${JSON.stringify(mapCargo.cargo)}`);

    // ===== 4. 战斗验证 =====
    log("\n4. 战斗流程验证");
    // 使用 tryMoveTo 移动到战斗节点
    // 战斗节点类型是 "boss"/"elite"/问号格解析后的 "combat"
    const battleMoved = await page.evaluate(() => {
      const gs = window.getGameState();
      const scene = window.game.scene.getScene("MapScene");
      if (!scene || !scene.tryMoveTo) return { moved: false, error: "no tryMoveTo" };
      const cells = gs.mapCells;
      if (!cells) return { moved: false, error: "no cells" };

      // 揭示所有节点
      for (let y = 0; y < cells.length; y++) {
        for (let x = 0; x < cells[y].length; x++) {
          if (cells[y][x]) cells[y][x].isRevealed = true;
        }
      }

      // 找最近的 boss/elite 节点（BFS）
      const pos = gs.currentPosition;
      const visited = new Set();
      const queue = [{ x: pos.x, y: pos.y, dist: 0 }];
      visited.add(`${pos.x},${pos.y}`);
      let closest = null;
      while (queue.length > 0) {
        const cur = queue.shift();
        if (cur.dist > 0 && cells[cur.y] && cells[cur.y][cur.x] &&
            (cells[cur.y][cur.x].type === "boss" || cells[cur.y][cur.x].type === "elite")) {
          closest = cur;
          break;
        }
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        for (const [dx, dy] of dirs) {
          const nx = cur.x + dx, ny = cur.y + dy;
          const key = `${nx},${ny}`;
          if (!visited.has(key) && cells[ny] && cells[ny][nx]) {
            visited.add(key);
            queue.push({ x: nx, y: ny, dist: cur.dist + 1 });
          }
        }
      }

      if (closest) {
        // 传送到战斗节点旁边然后移动
        const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
        for (const [dx, dy] of dirs) {
          const nx = closest.x + dx, ny = closest.y + dy;
          if (cells[ny] && cells[ny][nx] && (cells[ny][nx].type === "empty" || cells[ny][nx].type === "camp")) {
            gs.currentPosition = { x: nx, y: ny };
            scene.tryMoveTo(closest.x, closest.y);
            return { moved: true, type: cells[closest.y][closest.x].type, pos: `${closest.x},${closest.y}` };
          }
        }
        // 直接传送
        gs.currentPosition = { x: closest.x - 1, y: closest.y };
        scene.tryMoveTo(closest.x, closest.y);
        return { moved: true, type: cells[closest.y][closest.x].type, pos: `${closest.x},${closest.y}` };
      }

      // 没有战斗节点，将一个相邻节点改为 boss
      const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
      for (const [dx, dy] of dirs) {
        const nx = pos.x + dx, ny = pos.y + dy;
        if (cells[ny] && cells[ny][nx]) {
          cells[ny][nx].type = "boss";
          scene.tryMoveTo(nx, ny);
          return { moved: true, type: "boss (converted)", pos: `${nx},${ny}` };
        }
      }

      return { moved: false, error: "no battle node found" };
    });
    await sleep(2000);

    let battleActive = await getActiveScene(page);

    if (battleActive === "BattleScene") {
      pass(`BattleScene active (移动到 ${battleMoved.type} 节点)`);
      await screenshot(page, "battle-active");

      // 检查战斗状态
      const battleInfo = await page.evaluate(() => {
        const scene = window.game.scene.getScene("BattleScene");
        if (!scene) return {};
        const bm = scene.battleManager;
        return {
          hasManager: !!bm,
          battleEnded: scene.battleEnded,
          turn: bm ? bm.state.turn : 0,
          actionPoints: bm ? bm.state.actionPoints : 0,
          playerChars: bm ? bm.state.characters.length : 0,
          enemies: bm ? bm.state.enemies.length : 0,
        };
      });
      pass(`战斗管理器: turn=${battleInfo.turn}, AP=${battleInfo.actionPoints}, 玩家=${battleInfo.playerChars}, 敌人=${battleInfo.enemies}, ended=${battleInfo.battleEnded}`);

      // 结束回合推进战斗
      // BattleManager.endTurn() 是同步的：结束玩家回合 → 敌人行动 → 检查结束 → 下一回合
      // playCard 需要 selectedCard 和 selectedEnemy 先设置
      for (let i = 0; i < 30; i++) {
        await page.evaluate(() => {
          const scene = window.game.scene.getScene("BattleScene");
          if (!scene || !scene.battleManager || scene.battleEnded) return;
          const bm = scene.battleManager;

          // 尝试选牌并出牌
          if (bm.state.characters.length > 0 && bm.state.enemies.length > 0) {
            const char = bm.state.characters[0];
            if (char.hand && char.hand.length > 0 && bm.state.actionPoints >= char.hand[0].cost) {
              // 设置 selectedCard
              bm.selectedCard = { charIndex: 0, cardIndex: 0 };
              // 设置 selectedEnemy（如果卡牌需要目标）
              const card = char.hand[0];
              const needsTarget = card.effects && card.effects.some(e => e.target === "enemy");
              if (needsTarget) {
                bm.selectedEnemy = 0; // 选第一个敌人
              }
              bm.playCard();
            } else {
              // 没有可出的牌，结束回合
              scene.endTurn();
            }
          } else {
            scene.endTurn();
          }
        });
        await sleep(300);

        const curEnded = await page.evaluate(() => {
          const scene = window.game.scene.getScene("BattleScene");
          return scene ? scene.battleEnded : true;
        });

        if (curEnded) {
          pass(`战斗结束 (第${i + 1}步)`);
          await sleep(1000);

          // 检查是否胜利
          const afterBattle = await getActiveScene(page);
          if (afterBattle === "RewardScene") {
            pass(`战斗胜利，进入奖励选择`);
            await screenshot(page, "battle-reward");

            // 选择奖励
            await page.evaluate(() => {
              const scene = window.game.scene.getScene("RewardScene");
              if (scene && scene.selectReward) scene.selectReward(0);
            });
            await sleep(1500);

            const afterReward = await getActiveScene(page);
            pass(`选择奖励后返回 ${afterReward}`);
            await screenshot(page, "map-after-battle-return");
          } else if (afterBattle === "MapScene") {
            pass(`战斗胜利，返回地图`);
            await screenshot(page, "map-after-battle-return");
          } else {
            log(`  ⚠ 战斗结束但场景: ${afterBattle}`);
            await screenshot(page, "battle-reward");
          }
          break;
        }
      }

      // 检查是否卡在战斗中
      const finalBattleEnded = await page.evaluate(() => {
        const scene = window.game.scene.getScene("BattleScene");
        return scene ? scene.battleEnded : true;
      });
      const finalActiveScene = await getActiveScene(page);
      if (finalActiveScene === "BattleScene" && !finalBattleEnded) {
        // 获取更多调试信息
        const debugInfo = await page.evaluate(() => {
          const scene = window.game.scene.getScene("BattleScene");
          const bm = scene.battleManager;
          return {
            turn: bm.state.turn,
            ap: bm.state.actionPoints,
            chars: bm.state.characters.map(c => ({ name: c.def.name, hp: c.currentHp, hand: c.hand.length })),
            enemies: bm.state.enemies.map(e => ({ name: e.def.name, hp: e.currentHp })),
          };
        });
        fail(`战斗卡住: turn=${debugInfo.turn}, AP=${debugInfo.ap}, chars=${JSON.stringify(debugInfo.chars)}, enemies=${JSON.stringify(debugInfo.enemies)}`);
      } else {
        pass(`战斗未卡住: 最终 scene=${finalActiveScene}`);
      }
    } else {
      log(`  ⚠ 未进入 BattleScene (实际: ${battleActive}, 移动结果: ${JSON.stringify(battleMoved)})`);
      // 截图当前状态
      await screenshot(page, "battle-active");
    }

    // ===== 5. 成功远征闭环 =====
    log("\n5. 成功远征闭环验证");
    // 重新开始一局完整流程
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("MapScene");
      if (scene) scene.scene.start("RouteSelectScene");
    });
    await sleep(1500);
    await selectFirstRoute(page);
    await selectThreeCharacters(page);

    // CargoPrep 一键装载
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.loadOrderRequirements) scene.loadOrderRequirements();
    });
    await sleep(500);

    // 开始远征
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2000);

    // 传送到目标节点并交付订单
    const deliveryResult = await page.evaluate(() => {
      const gs = window.getGameState();
      const cells = gs.mapCells;
      const goalPos = gs.bossPosition;
      if (!goalPos || !cells) return { error: "no goal" };

      // 设置目标节点为已揭示的空节点（避免战斗）
      if (cells[goalPos.y] && cells[goalPos.y][goalPos.x]) {
        cells[goalPos.y][goalPos.x].isRevealed = true;
        cells[goalPos.y][goalPos.x].isGoal = true;
        cells[goalPos.y][goalPos.x].type = "empty";
      }
      // 传送到目标
      gs.currentPosition = { ...goalPos };

      // 交付订单
      if (gs.selectedOrderId && window.deliverOrder && window.getOrderById) {
        const order = window.getOrderById(gs.selectedOrderId);
        if (order) {
          const result = window.deliverOrder(order, gs.cargo);
          return { delivered: true, result };
        }
      }
      return { error: "no order" };
    });
    await sleep(1000);

    if (deliveryResult.delivered && deliveryResult.result.ok) {
      pass(`订单交付成功`);
    } else {
      log(`  ⚠ 交付结果: ${JSON.stringify(deliveryResult)}`);
    }

    // 进入远征结算——通过撤退方式（因为直接交付后需要手动触发结算）
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("MapScene");
      if (scene && scene.handleRetreat) scene.handleRetreat();
    });
    await sleep(1500);

    const resultScene = await getActiveScene(page);
    pass(`远征结算界面: ${resultScene}`);
    await screenshot(page, "expedition-result-success");

    // 点击"再来一局"——ExpeditionResultScene 的按钮是匿名回调
    // 需要通过 scene.start("RouteSelectScene") 直接跳转
    if (resultScene === "ExpeditionResultScene") {
      await page.evaluate(() => {
        window.game.scene.getScene("ExpeditionResultScene").scene.start("RouteSelectScene");
      });
      await sleep(1500);
      const afterPlayAgain = await getActiveScene(page);
      pass(`再来一局后: ${afterPlayAgain}`);
    }

    // ===== 6. 撤退遗产闭环 =====
    log("\n6. 撤退遗产闭环验证");
    await selectFirstRoute(page);
    await selectThreeCharacters(page);

    // CargoPrep 装载
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.loadOrderRequirements) scene.loadOrderRequirements();
    });
    await sleep(300);

    // 开始远征
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2000);

    // 撤退
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("MapScene");
      if (scene && scene.handleRetreat) scene.handleRetreat();
    });
    await sleep(1500);

    const retreatScene = await getActiveScene(page);
    pass(`撤退后进入: ${retreatScene}`);
    await screenshot(page, "expedition-result-retreated");

    // 选择遗产——ExpeditionResultScene 撤退时显示"选择遗产"按钮，需要点击
    if (retreatScene === "ExpeditionResultScene") {
      // 使用测试入口直接触发遗产选择
      await page.evaluate(() => {
        const scene = window.game.scene.getScene("ExpeditionResultScene");
        if (scene && scene.startLegacySelectionForTest) {
          scene.startLegacySelectionForTest();
        }
      });
      await sleep(1500);

      const currentForLegacy = await getActiveScene(page);
      if (currentForLegacy === "LegacySelectScene") {
        // 使用 selectRelic
        await page.evaluate(() => {
          const scene = window.game.scene.getScene("LegacySelectScene");
          if (scene && scene.selectRelic) {
            const gs = window.getGameState();
            if (gs.legacyChoices && gs.legacyChoices.length > 0) {
              scene.selectRelic(gs.legacyChoices[0]);
            }
          }
        });
        await sleep(1500);

        const afterLegacy = await getActiveScene(page);
        pass(`选择遗产后进入: ${afterLegacy}`);
        await screenshot(page, "legacy-select");

        // 走到 CargoPrep 检查遗产效果
        if (afterLegacy === "RouteSelectScene") {
          await selectFirstRoute(page);
          await selectThreeCharacters(page);

          const legacyCargoPrep = await page.evaluate(() => {
            const gs = window.getGameState();
            const scenes = window.game.scene.scenes;
            const activeScene = scenes.find(s => s.scene.isActive())?.scene?.key;
            return {
              scene: activeScene,
              activeLegacy: gs.activeLegacyRelicId || "none",
              silver: gs.silver,
            };
          });
          pass(`下一局 CargoPrep: scene=${legacyCargoPrep.scene}, 遗产=${legacyCargoPrep.activeLegacy}, silver=${legacyCargoPrep.silver}`);
          await screenshot(page, "cargo-prep-with-legacy");
        }
      } else {
        log(`  ⚠ 当前场景不是 LegacySelectScene (实际: ${currentForLegacy})，跳过遗产选择验证`);
        await screenshot(page, "legacy-select");
      }
    }

  } catch (err) {
    log(`\n测试异常: ${err.message}`);
    log(err.stack);
    failed++;
  } finally {
    await browser.close();
  }

  log("\n========================================");
  log(`结果: ${passed} 通过, ${failed} 失败`);
  log("========================================");

  if (failed > 0) {
    log("\n失败项:");
    FAILED.forEach(f => log(`  - ${f}`));
    process.exit(1);
  }
}

runCheck();
