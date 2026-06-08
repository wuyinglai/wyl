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

async function runTest() {
  const browser = await chromium.launch({ headless: true, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1024, height: 800 } });
  const page = await context.newPage();

  console.log("阶段10.6 撤退后再来一局移动测试");
  console.log("=".repeat(60));

  try {
    // 1. 启动游戏
    console.log("\n1. 启动游戏...");
    await page.goto("http://localhost:5177");
    await page.waitForTimeout(3000);

    // 2. 开始游戏
    console.log("\n2. 点击开始远征...");
    await page.waitForSelector("text=开始远征", { timeout: 10000 });
    await page.click("text=开始远征");
    await page.waitForTimeout(2000);

    // 3. 选择第一条商路
    console.log("\n3. 选择商路...");
    await page.waitForSelector("text=选择商路", { timeout: 10000 });
    await page.waitForTimeout(1000);
    // 点击屏幕中间选择商路
    await page.click({ position: { x: 512, y: 400 } });
    await page.waitForTimeout(2000);

    // 4. 选择角色
    console.log("\n4. 选择角色...");
    await page.waitForTimeout(1000);
    // 点击确认按钮
    await page.click("text=确认");
    await page.waitForTimeout(2000);

    // 5. 开始远征
    console.log("\n5. 点击开始远征...");
    await page.waitForTimeout(500);
    await page.click("text=开始远征");
    await page.waitForTimeout(3000);

    // 6. 第一次移动验证
    console.log("\n6. 第一次进入地图，尝试移动...");
    const firstPosBefore = await page.evaluate(() => {
      const gs = window.gameState || (window.game && window.game.state && window.game.state.gameState);
      return gs ? { x: gs.currentPosition.x, y: gs.currentPosition.y } : null;
    });
    console.log("   初始位置:", firstPosBefore);

    // 尝试向右移动（键盘 D 键）
    await page.keyboard.press("d");
    await page.waitForTimeout(1000);

    const firstPosAfter = await page.evaluate(() => {
      const gs = window.gameState || (window.game && window.game.state && window.game.state.gameState);
      return gs ? { x: gs.currentPosition.x, y: gs.currentPosition.y } : null;
    });
    console.log("   移动后位置:", firstPosAfter);

    const firstMoveSuccess = firstPosAfter &&
      (firstPosAfter.x !== firstPosBefore.x || firstPosAfter.y !== firstPosBefore.y);
    console.log("   第一次移动成功:", firstMoveSuccess ? "✅" : "❌");

    if (!firstMoveSuccess) {
      console.error("第一次就无法移动！测试提前结束");
      return false;
    }

    // 7. 撤退
    console.log("\n7. 点击撤退...");
    await page.click("text=撤退");
    await page.waitForTimeout(1000);

    // 8. 确认撤退
    console.log("\n8. 确认撤退...");
    await page.click("text=确认撤退");
    await page.waitForTimeout(3000);

    // 9. 点击再来一局
    console.log("\n9. 点击再来一局...");
    await page.waitForSelector("text=再来一局", { timeout: 10000 });
    await page.click("text=再来一局");
    await page.waitForTimeout(2000);

    // 10. 选择同样的商路（未完成订单）
    console.log("\n10. 继续未完成订单...");
    await page.waitForSelector("text=选择商路", { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.click({ position: { x: 512, y: 400 } });
    await page.waitForTimeout(2000);

    // 11. 再次选择角色
    console.log("\n11. 选择角色...");
    await page.waitForTimeout(1000);
    await page.click("text=确认");
    await page.waitForTimeout(2000);

    // 12. 再次开始远征
    console.log("\n12. 再次开始远征...");
    await page.waitForTimeout(500);
    await page.click("text=开始远征");
    await page.waitForTimeout(3000);

    // 13. 第二次移动验证
    console.log("\n13. 第二次进入地图，尝试移动...");
    const secondPosBefore = await page.evaluate(() => {
      const gs = window.gameState || (window.game && window.game.state && window.game.state.gameState);
      return gs ? { x: gs.currentPosition.x, y: gs.currentPosition.y } : null;
    });
    console.log("   初始位置:", secondPosBefore);

    // 查看相关状态
    const stateBeforeMove = await page.evaluate(() => {
      const gs = window.gameState || (window.game && window.game.state && window.game.state.gameState);
      return {
        _isAutoMoving: gs ? gs._isAutoMoving : undefined,
        _autoMoveResumeStep: gs ? gs._autoMoveResumeStep : undefined,
        _isClickTesting: gs ? gs._isClickTesting : undefined,
        _clickTestResumeStep: gs ? gs._clickTestResumeStep : undefined,
        _isDirectionalTesting: gs ? gs._isDirectionalTesting : undefined,
        _directionalTestResumeStep: gs ? gs._directionalTestResumeStep : undefined,
        mapCellsLength: gs && gs.mapCells ? gs.mapCells.length : 0,
      };
    });
    console.log("   状态检查:", stateBeforeMove);

    // 尝试向右移动（键盘 D 键）
    await page.keyboard.press("d");
    await page.waitForTimeout(1000);

    const secondPosAfter = await page.evaluate(() => {
      const gs = window.gameState || (window.game && window.game.state && window.game.state.gameState);
      return gs ? { x: gs.currentPosition.x, y: gs.currentPosition.y } : null;
    });
    console.log("   移动后位置:", secondPosAfter);

    const secondMoveSuccess = secondPosAfter &&
      (secondPosAfter.x !== secondPosBefore.x || secondPosAfter.y !== secondPosBefore.y);
    console.log("   第二次移动成功:", secondMoveSuccess ? "✅" : "❌");

    // 14. 验证结果
    console.log("\n" + "=".repeat(60));
    if (secondMoveSuccess) {
      console.log("✅ 测试通过：撤退后再来一局可以正常移动！");
    } else {
      console.log("❌ 测试失败：撤退后再来一局无法移动！");
    }

    return secondMoveSuccess;

  } catch (error) {
    console.error("\n❌ 测试出错:", error);
    return false;
  } finally {
    await browser.close();
  }
}

// 运行测试
runTest().then((success) => {
  process.exit(success ? 0 : 1);
}).catch((error) => {
  console.error("运行失败:", error);
  process.exit(1);
});
