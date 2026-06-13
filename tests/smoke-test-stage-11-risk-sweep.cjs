/**
 * smoke-test-stage-11-risk-sweep.cjs
 * 阶段11 进入阶段12前：25个最高风险 bug 扫尾测试
 *
 * 测试覆盖：
 * 1. MainMenuScene 没有大地图原型入口
 * 2. 开始远征进入 TownScene
 * 3. 设施详情面板互斥切换，无残留
 * 4. 重复点击同一设施不造成 children 异常增长
 * 5. 商路大厅进入 RouteSelectScene
 * 6. ESC 返回主菜单
 * 7. 再次进入 TownScene 设施仍正常
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
 * 获取 TownScene 所有可见文本
 */
async function getTownTexts(page) {
  return await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    if (!ts) return [];
    const texts = [];
    ts.children.each((child) => {
      if (child.type === "Text" && child.text && child.visible) {
        texts.push(String(child.text));
      }
    });
    // 遍历所有容器
    ["workshopCards", "restHouseCards", "intelOfficeCards", "storageToolsCards"].forEach((key) => {
      const container = ts[key];
      if (container && container.visible) {
        container.each((child) => {
          if (child.type === "Text" && child.text && child.visible) {
            texts.push(String(child.text));
          }
        });
      }
    });
    return texts;
  });
}

/**
 * 获取 TownScene 的 children 数量
 */
async function getTownChildrenCount(page) {
  return await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    if (!ts) return 0;
    return ts.children.getAll().length;
  });
}

