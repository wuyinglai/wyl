/**
 * smoke-test-tool-system-12-1.cjs
 * 阶段12.1：远征工具系统数据结构冒烟测试
 */
const { chromium } = require("playwright");

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
  console.log("阶段12.1：远征工具系统数据结构冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 页面加载
    console.log("1. 页面加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game && window.game.scene), "window.game 存在");

    // 2. toolSystem 暴露检查
    console.log("2. toolSystem API 暴露检查");
    mark(await page.evaluate(() => typeof window.getAllTools === "function"), "getAllTools 已暴露");
    mark(await page.evaluate(() => typeof window.getToolById === "function"), "getToolById 已暴露");
    mark(await page.evaluate(() => typeof window.getToolsByCategory === "function"), "getToolsByCategory 已暴露");
    mark(await page.evaluate(() => typeof window.getToolsByRarity === "function"), "getToolsByRarity 已暴露");
    mark(await page.evaluate(() => typeof window.isKnownToolId === "function"), "isKnownToolId 已暴露");
    mark(await page.evaluate(() => typeof window.formatToolSummary === "function"), "formatToolSummary 已暴露");

    // 3. getAllTools 返回数组，至少8个
    console.log("3. getAllTools 数量与结构检查");
    const allTools = await page.evaluate(() => window.getAllTools());
    mark(Array.isArray(allTools), "getAllTools 返回数组");
    mark(allTools.length >= 8, `工具数量 >= 8（实际: ${allTools.length}）`);

    // 4. 所有工具字段检查
    console.log("4. 每个工具字段合法性检查");
    const validCategories = ["cargo", "mobility", "scouting", "survival", "combat", "utility"];
    const validRarities = ["common", "uncommon", "rare"];
    const validEffects = [
      "protect_cargo", "reduce_retreat_cost", "reveal_risk",
      "reduce_encounter_risk", "weather_resistance", "combat_support", "none"
    ];

    // 已实装工具列表（阶段12要求）
    const implementedTools = ["sealed_crate", "spare_axle", "range_scope", "camouflage_cloth", "waterproof_tarp", "sand_mask", "reinforced_shield"];

    for (const tool of allTools) {
      mark(tool.id && tool.id.length > 0, `工具 id 非空: ${tool.id}`);
      mark(tool.name && tool.name.length > 0, `工具 name 非空: ${tool.name}`);
      mark(tool.description && tool.description.length > 0, `工具 description 非空: ${tool.id}`);
      mark(validCategories.includes(tool.category), `工具 category 合法: ${tool.category}`);
      mark(validRarities.includes(tool.rarity), `工具 rarity 合法: ${tool.rarity}`);
      mark(validEffects.includes(tool.effectType), `工具 effectType 合法: ${tool.effectType}`);
      mark(tool.price !== undefined && tool.price > 0, `工具价格 > 0: ${tool.id} = ${tool.price}银`);
      // 信号焰火未实装，其他工具已实装
      const expectedImplemented = implementedTools.includes(tool.id);
      mark(tool.isImplemented === expectedImplemented, `工具 isImplemented 正确: ${tool.id} = ${tool.isImplemented}`);
    }

    // 5. getToolById 检查
    console.log("5. getToolById 检查");
    const sealedCrate = await page.evaluate(() => window.getToolById("sealed_crate"));
    mark(sealedCrate && sealedCrate.name === "密封货箱", "getToolById('sealed_crate') 返回密封货箱");

    const spareAxle = await page.evaluate(() => window.getToolById("spare_axle"));
    mark(spareAxle && spareAxle.name === "备用轮轴", "getToolById('spare_axle') 返回备用轮轴");

    const unknownTool = await page.evaluate(() => window.getToolById("unknown_tool"));
    mark(unknownTool === undefined, "getToolById('unknown_tool') 返回 undefined");

    // 6. getToolsByCategory 检查
    console.log("6. getToolsByCategory 检查");
    const cargoTools = await page.evaluate(() => window.getToolsByCategory("cargo"));
    mark(Array.isArray(cargoTools) && cargoTools.length > 0 && cargoTools.some(t => t.id === "sealed_crate"), "getToolsByCategory('cargo') 包含 sealed_crate");

    const survivalTools = await page.evaluate(() => window.getToolsByCategory("survival"));
    mark(
      survivalTools.some(t => t.id === "waterproof_tarp") || survivalTools.some(t => t.id === "sand_mask"),
      "getToolsByCategory('survival') 包含 waterproof_tarp 或 sand_mask"
    );

    // 7. getToolsByRarity 检查
    console.log("7. getToolsByRarity 检查");
    const commonTools = await page.evaluate(() => window.getToolsByRarity("common"));
    mark(Array.isArray(commonTools) && commonTools.length >= 1, "getToolsByRarity('common') 至少1个");

    // 8. isKnownToolId 检查
    console.log("8. isKnownToolId 检查");
    mark(await page.evaluate(() => window.isKnownToolId("sealed_crate")) === true, "isKnownToolId('sealed_crate') = true");
    mark(await page.evaluate(() => window.isKnownToolId("unknown_tool")) === false, "isKnownToolId('unknown_tool') = false");

    // 9. formatToolSummary 检查
    console.log("9. formatToolSummary 检查");
    const summary = await page.evaluate(() => {
      const tool = window.getToolById("sealed_crate");
      return window.formatToolSummary(tool);
    });
    mark(summary.includes("密封货箱"), `formatToolSummary 包含工具名（实际: ${summary}）`);
    // 已实装工具不应包含"效果未接入"
    mark(!summary.includes("效果未接入"), `formatToolSummary 已实装工具不含效果未接入（实际: ${summary}）`);

    // 测试未实装工具的 formatToolSummary
    const signalFlareSummary = await page.evaluate(() => {
      const tool = window.getToolById("signal_flare");
      return window.formatToolSummary(tool);
    });
    mark(signalFlareSummary.includes("信号焰火"), `未实装工具 formatToolSummary 包含工具名（实际: ${signalFlareSummary}）`);
    mark(signalFlareSummary.includes("效果未接入"), `未实装工具 formatToolSummary 包含效果未接入（实际: ${signalFlareSummary}）`);

    // 10. 副本不污染测试
    console.log("10. 副本不污染测试");
    const isSafe = await page.evaluate(() => {
      const first = window.getAllTools();
      if (first.length === 0) return false;
      first[0].name = "污染测试";
      first[0].id = "polluted";
      const second = window.getAllTools();
      return second[0].id !== "polluted";
    });
    mark(isSafe, "getAllTools 返回副本，外部修改不影响下一次调用");

    // 总结
    console.log("\n========================================");
    console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
    if (failCount === 0) {
      console.log("阶段12.1工具系统数据结构: ✅ 全部通过");
    } else {
      console.log("阶段12.1工具系统数据结构: ❌ 有失败项");
    }
    console.log("========================================\n");

    await browser.close();
    process.exit(failCount > 0 ? 1 : 0);
  } catch (e) {
    console.error(`\n❌ 测试失败: ${e.message}`);
    console.error(e.stack);
    await browser.close();
    process.exit(1);
  }
}

runTest();
