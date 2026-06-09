/**
 * 阶段10.6.4 最小验证测试：
 * 真实点击主菜单"开始远征"按钮 → 验证进入 RouteSelectScene
 *
 * 关键目标：
 * 1. 不把 Phaser 坐标直接当浏览器坐标 page.mouse.click
 * 2. 证明主菜单真实点击可进入 RouteSelectScene
 * 3. 证明 waitForSceneReady 不再只用 getScene 判断
 */

const { chromium } = require("playwright");
const assert = require("assert");
const { clickGamePoint, waitForSceneReady, gameToScreen } = require("./_real_helpers.cjs");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log("阶段10.6.4 最小验证测试：主菜单真实点击 → RouteSelectScene");
  console.log("====================================================================");

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // 1. 打开游戏
    console.log("\n[1] 打开游戏...");
    await page.goto("http://localhost:5173/");
    await page.waitForFunction(() => window.game && window.game.scene);
    console.log("  window.game 存在 ✓");

    // 2. 等待 MainMenuScene ready
    console.log("\n[2] 等待 MainMenuScene ready...");
    const mmReady = await waitForSceneReady(page, "MainMenuScene", { minChildren: 1 });
    console.log("  MainMenuScene active: ✓");

    // 3. 找到"开始远征"按钮
    console.log("\n[3] 查找主菜单可交互按钮...");
    const startBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm || !mm.children) return null;
      let result = null;
      mm.children.each((child) => {
        if (result) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /开始远征|开始游戏/.test(child.text)) {
            result = {
              x: child.x,
              y: child.y,
              text: child.text,
              visible: child.visible,
              alpha: child.alpha,
              depth: child.depth,
              inputEnabled: child.input.enabled,
            };
          }
        }
      });
      return result;
    });
    assert(startBtn !== null, "MainMenuScene 找到'开始远征'按钮");
    console.log("  按钮 Phaser 坐标: (" + startBtn.x + ", " + startBtn.y + ")");

    // 4. 坐标换算 + 真实点击
    console.log("\n[4] 坐标换算 → 真实点击...");
    const screenBefore = await gameToScreen(page, { x: startBtn.x, y: startBtn.y });
    console.log("  canvas rect: left=" + Math.round(screenBefore.rect.left) + " top=" + Math.round(screenBefore.rect.top) +
      " width=" + Math.round(screenBefore.rect.width) + " height=" + Math.round(screenBefore.rect.height));
    console.log("  game size: " + screenBefore.gameWidth + "x" + screenBefore.gameHeight);
    console.log("  canvas size: " + screenBefore.canvasWidth + "x" + screenBefore.canvasHeight);
    console.log("  devicePixelRatio: " + screenBefore.devicePixelRatio);
    console.log("  转换后 screen 坐标: (" + Math.round(screenBefore.x) + ", " + Math.round(screenBefore.y) + ")");

    await clickGamePoint(page, { x: startBtn.x, y: startBtn.y }, "主菜单开始按钮");

    // 5. 等待 RouteSelectScene ready
    console.log("\n[5] 等待 RouteSelectScene ready...");
    const rsReady = await waitForSceneReady(page, "RouteSelectScene", {
      minChildren: 5,
      requireRouteCards: true,
      timeoutMs: 8000,
    });
    console.log("  RouteSelectScene active: ✓");
    console.log("  childrenCount: " + rsReady.childrenCount);
    console.log("  routeCardsLength: " + rsReady.routeCardsLength);

    // 6. 断言
    console.log("\n[6] 断言...");
    assert(rsReady.isActive === true, "RouteSelectScene 必须 active");
    assert(rsReady.childrenCount > 0, "RouteSelectScene 必须有 children");
    assert(rsReady.routeCardsLength > 0, "RouteSelectScene 必须有 routeCards");
    assert(
      rsReady.activeScenes.includes("RouteSelectScene"),
      "activeScenes 必须包含 RouteSelectScene"
    );

    // 7. 查找第一张路线卡
    console.log("\n[7] 查找第一张路线卡...");
    const routeCard = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) return null;
      const card = rs.routeCards[0];
      return {
        x: card.x,
        y: card.y,
        hasInteractive: card.input && card.input.enabled,
        visible: card.visible,
      };
    });
    assert(routeCard !== null, "RouteSelectScene 找到第一张路线卡");
    console.log("  路线卡 Phaser 坐标: (" + routeCard.x + ", " + routeCard.y + ")");
    console.log("  hasInteractive: " + routeCard.hasInteractive);

    // 8. 真实点击路线卡 → 进入 CharacterSelectScene
    console.log("\n[8] 真实点击路线卡...");
    await clickGamePoint(page, { x: routeCard.x, y: routeCard.y }, "第一张路线卡");

    console.log("\n[9] 等待 CharacterSelectScene ready...");
    const csReady = await waitForSceneReady(page, "CharacterSelectScene", {
      minChildren: 5,
      requireCharacterCards: true,
      timeoutMs: 8000,
    });
    assert(csReady.isActive === true, "CharacterSelectScene 必须 active");
    assert(csReady.characterCardsLength > 0, "CharacterSelectScene 必须有角色卡片");
    console.log("  CharacterSelectScene active ✓");
    console.log("  characterCardsLength: " + csReady.characterCardsLength);

    console.log("\n===== 最小验证测试通过 ✓ ✓ ✓ =====");
    console.log("主菜单真实点击成功进入 RouteSelectScene");
    console.log("RouteSelectScene routeCards > 0");
    console.log("路线卡真实点击成功进入 CharacterSelectScene");

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.log("\n===== 测试失败 =====");
    console.log(err);

    try {
      const diag = await page.evaluate(() => {
        return {
          activeScenes: window.game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key),
          mm: (() => {
            const s = window.game.scene.getScene("MainMenuScene");
            return s ? { active: s.scene.isActive(), children: s.children?.list?.length || 0 } : null;
          })(),
          rs: (() => {
            const s = window.game.scene.getScene("RouteSelectScene");
            return s ? { active: s.scene.isActive(), children: s.children?.list?.length || 0, routeCards: s.routeCards?.length || 0 } : null;
          })(),
          canvasRect: (() => {
            const c = document.querySelector("canvas");
            if (!c) return null;
            const r = c.getBoundingClientRect();
            return { left: r.left, top: r.top, width: r.width, height: r.height, cw: c.width, ch: c.height };
          })(),
          gameSize: {
            w: window.game?.scale?.gameSize?.width ?? window.game?.config?.width,
            h: window.game?.scale?.gameSize?.height ?? window.game?.config?.height,
          },
          dpr: window.devicePixelRatio,
        };
      });
      console.log("\n[诊断信息]");
      console.log(JSON.stringify(diag, null, 2));
    } catch (e) {
      console.log("诊断失败: " + e);
    }

    await browser.close();
    process.exit(1);
  }
})();
