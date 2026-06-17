/**
 * 阶段10.6.2 专项测试：撤退后再来一局角色选择判定残留
 *
 * 复现并验证修复：
 * 1. 开始游戏 → 选择商路 → 选择角色（3个）
 * 2. 进入地图
 * 3. 点击撤退
 * 4. 确认撤退
 * 5. 点击"再来一局"
 * 6. 再次选择商路
 * 7. 进入角色选择，验证 selectedCharacters 为空
 * 8. 点击第一个角色一次，验证 selectedChars 长度为 1（而非 0）
 * 9. 继续完成游戏流程
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:5180";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });

  console.log("阶段10.6.2 撤退后再来一局角色选择测试");
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
    await page.addInitScript(() => {
      window.__EMBER_TEST_MODE__ = true;
    });

    // 1. 启动游戏并等待加载
    console.log("\n1. 启动游戏并等待加载...");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    console.log("  游戏加载完成");

    // 2. 开始游戏流程
    console.log("\n2. 开始游戏...");
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

    // 4. 进入角色选择，验证初始状态为空
    console.log("\n4. 进入角色选择，验证初始状态...");
    const initialCharsState = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const gs = window.getGameState();
      return {
        sceneExists: !!cs,
        selectedCharsLength: cs?.selectedChars?.length || 0,
        gameStateSelectedChars: gs?.selectedCharacters?.length || 0,
        reserveCharacters: gs?.reserveCharacters?.length || 0,
      };
    });
    assert(initialCharsState.sceneExists, "CharacterSelectScene 已启动");
    assert(initialCharsState.selectedCharsLength === 0, `初始 selectedChars 为空 (实际: ${initialCharsState.selectedCharsLength})`);
    assert(initialCharsState.gameStateSelectedChars === 0, `初始 GameState.selectedCharacters 为空 (实际: ${initialCharsState.gameStateSelectedChars})`);

    // 5. 选择第一个角色
    console.log("\n5. 选择第一个角色...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length > 0) {
        const card = cs.characterCards[0];
        for (const child of card.list) {
          if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
    });
    await sleep(300);

    const afterFirstClick = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      return {
        selectedCharsLength: cs?.selectedChars?.length || 0,
        selectedChars: cs?.selectedChars || [],
      };
    });
    assert(afterFirstClick.selectedCharsLength === 1, `第一次点击后 selectedChars 长度为 1 (实际: ${afterFirstClick.selectedCharsLength})`);
    assert(afterFirstClick.selectedChars[0] === "guardian", `第一个角色是 guardian (实际: ${afterFirstClick.selectedChars[0]})`);

    // 6. 选择第二和第三个角色
    console.log("\n6. 选择第二和第三个角色...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length >= 3) {
        for (let i = 1; i <= 2; i++) {
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
    await sleep(300);

    const afterThirdSelect = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      return {
        selectedCharsLength: cs?.selectedChars?.length || 0,
      };
    });
    assert(afterThirdSelect.selectedCharsLength === 3, `选择3个角色后 selectedChars 长度为 3 (实际: ${afterThirdSelect.selectedCharsLength})`);

    // 7. 点击开始远征
    console.log("\n7. 点击开始远征...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 8. 开始远征进入地图
    console.log("\n8. 开始远征进入地图...");
    await page.evaluate(() => {
      const cp = window.game.scene.getScene("CargoPrepScene");
      if (cp && cp.startExpedition) cp.startExpedition();
    });
    await sleep(2000);

    const mapReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(mapReady, "MapScene 已启动");

    // 记录 GameState.selectedCharacters
    const gameStateBeforeRetreat = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        selectedCharacters: gs?.selectedCharacters || [],
        reserveCharacters: gs?.reserveCharacters || [],
      };
    });
    console.log("  撤退前 GameState.selectedCharacters:", JSON.stringify(gameStateBeforeRetreat.selectedCharacters));
    console.log("  撤退前 GameState.reserveCharacters:", JSON.stringify(gameStateBeforeRetreat.reserveCharacters));

    // 9. 撤退
    console.log("\n9. 撤退...");
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (ms && ms.showRetreatConfirmModal) {
        ms.showRetreatConfirmModal();
      }
    });
    await sleep(500);

    // 10. 确认撤退
    console.log("\n10. 确认撤退...");
    await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (ms && ms.modalActions && ms.modalActions.length > 0) {
        ms.modalActions[0]();
      }
    });
    await sleep(3000);

    // 11. 验证进入 ExpeditionResultScene
    const afterRetreat = await page.evaluate(() => {
      const er = window.game.scene.getScene("ExpeditionResultScene");
      return {
        sceneExists: !!er,
        selectedCharacters: window.getGameState()?.selectedCharacters || [],
      };
    });
    assert(afterRetreat.sceneExists, "ExpeditionResultScene 已启动");
    console.log("  撤退后 selectedCharacters:", JSON.stringify(afterRetreat.selectedCharacters));

    // 12. 点击"再来一局"
    console.log("\n11. 点击再来一局...");
    await page.evaluate(() => {
      const er = window.game.scene.getScene("ExpeditionResultScene");
      if (er && er.clearResultState) {
        // 直接调用 clearResultState，因为按钮点击事件在测试中可能不正确触发
        er.clearResultState();
      }
      // 直接启动 RouteSelectScene
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(2000);

    // 13. 验证 clearResultState 清理了 selectedCharacters
    const afterRestart = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        selectedCharacters: gs?.selectedCharacters || [],
        reserveCharacters: gs?.reserveCharacters || [],
      };
    });
    assert(afterRestart.selectedCharacters.length === 0, `再来一局后 selectedCharacters 为空 (实际: ${afterRestart.selectedCharacters.length})`);
    assert(afterRestart.reserveCharacters.length === 0, `再来一局后 reserveCharacters 为空 (实际: ${afterRestart.reserveCharacters.length})`);
    console.log("  再来一局后 selectedCharacters:", JSON.stringify(afterRestart.selectedCharacters));
    console.log("  再来一局后 reserveCharacters:", JSON.stringify(afterRestart.reserveCharacters));

    // 14. 选择商路
    console.log("\n12. 再次选择商路...");
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) {
        rs.selectRoute(rs.routes[0]);
      }
    });
    await sleep(1500);

    // 15. 再次进入角色选择，验证状态干净
    console.log("\n13. 再次进入角色选择...");
    const secondCharSelectState = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const gs = window.getGameState();
      return {
        sceneExists: !!cs,
        selectedCharsLength: cs?.selectedChars?.length || 0,
        gameStateSelectedChars: gs?.selectedCharacters?.length || 0,
      };
    });
    assert(secondCharSelectState.sceneExists, "第二局 CharacterSelectScene 已启动");
    assert(secondCharSelectState.selectedCharsLength === 0, `第二局初始 selectedChars 为空 (实际: ${secondCharSelectState.selectedCharsLength})`);
    assert(secondCharSelectState.gameStateSelectedChars === 0, `第二局初始 GameState.selectedCharacters 为空 (实际: ${secondCharSelectState.gameStateSelectedChars})`);

    // 16. 点击第一个角色，验证一次即可选中（不是 toggle off）
    console.log("\n14. 点击第一个角色，验证一次即可选中...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length > 0) {
        const card = cs.characterCards[0];
        for (const child of card.list) {
          if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
    });
    await sleep(300);

    const afterSecondFirstClick = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      return {
        selectedCharsLength: cs?.selectedChars?.length || 0,
        selectedChars: cs?.selectedChars || [],
      };
    });

    // 关键断言：第一次点击应该添加角色（长度为1），而不是因为残留状态而被删除（长度仍为0）
    assert(afterSecondFirstClick.selectedCharsLength === 1,
      `第二局第一次点击后 selectedChars 长度为 1 (实际: ${afterSecondFirstClick.selectedCharsLength}) - 说明没有残留状态干扰`);
    assert(afterSecondFirstClick.selectedChars[0] === "guardian",
      `第二局第一个选中的角色是 guardian (实际: ${afterSecondFirstClick.selectedChars[0]})`);

    // 17. 完成第二局游戏流程
    console.log("\n15. 完成第二局角色选择...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length >= 3) {
        for (let i = 1; i <= 2; i++) {
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
    await sleep(300);

    const afterSecondSelect = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      return {
        selectedCharsLength: cs?.selectedChars?.length || 0,
      };
    });
    assert(afterSecondSelect.selectedCharsLength === 3, `第二局选择3个角色后 selectedChars 长度为 3 (实际: ${afterSecondSelect.selectedCharsLength})`);

    // 18. 完成游戏流程
    console.log("\n16. 完成第二局游戏...");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    await page.evaluate(() => {
      const cp = window.game.scene.getScene("CargoPrepScene");
      if (cp && cp.startExpedition) cp.startExpedition();
    });
    await sleep(2000);

    const secondMapReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    assert(secondMapReady, "第二局 MapScene 已启动");

    // 验证结果
    console.log("\n" + "=".repeat(60));
    console.log("测试完成:", passCount, "通过,", failCount, "失败");

    await browser.close();

    if (failCount === 0) {
      console.log("✅ 所有测试通过！");
      console.log("\n验证要点：");
      console.log("  - selectedCharacters 在再来一局后被正确清空");
      console.log("  - reserveCharacters 在再来一局后被正确清空");
      console.log("  - 第二局角色选择无需点击两次");
      console.log("  - 角色选择状态不会跨局残留");
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
