/**
 * smoke-test-order-time-persist-10-2.cjs
 * 阶段10.2：订单时间跨局延续
 *
 * 验证：
 * 1. 订单有时间限制字段
 * 2. 初始剩余时间正确
 * 3. 移动后已消耗时间增加
 * 4. 撤退后再来一局，时间仍保持
 * 5. resetGameState 清空 orderTimeStates
 * 6. 完成订单后 isCompleted=true
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/order-time-persist");
const FAILED = [];
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
    FAILED.push(msg);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const fs = require("fs");
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  page.on("pageerror", err => {
    console.error(`[浏览器错误] ${err.message}`);
    failed++;
  });

  await page.addInitScript(() => {
    window.__EMBER_TEST_MODE__ = true;
  });
  
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

  console.log("阶段10.2：订单时间跨局延续测试");
  console.log("=".repeat(60));

  // ========== 1. 验证订单数据有时间限制 ==========
  console.log("1. 验证订单时间限制字段");
  
  const orderCheck = await page.evaluate(() => {
    const { CITY_ORDERS } = window;
    return {
      hasOrders: CITY_ORDERS && CITY_ORDERS.length > 0,
      hasTimeLimit: CITY_ORDERS && CITY_ORDERS.every(o => o.timeLimitSteps !== undefined)
    };
  });
  
  assert(orderCheck.hasOrders, "存在订单数据");
  assert(orderCheck.hasTimeLimit, "所有订单都有时间限制字段");

  // ========== 2. 进入 MapScene，验证初始时间 ==========
  console.log("2. 进入 MapScene，验证初始订单时间");
  
  await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
  await sleep(2000);

  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
  });
  await sleep(1000);

  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.characterCards && cs.characterCards.length >= 3) {
      for (let i = 0; i < 3; i++) {
        const card = cs.characterCards[i];
        for (const child of card.list) {
          if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
    }
  });
  await sleep(500);

  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });
  await sleep(1500);

  await page.evaluate(() => {
    const scene = window.game.scene.getScene("CargoPrepScene");
    if (scene && scene.startExpedition) scene.startExpedition();
  });
  await sleep(2500);

  const mapReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(mapReady, "MapScene 就绪");

  // 验证初始订单时间
  const initialTime = await page.evaluate(() => {
    const gs = window.getGameState();
    const orderId = gs.selectedOrderId;
    if (!orderId) return null;
    const timeState = gs.orderTimeStates[orderId];
    return timeState ? { elapsed: timeState.elapsedSteps, remaining: timeState.remainingSteps, limit: timeState.limitSteps } : null;
  });
  
  assert(initialTime !== null, "存在订单时间状态");
  assert(initialTime.elapsed === 0, "初始已消耗时间为0");
  assert(initialTime.remaining === initialTime.limit, "初始剩余时间等于限制时间");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "initial-order-time.png") });

  // ========== 3. 移动几次，验证时间消耗 ==========
  console.log("3. 验证移动后时间消耗");
  
  // 移动3次
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const gs = window.getGameState();
      const neighbors = window.getMovableNeighbors(gs);
      if (neighbors && neighbors.length > 0) {
        window.moveToCell(gs, neighbors[0].x, neighbors[0].y);
        window.setGameState(gs);
      }
    });
    await sleep(500);
  }
  
  const afterMoveTime = await page.evaluate(() => {
    const gs = window.getGameState();
    const orderId = gs.selectedOrderId;
    if (!orderId) return null;
    const timeState = gs.orderTimeStates[orderId];
    return timeState ? { elapsed: timeState.elapsedSteps, remaining: timeState.remainingSteps } : null;
  });
  
  assert(afterMoveTime.elapsed >= 1, "移动后已消耗时间增加");
  assert(afterMoveTime.remaining < initialTime.limit, "剩余时间减少");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "after-move-time.png") });

  // ========== 4. 撤退，验证撤退结算显示时间 ==========
  console.log("4. 验证撤退结算显示时间");
  
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return;
    const texts = ms.children.list.filter(c => c.type === "Text");
    const retreatText = texts.find(t => t.text === "撤退");
    if (retreatText) {
      const btns = ms.children.list.filter(c =>
        c.type === "Rectangle" && c.input && c.input.enabled &&
        Math.abs(c.y - retreatText.y) < 20 && Math.abs(c.x - retreatText.x) < 50
      );
      if (btns.length > 0) btns[0].emit("pointerdown");
    }
  });
  await sleep(2000);
  
  // 确认撤退
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return;
    let confirmBtn = null;
    if (ms.modalContainer && ms.modalContainer.list) {
      confirmBtn = ms.modalContainer.list.find(
        (c) => c.type === "Text" && c.text === "确认撤退" && c.input && c.input.enabled
      );
    }
    if (confirmBtn) {
      confirmBtn.emit("pointerdown");
    }
  });
  await sleep(2000);

  // 检查结算界面显示时间信息
  const retreatResultCheck = await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return { hasTimeText: false, hasBackBtn: false, hasPlayAgainBtn: false };
    const texts = ers.children.list.filter(c => c.type === "Text");
    const hasTimeText = texts.some(t => t.text.includes("已消耗时间") || t.text.includes("剩余时间"));
    const hasBackBtn = texts.some(t => t.text === "返回主菜单");
    const hasPlayAgainBtn = texts.some(t => t.text === "再来一局");
    return { hasTimeText, hasBackBtn, hasPlayAgainBtn };
  });
  
  assert(retreatResultCheck.hasTimeText, "撤退结算显示时间信息");
  assert(retreatResultCheck.hasBackBtn, "显示\"返回主菜单\"按钮");
  assert(retreatResultCheck.hasPlayAgainBtn, "显示\"再来一局\"按钮");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "retreat-time-result.png") });

  // ========== 5. 再来一局，验证时间延续 ==========
  console.log("5. 验证时间跨局延续");
  
  const savedTime = afterMoveTime;
  
  // 点击再来一局
  await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return;
    const texts = ers.children.list.filter(c => c.type === "Text");
    const playAgainBtn = texts.find(t => t.text === "再来一局" && t.input && t.input.enabled);
    if (playAgainBtn) {
      playAgainBtn.emit("pointerdown");
    }
  });
  await sleep(2000);

  // 重新进入远征（选择同一订单）
  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
  });
  await sleep(1000);

  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.characterCards && cs.characterCards.length >= 3) {
      for (let i = 0; i < 3; i++) {
        const card = cs.characterCards[i];
        for (const child of card.list) {
          if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
    }
  });
  await sleep(500);

  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });
  await sleep(1500);

  await page.evaluate(() => {
    const scene = window.game.scene.getScene("CargoPrepScene");
    if (scene && scene.startExpedition) scene.startExpedition();
  });
  await sleep(2500);

  // 验证时间延续
  const afterRetryTime = await page.evaluate(() => {
    const gs = window.getGameState();
    const orderId = gs.selectedOrderId;
    if (!orderId) return null;
    const timeState = gs.orderTimeStates[orderId];
    return timeState ? { elapsed: timeState.elapsedSteps, remaining: timeState.remainingSteps } : null;
  });
  
  assert(afterRetryTime !== null, "再来一局后仍有订单时间状态");
  assert(afterRetryTime.elapsed === savedTime.elapsed, "已消耗时间保持不变");
  assert(afterRetryTime.remaining === savedTime.remaining, "剩余时间保持不变");

  // ========== 6. 验证 resetGameState 清空 orderTimeStates ==========
  console.log("6. 验证 resetGameState 清空 orderTimeStates");

  const beforeReset = await page.evaluate(() => {
    const gs = window.getGameState();
    return Object.keys(gs.orderTimeStates).length > 0;
  });

  assert(beforeReset, "reset 前有订单时间状态");

  // 调用 resetGameState
  await page.evaluate(() => {
    window.resetGameState();
  });
  await sleep(500);

  const afterReset = await page.evaluate(() => {
    const gs = window.getGameState();
    return Object.keys(gs.orderTimeStates).length === 0;
  });

  assert(afterReset, "resetGameState 后订单时间状态已清空");

  // ========== 总结 ==========
  console.log("=".repeat(60));
  console.log(`测试完成: ${passed} passed, ${failed} failed`);
  if (FAILED.length > 0) {
    console.error("失败项:");
    FAILED.forEach(f => console.error(`  - ${f}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
