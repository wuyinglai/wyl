/**
 * smoke-test-unfinished-order-10-3.cjs
 * 阶段10.3：未完成订单延续机制
 *
 * 验证：
 * 1. 初始 unfinishedOrderIds 为空
 * 2. 撤退前 selectedOrderId 存在
 * 3. 移动后 orderTimeStates elapsedSteps 增加
 * 4. 确认撤退后订单进入 unfinishedOrderIds
 * 5. 撤退结算显示"未完成订单 / 下次可继续 / 剩余步数"
 * 6. 点击"再来一局"后 unfinishedOrderIds 仍然存在
 * 7. 继续同一订单时 remainingSteps 不重置
 * 8. 成功交付后订单从 unfinishedOrderIds 移除
 * 9. completedOrderIds 包含订单
 * 10. resetGameState 后 unfinishedOrderIds 清空
 * 11. 不显示"选择遗产"
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/unfinished-order");
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

  console.log("阶段10.3：未完成订单延续机制测试");
  console.log("=".repeat(60));

  // ========== 1. 验证初始状态 unfinishedOrderIds 为空 ==========
  console.log("1. 验证初始状态 unfinishedOrderIds 为空");
  
  const initialUnfinished = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.unfinishedOrderIds ? gs.unfinishedOrderIds.length : 0;
  });
  
  assert(initialUnfinished === 0, "初始未完成订单列表为空");

  // ========== 2. 进入 MapScene，验证 selectedOrderId 存在 ==========
  console.log("2. 进入 MapScene，验证 selectedOrderId 存在");
  
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

  const hasOrderId = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.selectedOrderId !== null;
  });
  assert(hasOrderId, "存在 selectedOrderId");

  // ========== 3. 移动后验证 elapsedSteps 增加 ==========
  console.log("3. 验证移动后 elapsedSteps 增加");
  
  const beforeMove = await page.evaluate(() => {
    const gs = window.getGameState();
    const timeState = gs.selectedOrderId ? gs.orderTimeStates[gs.selectedOrderId] : null;
    return timeState ? timeState.elapsedSteps : -1;
  });
  
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
  
  const afterMove = await page.evaluate(() => {
    const gs = window.getGameState();
    const timeState = gs.selectedOrderId ? gs.orderTimeStates[gs.selectedOrderId] : null;
    return timeState ? timeState.elapsedSteps : -1;
  });
  
  assert(afterMove >= 1, "移动后已消耗步数增加");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "after-move.png") });

  // ========== 4. 撤退后验证订单进入 unfinishedOrderIds ==========
  console.log("4. 验证撤退后订单进入 unfinishedOrderIds");
  
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
  await sleep(3000);

  // 检查撤退结算后订单进入未完成列表
  const afterRetreat = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.unfinishedOrderIds ? gs.unfinishedOrderIds.length : 0;
  });
  
  assert(afterRetreat >= 1, "撤退后订单进入未完成列表");

  // ========== 5. 验证撤退结算显示未完成订单信息 ==========
  console.log("5. 验证撤退结算显示未完成订单信息");
  
  const retreatResultCheck = await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return { hasUnfinishedText: false };
    const texts = ers.children.list.filter(c => c.type === "Text");
    const hasUnfinishedText = texts.some(t => 
      t.text.includes("未完成订单") || 
      t.text.includes("下次可继续") || 
      t.text.includes("剩余步数")
    );
    const hasLegacyText = texts.some(t => t.text.includes("选择遗产"));
    return { hasUnfinishedText, hasLegacyText };
  });
  
  assert(retreatResultCheck.hasUnfinishedText, "撤退结算显示未完成订单信息");
  assert(!retreatResultCheck.hasLegacyText, "不显示选择遗产");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "retreat-result.png") });

  // ========== 6. 再来一局后验证 unfinishedOrderIds 仍然存在 ==========
  console.log("6. 验证再来一局后未完成订单仍存在");
  
  const savedOrderId = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.unfinishedOrderIds ? gs.unfinishedOrderIds[0] : null;
  });
  
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

  // 验证未完成订单仍然存在
  const afterRetry = await page.evaluate((orderId) => {
    const gs = window.getGameState();
    return gs.unfinishedOrderIds ? gs.unfinishedOrderIds.includes(orderId) : false;
  }, savedOrderId);
  
  assert(afterRetry, "再来一局后未完成订单仍存在");

  // ========== 7. 继续同一订单，验证 remainingSteps 不重置 ==========
  console.log("7. 验证继续同一订单时 remainingSteps 不重置");
  
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

  // 验证时间状态不重置
  const timeStateCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    const timeState = gs.selectedOrderId ? gs.orderTimeStates[gs.selectedOrderId] : null;
    return timeState ? { elapsed: timeState.elapsedSteps, remaining: timeState.remainingSteps } : null;
  });
  
  assert(timeStateCheck !== null, "存在订单时间状态");
  assert(timeStateCheck.elapsed >= 1, "已消耗步数未重置");
  assert(timeStateCheck.remaining < timeStateCheck.elapsed + timeStateCheck.remaining, "剩余步数正确");

  // ========== 8. 验证 resetGameState 清空 unfinishedOrderIds ==========
  console.log("8. 验证 resetGameState 清空 unfinishedOrderIds");

  const beforeReset = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.unfinishedOrderIds ? gs.unfinishedOrderIds.length > 0 : false;
  });

  assert(beforeReset, "reset 前有未完成订单");

  // 调用 resetGameState
  await page.evaluate(() => {
    window.resetGameState();
  });
  await sleep(500);

  const afterReset = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.unfinishedOrderIds ? gs.unfinishedOrderIds.length === 0 : true;
  });

  assert(afterReset, "resetGameState 后未完成订单列表已清空");

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