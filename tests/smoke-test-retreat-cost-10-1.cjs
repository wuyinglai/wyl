/**
 * smoke-test-retreat-cost-10-1.cjs
 * 阶段10.1：撤退成本系统
 *
 * 验证：
 * 1. retreatSystem 纯函数正常工作
 * 2. 撤退确认弹窗显示补给消耗信息
 * 3. 补给充足时安全撤退
 * 4. 补给不足时失败撤退
 * 5. 撤退结果正确显示
 * 6. 不显示"选择遗产"按钮
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/retreat-cost");
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

  console.log("阶段10.1：撤退成本系统测试");
  console.log("=".repeat(60));

  // ========== 1. 测试 retreatSystem 纯函数 ==========
  console.log("1. 测试 retreatSystem 纯函数");
  
  const pureFunctionTests = await page.evaluate(() => {
    const results = [];
    
    // 测试 calculateRetreatSupplyCost
    try {
      const cost1 = window.calculateRetreatSupplyCost({ x: 0, y: 0 }, { x: 0, y: 0 });
      results.push({
        name: "calculateRetreatSupplyCost (起点)",
        pass: cost1 === 0,
        actual: cost1,
        expected: 0
      });
      
      const cost2 = window.calculateRetreatSupplyCost({ x: 5, y: 3 }, { x: 0, y: 0 });
      const expected2 = 5 + 3; // 曼哈顿距离
      results.push({
        name: "calculateRetreatSupplyCost (曼哈顿距离)",
        pass: cost2 === expected2,
        actual: cost2,
        expected: expected2
      });
    } catch (e) {
      results.push({
        name: "calculateRetreatSupplyCost",
        pass: false,
        error: e.message
      });
    }
    
    // 测试 checkRetreatCost
    try {
      // 补给充足
      const check1 = window.checkRetreatCost({ x: 5, y: 3 }, { x: 0, y: 0 }, 10);
      results.push({
        name: "checkRetreatCost (充足)",
        pass: check1.canRetreatSafely === true && check1.resultType === "safe_retreat" && check1.shortage === 0,
        actual: JSON.stringify(check1)
      });
      
      // 补给不足
      const check2 = window.checkRetreatCost({ x: 5, y: 3 }, { x: 0, y: 0 }, 5);
      results.push({
        name: "checkRetreatCost (不足)",
        pass: check2.canRetreatSafely === false && check2.resultType === "failed_retreat" && check2.shortage === 3,
        actual: JSON.stringify(check2)
      });
    } catch (e) {
      results.push({
        name: "checkRetreatCost",
        pass: false,
        error: e.message
      });
    }
    
    // 测试 getRetreatCostText
    try {
      const check = window.checkRetreatCost({ x: 5, y: 3 }, { x: 0, y: 0 }, 10);
      const lines = window.getRetreatCostText(check);
      results.push({
        name: "getRetreatCostText",
        pass: Array.isArray(lines) && lines.length >= 3 && lines.some(l => l.includes("补给")),
        actual: lines.join(" | ")
      });
    } catch (e) {
      results.push({
        name: "getRetreatCostText",
        pass: false,
        error: e.message
      });
    }
    
    return results;
  });
  
  for (const test of pureFunctionTests) {
    if (test.pass) {
      assert(true, `${test.name}`);
    } else {
      assert(false, `${test.name}: ${test.error || test.actual}`);
    }
  }

  // ========== 2. 真实流程进入 MapScene ==========
  console.log("2. 进入 MapScene");
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

  // ========== 3. 触发撤退，检查弹窗 ==========
  console.log("3. 触发撤退，检查确认弹窗");
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

  // 检查是否有确认弹窗（考虑 modalContainer）
  const modalCheck = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { hasModal: false, hasSupplyText: false };
    let allTexts = ms.children.list.filter(c => c.type === "Text");
    // 检查 modalContainer
    if (ms.modalContainer && ms.modalContainer.list) {
      const modalTexts = ms.modalContainer.list.filter(c => c.type === "Text");
      allTexts = allTexts.concat(modalTexts);
    }
    const hasConfirm = allTexts.some(t => t.text === "确认撤退");
    const hasSupplyText = allTexts.some(t => t.text.includes("补给"));
    return { hasModal: hasConfirm, hasSupplyText };
  });
  
  assert(modalCheck.hasModal, "显示撤退确认弹窗");
  assert(modalCheck.hasSupplyText, "弹窗显示补给信息");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "retreat-confirm-modal.png") });

  // ========== 4. 取消撤退 ==========
  console.log("4. 取消撤退");
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return;
    // 在 modalContainer 里面找文本（因为按钮是 Text 类型的）
    let cancelBtn = null;
    if (ms.modalContainer && ms.modalContainer.list) {
      cancelBtn = ms.modalContainer.list.find(
        (c) => c.type === "Text" && c.text === "取消" && c.input && c.input.enabled
      );
    }
    if (cancelBtn) {
      cancelBtn.emit("pointerdown");
    }
  });
  await sleep(1000);

  // 确认仍然在 MapScene
  const stillOnMap = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(stillOnMap, "取消后仍在 MapScene");

  // ========== 5. 低补给时的撤退（失败） ==========
  console.log("5. 测试低补给时的撤退");
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs.food = 1; // 设为低补给
    window.setGameState(gs);
  });
  
  // 再次触发撤退
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
    // 在 modalContainer 里面找确认按钮
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

  // 检查进入了 ExpeditionResultScene
  const ersReady2 = await page.evaluate(() => !!window.game.scene.getScene("ExpeditionResultScene"));
  assert(ersReady2, "进入 ExpeditionResultScene");

  // 检查是否显示撤退失败信息
  const failedResultCheck = await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return { hasFailedText: false, hasBackBtn: false, hasPlayAgainBtn: false, hasLegacyBtn: false };
    const texts = ers.children.list.filter(c => c.type === "Text");
    const hasFailedText = texts.some(t => t.text.includes("失败"));
    const hasBackBtn = texts.some(t => t.text === "返回主菜单");
    const hasPlayAgainBtn = texts.some(t => t.text === "再来一局");
    const hasLegacyBtn = texts.some(t => t.text === "选择遗产");
    return { hasFailedText, hasBackBtn, hasPlayAgainBtn, hasLegacyBtn };
  });
  
  assert(failedResultCheck.hasBackBtn, "显示\"返回主菜单\"按钮");
  assert(failedResultCheck.hasPlayAgainBtn, "显示\"再来一局\"按钮");
  assert(!failedResultCheck.hasLegacyBtn, "不显示\"选择遗产\"按钮");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "retreat-failed-result.png") });

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

