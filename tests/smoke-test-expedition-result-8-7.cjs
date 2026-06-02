/**
 * smoke-test-expedition-result-8-7.cjs
 * 阶段8.7：远征结算系统 v1
 *
 * 验证：
 * 1. 纯函数 createSuccessExpeditionResult 正确
 * 2. 真实流程交付后写入 lastExpeditionResult
 * 3. ExpeditionResultScene 显示正确内容
 * 4. 再来一局能回到 RouteSelectScene
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/expedition-result");
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
  const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  page.on("pageerror", err => {
    console.error(`[浏览器错误] ${err.message}`);
    failed++;
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

  console.log("阶段8.7：远征结算系统 v1 测试");
  console.log("=".repeat(60));

  // ========== 1. window.game 存在 ==========
  console.log("1. window.game 存在");
  assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

  // ========== 2. 纯函数暴露 ==========
  console.log("2. 纯函数暴露到 window");
  const fnCheck = await page.evaluate(() => ({
    hasCreateSuccessExpeditionResult: typeof window.createSuccessExpeditionResult === "function",
    hasFormatExpeditionResult: typeof window.formatExpeditionResult === "function",
  }));
  assert(fnCheck.hasCreateSuccessExpeditionResult, "createSuccessExpeditionResult 已暴露");
  assert(fnCheck.hasFormatExpeditionResult, "formatExpeditionResult 已暴露");

  // ========== 3. 纯函数生成 resultType = success ==========
  console.log("3. 纯函数生成 resultType = success");
  const mockResult = await page.evaluate(() => {
    const mockOrder = {
      id: "test_order",
      title: "测试订单",
      cityId: "city_test",
      rewardSilver: 30,
      rewardEmbers: 5,
      cityContribution: 1,
    };
    const mockDelivery = {
      ok: true,
      rewardSilver: 30,
      rewardEmbers: 5,
      cityContribution: 1,
      updatedCargo: { grain: 2 },
    };
    const mockGameState = {
      cityContributions: { city_test: 1 },
      completedOrderIds: ["test_order"],
    };
    return window.createSuccessExpeditionResult({
      order: mockOrder,
      cityName: "测试城市",
      deliveryResult: mockDelivery,
      gameState: mockGameState,
    });
  });
  assert(mockResult.resultType === "success", `resultType = success (实际: ${mockResult.resultType})`);
  assert(mockResult.orderTitle === "测试订单", `orderTitle = 测试订单`);
  assert(mockResult.silverGained === 30, `silverGained = 30`);
  assert(mockResult.embersGained === 5, `embersGained = 5`);
  assert(mockResult.cityContributionGained === 1, `cityContributionGained = 1`);
  assert(mockResult.finalCityStatus === "已联络", `finalCityStatus = 已联络 (实际: ${mockResult.finalCityStatus})`);

  // ========== 4. summaryLines 包含订单完成 ==========
  console.log("4. summaryLines 包含订单完成");
  assert(mockResult.summaryLines.some(l => l.includes("订单完成")), `summaryLines 包含"订单完成"`);
  assert(mockResult.summaryLines.some(l => l.includes("测试订单")), `summaryLines 包含"测试订单"`);

  // ========== 5. formatExpeditionResult ==========
  console.log("5. formatExpeditionResult 返回正确文本");
  const fmtLines = await page.evaluate((result) => {
    return window.formatExpeditionResult(result);
  }, mockResult);
  assert(fmtLines.some(l => l.includes("远征成功")), `format 包含"远征成功"`);
  assert(fmtLines.some(l => l.includes("测试订单")), `format 包含"测试订单"`);
  assert(fmtLines.some(l => l.includes("30")), `format 包含银币 30`);

  // ========== 6. 真实流程进入 MapScene ==========
  console.log("6. 真实流程进入 MapScene");
  await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
  await sleep(2000);

  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
  });
  await sleep(1000);

  // 选择 3 个角色
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

  // 经过 CargoPrepScene
  await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs && cs.startExpedition) cs.startExpedition();
  });
  await sleep(1500);

  const cargoPrepReady = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
  assert(cargoPrepReady, "CargoPrepScene 就绪");

  await page.evaluate(() => {
    const scene = window.game.scene.getScene("CargoPrepScene");
    if (scene && scene.startExpedition) scene.startExpedition();
  });
  await sleep(2500);

  const mapReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
  assert(mapReady, "MapScene 就绪");

  // ========== 7. 记录初始状态 ==========
  console.log("7. 记录初始状态");
  const initialState = await page.evaluate(() => {
    const gs = window.getGameState();
    const order = gs.selectedOrderId ? window.getOrderById(gs.selectedOrderId) : null;
    return {
      orderId: gs.selectedOrderId,
      cityId: gs.selectedCityId,
      silver: gs.silver,
      embers: gs.embers,
      rewardSilver: order ? order.rewardSilver : 0,
      rewardEmbers: order ? order.rewardEmbers : 0,
      cityContribution: order ? order.cityContribution : 0,
    };
  });
  console.log(`    订单: ${initialState.orderId}, 银币: ${initialState.silver}, 火种: ${initialState.embers}`);

  // ========== 8. BFS 寻路到目标节点 ==========
  console.log("8. BFS 寻路到目标节点");
  const goalCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    const cells = gs.mapCells;
    for (let y = 0; y < gs.mapHeight; y++) {
      for (let x = 0; x < gs.mapWidth; x++) {
        const cell = cells[y][x];
        if (cell.isGoal || cell.type === "boss") {
          return { x, y, isGoal: cell.isGoal, type: cell.type };
        }
      }
    }
    return null;
  });
  assert(!!goalCheck, `找到目标节点: ${JSON.stringify(goalCheck)}`);

  const pathResult = await page.evaluate(({ gx, gy }) => {
    const gs = window.getGameState();
    const cells = gs.mapCells;
    const start = gs.currentPosition;
    const dirs = [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 }];
    const queue = [{ x: start.x, y: start.y, path: [] }];
    const visited = new Set([`${start.x},${start.y}`]);
    let foundPath = null;
    while (queue.length > 0) {
      const { x, y, path } = queue.shift();
      if (x === gx && y === gy) {
        foundPath = path;
        break;
      }
      for (const { dx, dy } of dirs) {
        const nx = x + dx, ny = y + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < gs.mapWidth && ny >= 0 && ny < gs.mapHeight && !visited.has(key)) {
          const cell = cells[ny][nx];
          if (cell.type !== "obstacle") {
            visited.add(key);
            queue.push({ x: nx, y: ny, path: [...path, { x: nx, y: ny }] });
          }
        }
      }
    }
    return { pathFound: !!foundPath, pathLength: foundPath ? foundPath.length : 0, path: foundPath || [] };
  }, { gx: goalCheck.x, gy: goalCheck.y });
  assert(pathResult.pathFound, `BFS 找到路径 (长度: ${pathResult.pathLength})`);
  console.log(`    路径长度: ${pathResult.pathLength} 步`);

  // ========== 9. 逐步移动到目标节点 ==========
  console.log("9. 逐步移动到目标节点");
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs._isAutoMoving = true;
    window.setGameState(gs);
  });

  const movePath = pathResult.path;
  let reachedGoal = false;
  for (let i = 0; i < Math.min(movePath.length, 100); i++) {
    const step = movePath[i];
    const prev = i > 0 ? movePath[i - 1] : await page.evaluate(() => window.getGameState().currentPosition);
    const dx = step.x - prev.x;
    const dy = step.y - prev.y;
    if (dy === -1) await page.keyboard.press("ArrowUp");
    else if (dy === 1) await page.keyboard.press("ArrowDown");
    else if (dx === -1) await page.keyboard.press("ArrowLeft");
    else if (dx === 1) await page.keyboard.press("ArrowRight");
    await sleep(150);
    if (step.x === goalCheck.x && step.y === goalCheck.y) {
      reachedGoal = true;
      console.log(`    到达目标节点 (${step.x}, ${step.y})，步数: ${i + 1}`);
      break;
    }
  }
  assert(reachedGoal, "成功移动到目标节点");

  await page.evaluate(() => {
    const gs = window.getGameState();
    gs._isAutoMoving = false;
    window.setGameState(gs);
  });
  await sleep(2000);

  // ========== 10. 验证 lastExpeditionResult 写入 ==========
  console.log("10. 验证 lastExpeditionResult 写入");
  const resultCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      hasResult: !!gs.lastExpeditionResult,
      resultType: gs.lastExpeditionResult ? gs.lastExpeditionResult.resultType : null,
      orderTitle: gs.lastExpeditionResult ? gs.lastExpeditionResult.orderTitle : null,
      silverGained: gs.lastExpeditionResult ? gs.lastExpeditionResult.silverGained : null,
      embersGained: gs.lastExpeditionResult ? gs.lastExpeditionResult.embersGained : null,
      cityContributionGained: gs.lastExpeditionResult ? gs.lastExpeditionResult.cityContributionGained : null,
      finalCityStatus: gs.lastExpeditionResult ? gs.lastExpeditionResult.finalCityStatus : null,
      remainingCargo: gs.lastExpeditionResult ? gs.lastExpeditionResult.remainingCargo : null,
    };
  });
  assert(resultCheck.hasResult, "lastExpeditionResult 已写入");
  assert(resultCheck.resultType === "success", `resultType = success (实际: ${resultCheck.resultType})`);
  assert(resultCheck.silverGained === initialState.rewardSilver, `silverGained = ${initialState.rewardSilver} (实际: ${resultCheck.silverGained})`);
  assert(resultCheck.embersGained === initialState.rewardEmbers, `embersGained = ${initialState.rewardEmbers} (实际: ${resultCheck.embersGained})`);
  assert(resultCheck.cityContributionGained === initialState.cityContribution, `cityContributionGained = ${initialState.cityContribution} (实际: ${resultCheck.cityContributionGained})`);
  assert(resultCheck.finalCityStatus === "已联络", `finalCityStatus = 已联络 (实际: ${resultCheck.finalCityStatus})`);
  console.log(`    订单: ${resultCheck.orderTitle}, 状态: ${resultCheck.finalCityStatus}`);

  // ========== 11. 截图交付弹窗 ==========
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "delivery-popup.png") });

  // ========== 12. 点击进入 ExpeditionResultScene ==========
  console.log("12. 点击进入 ExpeditionResultScene");
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return;
    // 点击"查看结算"按钮（depth 902-903 的交互元素）
    for (const child of ms.children.list) {
      if (child.depth >= 902 && child.input && child.input.enabled) {
        child.emit("pointerdown");
        break;
      }
    }
  });
  await sleep(2000);

  const resultSceneReady = await page.evaluate(() => !!window.game.scene.getScene("ExpeditionResultScene"));
  assert(resultSceneReady, "ExpeditionResultScene 就绪");

  // ========== 13. 验证 ExpeditionResultScene 显示内容 ==========
  console.log("13. 验证 ExpeditionResultScene 显示内容");
  const sceneCheck = await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return { ok: false, texts: [] };
    const texts = ers.children.list.filter(c => c.type === "Text").map(t => t.text);
    return {
      ok: true,
      texts,
      hasSuccess: texts.some(t => t.includes("远征成功")),
      hasOrderTitle: texts.some(t => t.includes("订单完成")),
      hasSilver: texts.some(t => t.includes("银币")),
      hasEmbers: texts.some(t => t.includes("火种")),
      hasCityStatus: texts.some(t => t.includes("城市状态")),
      hasContacted: texts.some(t => t.includes("已联络")),
    };
  });
  assert(sceneCheck.ok, "ExpeditionResultScene 场景存在");
  assert(sceneCheck.hasSuccess, `显示"远征成功"`);
  assert(sceneCheck.hasOrderTitle, `显示"订单完成"`);
  assert(sceneCheck.hasSilver, `显示银币信息`);
  assert(sceneCheck.hasEmbers, `显示火种信息`);
  assert(sceneCheck.hasCityStatus, `显示"城市状态"`);
  assert(sceneCheck.hasContacted, `显示"已联络"`);
  console.log(`    显示内容: ${JSON.stringify(sceneCheck.texts.filter(t => t.length > 0).slice(0, 10))}`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "expedition-result-scene.png") });

  // ========== 14. 点击"再来一局"回到 RouteSelectScene ==========
  console.log("14. 点击再来一局回到 RouteSelectScene");
  await page.evaluate(() => {
    const ers = window.game.scene.getScene("ExpeditionResultScene");
    if (!ers) return;
    // 找到"再来一局"按钮（第二个按钮）
    const buttons = ers.children.list.filter(c => c.type === "Rectangle" && c.input && c.input.enabled);
    if (buttons.length >= 2) {
      buttons[1].emit("pointerdown");
    }
  });
  await sleep(2000);

  const routeSelectReady = await page.evaluate(() => !!window.game.scene.getScene("RouteSelectScene"));
  assert(routeSelectReady, "点击再来一局后回到 RouteSelectScene");

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "back-to-route-select.png") });

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
