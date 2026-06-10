/**
 * 阶段10.6.4 完整真实流程测试：主菜单 → 路线选择 → 角色选择 → 货物准备 →
 *                              MapScene → 撤退 → 再来一局 → 重新走一遍
 *
 * 严格规则：
 * - 所有点击都用 clickGamePoint（Phaser 坐标 → 浏览器坐标）
 * - 不允许直接调用 scene.start / selectRoute / startExpedition
 * - 不允许直接修改 GameState
 * - 不允许用 page.evaluate 直接调用内部流程函数
 * - 只允许通过 page.evaluate 读取状态和查询按钮坐标
 */

const { chromium } = require("playwright");
const assert = require("assert");
const { clickGamePoint, waitForSceneReady, findInteractiveButtonByText } = require("./_real_helpers.cjs");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function findButtonByText(page, sceneKey, textPattern) {
  return await page.evaluate(([sceneKey, textPatternStr]) => {
    const scene = window.game.scene.getScene(sceneKey);
    if (!scene) return null;
    const pattern = new RegExp(textPatternStr);
    let result = null;
    // 情形 A：Text 本身有 setInteractive
    scene.children?.each?.((child) => {
      if (result) return;
      if (child.type === "Text" && child.input && child.input.enabled) {
        if (child.text && pattern.test(child.text)) {
          result = { x: child.x, y: child.y, text: child.text };
        }
      }
    });
    // 情形 B：Container 是按钮，子元素包含匹配文字
    if (!result) {
      scene.children?.each?.((child) => {
        if (result) return;
        if (child.type !== "Text" && child.input && child.input.enabled) {
          if (child.list) {
            for (const sub of child.list) {
              if (sub.type === "Text" && sub.text && pattern.test(sub.text)) {
                result = { x: child.x, y: child.y, text: sub.text };
                break;
              }
            }
          }
        }
      });
    }
    // 情形 C：Rectangle 是按钮 (input enabled)，旁边/同位置有匹配 Text
    if (!result) {
      let rectBtn = null;
      let matchText = null;
      scene.children?.each?.((child) => {
        if (result) return;
        if (child.type === "Rectangle" && child.input && child.input.enabled) {
          rectBtn = { x: child.x, y: child.y };
        }
        if (child.type === "Text" && child.text && pattern.test(child.text)) {
          matchText = { x: child.x, y: child.y, text: child.text };
        }
        if (rectBtn && matchText && !result) {
          if (Math.abs(rectBtn.x - matchText.x) < 30 && Math.abs(rectBtn.y - matchText.y) < 30) {
            result = { x: rectBtn.x, y: rectBtn.y, text: matchText.text };
          }
        }
      });
    }
    return result;
  }, [sceneKey, textPattern]);
}

async function findModalButton(page, sceneKey) {
  return page.evaluate((sceneKey) => {
    const scene = window.game.scene.getScene(sceneKey);
    if (!scene || !scene.modalContainer) return null;
    let result = null;
    // 弹窗中的 Text 本身有 setInteractive()，直接在 modalContainer 列表里找
    scene.modalContainer.list?.forEach((child) => {
      if (result) return;
      if (child.type === "Text" && child.input && child.input.enabled) {
        if (child.text && (/确认|撤退|出发|开始/.test(child.text))) {
          result = { x: child.x, y: child.y, text: child.text };
        }
      }
    });
    // 如果没找到（可能是另一种容器结构），尝试递归找
    if (!result) {
      scene.modalContainer.list?.forEach((child) => {
        if (result) return;
        if (child.type !== "Text" && child.list) {
          child.list?.forEach((sub) => {
            if (result) return;
            if (sub.type === "Text" && sub.input && sub.input.enabled) {
              if (sub.text && /确认|撤退|出发|开始/.test(sub.text)) {
                result = { x: sub.x, y: sub.y, text: sub.text };
              }
            }
          });
        }
      });
    }
    return result;
  }, sceneKey);
}

