/**
 * smoke-test-world-map-11-1.cjs
 * 阶段11.1：大格子自由探索地图原型冒烟测试
 *
 * 测试要点：
 * 1. 主菜单真实点击"大地图原型"按钮进入 WorldMapScene
 * 2. WorldMapScene 地图为 20×20
 * 3. 玩家可通过方向键真实移动
 * 4. 补给和订单剩余步数随移动减少
 * 5. 边界不能越界
 * 6. 不同格子底部说明变化
 * 7. ESC 可返回主菜单
 */
const { chromium } = require("playwright");
const {
  clickGamePoint,
  waitForSceneReady,
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
  console.log("阶段11.1 大格子自由探索地图原型冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[WorldMapScene]")) {
      console.log(`  [页面] ${text}`);
    }
  });

  try {
    // 1. 游戏加载
    console.log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "MainMenuScene active");

    // 2. 找到"大地图原型"按钮
    console.log("2. 找到'大地图原型'按钮");
    const wmBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /大地图原型/.test(child.text)) {
            btn = { x: child.x, y: child.y };
          }
        }
      });
      return btn;
    });
    mark(wmBtn !== null, "主菜单找到'大地图原型'按钮");

    // 3. 真实点击进入 WorldMapScene
    console.log("3. 真实点击进入 WorldMapScene");
    if (wmBtn) {
      await clickGamePoint(page, { x: wmBtn.x, y: wmBtn.y }, "大地图原型按钮");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("WorldMapScene")), "WorldMapScene active");

    // 4. 检查地图规格 20×20
    console.log("4. 检查地图规格");
    const mapSpec = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      if (!ws) return null;
      // 检查 currentPosition 存在，cells 可以通过 outer 检查
      const cells = ws.cells;
      const rows = cells ? cells.length : 0;
      const cols = cells && cells[0] ? cells[0].length : 0;
      return {
        pos: ws.currentPosition,
        supplies: ws.supplies,
        orderSteps: ws.orderSteps,
        rows,
        cols,
      };
    });
    mark(mapSpec !== null, "WorldMapScene 有状态");
    mark(mapSpec && mapSpec.rows === 20, "地图高度 = 20");
    mark(mapSpec && mapSpec.cols === 20, "地图宽度 = 20");
    mark(mapSpec && mapSpec.pos && typeof mapSpec.pos.x === "number", "初始位置存在");
    mark(mapSpec && mapSpec.supplies > 0, "补给 > 0");
    mark(mapSpec && mapSpec.orderSteps > 0, "订单剩余步数 > 0");

    // 5. 检查 UI Text（位置、补给、订单剩余步数）
    console.log("5. 检查 UI 面板");
    const uiTextList = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      if (!ws) return [];
      const texts = [];
      ws.children?.each?.((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      return texts;
    });
    const hasPosLine = uiTextList.some((t) => t.includes("位置"));
    const hasSuppliesLine = uiTextList.some((t) => t.includes("补给"));
    const hasOrderLine = uiTextList.some((t) => t.includes("订单剩余步数"));
    const hasTerrainLine = uiTextList.some((t) => t.includes("当前地形"));
    mark(hasPosLine, "UI 显示'位置'");
    mark(hasSuppliesLine, "UI 显示'补给'");
    mark(hasOrderLine, "UI 显示'订单剩余步数'");
    mark(hasTerrainLine, "UI 显示'当前地形'");

    // 6. 真实键盘 ArrowRight 移动
    console.log("6. 真实键盘 ArrowRight 移动");
    const beforeMove = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      return {
        x: ws.currentPosition.x,
        y: ws.currentPosition.y,
        supplies: ws.supplies,
        orderSteps: ws.orderSteps,
      };
    });
    console.log(`  移动前: pos=(${beforeMove.x},${beforeMove.y}), 补给=${beforeMove.supplies}, 步数=${beforeMove.orderSteps}`);
    await page.keyboard.press("ArrowRight");
    await sleep(500);
    const afterRight = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      return {
        x: ws.currentPosition.x,
        y: ws.currentPosition.y,
        supplies: ws.supplies,
        orderSteps: ws.orderSteps,
      };
    });
    console.log(`  移动后: pos=(${afterRight.x},${afterRight.y}), 补给=${afterRight.supplies}, 步数=${afterRight.orderSteps}`);
    mark(afterRight.x === beforeMove.x + 1, "ArrowRight 后 x 增加 1");
    mark(afterRight.y === beforeMove.y, "ArrowRight 后 y 不变");
    mark(afterRight.supplies < beforeMove.supplies, "补给减少");
    mark(afterRight.orderSteps < beforeMove.orderSteps, "订单剩余步数减少");

    // 7. ArrowDown 再移动一次
    console.log("7. 真实键盘 ArrowDown 移动");
    await page.keyboard.press("ArrowDown");
    await sleep(500);
    const afterDown = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      return { x: ws.currentPosition.x, y: ws.currentPosition.y };
    });
    mark(afterDown.y === afterRight.y + 1, "ArrowDown 后 y 增加 1");
    mark(afterDown.x === afterRight.x, "ArrowDown 后 x 不变");

    // 8. 检查不同格子时底部说明变化
    console.log("8. 检查不同格子底部说明变化");
    const desc1 = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      return ws.cells[ws.currentPosition.y][ws.currentPosition.x].desc;
    });
    console.log(`  初始格子: ${desc1}`);
    // 往左上移动，去寻找特殊点位（目标城市、驿站、村庄等）
    // 地图：TargetCity=(17,2), Outpost=(10,10), Village=(5,7), Ruin=(14,14)/(8,3), Enemy=(12,7)/(16,12)
    // 当前位置是 (3, 18) 左右，往上走 y 会减小，去找 Outpost (10,10)
    // 先右 7 步 + 上 8 步，到达 (10,10)
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press("ArrowRight");
      await sleep(200);
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("ArrowUp");
      await sleep(200);
    }
    const desc2 = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      const cell = ws.cells[ws.currentPosition.y][ws.currentPosition.x];
      return { pos: { x: ws.currentPosition.x, y: ws.currentPosition.y }, desc: cell.desc, type: cell.type };
    });
    console.log(`  移动后: (${desc2.pos.x},${desc2.pos.y}) type=${desc2.type} desc=${desc2.desc}`);
    mark(desc1 !== desc2.desc, "不同格子底部说明不同");

    // 9. 边界测试：按 ArrowLeft 多步直到边界
    console.log("9. 边界测试");
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press("ArrowLeft");
      await sleep(30);
    }
    const afterLeft = await page.evaluate(() => {
      const ws = window.game.scene.getScene("WorldMapScene");
      return { x: ws.currentPosition.x, y: ws.currentPosition.y };
    });
    mark(afterLeft.x >= 0, "x 不越界（>= 0）");
    mark(afterLeft.x < 20, "x 不越界（< 20）");
    mark(afterLeft.y >= 0, "y 不越界（>= 0）");
    mark(afterLeft.y < 20, "y 不越界（< 20）");

    // 10. ESC 返回主菜单
    console.log("10. ESC 返回主菜单");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "ESC 后 MainMenuScene active");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.1 大地图原型: ✅ 全部通过");
    } else {
      console.log("阶段11.1 大地图原型: ❌ 有失败项");
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
