/**
 * smoke-test-goods-8-1.cjs
 * 阶段8.1 商品数据系统冒烟测试（严格版）
 *
 * 失败时 process.exit(1)，成功时 process.exit(0)
 *
 * 验证要点:
 * 1. window.game 存在
 * 2. GOODS 至少 4 个
 * 3. grain / medicine / iron / parts 都存在
 * 4. 所有商品 id 唯一
 * 5. validateGoods() 返回 valid
 * 6. getGoodName("grain") 返回"粮食"
 * 7. formatGoodsRequirement({ grain: 5, medicine: 2 }) 包含"粮食 x5"和"药材 x2"
 * 8. createEmptyCargo() 返回空对象
 * 9. addCargo({}, "grain", 5) 后 grain = 5
 * 10. removeCargo({ grain: 5 }, "grain", 2) 后 grain = 3
 * 11. removeCargo({ grain: 5 }, "grain", 5) 后 grain key 被删除，不能为负
 * 12. hasCargo({ grain: 5, medicine: 2 }, { grain: 5 }) 为 true
 * 13. hasCargo({ grain: 3 }, { grain: 5 }) 为 false
 * 14. calculateCargoWeight({ grain: 5, iron: 2 }) = 5*1 + 2*2 = 9
 * 15. formatCargo({ grain: 5, medicine: 2 }) 使用中文名
 */
const { chromium } = require("playwright");
const BASE_URL = process.env.BASE_URL || "http://localhost:5180";
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    throw new Error(`断言失败: ${message}`);
  }
  passed++;
  console.log(`  ✅ ${message}`);
}

