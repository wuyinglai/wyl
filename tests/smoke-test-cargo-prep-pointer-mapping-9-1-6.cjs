/**
 * smoke-test-cargo-prep-pointer-mapping-9-1-6.cjs
 * 阶段9.1.6：CargoPrep 指针坐标映射测试
 *
 * 核心验证：
 * - canvas rect 和 Phaser scale 的坐标映射是否正确
 * - 通过 canvas rect 计算页面坐标，用 mousedown dispatch 验证
 * - 验证按钮 hover 反馈（console 日志）
 * - 验证按钮 pointerdown 事件
 * - 验证 cargo/silver/weight 变化
 */

const { chromium } = require("playwright");
const BASE_URL = "http://localhost:5173";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;
const FAILED = [];

function assert(condition, message) {
  if (!condition) {
    failed++;
    FAILED.push(message);
    console.error(`  [FAIL] ${message}`);
    return false;
  }
  passed++;
  console.log(`  [PASS] ${message}`);
  return true;
}

async function runTest() {
  console.log("============================================================");
  console.log("阶段9.1.6：CargoPrep 指针坐标映射测试");
  console.log("============================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();

  // 收集 console 日志（监听所有类型）
  const consoleLogs = [];
  page.on("console", msg => {
    const text = msg.text();
    if (text.includes("[CargoPrep]") || text.includes("[InputDebug]") || text.includes("[CargoPrepDebug]")) {
      consoleLogs.push(text);
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
    assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

    // 2. 检查 CSS 配置
    console.log("2. 检查 CSS 配置（body margin, canvas rect）");
    const cssInfo = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const rect = canvas.getBoundingClientRect();
      const bodyStyle = window.getComputedStyle(document.body);
      return {
        bodyMargin: bodyStyle.margin,
        bodyPadding: bodyStyle.padding,
        canvasRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        canvasMargin: window.getComputedStyle(canvas).margin,
        devicePixelRatio: window.devicePixelRatio,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      };
    });
    console.log(`    bodyMargin: ${cssInfo.bodyMargin}`);
    console.log(`    canvasRect: x=${cssInfo.canvasRect.x}, y=${cssInfo.canvasRect.y}, w=${cssInfo.canvasRect.width}, h=${cssInfo.canvasRect.height}`);
    assert(cssInfo.bodyMargin === "0px", `body margin 为 0 (实际: ${cssInfo.bodyMargin})`);
    assert(cssInfo.canvasRect.x === 0, `canvas 左边距为 0 (实际: ${cssInfo.canvasRect.x})`);

    // 3. 进入 CargoPrepScene
    console.log("3. 进入 CargoPrepScene");
    await page.evaluate(() => {
      window.resetGameState();
      const gs = window.getGameState();
      gs.selectedRouteId = "plains";
      gs.selectedCharacters = ["guardian", "scout", "repairman"];
      gs.silver = 50;
      gs.maxCargoWeight = 20;
      gs.selectedOrderId = "order_ash_supply";
      window.setGameState(gs);
      const game = window.game;
      game.scene.stop("MainMenuScene");
      game.scene.start("CargoPrepScene");
    });
    await sleep(2000);

    const activeScene = await page.evaluate(() => {
      return window.game.scene.scenes.find(s => s.sys.isActive())?.sys.config.key;
    });
    assert(activeScene === "CargoPrepScene", `进入 CargoPrepScene (实际: ${activeScene})`);

    // 4. 获取坐标映射参数
    console.log("4. 获取坐标映射参数");
    const mappingInfo = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const rect = canvas.getBoundingClientRect();
      const game = window.game;
      return {
        canvasRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        gameWidth: game.config.width,
        gameHeight: game.config.height,
        displayWidth: game.scale.displaySize.width,
        displayHeight: game.scale.displaySize.height,
        scaleX: rect.width / game.config.width,
        scaleY: rect.height / game.config.height,
      };
    });
    console.log(`    scaleX: ${mappingInfo.scaleX.toFixed(4)}, scaleY: ${mappingInfo.scaleY.toFixed(4)}`);

    // 5. 获取按钮 bounds
    console.log("5. 获取按钮 bounds");
    const buttonInfo = await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      const buttons = [];
      scene.children.each(child => {
        if (child.type === "Container" && child.input && child.input.enabled) {
          const bounds = child.getBounds();
          let data = null;
          try { data = JSON.parse(JSON.stringify(child.data.values)); } catch(e) {}
          if (data && data.goodId) {
            buttons.push({
              goodId: data.goodId,
              action: data.action,
              x: child.x, y: child.y,
              depth: child.depth,
              bounds: { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height },
              sizeW: child.width, sizeH: child.height,
            });
          }
        }
      });
      return buttons;
    });
    console.log(`    找到 ${buttonInfo.length} 个商品按钮`);

    // 验证按钮 size 是 56x56
    const grainPlusBtn = buttonInfo.find(b => b.goodId === "grain" && b.action === "plus");
    assert(grainPlusBtn, "找到粮食 [+] 按钮");
    assert(grainPlusBtn.sizeW === 56, `按钮 size 宽 56 (实际: ${grainPlusBtn.sizeW})`);
    assert(grainPlusBtn.sizeH === 56, `按钮 size 高 56 (实际: ${grainPlusBtn.sizeH})`);

    // 6. 计算页面坐标并点击
    console.log("6. 计算页面坐标并点击粮食 [+]");

    const canvasRect = mappingInfo.canvasRect;
    const scaleX = mappingInfo.scaleX;
    const scaleY = mappingInfo.scaleY;

    // 游戏坐标 → 页面坐标
    const gameToPage = (gx, gy) => ({
      x: Math.round(canvasRect.x + gx * scaleX),
      y: Math.round(canvasRect.y + gy * scaleY),
    });

    // 粮食 [+] 按钮中心游戏坐标
    const grainPlusCenterX = grainPlusBtn.x;
    const grainPlusCenterY = grainPlusBtn.y;
    const grainPlusPagePos = gameToPage(grainPlusCenterX, grainPlusCenterY);
    console.log(`    粮食 [+] 游戏坐标: (${grainPlusCenterX}, ${grainPlusCenterY})`);
    console.log(`    粮食 [+] 页面坐标: (${grainPlusPagePos.x}, ${grainPlusPagePos.y})`);

    // 用 mousedown dispatch 点击
    const beforeState = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: JSON.parse(JSON.stringify(gs.cargo)), silver: gs.silver, weight: window.calculateCargoWeight(gs.cargo) };
    });

    await page.evaluate(({ px, py }) => {
      const canvas = document.querySelector("canvas");
      canvas.dispatchEvent(new MouseEvent("mousedown", {
        clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 1
      }));
      canvas.dispatchEvent(new MouseEvent("mouseup", {
        clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 0
      }));
    }, { px: grainPlusPagePos.x, py: grainPlusPagePos.y });
    await sleep(500);

    const afterState = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: JSON.parse(JSON.stringify(gs.cargo)), silver: gs.silver, weight: window.calculateCargoWeight(gs.cargo) };
    });

    // 验证 pointerdown 日志（通过 scene.debugClickLog 读取，避免 Playwright console 捕获不可靠的问题）
    const debugLogs = await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      return scene ? scene.debugClickLog : [];
    });
    const grainPlusLog = debugLogs.find(l => l.includes("click plus grain"));
    assert(!!grainPlusLog, `scene 收到 [CargoPrepDebug] click plus grain`);
    assert(afterState.cargo.grain === beforeState.cargo.grain + 1,
      `grain +1: ${beforeState.cargo.grain} -> ${afterState.cargo.grain}`);
    assert(afterState.silver < beforeState.silver,
      `silver 减少: ${beforeState.silver} -> ${afterState.silver}`);
    assert(afterState.weight > beforeState.weight,
      `weight 增加: ${beforeState.weight} -> ${afterState.weight}`);

    // 7. 点击药材 [+]
    console.log("7. 点击药材 [+]");
    const medPlusBtn = buttonInfo.find(b => b.goodId === "medicine" && b.action === "plus");
    const medPlusPagePos = gameToPage(medPlusBtn.x, medPlusBtn.y);
    await page.evaluate(({ px, py }) => {
      const canvas = document.querySelector("canvas");
      canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 0 }));
    }, { px: medPlusPagePos.x, py: medPlusPagePos.y });
    await sleep(300);

    const afterMed = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: JSON.parse(JSON.stringify(gs.cargo)), silver: gs.silver };
    });
    // 重新读取 debugLogs（medicine 点击后）
    const debugLogsAfterMed = await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      return scene ? scene.debugClickLog : [];
    });
    const medPlusLog = debugLogsAfterMed.find(l => l.includes("click plus medicine"));
    assert(!!medPlusLog, `scene 收到 [CargoPrepDebug] click plus medicine`);
    assert(afterMed.cargo.medicine === 1, `medicine +1: ${afterMed.cargo.medicine}`);

    // 8. 点击粮食 [-]
    console.log("8. 点击粮食 [-]");
    const grainMinusBtn = buttonInfo.find(b => b.goodId === "grain" && b.action === "minus");
    const grainMinusPagePos = gameToPage(grainMinusBtn.x, grainMinusBtn.y);
    await page.evaluate(({ px, py }) => {
      const canvas = document.querySelector("canvas");
      canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 0 }));
    }, { px: grainMinusPagePos.x, py: grainMinusPagePos.y });
    await sleep(300);

    const afterMinus = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: JSON.parse(JSON.stringify(gs.cargo)), silver: gs.silver };
    });
    // 重新读取 debugLogs（minus 点击后）
    const debugLogsAfterMinus = await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      return scene ? scene.debugClickLog : [];
    });
    const grainMinusLog = debugLogsAfterMinus.find(l => l.includes("click minus grain"));
    assert(!!grainMinusLog, `scene 收到 [CargoPrepDebug] click minus grain`);
    assert(afterMinus.cargo.grain === beforeState.cargo.grain,
      `grain 恢复: ${afterMinus.cargo.grain}`);

    // 9. 清空
    console.log("9. 清空货物");
    const clearBtnPagePos = gameToPage(230, 670);
    await page.evaluate(({ px, py }) => {
      const canvas = document.querySelector("canvas");
      canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 0 }));
    }, { px: clearBtnPagePos.x, py: clearBtnPagePos.y });
    await sleep(300);

    const afterClear = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: JSON.parse(JSON.stringify(gs.cargo)), silver: gs.silver };
    });
    const totalCargo = Object.values(afterClear.cargo).reduce((a, b) => a + (b || 0), 0);
    assert(totalCargo === 0, `清空后货物为 0 (实际: ${totalCargo})`);

    // 10. 一键装载
    console.log("10. 一键装载订单");
    const loadBtnPagePos = gameToPage(80, 670);
    await page.evaluate(({ px, py }) => {
      const canvas = document.querySelector("canvas");
      canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
      canvas.dispatchEvent(new MouseEvent("mouseup", { clientX: px, clientY: py, bubbles: true, cancelable: true, button: 0, buttons: 0 }));
    }, { px: loadBtnPagePos.x, py: loadBtnPagePos.y });
    await sleep(300);

    const afterLoad = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: JSON.parse(JSON.stringify(gs.cargo)), silver: gs.silver };
    });
    assert(afterLoad.cargo.grain === 5, `一键装载后 grain=5 (实际: ${afterLoad.cargo.grain})`);

    // 11. 验证所有 debug 日志
    console.log("11. 验证 debug 日志");
    const allDebugLogs = await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      return scene ? scene.debugClickLog : [];
    });
    console.log(`    收到 ${allDebugLogs.length} 条 [CargoPrepDebug] 日志`);
    allDebugLogs.forEach(l => console.log(`    ${l}`));
    assert(allDebugLogs.length >= 3, `至少 3 条 click 日志 (实际: ${allDebugLogs.length})`);

  } catch (err) {
    console.error("\n测试异常:", err.message);
    console.error(err.stack);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n============================================================");
  console.log(`测试完成: ${passed} passed, ${failed} failed`);
  console.log("============================================================");

  if (failed > 0) {
    console.log("\n失败项:");
    FAILED.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

runTest();
