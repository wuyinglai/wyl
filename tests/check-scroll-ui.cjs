/**
 * check-scroll-ui.cjs
 * 快速验证工具商店的滚动、遮挡、按钮、切换设施等行为
 */
const { chromium } = require("playwright");
const { clickGamePoint, waitForSceneReady, sleep, findInteractiveButtonByText } = require("./_real_helpers.cjs");

const BASE_URL = "http://localhost:5179";

let passCount = 0;
let failCount = 0;
function mark(pass, msg) {
  if (pass) { passCount++; console.log("  [PASS] " + msg); }
  else { failCount++; console.log("  [FAIL] " + msg); }
}

async function collectVisibleToolTexts(page) {
  return page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    if (!ts) return [];
    const out = [];
    function walk(parent, depth) {
      if (!parent) return;
      if (parent.visible === false) return;
      const list = parent === ts ? (ts.children?.list || []) : (parent.list || []);
      for (const child of list) {
        if (!child) continue;
        if (child.type === "Text" && child.visible !== false) {
          out.push({ text: String(child.text || ""), x: child.x, y: child.y });
        }
        if (child.type === "Container") walk(child, depth + 1);
      }
    }
    walk(ts, 0);
    return out;
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

    // 1. 进入主菜单 → 点击开始远征
    console.log("1. 主菜单 → TownScene");
    const startBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children.each((c) => {
        if (btn) return;
        if (c.type === "Text" && c.input?.enabled && /开始远征/.test(c.text))
          btn = { x: c.x, y: c.y };
      });
      return btn;
    });
    mark(startBtn !== null, "找到开始远征按钮");
    if (startBtn) await clickGamePoint(page, startBtn, "开始远征");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "进入 TownScene");

    // 2. 点击仓库/工具
    console.log("2. 仓库/工具面板");
    const warehouseBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((c) => {
        if (btn) return;
        if (c.type === "Text" && (c.text === "仓库/工具" || /仓库/.test(c.text)))
          btn = { x: c.x, y: c.y };
      });
      return btn;
    });
    mark(warehouseBtn !== null, "找到仓库/工具按钮");
    if (warehouseBtn) await clickGamePoint(page, warehouseBtn, "仓库/工具");
    await sleep(800);

    const textsAfterWarehouse = await collectVisibleToolTexts(page);
    mark(textsAfterWarehouse.some(t => t.text.includes("仓库") || t.text.includes("工具")), "面板标题包含仓库/工具");
    mark(textsAfterWarehouse.some(t => t.text.includes("银币")), "显示银币");

    // 3. 当前可见的工具名称（应该只有约 4 个）
    const toolNamesInitial = textsAfterWarehouse
      .map(t => t.text)
      .filter(t => ["密封货箱","备用轮轴","测距镜","伪装布","防水油布","沙尘面罩","信号焰火","加固护板"].includes(t));
    console.log("  当前可见工具: " + JSON.stringify(toolNamesInitial));
    mark(toolNamesInitial.length >= 3 && toolNamesInitial.length <= 5, "滚动框内只显示 3-5 张工具卡");

    // 4. 模拟鼠标滚轮向下滚动（用 wheel 事件）
    console.log("3. 鼠标滚轮向下");
    const scrollBoxCenter = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      // boxX=520, boxY=255, boxW=400, boxH=360
      return { x: 520 + 200, y: 255 + 180 };
    });
    const screenPt = await page.evaluate((pt) => {
      const canvas = document.querySelector("canvas");
      const rect = canvas.getBoundingClientRect();
      const game = window.game;
      const gw = game.scale.gameSize.width;
      const gh = game.scale.gameSize.height;
      return { sx: rect.left + (pt.x / gw) * rect.width, sy: rect.top + (pt.y / gh) * rect.height };
    }, scrollBoxCenter);

    await page.mouse.move(screenPt.sx, screenPt.sy);
    await page.evaluate(() => {
      window.__wheelLog = [];
      const ts = window.game.scene.getScene("TownScene");
      const orig = ts.shopWheelHandler;
      ts.input.off("wheel", ts.shopWheelHandler);
      ts.input.on("wheel", (pointer) => {
        window.__wheelLog.push({ x: pointer.x, y: pointer.y, deltaY: pointer.deltaY, idx: ts.shopScrollIndex });
        if (orig) orig.call(ts, pointer);
      });
      // 派发 wheel 事件到 canvas
      const canvas = document.querySelector("canvas");
      const evt = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, clientX: 720, clientY: 435 });
      canvas.dispatchEvent(evt);
    });
    await sleep(800);

    const textsAfterScroll = await collectVisibleToolTexts(page);
    const toolNamesAfter = textsAfterScroll
      .map(t => t.text)
      .filter(t => ["密封货箱","备用轮轴","测距镜","伪装布","防水油布","沙尘面罩","信号焰火","加固护板"].includes(t));
    console.log("  滚动后可见工具: " + JSON.stringify(toolNamesAfter));

    // 5. 现在应该看到后面 4 个工具
    mark(toolNamesAfter.length >= 1, "滚轮后仍有工具显示");
    const changedToolSet =
      toolNamesInitial[0] !== toolNamesAfter[0] ||
      toolNamesInitial.join(",") !== toolNamesAfter.join(",");
    mark(changedToolSet, "滚轮后工具列表发生变化");

    // 6. 回到初始位置（滚轮向上）
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const evt = new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true });
      canvas.dispatchEvent(evt);
    });
    await sleep(500);

    // 7. 购买测试：找一个「购买 X银」按钮
    console.log("4. 购买测试");
    const buyBtn = await findInteractiveButtonByText(page, "TownScene", "购买");
    mark(buyBtn !== null, "找到购买按钮（Container 形式）");
    if (buyBtn) {
      const silverBefore = await page.evaluate(() => window.getGameState().silver);
      await clickGamePoint(page, buyBtn, "购买按钮");
      await sleep(500);
      const silverAfter = await page.evaluate(() => window.getGameState().silver);
      console.log("  银币: " + silverBefore + " → " + silverAfter);
      mark(silverAfter < silverBefore, "购买后银币减少");
    }

    // 8. 切换设施后工具商店应当清除
    console.log("5. 切换到工坊后残留检查");
    const workshopBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((c) => {
        if (btn) return;
        if (c.type === "Text" && c.text === "工坊") btn = { x: c.x, y: c.y };
      });
      return btn;
    });
    if (workshopBtn) await clickGamePoint(page, workshopBtn, "工坊");
    await sleep(600);

    const textsAfterWorkshop = await collectVisibleToolTexts(page);
    const hasToolCardAfterWorkshop = textsAfterWorkshop.some(t => ["密封货箱","备用轮轴","测距镜","伪装布","防水油布","沙尘面罩","信号焰火","加固护板"].includes(t.text));
    mark(!hasToolCardAfterWorkshop, "切换到工坊后无工具卡片残留");

    // 9. 再切回仓库/工具
    console.log("6. 再切回仓库/工具");
    if (warehouseBtn) await clickGamePoint(page, warehouseBtn, "仓库/工具(第2次)");
    await sleep(600);
    const textsAgain = await collectVisibleToolTexts(page);
    mark(textsAgain.some(t => ["密封货箱","备用轮轴","测距镜","伪装布","防水油布","沙尘面罩","信号焰火","加固护板"].includes(t.text)), "再次打开仓库/工具后工具重新显示");

    // 10. 去 CargoPrepScene 确认携带可用
    console.log("7. CargoPrepScene 工具携带");
    const routeBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((c) => {
        if (btn) return;
        if (c.type === "Text" && c.text === "商路大厅") btn = { x: c.x, y: c.y };
      });
      return btn;
    });
    if (routeBtn) await clickGamePoint(page, routeBtn, "商路大厅");
    await sleep(1500);

    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "进入 RouteSelectScene");

    // 第一张路线卡
    const firstCard = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) return null;
      return { x: rs.routeCards[0].x, y: rs.routeCards[0].y };
    });
    if (firstCard) await clickGamePoint(page, firstCard, "路线卡1");
    await sleep(1200);

    // 角色选择
    const charCards = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
      return cs.characterCards.slice(0, 3).map(c => ({ x: c.x, y: c.y }));
    });
    if (charCards) {
      for (let i = 0; i < charCards.length; i++) {
        await clickGamePoint(page, charCards[i], "角色卡" + (i + 1));
        await sleep(300);
      }
    }
    const csStart = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    if (csStart) await clickGamePoint(page, csStart, "角色选择开始远征");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("CargoPrepScene")), "进入 CargoPrepScene");

    const cargoTexts = await page.evaluate(() => {
      const cp = window.game.scene.getScene("CargoPrepScene");
      if (!cp) return [];
      const out = [];
      function walk(parent) {
        if (!parent) return;
        const list = parent === cp ? (cp.children?.list || []) : (parent.list || []);
        for (const child of list) {
          if (!child) continue;
          if (child.type === "Text" && child.visible !== false) {
            out.push(String(child.text || ""));
          }
          if (child.type === "Container") walk(child);
        }
      }
      walk(cp);
      return out;
    });
    console.log("  CargoPrepScene 相关文本样例: " + cargoTexts.filter(t => t.length < 20).slice(0, 10).join(" | "));
    mark(cargoTexts.length > 5, "CargoPrepScene 有可见文本");

    console.log("\n========================================");
    console.log(`检查结果: ${passCount} 通过, ${failCount} 失败`);
    console.log("========================================");

    await browser.close();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (e) {
    console.error("❌ " + e.message);
    console.error(e.stack);
    await browser.close();
    process.exit(1);
  }
}

run();
