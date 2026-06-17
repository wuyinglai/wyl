/**
 * 阶段10.6 专项测试：撤退后再来一局移动问题
 *
 * 复现并验证修复：
 * 1. 开始游戏 → 选择商路 → 进入地图
 * 2. 移动一步确认可以移动
 * 3. 点击撤退
 * 4. 确认撤退
 * 5. 点击"再来一局"
 * 6. 继续同一个未完成订单
 * 7. 再次进入地图
 * 8. 验证可以移动
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "http://localhost:5180";
const PROJECT_ROOT = path.join(__dirname, "..");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });

  console.log("阶段10.6 撤退后再来一局移动测试");
  console.log("=".repeat(60));

  let passCount = 0;
  let failCount = 0;

  function assert(condition, msg) {
    if (condition) {
      passCount++;
      console.log("  [PASS]", msg);
    } else {
      failCount++;
      console.log("  [FAIL]", msg);
    }
    return condition;
  }

  try {
    // 添加初始化脚本
    await page.addInitScript(() => {
      window.__EMBER_TEST_MODE__ = true;
    });

    // 1. 启动游戏并等待加载
    console.log("\n1. 启动游戏并等待加载...");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    console.log("  游戏加载完成");

    // 2. 开始游戏 - 使用场景API
    console.log("\n2. 开始游戏...");

    // 直接通过场景API开始游戏
    await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (mm && mm.resetGameStateForNewRun) {
        mm.resetGameStateForNewRun();
      }
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(1500);

    // 3. 选择商路
    console.log("\n3. 选择商路...");
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) {
        rs.selectRoute(rs.routes[0]);
      }
    });
    await sleep(1500);

    // 4. 选择角色
    console.log("\n4. 选择角色...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length >= 3) {
        // 选择前3个角色
        for (let i = 0; i < 3; i++) {
          const card = cs.characterCards[i];
          for (const child of card.list) {
            if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
              child.emit("pointerdown");
              break;
            }
          }
        }
      }
    });
    await sleep(500);

    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 5. 开始远征
    console.log("\n5. 开始远征...");
    await page.evaluate(() => {
      const cp = window.game.scene.getScene("CargoPrepScene");
      if (cp && cp.startExpedition) cp.startExpedition();
    });
    await sleep(2000);

    // 验证进入MapScene
    const mapSceneReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapSceneReady, "MapScene 已启动");

    // 6. 第一次移动验证
    console.log("\n6. 第一次进入地图，尝试移动...");
    const firstState = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        position: gs?.currentPosition,
        mapCellsExists: gs?.mapCells?.length > 0,
        mapCellsLength: gs?.mapCells?.length,
        selectedOrderId: gs?.selectedOrderId,
        unfinishedOrderIds: gs?.unfinishedOrderIds,
        _isAutoMoving: gs?._isAutoMoving,
        _isClickTesting: gs?._isClickTesting,
        _isDirectionalTesting: gs?._isDirectionalTesting,
      };
    });
    console.log("  初始状态:", JSON.stringify(firstState.position));

    // 移动
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (ms && ms.tryMoveTo) {
        const gs = window.getGameState();
        const currentX = gs.currentPosition.x;
        const currentY = gs.currentPosition.y;
        // 尝试向右移动
        ms.tryMoveTo(currentX + 1, currentY);
      }
    });
    await sleep(500);

    const firstStateAfter = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        position: gs?.currentPosition,
      };
    });
    console.log("  移动后位置:", JSON.stringify(firstStateAfter.position));

    const firstMoveSuccess = firstStateAfter.position &&
      (firstStateAfter.position.x !== firstState.position.x || firstStateAfter.position.y !== firstState.position.y);
    assert(firstMoveSuccess, "第一次移动成功");

    if (!firstMoveSuccess) {
      console.error("第一次就无法移动！测试提前结束");
      return false;
    }

    // 7. 撤退
    console.log("\n7. 撤退...");
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (ms && ms.showRetreatConfirmModal) {
        ms.showRetreatConfirmModal();
      }
    });
    await sleep(500);

    // 8. 确认撤退
    console.log("\n8. 确认撤退...");
    await page.evaluate(() => {
      // 查找并点击确认撤退按钮
      const ms = window.game.scene.getScene("MapScene");
      if (ms && ms.modalActions && ms.modalActions.length > 0) {
        // 找到确认撤退的action（通常是第一个）
        ms.modalActions[0]();
      }
    });
    await sleep(3000);

    // 9. 点击再来一局
    console.log("\n9. 点击再来一局...");
    await page.evaluate(() => {
      const er = window.game.scene.getScene("ExpeditionResultScene");
      if (er) {
        // 查找再来一局按钮
        const buttons = er.children.list.filter(c => c.type === "Rectangle" || c.type === "Container");
        for (const btn of buttons) {
          if (btn.list) {
            for (const child of btn.list) {
              if (child.type === "Text" && child.text === "再来一局") {
                btn.emit("pointerdown");
                break;
              }
            }
          }
        }
      }
    });
    await sleep(2000);

    // 10. 继续订单
    console.log("\n10. 继续未完成订单...");
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) {
        rs.selectRoute(rs.routes[0]);
      }
    });
    await sleep(1500);

    // 11. 选择角色
    console.log("\n11. 选择角色...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length >= 3) {
        for (let i = 0; i < 3; i++) {
          const card = cs.characterCards[i];
          for (const child of card.list) {
            if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
              child.emit("pointerdown");
              break;
            }
          }
        }
      }
    });
    await sleep(500);

    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 12. 再次开始远征
    console.log("\n12. 再次开始远征...");
    await page.evaluate(() => {
      const cp = window.game.scene.getScene("CargoPrepScene");
      if (cp && cp.startExpedition) cp.startExpedition();
    });
    await sleep(2000);

    // 13. 第二次移动验证
    console.log("\n13. 第二次进入地图，尝试移动...");

    const secondState = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        position: gs?.currentPosition,
        mapCellsExists: gs?.mapCells?.length > 0,
        mapCellsLength: gs?.mapCells?.length,
        selectedOrderId: gs?.selectedOrderId,
        unfinishedOrderIds: gs?.unfinishedOrderIds,
        orderTimeStates: gs?.orderTimeStates,
        _isAutoMoving: gs?._isAutoMoving,
        _isClickTesting: gs?._isClickTesting,
        _isDirectionalTesting: gs?._isDirectionalTesting,
        currentScene: window.game?.scene?.key,
      };
    });
    console.log("  状态检查:", JSON.stringify({
      position: secondState.position,
      mapCellsLength: secondState.mapCellsLength,
      _isAutoMoving: secondState._isAutoMoving,
      _isClickTesting: secondState._isClickTesting,
      _isDirectionalTesting: secondState._isDirectionalTesting,
    }));

    // 移动
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (ms && ms.tryMoveTo) {
        const gs = window.getGameState();
        const currentX = gs.currentPosition.x;
        const currentY = gs.currentPosition.y;
        // 尝试向右移动
        ms.tryMoveTo(currentX + 1, currentY);
      }
    });
    await sleep(500);

    const secondStateAfter = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        position: gs?.currentPosition,
      };
    });
    console.log("  移动后位置:", JSON.stringify(secondStateAfter.position));

    const secondMoveSuccess = secondStateAfter.position &&
      (secondStateAfter.position.x !== secondState.position.x || secondStateAfter.position.y !== secondState.position.y);
    assert(secondMoveSuccess, "第二次移动成功");

    if (!secondMoveSuccess) {
      // 输出详细状态
      console.log("  第二次移动失败，详细状态:");
      const debugState = await page.evaluate(() => {
        const gs = window.getGameState();
        const ms = window.game.scene.getScene("MapScene");
        return {
          currentPosition: gs?.currentPosition,
          mapCellsExists: gs?.mapCells?.length > 0,
          mapCellsLength: gs?.mapCells?.length,
          _isAutoMoving: gs?._isAutoMoving,
          _isClickTesting: gs?._isClickTesting,
          _isDirectionalTesting: gs?._isDirectionalTesting,
          modalContainerExists: !!ms?.modalContainer,
          inputLocked: ms?.input?.locked,
          currentScene: window.game?.scene?.key,
        };
      });
      console.log("  ", JSON.stringify(debugState));
    }

    // 14. 验证结果
    console.log("\n" + "=".repeat(60));
    console.log("测试完成:", passCount, "通过,", failCount, "失败");

    await browser.close();

    if (failCount === 0) {
      console.log("✅ 所有测试通过！");
    } else {
      console.log("❌ 有", failCount, "项测试失败");
    }

    return failCount === 0;

  } catch (error) {
    console.error("\n❌ 测试出错:", error.message);
    await browser.close();
    return false;
  }
}

// 运行测试
runTest().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error("运行失败:", error);
  process.exit(1);
});
