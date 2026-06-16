/**
 * smoke-test-town-tools-display-12-2.cjs
 * 阶段12.2：仓库/工具界面显示真实工具目录
 */
const { chromium } = require("playwright");
const { clickGamePoint, waitForSceneReady, findInteractiveButtonByText, sleep } = require("./_real_helpers.cjs");

const BASE_URL = "http://localhost:5175";

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

async function getTownTexts(page) {
  return await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    if (!ts) return [];
    const texts = [];

    // 递归遍历 Container 内的 Text
    function collectTextsFromContainer(container) {
      if (!container || !container.visible) return;
      container.each((child) => {
        if (child.type === "Text" && child.text && child.visible) {
          texts.push(String(child.text));
        } else if (child.type === "Container") {
          collectTextsFromContainer(child);
        }
      });
    }

    // 遍历场景直接子对象
    ts.children.each((child) => {
      if (child.type === "Text" && child.text && child.visible) {
        texts.push(String(child.text));
      } else if (child.type === "Container") {
        collectTextsFromContainer(child);
      }
    });

    // 遍历特定 container
    ["workshopCards", "restHouseCards", "intelOfficeCards", "storageToolsCards"].forEach((key) => {
      const container = ts[key];
      collectTextsFromContainer(container);
    });
    return texts;
  });
}

async function runTest() {
  console.log("========================================");
  console.log("阶段12.2：仓库/工具界面显示真实工具目录");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 页面加载
    console.log("1. 页面加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game && window.game.scene), "window.game 存在");

    // 2. toolSystem API 暴露检查
    console.log("2. toolSystem API 暴露检查");
    mark(await page.evaluate(() => typeof window.getAllTools === "function"), "getAllTools 已暴露");
    const toolCount = await page.evaluate(() => window.getAllTools().length);
    mark(toolCount >= 8, `getAllTools 返回 >= 8（实际: ${toolCount}）`);

    // 3. MainMenuScene active
    console.log("3. MainMenuScene");
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "MainMenuScene active");

    // 4. 真实点击开始远征进入 TownScene
    console.log("4. 真实点击开始远征");
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
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "点击开始远征进入 TownScene");

    // 5. 真实点击仓库/工具
    console.log("5. 真实点击仓库/工具");
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
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "点击仓库/工具后仍停留 TownScene");

    // 6. 检查工具目录显示
    console.log("6. 检查工具目录显示");
    const texts = await getTownTexts(page);
    mark(texts.some(t => t.includes("仓库") || t.includes("工具")), "显示「仓库/工具」");

    // 8 个工具名称
    mark(texts.some(t => t.includes("密封货箱")), "显示「密封货箱」");
    mark(texts.some(t => t.includes("备用轮轴")), "显示「备用轮轴」");
    mark(texts.some(t => t.includes("测距镜")), "显示「测距镜」");
    mark(texts.some(t => t.includes("伪装布")), "显示「伪装布」");
    mark(texts.some(t => t.includes("防水油布")), "显示「防水油布」");
    mark(texts.some(t => t.includes("沙尘面罩")), "显示「沙尘面罩」");
    mark(texts.some(t => t.includes("信号焰火")), "显示「信号焰火」");
    mark(texts.some(t => t.includes("加固护板")), "显示「加固护板」");

    // 效果状态（只有信号焰火未实装，显示"暂未开放"）
    mark(texts.some(t => t.includes("暂未开放")), "显示「暂未开放」（信号焰火）");

    // 显示购买按钮（阶段12商店功能）
    mark(texts.some(t => t.includes("购买")), "显示「购买」按钮");

    // 显示银币数量
    mark(texts.some(t => t.includes("银币")), "显示银币数量");

    // 不显示制作按钮（尚未实现）
    mark(!texts.some(t => t.includes("制作") && !t.includes("后续")), "不显示「制作」按钮");

    // TownScene 不显示携带按钮（携带在 CargoPrepScene）
    mark(!texts.some(t => t.includes("携带") && !t.includes("购买后请在")), "TownScene 不显示「携带」按钮");

    // 7. 点击工坊后不再显示密封货箱
    console.log("7. 点击工坊后检查残留");
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
    const afterWorkshop = await getTownTexts(page);
    mark(!afterWorkshop.some(t => t.includes("密封货箱")), "点击工坊后不残留「密封货箱」");

    // 8. 再点击仓库/工具重新显示
    console.log("8. 再点击仓库/工具");
    if (warehouseBtn) {
      await clickGamePoint(page, { x: warehouseBtn.x, y: warehouseBtn.y }, "仓库/工具按钮(第2次)");
    }
    await sleep(500);
    const afterWarehouseAgain = await getTownTexts(page);
    mark(afterWarehouseAgain.some(t => t.includes("密封货箱")), "再点击仓库/工具后显示「密封货箱」");

    // 9. 点击商路大厅进入 RouteSelectScene
    console.log("9. 点击商路大厅");
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
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "商路大厅进入 RouteSelectScene");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段12.2工具目录展示: ✅ 全部通过");
    } else {
      console.log("阶段12.2工具目录展示: ❌ 有失败项");
    }
    console.log("========================================\n");

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