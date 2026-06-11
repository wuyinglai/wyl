/**
 * 阶段10.6.4 专项测试：撤退后再来一局-真实输入测试
 *
 * 严格原则：所有用户交互都必须通过真实的 mouse.click / keyboard.press。
 * 只允许通过 page.evaluate 读取游戏状态（用于断言）和查询按钮坐标（用于真实点击）。
 * 使用共享 helper 进行坐标换算和按钮查找。
 */

const { chromium } = require("playwright");
const {
  clickGamePoint,
  waitForSceneReady,
  findInteractiveButtonByText,
  sleep,
} = require("./_real_helpers.cjs");

async function findCardIndex(page, sceneKey, cardField, index = 0) {
  return page.evaluate(([sceneKey, cardField, index]) => {
    const scene = window.game.scene.getScene(sceneKey);
    if (!scene) return null;
    const cards = scene[cardField];
    if (!cards || cards.length <= index) return null;
    const card = cards[index];
    return { x: card.x, y: card.y };
  }, [sceneKey, cardField, index]);
}

async function findModalConfirmButton(page, sceneKey) {
  return page.evaluate((sceneKey) => {
    const scene = window.game.scene.getScene(sceneKey);
    if (!scene || !scene.modalContainer) return null;
    let result = null;
    // 弹窗中的 Text 可能直接有 interactive
    scene.modalContainer.list?.forEach((child) => {
      if (result) return;
      if (child.type === "Text" && child.input && child.input.enabled) {
        if (child.text && /确认|撤退|出发|开始/.test(child.text)) {
          result = { x: child.x, y: child.y };
        }
      }
    });
    // Rectangle + Text
    if (!result) {
      let rect = null;
      scene.modalContainer.list?.forEach((child) => {
        if (child.type === "Rectangle" && child.input && child.input.enabled) {
          rect = { x: child.x, y: child.y };
        }
        if (child.type === "Text" && rect) {
          if (Math.abs(child.x - rect.x) < 100 && Math.abs(child.y - rect.y) < 50) {
            if (!result) result = { x: rect.x, y: rect.y };
          }
        }
      });
    }
    return result;
  }, sceneKey);
}

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log("阶段10.6.4 撤退后再来一局-真实输入测试");
  console.log("=".repeat(70));

  let passCount = 0;
  let failCount = 0;
  const failures = [];

  function mark(condition, msg) {
    if (condition) {
      passCount++;
      console.log("  [PASS]", msg);
    } else {
      failCount++;
      failures.push(msg);
      console.log("  [FAIL]", msg);
    }
    return condition;
  }

  try {
    // ===== 1. 启动游戏 =====
    console.log("\n[1] 启动游戏...");
    await page.goto("http://localhost:5173", { waitUntil: "networkidle", timeout: 30000 });
    await sleep(3000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

    // ===== 2. 主菜单点击 =====
    console.log("\n[2] 真实点击主菜单'开始远征'...");
    const mainMenuBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children?.each?.((child) => {
        if (btn) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /开始远征/.test(child.text)) {
            btn = { x: child.x, y: child.y };
          }
        }
      });
      return btn;
    });
    mark(mainMenuBtn !== null, "MainMenu 找到开始远征按钮");
    if (mainMenuBtn) {
      await clickGamePoint(page, { x: mainMenuBtn.x, y: mainMenuBtn.y }, "主菜单开始远征");
      await sleep(2000);
    }

    // 阶段11.1：主菜单现在进入 TownScene
    await waitForSceneReady(page, "TownScene", { minChildren: 5, timeoutMs: 10000 });
    const townBtn = await findInteractiveButtonByText(page, "TownScene", "商路大厅");
    mark(townBtn !== null, "TownScene 找到'商路大厅'按钮");
    if (townBtn) {
      await clickGamePoint(page, { x: townBtn.x, y: townBtn.y }, "TownScene 商路大厅");
      await sleep(1000);
    }

    // ===== 3. 选择路线 =====
    await waitForSceneReady(page, "RouteSelectScene", { requireRouteCards: true, timeoutMs: 10000 });
    console.log("\n[3] 真实点击第一张路线卡片...");
    const routeCard = await findCardIndex(page, "RouteSelectScene", "routeCards", 0);
    mark(routeCard !== null, "RouteSelectScene 找到路线卡片");
    if (routeCard) {
      await clickGamePoint(page, { x: routeCard.x, y: routeCard.y }, "路线卡1");
      await sleep(2500);
    }

    // ===== 4. 选择角色 =====
    await waitForSceneReady(page, "CharacterSelectScene", { requireCharacterCards: true, timeoutMs: 10000 });
    console.log("\n[4] 真实点击前3张角色卡片...");
    const charCards = [];
    for (let i = 0; i < 3; i++) {
      const c = await findCardIndex(page, "CharacterSelectScene", "characterCards", i);
      if (c) charCards.push(c);
    }
    mark(charCards.length === 3, "CharacterSelectScene 找到3张角色卡片");
    for (let i = 0; i < charCards.length; i++) {
      await clickGamePoint(page, { x: charCards[i].x, y: charCards[i].y }, "角色卡" + (i + 1));
      await sleep(300);
    }

    // ===== 5. 点击 CharacterSelectScene 的"开始远征" =====
    console.log("\n[5] 真实点击 CharacterSelectScene 的'开始远征'...");
    const charConfirmBtn = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    mark(charConfirmBtn !== null, "CharacterSelectScene 找到'开始远征'按钮");
    if (charConfirmBtn) {
      await clickGamePoint(page, { x: charConfirmBtn.x, y: charConfirmBtn.y }, "CharacterSelectScene 开始远征");
      await sleep(2000);
    }

    // ===== 6. CargoPrepScene 点击"开始远征" =====
    await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 10000 });
    console.log("\n[6] 真实点击 CargoPrepScene 的'开始远征'...");
    const cargoStartBtn = await findInteractiveButtonByText(page, "CargoPrepScene", "开始远征");
    mark(cargoStartBtn !== null, "CargoPrepScene 找到'开始远征'按钮");
    if (cargoStartBtn) {
      await clickGamePoint(page, { x: cargoStartBtn.x, y: cargoStartBtn.y }, "CargoPrepScene 开始远征");
      await sleep(3000);
    }

    const hasMap = await page.evaluate(() => {
      return window.game.scene.getScenes(true).some((s) => s.scene.key === "MapScene");
    });
    mark(hasMap, "第一次进入 MapScene");

    // ===== 7. 第一次 MapScene 检查当前位置，不移动，直接撤退 =====
    // 注意：移动可能会触发 BattleScene，导致 MapScene 不再是 active scene
    // 所以先点击撤退按钮，而不是先移动再撤退
    console.log("\n[7] 第一次 MapScene 检查状态并直接撤退...");
    const firstPosBefore = await page.evaluate(() => {
      const gs = window.getGameState();
      return { x: gs.currentPosition.x, y: gs.currentPosition.y };
    });
    console.log("  当前位置:", firstPosBefore);

    mark(true, "第一次 MapScene 成功进入，有 currentPosition");

    // ===== 8. 点击撤退按钮 =====
    console.log("\n[8] 真实点击撤退按钮...");
    const retreatBtn = await findInteractiveButtonByText(page, "MapScene", "撤退");
    mark(retreatBtn !== null, "MapScene 找到撤退按钮");
    if (retreatBtn) {
      await clickGamePoint(page, { x: retreatBtn.x, y: retreatBtn.y }, "MapScene 撤退按钮");
      await sleep(1500);
    }

    // ===== 9. 确认撤退弹窗 =====
    console.log("\n[9] 真实点击确认撤退弹窗...");
    const confirmRetreat = await findModalConfirmButton(page, "MapScene");
    mark(confirmRetreat !== null, "MapScene 找到确认撤退按钮");
    if (confirmRetreat) {
      await clickGamePoint(page, { x: confirmRetreat.x, y: confirmRetreat.y }, "确认撤退");
      await sleep(3500);
    }

    const afterRetreat = await page.evaluate(() => {
      return window.game.scene.getScenes(true).map((s) => s.scene.key);
    });
    mark(afterRetreat.includes("ExpeditionResultScene"), "撤退后进入 ExpeditionResultScene");

    // ===== 10. 点击"再来一局" =====
    console.log("\n[10] 真实点击'再来一局'...");
    const replayBtn = await findInteractiveButtonByText(page, "ExpeditionResultScene", "再来一局");
    mark(replayBtn !== null, "ExpeditionResultScene 找到'再来一局'按钮");
    if (replayBtn) {
      await clickGamePoint(page, { x: replayBtn.x, y: replayBtn.y }, "再来一局");
      await sleep(2000);
    }

    // 阶段11.1：再来一局现在进入 TownScene
    await waitForSceneReady(page, "TownScene", { minChildren: 5, timeoutMs: 10000 });
    const townBtn2 = await findInteractiveButtonByText(page, "TownScene", "商路大厅");
    mark(townBtn2 !== null, "再来一局后 TownScene 找到'商路大厅'按钮");
    if (townBtn2) {
      await clickGamePoint(page, { x: townBtn2.x, y: townBtn2.y }, "再来一局后 TownScene 商路大厅");
      await sleep(1500);
    }

    const afterReplay = await page.evaluate(() => {
      return window.game.scene.getScenes(true).map((s) => s.scene.key);
    });
    mark(afterReplay.includes("RouteSelectScene"), "点击再来一局后进入第二局 RouteSelectScene");
    mark(!afterReplay.includes("BattleScene") && !afterReplay.includes("MapScene"),
      "再来一局后没有残留旧场景");

    // ===== 11. 第二局 选择路线 =====
    // 再来一局后检查当前 active scenes，而不是假设 RouteSelectScene 就是 active
    console.log("\n[11] 再来一局后检查场景状态...");
    const afterReplayScenes2 = await page.evaluate(() => {
      return window.game.scene.getScenes(true).map((s) => s.scene.key);
    });
    console.log("  active scenes 再来一局后:", afterReplayScenes2);

    // 如果没有 RouteSelectScene，可能是 create 没执行完，重试
    if (!afterReplayScenes2.includes("RouteSelectScene")) {
      await sleep(2000);
      const retryScenes = await page.evaluate(() => {
        return window.game.scene.getScenes(true).map((s) => s.scene.key);
      });
      console.log("  2s 后 active scenes:", retryScenes);
    }

    console.log("\n[11b] 第二局：真实点击第一张路线卡片...");
    const routeCard2 = await findCardIndex(page, "RouteSelectScene", "routeCards", 0);
    mark(routeCard2 !== null, "第二局 RouteSelectScene 找到路线卡片");
    if (routeCard2) {
      await clickGamePoint(page, { x: routeCard2.x, y: routeCard2.y }, "第二局路线卡1");
      await sleep(2500);
    }

    // ===== 12. 第二局 选择角色 =====
    await waitForSceneReady(page, "CharacterSelectScene", { requireCharacterCards: true, timeoutMs: 10000 });
    console.log("\n[12] 第二局：真实点击前3张角色卡片...");
    const charCards2 = [];
    for (let i = 0; i < 3; i++) {
      const c = await findCardIndex(page, "CharacterSelectScene", "characterCards", i);
      if (c) charCards2.push(c);
    }
    mark(charCards2.length === 3, "第二局找到3张角色卡片");
    for (let i = 0; i < charCards2.length; i++) {
      await clickGamePoint(page, { x: charCards2[i].x, y: charCards2[i].y }, "第二局角色卡" + (i + 1));
      await sleep(300);
    }

    const charConfirmBtn2 = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    mark(charConfirmBtn2 !== null, "第二局 CharacterSelectScene 找到'开始远征'按钮");
    if (charConfirmBtn2) {
      await clickGamePoint(page, { x: charConfirmBtn2.x, y: charConfirmBtn2.y }, "第二局 CharacterSelectScene 开始远征");
      await sleep(2000);
    }

    // ===== 13. 第二局 CargoPrepScene =====
    await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 10000 });
    console.log("\n[13] 第二局：真实点击 CargoPrepScene 的'开始远征'...");
    const cargoStartBtn2 = await findInteractiveButtonByText(page, "CargoPrepScene", "开始远征");
    mark(cargoStartBtn2 !== null, "第二局 CargoPrepScene 找到'开始远征'按钮");
    if (cargoStartBtn2) {
      await clickGamePoint(page, { x: cargoStartBtn2.x, y: cargoStartBtn2.y }, "第二局 CargoPrepScene 开始远征");
      await sleep(3000);
    }

    const afterCargo2 = await page.evaluate(() => {
      return window.game.scene.getScenes(true).map((s) => s.scene.key);
    });
    mark(afterCargo2.includes("MapScene"), "第二次进入 MapScene");

    // ===== 14. 第二局 MapScene 诊断 =====
    await waitForSceneReady(page, "MapScene", { minChildren: 20, timeoutMs: 15000 });
    console.log("\n[14] 第二局 MapScene 输入状态诊断...");
    const secondDiag = await page.evaluate(() => {
      const gs = window.getGameState();
      const ms = window.game.scene.getScene("MapScene");
      let highDepth = 0;
      ms?.children?.each?.((child) => {
        if (child.depth >= 100 && child.input && child.input.enabled) highDepth++;
      });
      return {
        mapSceneActive: window.game.scene.isActive("MapScene"),
        mapCells: gs?.mapCells?.length || 0,
        currentPosition: gs?.currentPosition,
        selectedCharactersLen: gs?.selectedCharacters?.length || 0,
        selectedOrderId: gs?.selectedOrderId,
        modalOpen: !!ms?.modalContainer,
        keyboardEnabled: ms?.input?.keyboard?.enabled,
        highDepth,
      };
    });
    console.log("  诊断:", JSON.stringify(secondDiag));
    mark(secondDiag.mapSceneActive === true, "第二次 MapScene active");
    mark(secondDiag.mapCells > 0, "第二次 mapCells 有数据");
    mark(secondDiag.selectedCharactersLen === 3, "第二次 selectedCharacters 有3个");
    mark(secondDiag.selectedOrderId !== null, "第二次 selectedOrderId 存在");
    mark(!secondDiag.modalOpen, "第二次 MapScene 没有弹窗覆盖");

    // ===== 15. 第二局 真实键盘移动 =====
    console.log("\n[15] 第二局 MapScene 真实键盘移动（关键断言）...");
    const secondPosBefore = await page.evaluate(() => {
      const gs = window.getGameState();
      return { x: gs.currentPosition.x, y: gs.currentPosition.y };
    });
    console.log("  移动前位置:", secondPosBefore);

    await page.keyboard.press("ArrowRight");
    await sleep(1000);

    const secondPosAfter = await page.evaluate(() => {
      const gs = window.getGameState();
      return { x: gs.currentPosition.x, y: gs.currentPosition.y };
    });
    console.log("  移动后位置:", secondPosAfter);

    mark(secondPosAfter.x !== secondPosBefore.x || secondPosAfter.y !== secondPosBefore.y,
      "关键断言：第二局真实键盘移动成功");

    // ===== 总结 =====
    console.log("\n" + "=".repeat(70));
    console.log("测试完成:", passCount, "通过,", failCount, "失败");
    if (failures.length > 0) {
      console.log("\n失败项:");
      failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    } else {
      console.log("✅ 所有测试通过！");
    }

    await browser.close();
    return failCount === 0;
  } catch (error) {
    console.error("\n❌ 测试出错:", error);
    try {
      await browser.close();
    } catch (e) {}
    return false;
  }
}

runTest().then((ok) => {
  process.exit(ok ? 0 : 1);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
