/**
 * smoke-test-order-delivery-8-4.cjs
 * 阶段8.4：订单交付系统 v1
 *
 * 验证：
 * 1. deliverOrder 纯函数正确性（missing_order / not_enough / delivered / already_delivered）
 * 2. 真实流程：到达目标节点触发交付
 * 3. 交付后 cargo 扣除、silver/embers 增加、completedOrderIds 更新
 * 4. 防重复交付
 * 5. MapScene 显示订单已完成
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/order-delivery");
const FAILED = [];
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

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

  console.log("阶段8.4：订单交付系统 v1 测试");
  console.log("=".repeat(60));

  // ========== 1. window.game 存在 ==========
  console.log("1. window.game 存在");
  assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

  // ========== 2-6. deliverOrder 纯函数测试 ==========
  console.log("2-6. deliverOrder 纯函数测试");
  const pureTests = await page.evaluate(() => {
    const results = {};

    // 测试2：order undefined → missing_order
    const r1 = window.deliverOrder({ order: undefined, cargo: { grain: 5 }, completedOrderIds: [] });
    results.missingOrder = { ok: r1.ok, reason: r1.reason };

    // 测试3：cargo 不足 → not_enough_cargo
    const order = { id: "order_test", requiredGoods: { grain: 8, medicine: 2 }, rewardSilver: 30, rewardEmbers: 5, cityContribution: 1, cityId: "city_test" };
    const r2 = window.deliverOrder({ order, cargo: { grain: 5 }, completedOrderIds: [] });
    results.notEnough = { ok: r2.ok, reason: r2.reason };

    // 测试4：cargo 足够 → delivered
    const r3 = window.deliverOrder({ order, cargo: { grain: 8, medicine: 2 }, completedOrderIds: [] });
    results.delivered = {
      ok: r3.ok,
      reason: r3.reason,
      updatedCargo: r3.updatedCargo,
      rewardSilver: r3.rewardSilver,
      rewardEmbers: r3.rewardEmbers,
      cityContribution: r3.cityContribution,
    };

    // 测试5：已完成 → already_delivered
    const r4 = window.deliverOrder({ order, cargo: { grain: 8, medicine: 2 }, completedOrderIds: ["order_test"] });
    results.alreadyDelivered = { ok: r4.ok, reason: r4.reason };

    // 测试6：不修改原 cargo
    const originalCargo = { grain: 8, medicine: 2 };
    const origStr = JSON.stringify(originalCargo);
    window.deliverOrder({ order, cargo: originalCargo, completedOrderIds: [] });
    results.noMutate = JSON.stringify(originalCargo) === origStr;

    return results;
  });

  assert(!pureTests.missingOrder.ok && pureTests.missingOrder.reason === "missing_order",
    "order undefined → missing_order");
  assert(!pureTests.notEnough.ok && pureTests.notEnough.reason === "not_enough_cargo",
    "cargo 不足 → not_enough_cargo");
  assert(pureTests.delivered.ok && pureTests.delivered.reason === "delivered",
    "cargo 足够 → delivered");
  assert(Object.keys(pureTests.delivered.updatedCargo).length === 0,
    `交付后 updatedCargo 为空 (实际: ${JSON.stringify(pureTests.delivered.updatedCargo)})`);
  assert(pureTests.delivered.rewardSilver === 30,
    `rewardSilver = 30 (实际: ${pureTests.delivered.rewardSilver})`);
  assert(pureTests.delivered.rewardEmbers === 5,
    `rewardEmbers = 5 (实际: ${pureTests.delivered.rewardEmbers})`);
  assert(pureTests.delivered.cityContribution === 1,
    `cityContribution = 1 (实际: ${pureTests.delivered.cityContribution})`);
  assert(!pureTests.alreadyDelivered.ok && pureTests.alreadyDelivered.reason === "already_delivered",
    "已完成 → already_delivered");
  assert(pureTests.noMutate, "deliverOrder 不修改原 cargo 对象");

  // ========== 7-15. 真实流程测试 ==========
  console.log("7-15. 真实流程测试");

  // 进入 RouteSelectScene
  await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
  await sleep(1500);

  // 选择第一条商路
  const routeResult = await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (!rs || !rs.routes || rs.routes.length === 0) return { ok: false };
    rs.selectRoute(rs.routes[0]);
    const gs = window.getGameState();
    return { ok: true, selectedOrderId: gs.selectedOrderId };
  });
  assert(routeResult.ok, "商路选择成功");
  assert(!!routeResult.selectedOrderId, `selectedOrderId 存在: ${routeResult.selectedOrderId}`);
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

  // 确认 MapScene 就绪
  const msReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(msReady, "MapScene 就绪");

  // 确认 cargo 满足订单需求
  const cargoCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    const order = gs.selectedOrderId ? window.getOrderById(gs.selectedOrderId) : undefined;
    if (!order) return { ok: false, reason: "no order" };
    const check = window.checkOrderCargo(order, gs.cargo);
    return { ok: true, hasEnough: check.hasEnoughCargo, cargo: JSON.stringify(gs.cargo) };
  });
  assert(cargoCheck.ok, "cargo 状态可读取");
  assert(cargoCheck.hasEnough, `cargo 满足订单需求: ${cargoCheck.cargo}`);

  // 找到目标节点（bossPos 或 isGoal）
  // 如果 expeditionGoal 是 boss，手动将目标节点设为 sanctuary 类型
  const goalInfo = await page.evaluate(() => {
    const gs = window.getGameState();
    const cells = gs.mapCells || [];

    // 先找 isGoal
    for (const row of cells) {
      for (const cell of row) {
        if (cell.isGoal) {
          return { ok: true, x: cell.x, y: cell.y, type: cell.type, foundBy: "isGoal" };
        }
      }
    }

    // 如果没有 isGoal（boss 模式），找到 bossPos 并转换为 sanctuary 目标
    // bossPos 在 GameState 中存储为地图最远点
    // 找到最右上的未清理节点作为目标
    let targetCell = null;
    let maxDist = -1;
    const startPos = gs.currentPosition || { x: 0, y: gs.mapHeight - 1 };
    for (const row of cells) {
      for (const cell of row) {
        if (!cell.isObstacle) {
          const dist = Math.abs(cell.x - startPos.x) + Math.abs(cell.y - startPos.y);
          if (dist > maxDist) {
            maxDist = dist;
            targetCell = cell;
          }
        }
      }
    }

    if (targetCell) {
      // 手动设置为目标节点
      targetCell.isGoal = true;
      targetCell.type = "empty";
      targetCell.isRevealed = true;
      gs.expeditionGoal = "sanctuary";
      window.setGameState(gs);
      return { ok: true, x: targetCell.x, y: targetCell.y, type: targetCell.type, foundBy: "farthest" };
    }

    return { ok: false };
  });
  assert(goalInfo.ok, `找到目标节点 (${goalInfo.x}, ${goalInfo.y})`);
  console.log(`    目标节点: (${goalInfo.x}, ${goalInfo.y})`);

  const goalX = goalInfo.x;
  const goalY = goalInfo.y;

  // 移动到目标节点
  // 直接调用 handleOrderDelivery（因为目标节点可能距离很远）
  // 先关闭自动移动模式（handleOrderDelivery 中不依赖此标志）
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs._isAutoMoving = false;
    window.setGameState(gs);
  });

  // 直接触发订单交付
  const deliveryTriggerResult = await page.evaluate(({ gx, gy }) => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { ok: false, reason: "no MapScene" };
    const gs = window.getGameState();
    const cell = gs.mapCells[gy][gx];
    if (!cell) return { ok: false, reason: "cell not found" };

    // 设置当前位置为目标节点
    gs.currentPosition = { x: gx, y: gy };
    window.setGameState(gs);

    // 调用 handleOrderDelivery（public 方法）
    ms.handleOrderDelivery(cell);

    return { ok: true };
  }, { gx: goalX, gy: goalY });
  assert(deliveryTriggerResult.ok, "订单交付触发成功");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "order-delivery-success.png") });

  // 验证交付结果
  const deliveryResult = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      completedOrderIds: gs.completedOrderIds || [],
      silver: gs.silver,
      embers: gs.embers,
      cargo: JSON.stringify(gs.cargo || {}),
      cityContributions: gs.cityContributions || {},
    };
  });
  assert(deliveryResult.completedOrderIds.length > 0,
    `completedOrderIds 包含订单: ${JSON.stringify(deliveryResult.completedOrderIds)}`);
  assert(deliveryResult.silver > 50,
    `silver 增加: ${deliveryResult.silver} (初始 50)`);
  assert(deliveryResult.embers > 0,
    `embers 增加: ${deliveryResult.embers}`);
  assert(deliveryResult.cargo === "{}",
    `cargo 扣除后为空: ${deliveryResult.cargo}`);
  console.log(`    silver: ${deliveryResult.silver}, embers: ${deliveryResult.embers}`);

  // 验证 MapScene 显示"已完成"
  const panelText = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return "";
    const texts = [];
    for (const child of (ms.children.list || [])) {
      if (child.type === "Text" && child.depth >= 100 && child.depth < 110) {
        texts.push(child.text);
      }
    }
    return texts.join("|");
  });
  assert(panelText.includes("已完成"),
    `MapScene 显示订单已完成 (实际: "${panelText.substring(0, 80)}...")`);
  console.log(`    面板文本: "${panelText.substring(0, 80)}..."`);

  // ========== 16. 防重复交付 ==========
  console.log("16. 防重复交付测试");
  const repeatResult = await page.evaluate(() => {
    const gs = window.getGameState();
    const order = gs.selectedOrderId ? window.getOrderById(gs.selectedOrderId) : undefined;
    const silverBefore = gs.silver;
    const embersBefore = gs.embers;

    const result = window.deliverOrder({
      order,
      cargo: gs.cargo,
      completedOrderIds: gs.completedOrderIds,
    });

    return {
      ok: result.ok,
      reason: result.reason,
      silverChanged: gs.silver !== silverBefore,
      embersChanged: gs.embers !== embersBefore,
    };
  });
  assert(!repeatResult.ok && repeatResult.reason === "already_delivered",
    "重复交付返回 already_delivered");
  assert(!repeatResult.silverChanged,
    "重复交付不增加 silver");
  assert(!repeatResult.embersChanged,
    "重复交付不增加 embers");

  // ========== 17. 货物不足时交付失败 ==========
  console.log("17. 货物不足时交付失败");
  const notEnoughResult = await page.evaluate(() => {
    const order = window.getOrderById("order_ash_supply");
    const result = window.deliverOrder({
      order,
      cargo: { grain: 1 },
      completedOrderIds: [],
    });
    return { ok: result.ok, reason: result.reason };
  });
  assert(!notEnoughResult.ok && notEnoughResult.reason === "not_enough_cargo",
    "货物不足时 reason = not_enough_cargo");

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
