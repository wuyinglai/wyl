/**
 * smoke-test-world-map-hidden-11-1-2.cjs
 * 阶段11.1.2：大地图原型入口隐藏验证测试
 * 
 * 验证目标：
 * 1. 主菜单不显示「大地图原型」按钮
 * 2. 主流程不受影响
 * 3. WorldMapScene 不在正式流程中出现
 */
const { chromium } = require("playwright");
const {
  clickGamePoint,
  sleep,
} = require("./_real_helpers.cjs");

const BASE_URL = process.env.BASE_URL || "http://localhost:5180";

let passCount = 0;
let failCount = 0;

function mark(pass, msg) {
  if (pass) {
    passCount++;
    console.log("  [PASS] " + msg);
  } else {
    failCount++;
    console.log("  [FAIL] " + msg);
  }
}

async function runTest() {
  console.log("========================================");
  console.log("阶段11.1.2 大地图原型入口隐藏验证测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 游戏加载
    console.log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "MainMenuScene active");

    // 2. 检查主菜单不存在「大地图原型」按钮
    console.log("2. 检查主菜单不存在「大地图原型」按钮");
    const hasWorldMapBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return false;
      let found = false;
      mm.children.each((child) => {
        if (found) return;
        if (child.type === "Text" && child.text && /大地图原型/.test(child.text)) {
          found = true;
        }
      });
      return found;
    });
    mark(!hasWorldMapBtn, "主菜单不存在「大地图原型」按钮");

    // 3. 主菜单只有「开始远征」按钮（检查文本元素）
    console.log("3. 检查主菜单只有「开始远征」按钮");
    const menuTexts = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return [];
      const texts = [];
      mm.children.each((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      return texts;
    });
    const hasStartBtn = menuTexts.some(t => t.includes("开始远征"));
    const hasWorldMapText = menuTexts.some(t => t.includes("大地图"));
    mark(hasStartBtn, "主菜单有「开始远征」按钮");
    mark(!hasWorldMapText, "主菜单文本中不含「大地图」");

    // 4. 点击「开始远征」进入 TownScene
    console.log("4. 点击「开始远征」进入 TownScene");
    const startBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /开始远征/.test(child.text)) {
            btn = { x: child.x, y: child.y };
          }
        }
      });
      return btn;
    });
    mark(startBtn !== null, "找到「开始远征」按钮");
    if (startBtn) {
      await clickGamePoint(page, { x: startBtn.x, y: startBtn.y }, "开始远征按钮");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "点击后进入 TownScene");

    // 5. 检查 WorldMapScene 未被激活
    console.log("5. 检查 WorldMapScene 未被激活");
    const worldMapActive = await page.evaluate(() => window.game.scene.isActive("WorldMapScene"));
    mark(!worldMapActive, "WorldMapScene 未在正式流程中被激活");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.1.2 大地图入口隐藏: ✅ 全部通过");
    } else {
      console.log("阶段11.1.2 大地图入口隐藏: ❌ 有失败项");
    }
    console.log("========================================");
    await browser.close();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (e) {
    console.error(`\n❌ 测试失败: ${e.message}`);
    console.error(e.stack);
    await browser.close();
    process.exit(1);
  }
}

runTest();