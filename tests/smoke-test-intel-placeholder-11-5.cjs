/**
 * smoke-test-intel-placeholder-11-5.cjs
 * 阶段11.5：情报所详情占位冒烟测试
 *
 * 测试覆盖：
 * 1. 主菜单进入 TownScene
 * 2. 点击情报所显示详情面板
 * 3. 情报所详情显示商路风险、城市状态、目标情报
 * 4. 切换到工坊、休整所后详情变化
 * 5. 再切换回情报所
 * 6. 商路大厅进入 RouteSelectScene
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

/**
 * 获取 TownScene 说明面板内容
 */
async function getTownPanelTexts(page) {
  return await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    if (!ts) return [];
    const texts = [];
    ts.children.each((child) => {
      if (child.type === "Text" && child.text && child.visible) {
        texts.push(String(child.text));
      }
    });
    // 检查工坊卡片
    if (ts.workshopCards && ts.workshopCards.visible) {
      ts.workshopCards.each((child) => {
        if (child.type === "Text" && child.text && child.visible) {
          texts.push(String(child.text));
        }
      });
    }
    // 检查休整所卡片
    if (ts.restHouseCards && ts.restHouseCards.visible) {
      ts.restHouseCards.each((child) => {
        if (child.type === "Text" && child.text && child.visible) {
          texts.push(String(child.text));
        }
      });
    }
    // 检查情报所卡片
    if (ts.intelOfficeCards && ts.intelOfficeCards.visible) {
      ts.intelOfficeCards.each((child) => {
        if (child.type === "Text" && child.text && child.visible) {
          texts.push(String(child.text));
        }
      });
    }
    return texts;
  });
}

async function runTest() {
  console.log("========================================");
  console.log("阶段11.5 情报所详情占位冒烟测试");
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

    // 3. 真实点击情报所
    console.log("3. 真实点击情报所");
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
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "点击情报所后 TownScene 仍 active");

    // 4. 检查情报所详情内容
    console.log("4. 检查情报所详情内容");
    const intelTexts = await getTownPanelTexts(page);
    mark(intelTexts.some(t => t.includes("情报所")), "说明区显示「情报所」");
    mark(intelTexts.some(t => t.includes("商路风险")), "说明区显示「商路风险」");
    mark(intelTexts.some(t => t.includes("城市状态")), "说明区显示「城市状态」");
    mark(intelTexts.some(t => t.includes("目标情报")), "说明区显示「目标情报」");
    mark(intelTexts.some(t => t.includes("后续开放") || t.includes("真实情报系统后续开放")), "说明区显示「后续开放」");

    // 5. 点击工坊，说明区切换
    console.log("5. 点击工坊，说明区切换");
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
    const workshopTexts = await getTownPanelTexts(page);
    mark(workshopTexts.some(t => t.includes("工坊")), "说明区切换为工坊详情");
    mark(workshopTexts.some(t => t.includes("工具图纸")), "工坊详情显示「工具图纸」");

    // 6. 点击休整所，说明区再次切换
    console.log("6. 点击休整所，说明区再次切换");
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
    const restTexts = await getTownPanelTexts(page);
    mark(restTexts.some(t => t.includes("休整所")), "说明区切换为休整所详情");

    // 7. 再点击情报所，说明区恢复
    console.log("7. 再点击情报所，说明区恢复");
    if (intelBtn) {
      await clickGamePoint(page, { x: intelBtn.x, y: intelBtn.y }, "情报所按钮(第2次)");
    }
    await sleep(500);
    const intelTextsAgain = await getTownPanelTexts(page);
    mark(intelTextsAgain.some(t => t.includes("商路风险")), "说明区重新显示情报所详情");

    // 8. 点击商路大厅，进入 RouteSelectScene
    console.log("8. 点击商路大厅");
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

    // 9. 按 ESC 返回城镇
    console.log("9. 按 ESC 返回城镇");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "回到 TownScene");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.5 情报所详情占位: ✅ 全部通过");
    } else {
      console.log("阶段11.5 情报所详情占位: ❌ 有失败项");
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