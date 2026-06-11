/**
 * smoke-test-town-facilities-11-2.cjs
 * 阶段11.2：城镇设施入口占位冒烟测试
 *
 * 测试覆盖：
 * 1. 主菜单进入 TownScene
 * 2. TownScene 显示设施按钮
 * 3. 设施按钮点击显示说明面板
 * 4. 商路大厅进入 RouteSelectScene
 * 5. 返回城镇、返回主菜单
 */
const { chromium } = require("playwright");
const {
  clickGamePoint,
  sleep,
} = require("./_real_helpers.cjs");

const BASE_URL = "http://localhost:5173";

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
  console.log("阶段11.2 城镇设施入口占位冒烟测试");
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

    // 2. 真实点击开始远征
    console.log("2. 真实点击开始远征");
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
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "TownScene active");

    // 3. 检查 TownScene 显示内容
    console.log("3. 检查 TownScene 显示内容");
    const townTexts = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return [];
      const texts = [];
      ts.children.each((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      return texts;
    });
    mark(townTexts.some(t => t.includes("灰烬城镇")), "能看到「灰烬城镇」");
    mark(townTexts.some(t => t.includes("商路大厅")), "能看到「商路大厅」");
    mark(townTexts.some(t => t.includes("工坊")), "能看到「工坊」");
    mark(townTexts.some(t => t.includes("休整所")), "能看到「休整所」");
    mark(townTexts.some(t => t.includes("情报所")), "能看到「情报所」");
    mark(townTexts.some(t => t.includes("仓库") || t.includes("工具")), "能看到「仓库」或「工具」");

    // 4. 真实点击工坊，检查说明面板
    console.log("4. 真实点击工坊，检查说明面板");
    const workshopBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text === "工坊") {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(workshopBtn !== null, "找到「工坊」按钮");
    if (workshopBtn) {
      await clickGamePoint(page, { x: workshopBtn.x, y: workshopBtn.y }, "工坊按钮");
    }
    await sleep(500);
    const descAfterWorkshop = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts || !ts.descText) return "";
      return ts.descText.text;
    });
    mark(descAfterWorkshop.includes("工坊"), "说明面板显示「工坊」");

    // 5. 真实点击休整所
    console.log("5. 真实点击休整所");
    const restBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text === "休整所") {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(restBtn !== null, "找到「休整所」按钮");
    if (restBtn) {
      await clickGamePoint(page, { x: restBtn.x, y: restBtn.y }, "休整所按钮");
    }
    await sleep(500);
    const descAfterRest = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts || !ts.descText) return "";
      return ts.descText.text;
    });
    mark(descAfterRest.includes("休整所"), "说明面板显示「休整所」");

    // 6. 真实点击情报所
    console.log("6. 真实点击情报所");
    const intelBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text === "情报所") {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(intelBtn !== null, "找到「情报所」按钮");
    if (intelBtn) {
      await clickGamePoint(page, { x: intelBtn.x, y: intelBtn.y }, "情报所按钮");
    }
    await sleep(500);
    const descAfterIntel = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts || !ts.descText) return "";
      return ts.descText.text;
    });
    mark(descAfterIntel.includes("情报所"), "说明面板显示「情报所」");

    // 7. 真实点击仓库/工具
    console.log("7. 真实点击仓库/工具");
    const warehouseBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && (child.text === "仓库/工具" || child.text.includes("仓库"))) {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(warehouseBtn !== null, "找到「仓库/工具」按钮");
    if (warehouseBtn) {
      await clickGamePoint(page, { x: warehouseBtn.x, y: warehouseBtn.y }, "仓库/工具按钮");
    }
    await sleep(500);
    const descAfterWarehouse = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts || !ts.descText) return "";
      return ts.descText.text;
    });
    mark(descAfterWarehouse.includes("仓库") || descAfterWarehouse.includes("工具"), "说明面板显示「仓库」或「工具」");

    // 8. 真实点击商路大厅，进入 RouteSelectScene
    console.log("8. 真实点击商路大厅");
    const routeHallBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text === "商路大厅") {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(routeHallBtn !== null, "找到「商路大厅」按钮");
    if (routeHallBtn) {
      await clickGamePoint(page, { x: routeHallBtn.x, y: routeHallBtn.y }, "商路大厅按钮");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "进入 RouteSelectScene");

    // 9. 检查 RouteSelectScene 有路线卡
    console.log("9. 检查 RouteSelectScene 有路线卡");
    const hasRouteCards = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs) return false;
      return rs.routeCards && rs.routeCards.length > 0;
    });
    mark(hasRouteCards, "RouteSelectScene routeCards > 0");

    // 10. 点击返回城镇（使用 ESC 键）
    console.log("10. 按 ESC 返回城镇");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "回到 TownScene");

    // 11. 按 ESC 返回主菜单
    console.log("11. 按 ESC 返回主菜单");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "回到 MainMenuScene");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.2 城镇设施入口占位: ✅ 全部通过");
    } else {
      console.log("阶段11.2 城镇设施入口占位: ❌ 有失败项");
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