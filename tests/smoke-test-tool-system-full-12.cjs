/**
 * 阶段12：工具系统完整闭环测试
 */

const { chromium } = require("playwright");

const BASE_URL = "http://localhost:5174";

let passed = 0;
let failed = 0;

function mark(condition, description) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${description}`);
    failed++;
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTest() {
  console.log("========================================");
  console.log("阶段12：工具系统完整闭环测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 页面加载
    console.log("1. 页面加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game && window.game.scene), "window.game 存在");

    // 2. 工具系统 API 检查
    console.log("2. 工具系统 API 检查");
    mark(await page.evaluate(() => typeof window.getAllTools === 'function'), "getAllTools 已暴露");
    mark(await page.evaluate(() => typeof window.getToolById === 'function'), "getToolById 已暴露");
    mark(await page.evaluate(() => typeof window.isToolOwned === 'function'), "isToolOwned 已暴露");
    mark(await page.evaluate(() => typeof window.tryBuyTool === 'function'), "tryBuyTool 已暴露");

    // 3. 工具数据检查
    console.log("3. 工具数据检查");
    const tools = await page.evaluate(() => window.getAllTools());
    mark(Array.isArray(tools) && tools.length >= 8, `工具数量 >= 8（实际: ${tools?.length})`);
    
    const sealedCrate = await page.evaluate(() => window.getToolById('sealed_crate'));
    mark(sealedCrate && sealedCrate.price > 0, `密封货箱有价格（${sealedCrate?.price}银）`);
    mark(sealedCrate && sealedCrate.isImplemented, "密封货箱已实装");

    const signalFlare = await page.evaluate(() => window.getToolById('signal_flare'));
    mark(signalFlare && !signalFlare.isImplemented, "信号焰火未实装");

    // 4. tryBuyTool 测试
    console.log("4. tryBuyTool 测试");
    
    // 测试购买未实装工具
    const buyNotImplemented = await page.evaluate(() => 
      window.tryBuyTool([], 1000, 'signal_flare')
    );
    mark(!buyNotImplemented.success && buyNotImplemented.reason === 'not_implemented', "未实装工具不可购买");

    // 测试购买已拥有工具
    const buyAlreadyOwned = await page.evaluate(() => 
      window.tryBuyTool(['sealed_crate'], 100, 'sealed_crate')
    );
    mark(!buyAlreadyOwned.success && buyAlreadyOwned.reason === 'already_owned', "已拥有工具不可重复购买");

    // 测试购买成功
    const buySuccess = await page.evaluate(() => 
      window.tryBuyTool([], 100, 'sealed_crate')
    );
    mark(buySuccess.success, "购买成功");
    mark(buySuccess.newOwned && buySuccess.newOwned.includes('sealed_crate'), "购买后工具加入 ownedTools");
    mark(buySuccess.newSilver === 100 - sealedCrate.price, `银币正确扣除（${buySuccess.newSilver})`);

    // 5. isToolOwned 测试
    console.log("5. isToolOwned 测试");
    const isOwned1 = await page.evaluate(() => window.isToolOwned(['sealed_crate'], 'sealed_crate'));
    mark(isOwned1, "isToolOwned 正确识别已拥有工具");
    
    const isOwned2 = await page.evaluate(() => window.isToolOwned(['sealed_crate'], 'spare_axle'));
    mark(!isOwned2, "isToolOwned 正确识别未拥有工具");

    // 6. getActiveToolEffectSummary 测试
    console.log("6. getActiveToolEffectSummary 测试");
    const effect1 = await page.evaluate(() => window.getActiveToolEffectSummary('sealed_crate'));
    mark(effect1 && effect1.includes('密封货箱'), "密封货箱效果摘要正确");
    
    const effect2 = await page.evaluate(() => window.getActiveToolEffectSummary(null));
    mark(effect2 && effect2.includes('未携带'), "未携带工具显示正确");

    // 7. 工具效果函数测试
    console.log("7. 工具效果函数测试");
    const retreatDiscount = await page.evaluate(() => {
      const ctx = { selectedToolId: 'spare_axle' };
      return window.applyRetreatCostDiscount(ctx);
    });
    mark(retreatDiscount === 0.7, `备用轮轴折扣正确（${retreatDiscount})`);

    const noDiscount = await page.evaluate(() => {
      const ctx = { selectedToolId: null };
      return window.applyRetreatCostDiscount(ctx);
    });
    mark(noDiscount === 1.0, `无工具时无折扣（${noDiscount})`);

    // 8. GameState 字段检查
    console.log("8. GameState 字段检查");
    const gs = await page.evaluate(() => {
      const state = window.getGameState();
      return {
        hasOwnedTools: Array.isArray(state.ownedTools),
        hasSelectedToolId: state.selectedToolId !== undefined,
      };
    });
    mark(gs.hasOwnedTools, "GameState 有 ownedTools 字段");
    mark(gs.hasSelectedToolId, "GameState 有 selectedToolId 字段");

    // 9. 进入 TownScene 验证工具商店显示
    console.log("9. TownScene 工具商店");
    await page.evaluate(() => {
      const mm = window.game.scene.getScene('MainMenuScene');
      if (mm) {
        mm.scene.start('TownScene');
      }
    });
    await sleep(1000);
    mark(await page.evaluate(() => window.game.scene.isActive('TownScene')), "TownScene active");

    // 验证 TownScene 显示工具列表（通过检查文本）
    const townTexts = await page.evaluate(() => {
      const ts = window.game.scene.getScene('TownScene');
      if (!ts) return [];
      const texts = [];
      ts.children.each((child) => {
        if (child.type === "Text" && child.text && child.visible) {
          texts.push(String(child.text));
        }
      });
      return texts;
    });
    mark(townTexts.some(t => t.includes('仓库/工具')), "显示仓库/工具标题");
    mark(townTexts.some(t => t.includes('银币')), "显示银币数量");

  } catch (e) {
    console.error("❌ 测试失败:", e);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n========================================");
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  if (failed === 0) {
    console.log("阶段12工具系统: ✅ 全部通过");
  } else {
    console.log("阶段12工具系统: ❌ 有失败项");
  }
  console.log("========================================");

  process.exit(failed > 0 ? 1 : 0);
}

runTest();