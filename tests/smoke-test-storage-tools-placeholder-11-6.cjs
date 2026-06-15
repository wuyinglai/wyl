/**
 * smoke-test-storage-tools-placeholder-11-6.cjs
 * 阶段11.6：仓库/工具详情占位冒烟测试
 *
 * 测试覆盖：
 * 1. 主菜单进入 TownScene
 * 2. 点击仓库/工具显示详情面板
 * 3. 仓库/工具详情显示货物仓库、远征工具、物资整理
 * 4. 切换到工坊、休整所、情报所后详情变化
 * 5. 再切换回仓库/工具
 * 6. 商路大厅进入 RouteSelectScene
 * 7. 返回城镇正常
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
 * 获取 TownScene 说明面板内容（包括所有详情卡片容器）
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
    // 检查仓库/工具卡片
    if (ts.storageToolsCards && ts.storageToolsCards.visible) {
      ts.storageToolsCards.each((child) => {
        if (child.type === "Text" && child.text && child.visible) {
          texts.push(String(child.text));
        }
      });
    }
    return texts;
  });
}

/**
 * 通过文本内容查找设施按钮
 */
async function findInteractiveButtonByText(page, targetText) {
  return await page.evaluate((text) => {
    const ts = window.game.scene.getScene("TownScene");
    if (!ts) return null;
    let btn = null;
    ts.children.each((child) => {
      if (btn) return;
      if (child.type === "Text" && child.text && child.text === text) {
        btn = { x: child.x, y: child.y };
      }
    });
    return btn;
  }, targetText);
}

async function findWarehouseButton(page) {
  return await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    if (!ts) return null;
    let btn = null;
    ts.children.each((child) => {
      if (btn) return;
      if (child.type === "Text" && child.text && (child.text === "仓库/工具" || child.text.includes("仓库"))) {
        btn = { x: child.x, y: child.y };
      }
    });
    return btn;
  });
}

async function runTest() {
  console.log("========================================");
  console.log("阶段11.6 仓库/工具详情占位冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 游戏加载
    console.log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game && window.game.scene), "window.game 存在");
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

    // 3. 真实点击仓库/工具
    console.log("3. 真实点击仓库/工具");
    const warehouseBtn = await findWarehouseButton(page);
    mark(warehouseBtn !== null, "找到「仓库/工具」按钮");
    if (warehouseBtn) {
      await clickGamePoint(page, { x: warehouseBtn.x, y: warehouseBtn.y }, "仓库/工具按钮");
    }
    await sleep(500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "点击仓库/工具后 TownScene 仍 active");

    // 4. 检查仓库/工具详情内容
    console.log("4. 检查仓库/工具详情内容");
    const storageTexts = await getTownPanelTexts(page);
    mark(storageTexts.some(t => t.includes("仓库") || t.includes("工具")), "说明区显示「仓库」或「工具」");
    mark(storageTexts.some(t => t.includes("远征工具")), "说明区显示「远征工具」");
    mark(storageTexts.some(t => t.includes("密封货箱")), "说明区显示工具目录（密封货箱）");
    mark(storageTexts.some(t => t.includes("效果未接入")), "说明区显示「效果未接入」");
    mark(storageTexts.some(t => t.includes("后续开放") || t.includes("携带和制作功能后续开放")), "说明区显示「后续开放」");

    // 5. 点击工坊，说明区切换
    console.log("5. 点击工坊，说明区切换");
    const workshopBtn = await findInteractiveButtonByText(page, "工坊");
    mark(workshopBtn !== null, "找到「工坊」按钮");
    if (workshopBtn) {
      await clickGamePoint(page, { x: workshopBtn.x, y: workshopBtn.y }, "工坊按钮");
    }
    await sleep(500);
    const workshopTexts = await getTownPanelTexts(page);
    mark(workshopTexts.some(t => t.includes("工坊")), "说明区切换为工坊详情");

    // 6. 点击休整所，说明区切换
    console.log("6. 点击休整所，说明区切换");
    const restBtn = await findInteractiveButtonByText(page, "休整所");
    mark(restBtn !== null, "找到「休整所」按钮");
    if (restBtn) {
      await clickGamePoint(page, { x: restBtn.x, y: restBtn.y }, "休整所按钮");
    }
    await sleep(500);
    const restTexts = await getTownPanelTexts(page);
    mark(restTexts.some(t => t.includes("休整所")), "说明区切换为休整所详情");

    // 7. 点击情报所，说明区切换
    console.log("7. 点击情报所，说明区切换");
    const intelBtn = await findInteractiveButtonByText(page, "情报所");
    mark(intelBtn !== null, "找到「情报所」按钮");
    if (intelBtn) {
      await clickGamePoint(page, { x: intelBtn.x, y: intelBtn.y }, "情报所按钮");
    }
    await sleep(500);
    const intelTexts = await getTownPanelTexts(page);
    mark(intelTexts.some(t => t.includes("情报所")), "说明区切换为情报所详情");

    // 8. 再点击仓库/工具，说明区恢复
    console.log("8. 再点击仓库/工具，说明区恢复");
    if (warehouseBtn) {
      await clickGamePoint(page, { x: warehouseBtn.x, y: warehouseBtn.y }, "仓库/工具按钮(第2次)");
    }
    await sleep(500);
    const storageTextsAgain = await getTownPanelTexts(page);
    mark(storageTextsAgain.some(t => t.includes("密封货箱")), "说明区重新显示仓库/工具详情（工具目录）");

    // 9. 点击商路大厅，进入 RouteSelectScene
    console.log("9. 点击商路大厅");
    const routeHallBtn = await findInteractiveButtonByText(page, "商路大厅");
    mark(routeHallBtn !== null, "找到「商路大厅」按钮");
    if (routeHallBtn) {
      await clickGamePoint(page, { x: routeHallBtn.x, y: routeHallBtn.y }, "商路大厅按钮");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "进入 RouteSelectScene");

    // 10. 按 ESC 返回城镇
    console.log("10. 按 ESC 返回城镇");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "回到 TownScene");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.6 仓库/工具详情占位: ✅ 全部通过");
    } else {
      console.log("阶段11.6 仓库/工具详情占位: ❌ 有失败项");
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
