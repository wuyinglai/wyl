/**
 * smoke-test-order-cargo-8-3.cjs
 * 阶段8.3：订单需求与货物状态关联加强
 *
 * 验证：
 * 1. checkOrderCargo 纯函数正确性
 * 2. formatMissingGoods 中文格式化
 * 3. getOrderCargoStatusText 状态文本
 * 4. checkCargoWeight 载重检查
 * 5. getCargoWeightStatusText 载重文本
 * 6. MapScene 集成显示
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/order-cargo");
const PASSED = [], FAILED = [];
let passed = 0, failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${msg}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${msg}`);
    FAILED.push(msg);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const fs = require("fs");
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("pageerror", err => {
    console.error(`[浏览器错误] ${err.message}`);
    failed++;
  });

  await page.addInitScript(() => {
          window.__EMBER_TEST_MODE__ = true;
        });
        
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

  console.log("阶段8.3：订单需求与货物状态关联加强测试");
  console.log("=".repeat(60));

  // ========== 1. window.game 存在 ==========
  console.log("1. window.game 存在");
  const gameReady = await page.evaluate(() => !!window.game);
  assert(gameReady, "window.game 存在");

  // ========== 2-4. checkOrderCargo 纯函数测试 ==========
  console.log("2-4. checkOrderCargo 纯函数测试");
  const orderCargoTests = await page.evaluate(() => {
    const results = [];

    // 测试2：货物充足
    const order1 = {
      id: "order_test_1",
      requiredGoods: { grain: 5, medicine: 2 },
    };
    const cargo1 = { grain: 5, medicine: 2, iron: 3 };
    const check1 = window.checkOrderCargo(order1, cargo1);
    results.push({
      name: "货物充足",
      hasEnoughCargo: check1.hasEnoughCargo,
      hasOrder: check1.hasOrder,
      missingGoodsEmpty: Object.keys(check1.missingGoods).length === 0,
    });

    // 测试3：货物不足
    const order2 = {
      id: "order_test_2",
      requiredGoods: { grain: 8, medicine: 2 },
    };
    const cargo2 = { grain: 5 };
    const check2 = window.checkOrderCargo(order2, cargo2);
    results.push({
      name: "货物不足",
      hasEnoughCargo: check2.hasEnoughCargo,
      hasOrder: check2.hasOrder,
      missingGrain: check2.missingGoods.grain,
      missingMedicine: check2.missingGoods.medicine,
    });

    // 测试4：missingGoods 计算正确
    // required { grain: 8, medicine: 2 }, cargo { grain: 5 }
    // missing { grain: 3, medicine: 2 }
    const expectedMissing = { grain: 3, medicine: 2 };
    const actualMissing = check2.missingGoods;
    results.push({
      name: "missingGoods 计算",
      grainCorrect: actualMissing.grain === expectedMissing.grain,
      medicineCorrect: actualMissing.medicine === expectedMissing.medicine,
    });

    return results;
  });

  assert(orderCargoTests[0].hasEnoughCargo, "货物充足时 hasEnoughCargo = true");
  assert(orderCargoTests[0].missingGoodsEmpty, "货物充足时 missingGoods 为空");
  assert(!orderCargoTests[1].hasEnoughCargo, "货物不足时 hasEnoughCargo = false");
  assert(orderCargoTests[2].grainCorrect, `missingGoods grain = 3 (实际: ${orderCargoTests[1].missingGrain})`);
  assert(orderCargoTests[2].medicineCorrect, `missingGoods medicine = 2 (实际: ${orderCargoTests[1].missingMedicine})`);

  // ========== 5. formatMissingGoods 中文名 ==========
  console.log("5. formatMissingGoods 中文名");
  const formatTests = await page.evaluate(() => {
    const missing1 = { grain: 3, medicine: 2 };
    const text1 = window.formatMissingGoods(missing1);
    const emptyText = window.formatMissingGoods({});
    return { text1, emptyText, hasGrain: text1.includes("粮食"), hasMedicine: text1.includes("药材") };
  });
  assert(formatTests.emptyText === "无", `空对象返回 "无" (实际: "${formatTests.emptyText}")`);
  assert(formatTests.hasGrain, `formatMissingGoods 包含 "粮食" (实际: "${formatTests.text1}")`);
  assert(formatTests.hasMedicine, `formatMissingGoods 包含 "药材" (实际: "${formatTests.text1}")`);
  console.log(`    格式化结果: "${formatTests.text1}"`);

  // ========== 6-7. getOrderCargoStatusText ==========
  console.log("6-7. getOrderCargoStatusText 状态文本");
  const statusTests = await page.evaluate(() => {
    const order = { id: "order_test", requiredGoods: { grain: 5 } };
    const enoughCargo = { grain: 5 };
    const notEnoughCargo = { grain: 3 };
    const noOrder = undefined;

    const textEnough = window.getOrderCargoStatusText(order, enoughCargo);
    const textNotEnough = window.getOrderCargoStatusText(order, notEnoughCargo);
    const textNoOrder = window.getOrderCargoStatusText(noOrder, {});

    return { textEnough, textNotEnough, textNoOrder };
  });
  assert(statusTests.textEnough.includes("物资已备齐"),
    `货物足够时包含 "物资已备齐" (实际: "${statusTests.textEnough}")`);
  assert(statusTests.textNotEnough.includes("缺少"),
    `货物不足时包含 "缺少" (实际: "${statusTests.textNotEnough}")`);
  assert(statusTests.textNoOrder.includes("未选择"),
    `无订单时包含 "未选择" (实际: "${statusTests.textNoOrder}")`);
  console.log(`    足够: "${statusTests.textEnough}"`);
  console.log(`    不足: "${statusTests.textNotEnough}"`);

  // ========== 8-9. checkCargoWeight ==========
  console.log("8-9. checkCargoWeight 载重检查");
  const weightTests = await page.evaluate(() => {
    // grain weight=1, iron weight=2
    const normalCargo = { grain: 10 }; // weight=10
    const overweightCargo = { grain: 10, iron: 10 }; // weight=30

    const checkNormal = window.checkCargoWeight(normalCargo, 20);
    const checkOver = window.checkCargoWeight(overweightCargo, 20);

    return {
      normal: {
        isOverweight: checkNormal.isOverweight,
        currentWeight: checkNormal.currentWeight,
        maxWeight: checkNormal.maxWeight,
      },
      over: {
        isOverweight: checkOver.isOverweight,
        overweightBy: checkOver.overweightBy,
        currentWeight: checkOver.currentWeight,
      },
    };
  });
  assert(!weightTests.normal.isOverweight,
    `正常载重时 isOverweight = false (weight: ${weightTests.normal.currentWeight}/${weightTests.normal.maxWeight})`);
  assert(weightTests.over.isOverweight,
    `超重时 isOverweight = true (weight: ${weightTests.over.currentWeight}, overBy: ${weightTests.over.overweightBy})`);
  assert(weightTests.over.overweightBy === 10,
    `超重 10 (实际: ${weightTests.over.overweightBy})`);

  // ========== 10. getCargoWeightStatusText ==========
  console.log("10. getCargoWeightStatusText 载重文本");
  const weightTextTests = await page.evaluate(() => {
    const normalText = window.getCargoWeightStatusText({ grain: 10 }, 20);
    const overText = window.getCargoWeightStatusText({ grain: 10, iron: 10 }, 20);
    const undefinedMax = window.getCargoWeightStatusText({ grain: 5 }, undefined);
    return { normalText, overText, undefinedMax };
  });
  assert(!weightTextTests.normalText.includes("超重"),
    `正常载重时不包含 "超重" (实际: "${weightTextTests.normalText}")`);
  assert(weightTextTests.overText.includes("超重"),
    `超重时包含 "超重" (实际: "${weightTextTests.overText}")`);
  console.log(`    正常: "${weightTextTests.normalText}"`);
  console.log(`    超重: "${weightTextTests.overText}"`);

  // ========== 11-14. 真实流程测试 ==========
  console.log("11-14. 真实流程进入 MapScene 验证订单状态显示");

  // 进入 RouteSelectScene
  await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
  await sleep(1500);

  // 选择第一条商路
  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
  });
  await sleep(2000);

  // 选择角色并开始远征
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
  await sleep(2000);

  // 阶段8.5：经过 CargoPrepScene
  const cargoPrepReady = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
  assert(cargoPrepReady, "CargoPrepScene 就绪");

  // 点击开始远征
  await page.evaluate(() => {
    const scene = window.game.scene.getScene("CargoPrepScene");
    if (scene && scene.startExpedition) scene.startExpedition();
  });
  await sleep(3000);

  // 截图验证
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "mapscene-order-status.png") });

  // 检查 MapScene 信息面板文本
  const panelTexts = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return [];
    const texts = [];
    for (const child of (ms.children.list || [])) {
      if (child.type === "Text" && child.depth >= 100 && child.depth < 110) {
        texts.push(child.text);
      }
    }
    return texts;
  });
  const panelText = panelTexts.join("|");
  console.log(`    信息面板文本: "${panelText.substring(0, 100)}..."`);

  // 测试11：订单状态显示"物资已备齐"
  assert(panelText.includes("物资已备齐") || panelText.includes("订单状态"),
    `MapScene 信息面板显示订单状态 (实际: "${panelText.substring(0, 60)}...")`);

  // 测试12：手动减少 cargo 后显示缺少
  const afterReduce = await page.evaluate(() => {
    const gs = window.getGameState();
    // 模拟减少货物
    gs.cargo = { grain: 2 }; // 原本需要 5
    const order = gs.selectedOrderId ? window.getOrderById(gs.selectedOrderId) : undefined;
    const status = window.getOrderCargoStatusText(order, gs.cargo);
    return { status, hasMissing: status.includes("缺少") };
  });
  assert(afterReduce.hasMissing,
    `减少 cargo 后状态显示缺少 (实际: "${afterReduce.status}")`);
  console.log(`    减少货物后: "${afterReduce.status}"`);

  // 测试13：超重检查
  const overweightCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    gs.cargo = { grain: 50 }; // 超载
    gs.maxCargoWeight = 20;
    const check = window.checkCargoWeight(gs.cargo, gs.maxCargoWeight);
    const text = window.getCargoWeightStatusText(gs.cargo, gs.maxCargoWeight);
    return { isOverweight: check.isOverweight, text, hasOverweightText: text.includes("超重") };
  });
  assert(overweightCheck.isOverweight, "超重检测正确");
  assert(overweightCheck.hasOverweightText,
    `超重状态文本包含"超重" (实际: "${overweightCheck.text}")`);
  console.log(`    超重状态: "${overweightCheck.text}"`);

  // 恢复 cargo
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs.cargo = { grain: 5 };
    gs.maxCargoWeight = 20;
  });

  // 测试14：进入战斗后返回，状态不丢失
  console.log("14. 战斗后返回 MapScene，订单/货物状态不丢失");
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    const gs = window.getGameState();
    const neighbors = window.getMovableNeighbors(gs);
    const cells = gs.mapCells || [];
    for (const n of neighbors) {
      if (n.y >= 0 && n.y < cells.length && n.x >= 0 && n.x < cells[n.y].length) {
        const cell = cells[n.y][n.x];
        if (cell && cell.type === "question") {
          cell.resolvedType = "combat";
          cell.isRevealed = true;
          ms.tryMoveTo(n.x, n.y);
          break;
        }
      }
    }
  });
  await sleep(4000);

  const beforeBattle = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      selectedOrderId: gs.selectedOrderId,
      cargo: JSON.stringify(gs.cargo),
    };
  });

  // 结束战斗
  await page.evaluate(() => {
    const bs = window.game.scene.getScene("BattleScene");
    if (bs && !bs.battleEnded) bs.onBattleEnd(true);
  });
  await sleep(2000);

  const afterBattle = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      selectedOrderId: gs.selectedOrderId,
      cargo: JSON.stringify(gs.cargo),
    };
  });

  assert(afterBattle.selectedOrderId === beforeBattle.selectedOrderId,
    `战斗后 selectedOrderId 不丢失`);
  assert(afterBattle.cargo === beforeBattle.cargo,
    `战斗后 cargo 不丢失`);

  // ========== 总结 ==========
  console.log("=".repeat(60));
  console.log(`测试完成: ${passed} passed, ${failed} failed`);
  if (FAILED.length > 0) {
    console.error("失败项:");
    FAILED.forEach(f => console.error(`  - ${f}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
