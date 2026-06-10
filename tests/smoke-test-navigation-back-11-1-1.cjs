/**
 * smoke-test-navigation-back-11-1-1.cjs
 * 阶段11.1.1 场景返回/退出导航冒烟测试
 *
 * 验证返回按钮和 ESC 键在各个场景中的导航功能。
 *
 * 验证流程：
 * 1. TownScene → 返回主菜单 → MainMenuScene
 * 2. RouteSelectScene → 返回城镇 → TownScene
 * 3. CharacterSelectScene → 返回商路 → RouteSelectScene
 * 4. CargoPrepScene → 返回角色选择 → CharacterSelectScene
 * 5. ESC 在各场景的导航
 *
 * 不允许：
 * - 直接调用 scene.start 绕过正常流程
 * - 直接调用 private 方法
 */
const { chromium } = require("playwright");
const {
  clickGamePoint,
  waitForSceneReady,
  findInteractiveButtonByText,
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
  console.log("阶段11.1.1 场景返回/退出导航冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on("console", msg => {
    const text = msg.text();
    if (text.includes("[城镇]") || text.includes("[商路选择]") || text.includes("[角色选择]") || text.includes("[货物整备]")) {
      console.log(`  [页面] ${text}`);
    }
  });

  try {
    // ========== 1. 游戏加载 + MainMenuScene ==========
    console.log("1. 游戏加载 + MainMenuScene");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "MainMenuScene active");

    // ========== 2. 进入 TownScene ==========
    console.log("2. 进入 TownScene");
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
    await waitForSceneReady(page, "TownScene", { minChildren: 5, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "TownScene active");

    // ========== 3. TownScene 返回主菜单（按钮点击）==========
    console.log("3. TownScene 返回主菜单（按钮）");
    const backToMainBtn = await findInteractiveButtonByText(page, "TownScene", "返回主菜单");
    mark(backToMainBtn !== null, "TownScene 找到'返回主菜单'按钮");
    if (backToMainBtn) {
      await clickGamePoint(page, { x: backToMainBtn.x, y: backToMainBtn.y }, "TownScene 返回主菜单");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "点击'返回主菜单'后 MainMenuScene active");

    // ========== 4. 再次进入 TownScene ==========
    console.log("4. 再次进入 TownScene");
    if (startBtn) {
      await clickGamePoint(page, { x: startBtn.x, y: startBtn.y }, "主菜单开始远征(第2次)");
    }
    await waitForSceneReady(page, "TownScene", { minChildren: 5, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "再次进入 TownScene active");

    // ========== 5. TownScene → 查看商路 → RouteSelectScene ==========
    console.log("5. TownScene → 查看商路 → RouteSelectScene");
    const seeRoutesBtn = await findInteractiveButtonByText(page, "TownScene", "查看商路");
    mark(seeRoutesBtn !== null, "TownScene 找到'查看商路'按钮");
    if (seeRoutesBtn) {
      await clickGamePoint(page, { x: seeRoutesBtn.x, y: seeRoutesBtn.y }, "TownScene 查看商路");
    }
    await waitForSceneReady(page, "RouteSelectScene", { requireRouteCards: true, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "RouteSelectScene active");

    // ========== 6. RouteSelectScene 返回城镇（按钮点击）==========
    console.log("6. RouteSelectScene 返回城镇（按钮）");
    const backToTownBtn = await findInteractiveButtonByText(page, "RouteSelectScene", "返回城镇");
    mark(backToTownBtn !== null, "RouteSelectScene 找到'返回城镇'按钮");
    if (backToTownBtn) {
      await clickGamePoint(page, { x: backToTownBtn.x, y: backToTownBtn.y }, "RouteSelectScene 返回城镇");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "点击'返回城镇'后 TownScene active");

    // ========== 7. 再次进入 RouteSelectScene + 选择路线 ==========
    console.log("7. 再次进入 RouteSelectScene + 选择路线");
    const seeRoutesBtn2 = await findInteractiveButtonByText(page, "TownScene", "查看商路");
    if (seeRoutesBtn2) {
      await clickGamePoint(page, { x: seeRoutesBtn2.x, y: seeRoutesBtn2.y }, "TownScene 查看商路(第2次)");
    }
    await waitForSceneReady(page, "RouteSelectScene", { requireRouteCards: true, timeoutMs: 10000 });

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

    // ========== 8. CharacterSelectScene 返回商路（按钮点击）==========
    console.log("8. CharacterSelectScene 返回商路（按钮）");
    await waitForSceneReady(page, "CharacterSelectScene", { requireCharacterCards: true, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("CharacterSelectScene")), "CharacterSelectScene active");

    const backToRouteBtn = await findInteractiveButtonByText(page, "CharacterSelectScene", "返回商路");
    mark(backToRouteBtn !== null, "CharacterSelectScene 找到'返回商路'按钮");
    if (backToRouteBtn) {
      await clickGamePoint(page, { x: backToRouteBtn.x, y: backToRouteBtn.y }, "CharacterSelectScene 返回商路");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "点击'返回商路'后 RouteSelectScene active");

    // ========== 9. 再次选择路线 + 选角色 + 进入 CargoPrepScene ==========
    console.log("9. 再次选择路线 + 选角色 + 进入 CargoPrepScene");
    const routeCardPt2 = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) return null;
      return { x: rs.routeCards[0].x, y: rs.routeCards[0].y };
    });
    if (routeCardPt2) {
      await clickGamePoint(page, { x: routeCardPt2.x, y: routeCardPt2.y }, "路线卡1(第2次)");
    }
    await sleep(1500);

    await waitForSceneReady(page, "CharacterSelectScene", { requireCharacterCards: true, timeoutMs: 10000 });
    const charCards = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
      return [
        { x: cs.characterCards[0].x, y: cs.characterCards[0].y },
        { x: cs.characterCards[1].x, y: cs.characterCards[1].y },
        { x: cs.characterCards[2].x, y: cs.characterCards[2].y },
      ];
    });
    if (charCards) {
      for (let i = 0; i < 3; i++) {
        await clickGamePoint(page, { x: charCards[i].x, y: charCards[i].y }, "角色卡" + (i + 1));
        await sleep(300);
      }
    }

    const csBtn = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    if (csBtn) {
      await clickGamePoint(page, { x: csBtn.x, y: csBtn.y }, "CharacterSelectScene 开始远征");
    }
    await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("CargoPrepScene")), "CargoPrepScene active");

    // ========== 10. CargoPrepScene 返回角色选择（按钮点击）==========
    console.log("10. CargoPrepScene 返回角色选择（按钮）");
    const backToCharBtn = await findInteractiveButtonByText(page, "CargoPrepScene", "返回角色选择");
    mark(backToCharBtn !== null, "CargoPrepScene 找到'返回角色选择'按钮");
    if (backToCharBtn) {
      await clickGamePoint(page, { x: backToCharBtn.x, y: backToCharBtn.y }, "CargoPrepScene 返回角色选择");
    }
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("CharacterSelectScene")), "点击'返回角色选择'后 CharacterSelectScene active");

    // ========== 11. ESC 在 CargoPrepScene 返回角色选择 ==========
    console.log("11. ESC 在 CargoPrepScene 返回角色选择");
    // 重新进入 CargoPrepScene
    const csBtn2 = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    if (csBtn2) {
      await clickGamePoint(page, { x: csBtn2.x, y: csBtn2.y }, "CharacterSelectScene 开始远征(第2次)");
    }
    await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 10000 });
    mark(await page.evaluate(() => window.game.scene.isActive("CargoPrepScene")), "CargoPrepScene active (ESC测试前)");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("CharacterSelectScene")), "ESC 在 CargoPrepScene 返回 CharacterSelectScene");

    // ========== 12. ESC 在 CharacterSelectScene 返回商路 ==========
    console.log("12. ESC 在 CharacterSelectScene 返回商路");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "ESC 在 CharacterSelectScene 返回 RouteSelectScene");

    // ========== 13. ESC 在 RouteSelectScene 返回城镇 ==========
    console.log("13. ESC 在 RouteSelectScene 返回城镇");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "ESC 在 RouteSelectScene 返回 TownScene");

    // ========== 14. ESC 在 TownScene 返回主菜单 ==========
    console.log("14. ESC 在 TownScene 返回主菜单");
    await page.keyboard.press("Escape");
    await sleep(1500);
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "ESC 在 TownScene 返回 MainMenuScene");

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段11.1.1 场景返回/退出导航: ✅ 全部通过");
    } else {
      console.log("阶段11.1.1 场景返回/退出导航: ❌ 有失败项");
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
