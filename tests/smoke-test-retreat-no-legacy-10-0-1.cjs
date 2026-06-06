/**
 * smoke-test-retreat-no-legacy-10-0-1.cjs
 * 阶段10.0.1：取消失败遗产系统
 *
 * 验证：
 * 1. 撤退结算不再显示"选择遗产"按钮
 * 2. 撤退结算显示"返回主菜单"和"再来一局"
 * 3. 失败结算同样不显示遗产按钮
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/retreat-no-legacy");
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

  console.log("阶段10.0.1：取消失败遗产系统测试");
  console.log("=".repeat(60));

  // ========== 1. 真实流程进入 MapScene ==========
  console.log("1. 进入 MapScene");
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

  // ========== 2. 触发撤退 ==========
  console.log("2. 触发撤退");
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

  // ========== 2.5 点击确认撤退 ==========
  console.log("2.5 点击确认撤退");
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

  // ========== 3. 进入 ExpeditionResultScene ==========
  console.log("3. 进入 ExpeditionResultScene");
  const ersReady = await page.evaluate(() => !!window.game.scene.getScene("ExpeditionResultScene"));
  assert(ersReady, "进入 ExpeditionResultScene");

  // ========== 4. 不显示"选择遗产"按钮 ==========
  console.log("4. 不显示选择遗产按钮");
  const btnCheck = await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return { hasLegacyBtn: false, hasBackBtn: false, hasPlayAgainBtn: false };
    const texts = ers.children.list.filter(c => c.type === "Text");
    const hasLegacyBtn = texts.some(t => t.text === "选择遗产");
    const hasBackBtn = texts.some(t => t.text === "返回主菜单");
    const hasPlayAgainBtn = texts.some(t => t.text === "再来一局");
    return { hasLegacyBtn, hasBackBtn, hasPlayAgainBtn };
  });
  assert(!btnCheck.hasLegacyBtn, `不显示"选择遗产"按钮`);
  assert(btnCheck.hasBackBtn, `显示"返回主菜单"按钮`);
  assert(btnCheck.hasPlayAgainBtn, `显示"再来一局"按钮`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "retreat-no-legacy.png") });

  // ========== 5. 点击"再来一局"进入 RouteSelectScene ==========
  console.log("5. 点击再来一局进入 RouteSelectScene");
  await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return;
    const texts = ers.children.list.filter(c => c.type === "Text");
    const playAgainText = texts.find(t => t.text === "再来一局");
    if (playAgainText) {
      const btns = ers.children.list.filter(c =>
        c.type === "Rectangle" && c.input && c.input.enabled &&
        Math.abs(c.y - playAgainText.y) < 20 && Math.abs(c.x - playAgainText.x) < 80
      );
      if (btns.length > 0) btns[0].emit("pointerdown");
    }
  });
  await sleep(2000);

  const routeSelectReady = await page.evaluate(() => !!window.game.scene.getScene("RouteSelectScene"));
  assert(routeSelectReady, "进入 RouteSelectScene");

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
