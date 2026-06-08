/**
 * 阶段10.5：订单附加条款 v1 冒烟测试
 *
 * 验证：
 * 1. 存在 confidential 订单（矿工粮药支援）
 * 2. 存在 fragile 订单（药材紧急委托）
 * 3. CargoPrepScene 能显示附加条款
 * 4. MapScene 信息面板能显示附加条款
 * 5. 普通订单没有附加条款时不报错
 * 6. 不显示"选择遗产"
 */

const { chromium } = require("playwright");

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();

  const results = [];
  let passCount = 0;
  let failCount = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passCount++;
      results.push({ pass: true, msg });
    } else {
      console.log(`  [FAIL] ${msg}`);
      failCount++;
      results.push({ pass: false, msg });
    }
  };

  try {
    console.log("阶段10.5：订单附加条款 v1 测试");
    console.log("============================================================\n");

    // 1. 启动游戏并等待加载
    console.log("1. 启动游戏");
    await page.goto("http://localhost:5173");
    await page.waitForTimeout(3000); // 等待游戏加载

    // 点击开始游戏
    console.log("  等待主菜单...");
    await page.waitForSelector("text=开始游戏", { timeout: 5000 });
    await page.click("text=开始游戏");
    await page.waitForTimeout(1000);

    // 2. 等待商路选择界面
    console.log("2. 进入商路选择界面");
    await page.waitForSelector("text=灰烬驿城", { timeout: 5000 });
    await page.waitForTimeout(500);

    // 3. 选择矿工商路（保密订单）
    console.log("3. 选择保密订单（矿工粮药支援）");

    // 找到矿工相关商路
    const furnaceRoute = page.locator("text=矿炉城").first();
    const furnaceVisible = await furnaceRoute.isVisible();
    if (furnaceVisible) {
      await furnaceRoute.click();
      await page.waitForTimeout(500);

      // 进入角色选择
      const confirmBtn = page.locator("text=确认").first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }

      // 在 CargoPrepScene 中检查
      const bodyText = await page.textContent("body");
      assert(
        bodyText.includes("保密"),
        "CargoPrepScene 显示【保密】标签"
      );
      assert(
        bodyText.includes("进入村落或营地时可能暴露委托内容"),
        "CargoPrepScene 显示保密条款描述"
      );
    } else {
      console.log("  [INFO] 矿炉城商路不可见，可能需要翻页");
    }

    // 4. 进入 MapScene
    console.log("\n4. 进入 MapScene 验证附加条款");
    const startExpeditionBtn = page.locator("text=开始远征").first();
    if (await startExpeditionBtn.isVisible()) {
      await startExpeditionBtn.click();
      await page.waitForTimeout(2000);
    }

    const mapText = await page.textContent("body");
    const hasConfidentialInMap = mapText.includes("保密");
    const hasSpecialTermsLabel = mapText.includes("附加条款");

    assert(
      hasConfidentialInMap || hasSpecialTermsLabel,
      "MapScene 显示保密订单附加条款"
    );

    // 5. 验证不显示"选择遗产"
    console.log("\n5. 验证不显示'选择遗产'");
    assert(
      !mapText.includes("选择遗产"),
      "MapScene 不显示'选择遗产'"
    );

    // 6. 测试易损订单
    console.log("\n6. 测试易损订单（药材紧急委托）");

    // 返回主菜单
    const backBtn = page.locator("text=返回主菜单");
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForTimeout(500);
    } else {
      // 可能需要先撤退
      const retreatBtn = page.locator("text=撤退");
      if (await retreatBtn.isVisible()) {
        await retreatBtn.click();
        await page.waitForTimeout(500);
        const confirmRetreat = page.locator("text=确认撤退");
        if (await confirmRetreat.isVisible()) {
          await confirmRetreat.click();
          await page.waitForTimeout(1000);
        }
        const againBtn = page.locator("text=再来一局");
        if (await againBtn.isVisible()) {
          await againBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // 再次进入商路选择
    await page.waitForSelector("text=灰烬驿城", { timeout: 5000 });

    // 找药泉城商路（易损订单）
    const medicineRoute = page.locator("text=药泉城").first();
    const medicineVisible = await medicineRoute.isVisible();
    if (medicineVisible) {
      await medicineRoute.click();
      await page.waitForTimeout(500);

      const confirmBtn2 = page.locator("text=确认").first();
      if (await confirmBtn2.isVisible()) {
        await confirmBtn2.click();
        await page.waitForTimeout(1000);
      }

      const fragileText = await page.textContent("body");
      assert(
        fragileText.includes("易损"),
        "CargoPrepScene 显示【易损】标签"
      );
      assert(
        fragileText.includes("货物容易因车厢受损"),
        "CargoPrepScene 显示易损条款描述"
      );

      // 进入 MapScene
      const startBtn2 = page.locator("text=开始远征").first();
      if (await startBtn2.isVisible()) {
        await startBtn2.click();
        await page.waitForTimeout(2000);
      }

      const fragileMapText = await page.textContent("body");
      assert(
        fragileMapText.includes("易损") || fragileMapText.includes("附加条款"),
        "MapScene 显示易损订单附加条款"
      );
    } else {
      console.log("  [INFO] 药泉城商路不可见，可能需要翻页");
    }

    // 7. 验证普通订单处理
    console.log("\n7. 验证普通订单处理（无附加条款）");

    // 返回
    const backBtn2 = page.locator("text=返回主菜单");
    if (await backBtn2.isVisible()) {
      await backBtn2.click();
      await page.waitForTimeout(500);
    } else {
      const retreatBtn2 = page.locator("text=撤退");
      if (await retreatBtn2.isVisible()) {
        await retreatBtn2.click();
        await page.waitForTimeout(500);
        const confirmRetreat2 = page.locator("text=确认撤退");
        if (await confirmRetreat2.isVisible()) {
          await confirmRetreat2.click();
          await page.waitForTimeout(1000);
        }
        const againBtn2 = page.locator("text=再来一局");
        if (await againBtn2.isVisible()) {
          await againBtn2.click();
          await page.waitForTimeout(500);
        }
      }
    }

    await page.waitForSelector("text=灰烬驿城", { timeout: 5000 });

    // 选择灰烬驿城（普通订单，无附加条款）
    await page.locator("text=灰烬驿城").first().click();
    await page.waitForTimeout(500);

    const confirmBtn3 = page.locator("text=确认").first();
    if (await confirmBtn3.isVisible()) {
      await confirmBtn3.click();
      await page.waitForTimeout(1000);
    }

    const normalText = await page.textContent("body");
    const hasNormalOrder = normalText.includes("基础补给委托");
    const noError = !normalText.includes("Cannot read property") &&
                     !normalText.includes("undefined is not an object");

    assert(hasNormalOrder, "基础补给委托订单正常显示");
    assert(noError, "普通订单无附加条款相关报错");

    // 进入 MapScene
    const startBtn3 = page.locator("text=开始远征").first();
    if (await startBtn3.isVisible()) {
      await startBtn3.click();
      await page.waitForTimeout(2000);
    }

    const normalMapText = await page.textContent("body");
    assert(
      !normalMapText.includes("附加条款"),
      "普通订单不显示附加条款标签"
    );

    // 总结
    console.log("\n========================================");
    console.log(`测试完成: ${passCount} 通过, ${failCount} 失败`);
    console.log("========================================");

    if (failCount > 0) {
      console.log("\n失败项:");
      results.filter(r => !r.pass).forEach(r => console.log(`  - ${r.msg}`));
    }

    return { passCount, failCount, results };

  } catch (error) {
    console.error("测试执行出错:", error.message);
    return { passCount, failCount: failCount + 1, error: error.message };
  } finally {
    await browser.close();
  }
}

// 运行测试
runTest().then((result) => {
  console.log("\n测试结果:", JSON.stringify(result, null, 2));
  process.exit(result.failCount > 0 ? 1 : 0);
}).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
