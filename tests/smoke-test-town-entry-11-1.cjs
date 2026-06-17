/**
 * smoke-test-town-entry-11-1.cjs
 * 阶段11.1 城镇入口 v1 冒烟测试
 *
 * 验证流程：
 * MainMenuScene → TownScene → RouteSelectScene → CharacterSelectScene →
 * CargoPrepScene → MapScene
 *
 * 不允许：
 * - 直接调用 scene.start / selectRoute / startExpedition
 * - 直接写 gameState
 * - 绕过真实点击流程
 */
const { chromium } = require("playwright");
const {
  clickGamePoint,
  waitForSceneReady,
  findInteractiveButtonByText,
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
  console.log("阶段11.1 城镇入口 v1 冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleLogs = [];
  page.on("console", msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes("[主菜单]") || text.includes("[城镇]") || text.includes("[商路选择]")) {
      console.log(`  [页面] ${text}`);
    }
  });

  try {
    // ========== 1. 游戏加载 ==========
    console.log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => !!window.game), "window.game 存在");
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "MainMenuScene active");

    // ========== 2. 真实点击主菜单"开始远征" ==========
    console.log("2. 真实点击主菜单'开始远征'");
    const startBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /开始远征|开始游戏/.test(child.text)) {
            btn = { x: child.x, y: child.y };
          }
        }
      });
      return btn;
    });
    mark(startBtn !== null, "主菜单找到'开始远征'按钮");
    if (startBtn) {
      await clickGamePoint(page, { x: startBtn.x, y: startBtn.y }, "主菜单开始远征");
    }
    await sleep(1500);

    // ========== 3. 等待 TownScene ready ==========
    console.log("3. 等待 TownScene ready");
    await waitForSceneReady(page, "TownScene", { minChildren: 5, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "TownScene active");

    // ========== 4. TownScene 显示内容 ==========
    console.log("4. TownScene 显示内容");
    const townContent = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      const texts = [];
      ts.children.each((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(child.text);
        }
      });
      return texts;
    });
    console.log("  TownScene 文本: " + JSON.stringify(townContent));
    mark(townContent !== null, "TownScene 有 children");
    mark(townContent?.some(t => t.includes("灰烬城镇")), "TownScene 显示'灰烬城镇'");
    mark(townContent?.some(t => t.includes("火种") || t.includes("银币") || t.includes("订单") || t.includes("贡献")),
      "TownScene 显示火种/银币/订单/城市贡献信息");

    // ========== 5. TownScene 有设施按钮 ==========
    console.log("5. TownScene 有设施按钮");
    const routeHallBtn = await findInteractiveButtonByText(page, "TownScene", "商路大厅");
    const workshopBtn = await findInteractiveButtonByText(page, "TownScene", "工坊");
    const restHouseBtn = await findInteractiveButtonByText(page, "TownScene", "休整所");
    mark(routeHallBtn !== null, "TownScene 有'商路大厅'按钮");
    mark(workshopBtn !== null, "TownScene 有'工坊'按钮");
    mark(restHouseBtn !== null, "TownScene 有'休整所'按钮");

    // ========== 6. 真实点击"商路大厅"进入 RouteSelectScene ==========
    console.log("6. 真实点击'商路大厅'进入 RouteSelectScene");
    if (routeHallBtn) {
      await clickGamePoint(page, { x: routeHallBtn.x, y: routeHallBtn.y }, "TownScene 商路大厅");
    }
    await waitForSceneReady(page, "RouteSelectScene", { requireRouteCards: true, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "点击'商路大厅'后 RouteSelectScene active");
    mark(await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      return (rs?.routeCards?.length ?? 0) > 0;
    }), "RouteSelectScene routeCards > 0");

    // ========== 7. 真实点击第一张路线卡 ==========
    console.log("7. 真实点击第一张路线卡");
    const routeCardPt = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) return null;
      return { x: rs.routeCards[0].x, y: rs.routeCards[0].y };
    });
    mark(routeCardPt !== null, "RouteSelectScene 找到第一张路线卡");
    if (routeCardPt) {
      await clickGamePoint(page, { x: routeCardPt.x, y: routeCardPt.y }, "路线卡1");
    }
    await sleep(1500);

    // ========== 8. 等待 CharacterSelectScene ==========
    console.log("8. 等待 CharacterSelectScene ready");
    await waitForSceneReady(page, "CharacterSelectScene", { requireCharacterCards: true, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("CharacterSelectScene")), "CharacterSelectScene active");

    // ========== 9. 真实点击 3 张角色卡 ==========
    console.log("9. 真实点击 3 张角色卡");
    const charCards = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
      return [
        { x: cs.characterCards[0].x, y: cs.characterCards[0].y },
        { x: cs.characterCards[1].x, y: cs.characterCards[1].y },
        { x: cs.characterCards[2].x, y: cs.characterCards[2].y },
      ];
    });
    mark(charCards !== null, "CharacterSelectScene 找到 3 张角色卡");
    if (charCards) {
      for (let i = 0; i < 3; i++) {
        await clickGamePoint(page, { x: charCards[i].x, y: charCards[i].y }, "角色卡" + (i + 1));
        await sleep(300);
      }
    }

    // ========== 10. 真实点击 CharacterSelectScene "开始远征" ==========
    console.log("10. 真实点击 CharacterSelectScene '开始远征'");
    const csBtn = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    mark(csBtn !== null, "CharacterSelectScene 找到'开始远征'按钮");
    if (csBtn) {
      await clickGamePoint(page, { x: csBtn.x, y: csBtn.y }, "CharacterSelectScene 开始远征");
    }
    await sleep(1500);

    // ========== 11. 等待 CargoPrepScene ==========
    console.log("11. 等待 CargoPrepScene ready");
    await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("CargoPrepScene")), "CargoPrepScene active");

    // ========== 12. 真实点击 CargoPrepScene "开始远征" ==========
    console.log("12. 真实点击 CargoPrepScene '开始远征'");
    const cpBtn = await findInteractiveButtonByText(page, "CargoPrepScene", "开始远征");
    mark(cpBtn !== null, "CargoPrepScene 找到'开始远征'按钮");
    if (cpBtn) {
      await clickGamePoint(page, { x: cpBtn.x, y: cpBtn.y }, "CargoPrepScene 开始远征");
    }
    await sleep(2000);

    // ========== 13. 等待 MapScene ready ==========
    console.log("13. 等待 MapScene ready");
    await waitForSceneReady(page, "MapScene", { minChildren: 20, timeoutMs: 15000 });
    mark(await page.evaluate(() => window.game.scene.isActive("MapScene")), "MapScene active");
    mark(await page.evaluate(() => {
      const gs = window.getGameState();
      return gs.mapCells && gs.mapCells.length > 0;
    }), "MapScene 有 mapCells");

    // ========== 14. MapScene 可真实移动一步 ==========
    console.log("14. MapScene 真实键盘移动");
    const posBefore = await page.evaluate(() => window.getGameState().currentPosition);
    await page.keyboard.press("ArrowRight");
    await sleep(500);
    const posAfter = await page.evaluate(() => window.getGameState().currentPosition);
    mark(posBefore !== null, "移动前有 currentPosition");
    mark(posAfter !== null, "移动后有 currentPosition");
    mark(
      posBefore && posAfter && (posBefore.x !== posAfter.x || posBefore.y !== posAfter.y),
      "键盘方向键移动成功（currentPosition 变化）"
    );

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.1 城镇入口 v1: ✅ 全部通过");
    } else {
      console.log("阶段11.1 城镇入口 v1: ❌ 有失败项");
    }
    console.log("========================================");
    await browser.close();
    process.exit(failCount > 0 ? 1 : 0);

  } catch (e) {
    console.error(`\n❌ 测试失败: ${e.message}`);
    console.error(`\n测试结果: ${passCount} 通过, ${failCount} 失败`);
    console.error("========================================");
    await browser.close();
    process.exit(1);
  }
}

runTest();