async function runTest() {
  console.log("========================================");
  console.log("阶段8.1 商品数据系统冒烟测试（严格版）");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // ========== 1. 游戏加载 ==========
    console.log("1. 游戏加载");
    await page.addInitScript(() => {
          window.__EMBER_TEST_MODE__ = true;
        });
        
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    assert(await page.evaluate(() => !!window.game && !!window.game.scene), "window.game 存在");

    // ========== 2. GOODS 至少 4 个 ==========
    console.log("2. GOODS 至少 4 个");
    const goodsCount = await page.evaluate(() => window.GOODS.length);
    assert(goodsCount >= 4, `GOODS 至少 4 个（实际: ${goodsCount}）`);

    // ========== 3. grain / medicine / iron / parts 都存在 ==========
    console.log("3. grain / medicine / iron / parts 都存在");
    const goodIds = await page.evaluate(() => window.GOODS.map(g => g.id));
    assert(goodIds.includes("grain"), "grain 存在");
    assert(goodIds.includes("medicine"), "medicine 存在");
    assert(goodIds.includes("iron"), "iron 存在");
    assert(goodIds.includes("parts"), "parts 存在");

    // ========== 4. 所有商品 id 唯一 ==========
    console.log("4. 所有商品 id 唯一");
    const allUnique = await page.evaluate(() => {
      const ids = window.GOODS.map(g => g.id);
      return new Set(ids).size === ids.length;
    });
    assert(allUnique, "所有商品 id 唯一");

    // ========== 5. validateGoods() 返回 valid ==========
    console.log("5. validateGoods() 返回 valid");
    const validation = await page.evaluate(() => {
      const result = window.validateGoods();
      return { valid: result.valid, errorCount: result.errors.length };
    });
    assert(validation.valid, `validateGoods() 返回 valid（errors: ${validation.errorCount}）`);

    // ========== 6. getGoodName("grain") 返回"粮食" ==========
    console.log("6. getGoodName(\"grain\") 返回\"粮食\"");
    const grainName = await page.evaluate(() => window.getGoodName("grain"));
    assert(grainName === "粮食", `getGoodName("grain") = "${grainName}"`);

    // ========== 7. formatGoodsRequirement 包含中文名 ==========
    console.log("7. formatGoodsRequirement({ grain: 5, medicine: 2 }) 包含中文名");
    const formatted = await page.evaluate(() => window.formatGoodsRequirement({ grain: 5, medicine: 2 }));
    assert(formatted.includes("粮食 x5"), `包含"粮食 x5"（实际: ${formatted}）`);
    assert(formatted.includes("药材 x2"), `包含"药材 x2"（实际: ${formatted}）`);

    // ========== 8. createEmptyCargo() 返回空对象 ==========
    console.log("8. createEmptyCargo() 返回空对象");
    const emptyCargo = await page.evaluate(() => {
      const c = window.createEmptyCargo();
      return Object.keys(c).length;
    });
    assert(emptyCargo === 0, "createEmptyCargo() 返回空对象");

    // ========== 9. addCargo({}, "grain", 5) 后 grain = 5 ==========
    console.log("9. addCargo({}, \"grain\", 5) 后 grain = 5");
    const afterAdd = await page.evaluate(() => {
      const c = window.addCargo({}, "grain", 5);
      return c.grain;
    });
    assert(afterAdd === 5, `addCargo 后 grain = ${afterAdd}`);

    // ========== 10. removeCargo({ grain: 5 }, "grain", 2) 后 grain = 3 ==========
    console.log("10. removeCargo({ grain: 5 }, \"grain\", 2) 后 grain = 3");
    const afterRemove = await page.evaluate(() => {
      const c = window.removeCargo({ grain: 5 }, "grain", 2);
      return c.grain;
    });
    assert(afterRemove === 3, `removeCargo 后 grain = ${afterRemove}`);

    // ========== 11. removeCargo({ grain: 5 }, "grain", 5) 后 grain key 被删除 ==========
    console.log("11. removeCargo({ grain: 5 }, \"grain\", 5) 后 grain key 被删除");
    const afterRemoveAll = await page.evaluate(() => {
      const c = window.removeCargo({ grain: 5 }, "grain", 5);
      return { hasKey: "grain" in c, value: c.grain };
    });
    assert(!afterRemoveAll.hasKey, "removeCargo 全部后 grain key 被删除");
    assert(afterRemoveAll.value === undefined, "removeCargo 全部后 grain 值为 undefined");

    // 验证不会减成负数
    const noNegative = await page.evaluate(() => {
      const c = window.removeCargo({ grain: 3 }, "grain", 5);
      return { hasKey: "grain" in c, value: c.grain };
    });
    assert(!noNegative.hasKey, "removeCargo 不允许减成负数（key 被删除）");

    // ========== 12. hasCargo({ grain: 5, medicine: 2 }, { grain: 5 }) 为 true ==========
    console.log("12. hasCargo 满足需求");
    const hasEnough = await page.evaluate(() => {
      return window.hasCargo({ grain: 5, medicine: 2 }, { grain: 5 });
    });
    assert(hasEnough === true, "hasCargo 满足需求为 true");

    // ========== 13. hasCargo({ grain: 3 }, { grain: 5 }) 为 false ==========
    console.log("13. hasCargo 不满足需求");
    const notEnough = await page.evaluate(() => {
      return window.hasCargo({ grain: 3 }, { grain: 5 });
    });
    assert(notEnough === false, "hasCargo 不满足需求为 false");

    // ========== 14. calculateCargoWeight({ grain: 5, iron: 2 }) = 9 ==========
    console.log("14. calculateCargoWeight({ grain: 5, iron: 2 }) = 9");
    const weight = await page.evaluate(() => {
      return window.calculateCargoWeight({ grain: 5, iron: 2 });
    });
    assert(weight === 9, `calculateCargoWeight = ${weight}（期望 9: 5*1 + 2*2）`);

    // ========== 15. formatCargo({ grain: 5, medicine: 2 }) 使用中文名 ==========
    console.log("15. formatCargo({ grain: 5, medicine: 2 }) 使用中文名");
    const cargoFormatted = await page.evaluate(() => {
      return window.formatCargo({ grain: 5, medicine: 2 });
    });
    assert(cargoFormatted.includes("粮食"), `formatCargo 包含"粮食"（实际: ${cargoFormatted}）`);
    assert(cargoFormatted.includes("药材"), `formatCargo 包含"药材"（实际: ${cargoFormatted}）`);

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    console.log("阶段8.1 商品数据系统: ✅ 全部通过");
    console.log("========================================");
    await browser.close();
    process.exit(0);

  } catch (e) {
    console.error(`\n❌ 测试失败: ${e.message}`);
    console.error(`\n测试结果: ${passed} 通过, ${failed} 失败`);
    console.error("========================================");
    await browser.close();
    process.exit(1);
  }
}

runTest();