async function main() {
  console.log("阶段10.6.4 完整真实流程测试：撤退 → 再来一局 → 第二局真实输入移动");
  console.log("=".repeat(80));

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // 1. 启动游戏
    console.log("\n[1] 启动游戏...");
    await page.goto("http://localhost:5173/");
    await page.waitForFunction(() => window.game && window.game.scene);

    // 2. 真实点击主菜单"开始远征"
    console.log("\n[2] 真实点击主菜单'开始远征'...");
    await waitForSceneReady(page, "MainMenuScene", { minChildren: 1 });
    const startBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children?.each?.((child) => {
        if (btn) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /开始远征|开始游戏/.test(child.text)) {
            btn = { x: child.x, y: child.y, text: child.text };
          }
        }
      });
      return btn;
    });
    assert(startBtn !== null, "主菜单找到开始远征按钮");
    await clickGamePoint(page, { x: startBtn.x, y: startBtn.y }, "主菜单开始远征");
    await sleep(1500);

    // 阶段11.1：主菜单现在进入 TownScene，等待 TownScene ready
    console.log("  [TownScene] 等待 TownScene ready...");
    await waitForSceneReady(page, "TownScene", { minChildren: 5, timeoutMs: 8000 });
    // 真实点击 TownScene 的"查看商路"
    const townBtn = await findInteractiveButtonByText(page, "TownScene", "查看商路");
    assert(townBtn !== null, "TownScene 找到'查看商路'按钮");
    await clickGamePoint(page, { x: townBtn.x, y: townBtn.y }, "TownScene 查看商路");
    await sleep(1000);

    // 3. 等待 RouteSelectScene ready + 真实点击第一张路线卡
    console.log("\n[3] 真实点击第一张路线卡片...");
    const rsReady = await waitForSceneReady(page, "RouteSelectScene", {
      minChildren: 5, requireRouteCards: true, timeoutMs: 8000,
    });
    assert(rsReady.isActive && rsReady.routeCardsLength > 0, "RouteSelectScene 已 ready");

    const routeCard = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      const card = rs?.routeCards?.[0];
      return card ? { x: card.x, y: card.y } : null;
    });
    assert(routeCard !== null, "找到第一张路线卡");
    await clickGamePoint(page, { x: routeCard.x, y: routeCard.y }, "第一张路线卡");
    await sleep(1500);

    // 4. 等待 CharacterSelectScene ready + 真实点击 3 个角色卡
    console.log("\n[4] 真实点击前3张角色卡片...");
    await waitForSceneReady(page, "CharacterSelectScene", {
      minChildren: 5, requireCharacterCards: true, timeoutMs: 8000,
    });
    const charCards = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
      return [{ x: cs.characterCards[0].x, y: cs.characterCards[0].y },
              { x: cs.characterCards[1].x, y: cs.characterCards[1].y },
              { x: cs.characterCards[2].x, y: cs.characterCards[2].y }];
    });
    assert(charCards && charCards.length === 3, "CharacterSelectScene 找到3张角色卡");
    for (let i = 0; i < 3; i++) {
      await clickGamePoint(page, { x: charCards[i].x, y: charCards[i].y }, "角色卡" + (i + 1));
      await sleep(300);
    }

    // 5. 真实点击 CharacterSelectScene 的"开始远征"
    console.log("\n[5] 真实点击 CharacterSelectScene 的'开始远征'...");
    const charConfirmBtn = await findButtonByText(page, "CharacterSelectScene", "开始远征");
    assert(charConfirmBtn !== null, "CharacterSelectScene 找到'开始远征'按钮");
    await clickGamePoint(page, { x: charConfirmBtn.x, y: charConfirmBtn.y }, "CharacterSelectScene 开始远征");
    await sleep(1500);

    // 6. CargoPrepScene 真实点击"开始远征"
    console.log("\n[6] 真实点击 CargoPrepScene 的'开始远征'...");
    await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 8000 });
    const cargoStartBtn = await findButtonByText(page, "CargoPrepScene", "开始远征");
    assert(cargoStartBtn !== null, "CargoPrepScene 找到'开始远征'按钮");
    await clickGamePoint(page, { x: cargoStartBtn.x, y: cargoStartBtn.y }, "CargoPrepScene 开始远征");
    await sleep(2000);

    // 7. 等待 MapScene ready + 第一次真实键盘移动
    console.log("\n[7] 等待 MapScene ready...");
    await waitForSceneReady(page, "MapScene", { minChildren: 5, timeoutMs: 10000 });
    const firstPosBefore = await page.evaluate(() => {
      const gs = window.getGameState();
      return { x: gs.currentPosition.x, y: gs.currentPosition.y };
    });
    console.log("  移动前位置:", firstPosBefore);
    await page.keyboard.press("ArrowRight");
    await sleep(1200);
    const firstPosAfter = await page.evaluate(() => {
      const gs = window.getGameState();
      return { x: gs.currentPosition.x, y: gs.currentPosition.y };
    });
    console.log("  移动后位置:", firstPosAfter);
    assert(
      firstPosAfter.x !== firstPosBefore.x || firstPosAfter.y !== firstPosBefore.y,
      "第一次 MapScene 真实键盘移动成功"
    );

    // 8. 真实点击撤退按钮（MapScene 撤退按钮是矩形+文字，rectangle 有 interactive）
    console.log("\n[8] 真实点击撤退按钮...");
    const retreatBtn = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return null;
      let result = null;
      // 先找：Container 是按钮，子元素有"撤退"文字
      ms.children?.each?.((child) => {
        if (result) return;
        if (child.type !== "Text" && child.input && child.input.enabled) {
          if (child.list) {
            for (const sub of child.list) {
              if (sub.type === "Text" && sub.text && /撤退/.test(sub.text)) {
                result = { x: child.x, y: child.y };
                break;
              }
            }
          }
        }
      });
      // 再找：Rectangle 是按钮 (input enabled)，相邻兄弟有"撤退" Text
      if (!result) {
        let rectBtn = null;
        let retreatText = null;
        ms.children?.each?.((child) => {
          if (child.type === "Rectangle" && child.input && child.input.enabled) {
            rectBtn = { x: child.x, y: child.y };
          }
          if (child.type === "Text" && child.text && /撤退$/.test(child.text) && child.text.length <= 4) {
            retreatText = { x: child.x, y: child.y };
          }
          if (rectBtn && retreatText && !result) {
            // 检查是否在相近位置（同一个按钮）
            if (Math.abs(rectBtn.x - retreatText.x) < 20 && Math.abs(rectBtn.y - retreatText.y) < 20) {
              result = { x: rectBtn.x, y: rectBtn.y };
            }
          }
        });
      }
      return result;
    });
    assert(retreatBtn !== null, "MapScene 找到撤退按钮");
    await clickGamePoint(page, { x: retreatBtn.x, y: retreatBtn.y }, "撤退按钮");
    await sleep(1500);

    // 9. 真实点击确认撤退弹窗
    console.log("\n[9] 真实点击确认撤退弹窗...");
    const confirmRetreat = await findModalButton(page, "MapScene");
    assert(confirmRetreat !== null, "MapScene 找到确认撤退按钮");
    if (confirmRetreat) {
      await clickGamePoint(page, { x: confirmRetreat.x, y: confirmRetreat.y }, "确认撤退");
    } else {
      await sleep(1500);
      const retry = await findModalButton(page, "MapScene");
      if (retry) {
        await clickGamePoint(page, { x: retry.x, y: retry.y }, "确认撤退(重试)");
      }
    }
    await sleep(3000);

    const afterRetreat = await page.evaluate(() => window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key));
    assert(afterRetreat.includes("ExpeditionResultScene"), "撤退后进入 ExpeditionResultScene");

    // 10. 真实点击"再来一局"
    console.log("\n[10] 真实点击'再来一局'...");
    await waitForSceneReady(page, "ExpeditionResultScene", { minChildren: 3, timeoutMs: 8000 });
    const replayBtn = await findButtonByText(page, "ExpeditionResultScene", "再来一局");
    assert(replayBtn !== null, "ExpeditionResultScene 找到'再来一局'按钮");
    await clickGamePoint(page, { x: replayBtn.x, y: replayBtn.y }, "再来一局");
    await sleep(1500);

    const afterReplay = await page.evaluate(() => window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key));
    // 阶段11.1：再来一局现在进入 TownScene，再从 TownScene 进入 RouteSelectScene
    await waitForSceneReady(page, "TownScene", { minChildren: 5, timeoutMs: 8000 });
    const townBtn2 = await findInteractiveButtonByText(page, "TownScene", "查看商路");
    assert(townBtn2 !== null, "再来一局后 TownScene 找到'查看商路'按钮");
    await clickGamePoint(page, { x: townBtn2.x, y: townBtn2.y }, "再来一局后 TownScene 查看商路");
    await sleep(1500);

    const afterReplayRouteSelect = await page.evaluate(() => window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key));
    assert(afterReplayRouteSelect.includes("RouteSelectScene"), "点击再来一局后进入第二局 RouteSelectScene");
    assert(!afterReplayRouteSelect.includes("BattleScene") && !afterReplayRouteSelect.includes("MapScene"),
      "再来一局后没有残留旧场景");

    // 11. 第二局：真实点击第一张路线卡
    console.log("\n[11] 第二局：真实点击第一张路线卡片...");
    const rs2Ready = await waitForSceneReady(page, "RouteSelectScene", {
      minChildren: 5, requireRouteCards: true, timeoutMs: 8000,
    });
    assert(rs2Ready.isActive && rs2Ready.routeCardsLength > 0, "第二局 RouteSelectScene 已 ready");

    const routeCard2 = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      const card = rs?.routeCards?.[0];
      return card ? { x: card.x, y: card.y } : null;
    });
    assert(routeCard2 !== null, "第二局找到路线卡");
    await clickGamePoint(page, { x: routeCard2.x, y: routeCard2.y }, "第二局路线卡");
    await sleep(1500);

    // 12. 第二局：真实点击 3 张角色卡
    console.log("\n[12] 第二局：真实点击前3张角色卡片...");
    await waitForSceneReady(page, "CharacterSelectScene", {
      minChildren: 5, requireCharacterCards: true, timeoutMs: 8000,
    });
    const charCards2 = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
      return [{ x: cs.characterCards[0].x, y: cs.characterCards[0].y },
              { x: cs.characterCards[1].x, y: cs.characterCards[1].y },
              { x: cs.characterCards[2].x, y: cs.characterCards[2].y }];
    });
    assert(charCards2 && charCards2.length === 3, "第二局 CharacterSelectScene 找到3张角色卡");
    for (let i = 0; i < 3; i++) {
      await clickGamePoint(page, { x: charCards2[i].x, y: charCards2[i].y }, "第二局角色卡" + (i + 1));
      await sleep(300);
    }

    const charConfirmBtn2 = await findButtonByText(page, "CharacterSelectScene", "开始远征");
    assert(charConfirmBtn2 !== null, "第二局 CharacterSelectScene 找到'开始远征'按钮");
    await clickGamePoint(page, { x: charConfirmBtn2.x, y: charConfirmBtn2.y }, "第二局 CharacterSelectScene 开始远征");
    await sleep(1500);

    // 13. 第二局：CargoPrepScene 真实点击"开始远征"
    console.log("\n[13] 第二局：真实点击 CargoPrepScene 的'开始远征'...");
    await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 8000 });
    const cargoStartBtn2 = await findButtonByText(page, "CargoPrepScene", "开始远征");
    assert(cargoStartBtn2 !== null, "第二局 CargoPrepScene 找到'开始远征'按钮");
    await clickGamePoint(page, { x: cargoStartBtn2.x, y: cargoStartBtn2.y }, "第二局 CargoPrepScene 开始远征");
    await sleep(2000);

    const afterCargo2 = await page.evaluate(() => window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key));
    assert(afterCargo2.includes("MapScene"), "第二局进入 MapScene");

    // 14. 第二局 MapScene 诊断
    console.log("\n[14] 第二局 MapScene 输入状态诊断...");
    const secondDiag = await page.evaluate(() => {
      const gs = window.getGameState();
      const ms = window.game.scene.getScene("MapScene");
      return {
        mapSceneActive: ms?.scene?.isActive?.() || ms?.scene?.active,
        mapCells: gs?.mapCells?.length || 0,
        currentPosition: gs?.currentPosition,
        selectedCharactersLen: gs?.selectedCharacters?.length || 0,
        selectedOrderId: gs?.selectedOrderId,
        modalOpen: !!ms?.modalContainer,
        keyboardEnabled: ms?.input?.keyboard?.enabled,
      };
    });
    console.log("  诊断:", JSON.stringify(secondDiag));
    assert(secondDiag.mapSceneActive === true, "第二局 MapScene active");
    assert(secondDiag.mapCells > 0, "第二局 mapCells 有数据");
    assert(secondDiag.selectedCharactersLen === 3, "第二局 selectedCharacters 有3个");
    assert(secondDiag.selectedOrderId !== null, "第二局 selectedOrderId 存在");
    assert(!secondDiag.modalOpen, "第二局 MapScene 没有弹窗覆盖");

    // 15. 第二局：真实键盘移动（关键断言）
    console.log("\n[15] 第二局 MapScene 真实键盘移动（关键断言）...");
    const secondPosBefore = await page.evaluate(() => {
      const gs = window.getGameState();
      return { x: gs.currentPosition.x, y: gs.currentPosition.y };
    });
    console.log("  移动前位置:", secondPosBefore);

    await page.keyboard.press("ArrowRight");
    await sleep(1200);

    const secondPosAfter = await page.evaluate(() => {
      const gs = window.getGameState();
      return { x: gs.currentPosition.x, y: gs.currentPosition.y };
    });
    console.log("  移动后位置:", secondPosAfter);

    assert(
      secondPosAfter.x !== secondPosBefore.x || secondPosAfter.y !== secondPosBefore.y,
      "关键断言：第二局真实键盘移动成功"
    );

    console.log("\n" + "=".repeat(80));
    console.log("✅ 完整真实流程测试通过！");
    console.log("   - 主菜单真实点击成功");
    console.log("   - 路线选择真实点击成功");
    console.log("   - 角色选择真实点击成功");
    console.log("   - CargoPrepScene 真实点击成功");
    console.log("   - 第一局 MapScene 真实移动成功");
    console.log("   - 撤退真实点击成功");
    console.log("   - 再来一局真实点击成功");
    console.log("   - 第二局重复流程成功");
    console.log("   - 第二局 MapScene 真实移动成功（关键修复验证）");

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.log("\n===== 测试失败 =====");
    console.log(err);

    try {
      const diag = await page.evaluate(() => {
        const activeScenes = window.game.scene.scenes.filter(s => s.scene.isActive()).map(s => s.scene.key);
        const getInfo = (key) => {
          const s = window.game.scene.getScene(key);
          if (!s) return null;
          return {
            active: s.scene?.isActive?.() || s.scene?.active,
            children: s.children?.list?.length || 0,
            routeCards: s.routeCards?.length || 0,
            characterCards: s.characterCards?.length || 0,
            hasModal: !!s.modalContainer,
          };
        };
        return {
          activeScenes,
          MainMenuScene: getInfo("MainMenuScene"),
          RouteSelectScene: getInfo("RouteSelectScene"),
          CharacterSelectScene: getInfo("CharacterSelectScene"),
          CargoPrepScene: getInfo("CargoPrepScene"),
          MapScene: getInfo("MapScene"),
          ExpeditionResultScene: getInfo("ExpeditionResultScene"),
          BattleScene: getInfo("BattleScene"),
          gameState: {
            currentPosition: window.getGameState?.().currentPosition,
            selectedCharacters: window.getGameState?.().selectedCharacters?.length,
            selectedOrderId: window.getGameState?.().selectedOrderId,
          },
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
}

main();
