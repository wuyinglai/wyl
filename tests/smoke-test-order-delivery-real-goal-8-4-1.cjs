/**
 * smoke-test-order-delivery-real-goal-8-4-1.cjs
 * 阶段8.4.1：修复订单交付目标点生成与真实触发
 *
 * 验证：
 * 1. 有订单时 expeditionGoal 强制为 sanctuary
 * 2. 地图生成后存在 isGoal 节点
 * 3. 通过真实移动到达目标节点触发交付
 * 4. 交付后 cargo/silver/embers 正确更新
 * 5. 防重复交付
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/order-delivery-real");
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

/**
 * BFS 寻路：从 start 到 goal 的最短路径（只走非障碍格）
 * 返回方向序列 [{x, y}, ...]
 */
function bfsPath(cells, start, goal) {
  const rows = cells.length;
  const cols = cells[0].length;
  const visited = new Set();
  const queue = [{ x: start.x, y: start.y, path: [] }];
  visited.add(`${start.x},${start.y}`);

  const dirs = [
    { dx: 0, dy: -1 }, // 上
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
    { dx: 1, dy: 0 },  // 右
  ];

  while (queue.length > 0) {
    const { x, y, path } = queue.shift();
    if (x === goal.x && y === goal.y) return path;

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(key)) {
        const cell = cells[ny][nx];
        if (cell.type !== "obstacle") {
          visited.add(key);
          queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
        }
      }
    }
  }
  return null; // 无路径
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

  console.log("阶段8.4.1：订单交付目标点生成与真实触发测试");
  console.log("=".repeat(60));

  // ========== 1. 游戏初始化 ==========
  console.log("1. 游戏初始化");
  assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

  // ========== 2. 选择商路 ==========
  console.log("2. 选择商路");
  await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
  await sleep(1500);

  const routeResult = await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (!rs || !rs.routes || rs.routes.length === 0) return { ok: false };
    rs.selectRoute(rs.routes[0]);
    const gs = window.getGameState();
    return { ok: true, selectedOrderId: gs.selectedOrderId };
  });
  assert(routeResult.ok, "商路选择成功");
  assert(!!routeResult.selectedOrderId, `selectedOrderId: ${routeResult.selectedOrderId}`);
  await sleep(2000);

  // ========== 3. 开始远征 ==========
  console.log("3. 开始远征");
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

  const msReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(msReady, "MapScene 就绪");

  // ========== 4. 验证 expeditionGoal 和 isGoal ==========
  console.log("4. 验证 expeditionGoal 和 isGoal 节点");
  const goalCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    const cells = gs.mapCells || [];
    let goalCell = null;
    for (const row of cells) {
      for (const cell of row) {
        if (cell.isGoal) {
          goalCell = { x: cell.x, y: cell.y, type: cell.type };
          break;
        }
      }
      if (goalCell) break;
    }
    return {
      expeditionGoal: gs.expeditionGoal,
      selectedOrderId: gs.selectedOrderId,
      goalCell,
      hasGoal: !!goalCell,
    };
  });
  assert(goalCheck.expeditionGoal === "sanctuary",
    `有订单时 expeditionGoal = "sanctuary" (实际: "${goalCheck.expeditionGoal}")`);
  assert(goalCheck.hasGoal,
    `地图存在 isGoal 节点 (${goalCheck.goalCell ? `${goalCheck.goalCell.x},${goalCheck.goalCell.y}` : "无"})`);
  console.log(`    expeditionGoal: ${goalCheck.expeditionGoal}, 目标: (${goalCheck.goalCell.x}, ${goalCheck.goalCell.y})`);

  // ========== 5. BFS 寻路并逐步移动到目标 ==========
  console.log("5. BFS 寻路并逐步移动到目标节点");
  const pathResult = await page.evaluate(({ gx, gy }) => {
    const gs = window.getGameState();
    const cells = gs.mapCells || [];
    const start = gs.currentPosition;
    const goal = { x: gx, y: gy };

    // BFS
    const rows = cells.length;
    const cols = cells[0].length;
    const visited = new Set();
    const queue = [{ x: start.x, y: start.y, path: [] }];
    visited.add(`${start.x},${start.y}`);

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    let foundPath = null;
    while (queue.length > 0) {
      const { x, y, path } = queue.shift();
      if (x === goal.x && y === goal.y) {
        foundPath = path;
        break;
      }
      for (const { dx, dy } of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(key)) {
          const cell = cells[ny][nx];
          if (cell.type !== "obstacle") {
            visited.add(key);
            queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
          }
        }
      }
    }

    return {
      pathFound: !!foundPath,
      pathLength: foundPath ? foundPath.length : 0,
      start: start,
      goal: goal,
      path: foundPath || [],
    };
  }, { gx: goalCheck.goalCell.x, gy: goalCheck.goalCell.y });

  assert(pathResult.pathFound, `BFS 找到路径 (长度: ${pathResult.pathLength})`);
  console.log(`    路径长度: ${pathResult.pathLength} 步`);

  if (!pathResult.pathFound) {
    console.error("无法找到到达目标节点的路径，跳过移动测试");
    await browser.close();
    process.exit(1);
  }

  // 逐步移动（通过键盘方向键触发 tryMoveTo）
  // 设置自动移动模式以跳过战斗
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs._isAutoMoving = true;
    window.setGameState(gs);
  });

  const movePath = pathResult.path;
  const MAX_STEPS = Math.min(movePath.length, 100); // 限制最大步数
  let reachedGoal = false;

  for (let i = 0; i < MAX_STEPS; i++) {
    const step = movePath[i];
    const prev = i > 0 ? movePath[i - 1] : pathResult.start;

    // 计算方向
    const dx = step.x - prev.x;
    const dy = step.y - prev.y;

    // 按方向键
    if (dy === -1) await page.keyboard.press("ArrowUp");
    else if (dy === 1) await page.keyboard.press("ArrowDown");
    else if (dx === -1) await page.keyboard.press("ArrowLeft");
    else if (dx === 1) await page.keyboard.press("ArrowRight");

    await sleep(150); // 等待移动完成

    // 检查是否到达目标
    if (step.x === goalCheck.goalCell.x && step.y === goalCheck.goalCell.y) {
      reachedGoal = true;
      console.log(`    到达目标节点 (${step.x}, ${step.y})，步数: ${i + 1}`);
      break;
    }
  }

  // 关闭自动移动
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs._isAutoMoving = false;
    window.setGameState(gs);
  });

  assert(reachedGoal, "成功移动到目标节点");

  // 等待弹窗和交付处理
  await sleep(2000);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "real-delivery-at-goal.png") });

  // ========== 6. 验证交付结果 ==========
  console.log("6. 验证交付结果");
  const deliveryResult = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      completedOrderIds: gs.completedOrderIds || [],
      silver: gs.silver,
      embers: gs.embers,
      cargo: JSON.stringify(gs.cargo || {}),
      cityContributions: gs.cityContributions || {},
      currentPosition: gs.currentPosition,
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

  // 验证 cityContributions
  const hasContrib = Object.values(deliveryResult.cityContributions).some(v => v > 0);
  assert(hasContrib,
    `cityContributions 有值: ${JSON.stringify(deliveryResult.cityContributions)}`);

  // ========== 7. 验证面板显示已完成 ==========
  console.log("7. 验证面板显示已完成");
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

  // 关闭弹窗（如果有）
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return;
    // 点击关闭弹窗（depth 900 的背景矩形）
    for (const child of ms.children.list) {
      if (child.type === "Rectangle" && child.depth === 900) {
        child.emit("pointerdown");
        break;
      }
    }
  });
  await sleep(500);

  // ========== 8. 防重复交付 ==========
  console.log("8. 防重复交付");
  const repeatCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    const order = gs.selectedOrderId ? window.getOrderById(gs.selectedOrderId) : undefined;
    const result = window.deliverOrder({
      order,
      cargo: gs.cargo,
      completedOrderIds: gs.completedOrderIds,
    });
    return {
      ok: result.ok,
      reason: result.reason,
    };
  });
  assert(!repeatCheck.ok && repeatCheck.reason === "already_delivered",
    `重复交付返回 already_delivered (实际: ${repeatCheck.reason})`);

  // ========== 9. 纯函数测试（保留） ==========
  console.log("9. deliverOrder 纯函数测试");
  const pureTests = await page.evaluate(() => {
    const order = { id: "order_pure_test", requiredGoods: { grain: 5 }, rewardSilver: 30, rewardEmbers: 5, cityContribution: 1, cityId: "city_test" };

    // missing_order
    const r1 = window.deliverOrder({ order: undefined, cargo: {}, completedOrderIds: [] });

    // not_enough_cargo
    const r2 = window.deliverOrder({ order, cargo: { grain: 2 }, completedOrderIds: [] });

    // delivered
    const r3 = window.deliverOrder({ order, cargo: { grain: 5 } , completedOrderIds: [] });

    // 不修改原 cargo
    const origCargo = { grain: 5 };
    const origStr = JSON.stringify(origCargo);
    window.deliverOrder({ order, cargo: origCargo, completedOrderIds: [] });
    const noMutate = JSON.stringify(origCargo) === origStr;

    return {
      missingOrder: !r1.ok && r1.reason === "missing_order",
      notEnough: !r2.ok && r2.reason === "not_enough_cargo",
      delivered: r3.ok && r3.reason === "delivered" && r3.rewardSilver === 30,
      noMutate,
    };
  });
  assert(pureTests.missingOrder, "order undefined → missing_order");
  assert(pureTests.notEnough, "cargo 不足 → not_enough_cargo");
  assert(pureTests.delivered, "cargo 足够 → delivered, rewardSilver=30");
  assert(pureTests.noMutate, "deliverOrder 不修改原 cargo");

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