async function runTest() {
  console.log("========================================");
  console.log("阶段11 进入阶段12前风险扫尾测试");
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

    // 2. 检查主菜单没有大地图原型
    console.log("2. 检查主菜单没有大地图原型");
    const hasWorldMap = await page.evaluate(() => {
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
    mark(!hasWorldMap, "主菜单没有「大地图原型」入口");

    // 3. 真实点击开始远征进入 TownScene
    console.log("3. 真实点击开始远征");
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

    // 4. 检查所有设施按钮可见
    console.log("4. 检查设施按钮");
    const townTexts = await getTownTexts(page);
    mark(townTexts.some(t => t.includes("商路大厅")), "能看到「商路大厅」");
    mark(townTexts.some(t => t.includes("工坊")), "能看到「工坊」");
    mark(townTexts.some(t => t.includes("休整所")), "能看到「休整所」");
    mark(townTexts.some(t => t.includes("情报所")), "能看到「情报所」");
    mark(townTexts.some(t => t.includes("仓库") || t.includes("工具")), "能看到「仓库/工具」");

    // 5. 点击工坊，检查详情
    console.log("5. 点击工坊");
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
    mark(afterWorkshop.some(t => t.includes("工坊")), "工坊详情显示「工坊」");
    mark(afterWorkshop.some(t => t.includes("工具图纸")), "工坊详情显示「工具图纸」");
    mark(!afterWorkshop.some(t => t.includes("队伍休整")), "工坊详情不残留「队伍休整」");
    mark(!afterWorkshop.some(t => t.includes("商路风险")), "工坊详情不残留「商路风险」");

    // 6. 点击休整所，检查详情
    console.log("6. 点击休整所");
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
    const afterRest = await getTownTexts(page);
    mark(afterRest.some(t => t.includes("休整所")), "休整所详情显示「休整所」");
    mark(afterRest.some(t => t.includes("队伍休整")), "休整所详情显示「队伍休整」");
    mark(!afterRest.some(t => t.includes("工具图纸")), "休整所详情不残留「工具图纸」");
    mark(!afterRest.some(t => t.includes("商路风险")), "休整所详情不残留「商路风险」");

    // 7. 点击情报所，检查详情
    console.log("7. 点击情报所");
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
    const afterIntel = await getTownTexts(page);
    mark(afterIntel.some(t => t.includes("情报所")), "情报所详情显示「情报所」");
    mark(afterIntel.some(t => t.includes("商路风险")), "情报所详情显示「商路风险」");
    mark(!afterIntel.some(t => t.includes("工具图纸")), "情报所详情不残留「工具图纸」");
    mark(!afterIntel.some(t => t.includes("队伍休整")), "情报所详情不残留「队伍休整」");

    // 8. 点击仓库/工具，检查详情
    console.log("8. 点击仓库/工具");
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
    const afterWarehouse = await getTownTexts(page);
    mark(afterWarehouse.some(t => t.includes("仓库") || t.includes("工具")), "仓库/工具详情显示");
    mark(afterWarehouse.some(t => t.includes("货物仓库")), "仓库/工具详情显示「货物仓库」");
    mark(afterWarehouse.some(t => t.includes("远征工具")), "仓库/工具详情显示「远征工具」");
    mark(afterWarehouse.some(t => t.includes("物资整理")), "仓库/工具详情显示「物资整理」");
    mark(!afterWarehouse.some(t => t.includes("工具图纸")), "仓库/工具详情不残留「工具图纸」");
    mark(!afterWarehouse.some(t => t.includes("队伍休整")), "仓库/工具详情不残留「队伍休整」");
    mark(!afterWarehouse.some(t => t.includes("商路风险")), "仓库/工具详情不残留「商路风险」");

    // 9. 反复点击同一设施，检查 children 数量不异常增长
    console.log("9. 反复点击仓库/工具");
    const initialCount = await getTownChildrenCount(page);
    for (let i = 0; i < 5; i++) {
      if (warehouseBtn) {
        await clickGamePoint(page, { x: warehouseBtn.x, y: warehouseBtn.y }, "仓库/工具重复点击" + (i + 1));
      }
      await sleep(300);
    }
    const finalCount = await getTownChildrenCount(page);
    mark(finalCount <= initialCount + 10, "反复点击设施 children 数量不异常增长");

    // 10. 再点击工坊，检查详情恢复
    console.log("10. 再点击工坊");
    if (workshopBtn) {
      await clickGamePoint(page, { x: workshopBtn.x, y: workshopBtn.y }, "工坊按钮(第2次)");
    }
    await sleep(500);
    const afterWorkshopAgain = await getTownTexts(page);
    mark(afterWorkshopAgain.some(t => t.includes("工坊")), "再点击工坊显示工坊详情");
    mark(afterWorkshopAgain.some(t => t.includes("工具图纸")), "工坊详情关键词「工具图纸」存在");

    // 11. 点击商路大厅，进入 RouteSelectScene
    console.log("11. 点击商路大厅");
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

    // 12. RouteSelectScene 检查路线卡存在
    console.log("12. 检查 RouteSelectScene");
    const hasRouteCards = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      return rs && rs.routeCards && rs.routeCards.length > 0;
    });
    mark(hasRouteCards, "RouteSelectScene 有路线卡");

    // 13. ESC 返回 TownScene
    console.log("13. ESC 返回城镇");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "ESC 返回 TownScene");

    // 14. TownScene ESC 返回主菜单
    console.log("14. ESC 返回主菜单");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "ESC 返回 MainMenuScene");

    // 15. 再次进入 TownScene，设施仍正常
    console.log("15. 再次进入 TownScene");
    const startBtn2 = await page.evaluate(() => {
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
    if (startBtn2) {
      await clickGamePoint(page, { x: startBtn2.x, y: startBtn2.y }, "再次开始远征");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "再次进入 TownScene");
    const townTexts2 = await getTownTexts(page);
    mark(townTexts2.some(t => t.includes("工坊")), "再次进入后工坊按钮可见");
    mark(townTexts2.some(t => t.includes("仓库") || townTexts2.some(t => t.includes("工具"))), "再次进入后仓库/工具按钮可见");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11风险扫尾: ✅ 全部通过");
    } else {
      console.log("阶段11风险扫尾: ❌ 有失败项");
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
