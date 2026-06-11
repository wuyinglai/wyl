/**
 * smoke-test-workshop-placeholder-11-3.cjs
 * 阶段11.3：工坊详情占位冒烟测试
 *
 * 测试覆盖：
 * 1. 主菜单进入 TownScene
 * 2. 点击工坊显示详情面板
 * 3. 工坊详情显示工具图纸、修理商队设备、升级商队设备
 * 4. 切换到其他设施后说明区变化
 * 5. 商路大厅进入 RouteSelectScene
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
  console.log("阶段11.3 工坊详情占位冒烟测试");
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

    // 3. 真实点击工坊
    console.log("3. 真实点击工坊");
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
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "点击工坊后 TownScene 仍 active");

    // 4. 检查工坊详情内容
    console.log("4. 检查工坊详情内容");
    const townTexts = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return [];
      const texts = [];
      ts.children.each((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      // 也检查工坊卡片容器
      if (ts.workshopCards && ts.workshopCards.visible) {
        ts.workshopCards.each((child) => {
          if (child.type === "Text" && child.text) {
            texts.push(String(child.text));
          }
        });
      }
      return texts;
    });
    mark(townTexts.some(t => t.includes("工坊")), "说明区显示「工坊」");
    mark(townTexts.some(t => t.includes("工具图纸")), "说明区显示「工具图纸」");
    mark(townTexts.some(t => t.includes("修理商队设备")), "说明区显示「修理商队设备」");
    mark(townTexts.some(t => t.includes("升级商队设备")), "说明区显示「升级商队设备」");
    mark(townTexts.some(t => t.includes("后续开放") || t.includes("真实制作系统后续开放")), "说明区显示「后续开放」");

    // 5. 点击休整所，说明区切换
    console.log("5. 点击休整所，说明区切换");
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
    const afterRestTexts = await page.evaluate(() => {
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
    mark(afterRestTexts.some(t => t.includes("休整所")), "说明区切换为休整所内容");
    mark(!afterRestTexts.some(t => t.includes("工具图纸")), "说明区不再显示工具图纸");

    // 6. 再点击工坊，说明区恢复
    console.log("6. 再点击工坊，说明区恢复");
    if (workshopBtn) {
      await clickGamePoint(page, { x: workshopBtn.x, y: workshopBtn.y }, "工坊按钮(第2次)");
    }
    await sleep(500);
    const afterWorkshopAgain = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return [];
      const texts = [];
      ts.children.each((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      if (ts.workshopCards && ts.workshopCards.visible) {
        ts.workshopCards.each((child) => {
          if (child.type === "Text" && child.text) {
            texts.push(String(child.text));
          }
        });
      }
      return texts;
    });
    mark(afterWorkshopAgain.some(t => t.includes("工具图纸")), "说明区重新显示工坊详情");

    // 7. 点击商路大厅，进入 RouteSelectScene
    console.log("7. 点击商路大厅");
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

    // 8. 点击返回城镇
    console.log("8. 按 ESC 返回城镇");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "回到 TownScene");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.3 工坊详情占位: ✅ 全部通过");
    } else {
      console.log("阶段11.3 工坊详情占位: ❌ 有失败项");
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