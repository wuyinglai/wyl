/**
 * smoke-test-city-progress-8-6.cjs
 * 阶段8.6：城市贡献与城市状态 v1（真实验收版）
 *
 * 验证：
 * 1. 纯函数：getCityProgress 在各种输入下正确
 * 2. 状态阈值：0→lost, 1→contacted, 3→recovering, 6→stable
 * 3. formatCityProgress 返回正确文本
 * 4. RouteSelectScene 显示城市状态
 * 5. MapScene 信息面板显示城市状态
 * 6. 真实交付后城市贡献增加
 * 7. 真实交付后城市状态 UI 变化可见
 * 8. 重复交付不重复增加贡献
 */

const { chromium } = require("playwright");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "../test-artifacts/city-progress");
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

  await page.addInitScript(() => {
          window.__EMBER_TEST_MODE__ = true;
        });
        
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

  console.log("阶段8.6：城市贡献与城市状态 v1 测试（真实验收版）");
  console.log("=".repeat(60));

  // ========== 1. window.game 存在 ==========
  console.log("1. window.game 存在");
  assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

  // ========== 2. 纯函数暴露 ==========
  console.log("2. 纯函数暴露到 window");
  const fnCheck = await page.evaluate(() => ({
    hasGetCityProgress: typeof window.getCityProgress === "function",
    hasGetCityStatusLabel: typeof window.getCityStatusLabel === "function",
    hasFormatCityProgress: typeof window.formatCityProgress === "function",
    hasGetCityProgressDetailLines: typeof window.getCityProgressDetailLines === "function",
  }));
  assert(fnCheck.hasGetCityProgress, "getCityProgress 已暴露");
  assert(fnCheck.hasGetCityStatusLabel, "getCityStatusLabel 已暴露");
  assert(fnCheck.hasFormatCityProgress, "formatCityProgress 已暴露");
  assert(fnCheck.hasGetCityProgressDetailLines, "getCityProgressDetailLines 已暴露");

  // ========== 3. undefined cityContributions 不崩溃 ==========
  console.log("3. undefined cityContributions 不崩溃");
  const undefCheck = await page.evaluate(() => {
    const result = window.getCityProgress("city_ash_post", undefined);
    return { status: result.status, label: result.statusLabel, contribution: result.contribution };
  });
  assert(undefCheck.status === "lost", `undefined → lost (实际: ${undefCheck.status})`);
  assert(undefCheck.label === "失联", `undefined → 失联 (实际: ${undefCheck.label})`);

  // ========== 4. contribution = 0 → lost ==========
  console.log("4. contribution = 0 → lost / 失联");
  const zeroCheck = await page.evaluate(() => {
    const r = window.getCityProgress("test_city", {});
    return { status: r.status, label: r.statusLabel, contribution: r.contribution, next: r.nextThreshold };
  });
  assert(zeroCheck.status === "lost", `0 → lost (实际: ${zeroCheck.status})`);
  assert(zeroCheck.label === "失联", `0 → 失联 (实际: ${zeroCheck.label})`);
  assert(zeroCheck.contribution === 0, `contribution = 0`);
  assert(zeroCheck.next === 1, `nextThreshold = 1 (实际: ${zeroCheck.next})`);

  // ========== 5. contribution = 1 → contacted ==========
  console.log("5. contribution = 1 → contacted / 已联络");
  const oneCheck = await page.evaluate(() => {
    const r = window.getCityProgress("test_city", { test_city: 1 });
    return { status: r.status, label: r.statusLabel, next: r.nextThreshold };
  });
  assert(oneCheck.status === "contacted", `1 → contacted (实际: ${oneCheck.status})`);
  assert(oneCheck.label === "已联络", `1 → 已联络 (实际: ${oneCheck.label})`);
  assert(oneCheck.next === 3, `nextThreshold = 3 (实际: ${oneCheck.next})`);

  // ========== 6. contribution = 3 → recovering ==========
  console.log("6. contribution = 3 → recovering / 恢复中");
  const threeCheck = await page.evaluate(() => {
    const r = window.getCityProgress("test_city", { test_city: 3 });
    return { status: r.status, label: r.statusLabel, next: r.nextThreshold };
  });
  assert(threeCheck.status === "recovering", `3 → recovering (实际: ${threeCheck.status})`);
  assert(threeCheck.label === "恢复中", `3 → 恢复中 (实际: ${threeCheck.label})`);
  assert(threeCheck.next === 6, `nextThreshold = 6 (实际: ${threeCheck.next})`);

  // ========== 7. contribution = 6 → stable ==========
  console.log("7. contribution = 6 → stable / 稳定据点");
  const sixCheck = await page.evaluate(() => {
    const r = window.getCityProgress("test_city", { test_city: 6 });
    return { status: r.status, label: r.statusLabel, next: r.nextThreshold };
  });
  assert(sixCheck.status === "stable", `6 → stable (实际: ${sixCheck.status})`);
  assert(sixCheck.label === "稳定据点", `6 → 稳定据点 (实际: ${sixCheck.label})`);
  assert(sixCheck.next === null, `stable → nextThreshold = null`);

  // ========== 8. formatCityProgress 返回包含"城市状态" ==========
  console.log("8. formatCityProgress 返回正确文本");
  const fmtCheck = await page.evaluate(() => ({
    zero: window.formatCityProgress("test_city", {}),
    one: window.formatCityProgress("test_city", { test_city: 1 }),
    three: window.formatCityProgress("test_city", { test_city: 3 }),
    six: window.formatCityProgress("test_city", { test_city: 6 }),
  }));
  assert(fmtCheck.zero.includes("城市状态"), `format(0) 包含"城市状态": ${fmtCheck.zero}`);
  assert(fmtCheck.zero.includes("失联"), `format(0) 包含"失联": ${fmtCheck.zero}`);
  assert(fmtCheck.one.includes("已联络"), `format(1) 包含"已联络": ${fmtCheck.one}`);
  assert(fmtCheck.three.includes("恢复中"), `format(3) 包含"恢复中": ${fmtCheck.three}`);
  assert(fmtCheck.six.includes("稳定据点"), `format(6) 包含"稳定据点": ${fmtCheck.six}`);

  // ========== 9. getCityProgressDetailLines ==========
  console.log("9. getCityProgressDetailLines 返回正确行");
  const detailCheck = await page.evaluate(() => {
    return window.getCityProgressDetailLines("test_city", { test_city: 1 });
  });
  assert(detailCheck.length >= 3, `detailLines 长度 >= 3 (实际: ${detailCheck.length})`);
  assert(detailCheck.some(l => l.includes("城市贡献：1")), `包含"城市贡献：1"`);
  assert(detailCheck.some(l => l.includes("已联络")), `包含"已联络"`);
  assert(detailCheck.some(l => l.includes("还需贡献")), `包含"还需贡献"`);

  // ========== 10. RouteSelectScene 显示城市状态 ==========
  console.log("10. RouteSelectScene 显示城市状态");
  await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
  await sleep(3000);

  const routeCityStatus = await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (!rs) return { ok: false, hasCityStatus: false, text: "" };
    const allTexts = [];
    const searchChildren = (obj) => {
      if (!obj) return;
      if (obj.list && Array.isArray(obj.list)) {
        for (const child of obj.list) {
          if (child.type === "Text" && child.text) allTexts.push(child.text);
          searchChildren(child);
        }
      }
      if (obj.children && obj.children.list && Array.isArray(obj.children.list)) {
        for (const child of obj.children.list) {
          if (child.type === "Text" && child.text) allTexts.push(child.text);
          searchChildren(child);
        }
      }
    };
    searchChildren(rs);
    if (rs.children && rs.children.list) {
      for (const child of rs.children.list) searchChildren(child);
    }
    const hasCityStatus = allTexts.some(t => t.includes("城市状态："));
    const cityStatusText = allTexts.find(t => t.includes("城市状态："));
    return { ok: true, hasCityStatus, text: cityStatusText || "" };
  });
  assert(routeCityStatus.ok, "RouteSelectScene 场景存在");
  assert(routeCityStatus.hasCityStatus, `RouteSelectScene 显示城市状态: "${routeCityStatus.text}"`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "route-select-city-status.png") });

  // ========== 11. 选择商路进入 CharacterSelect → CargoPrep → MapScene ==========
  console.log("11. 选择商路进入 MapScene");
  await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (rs && rs.routes && rs.routes.length > 0) {
      rs.selectRoute(rs.routes[0]);
    }
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

  // ========== 12. MapScene 信息面板显示城市状态 ==========
  console.log("12. MapScene 信息面板显示城市状态");
  const mapCityStatus = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { ok: false, hasCityStatus: false, text: "" };
    const texts = ms.children.list.filter(c => c.type === "Text");
    const hasCityStatus = texts.some(t => t.text && t.text.includes("城市状态："));
    const cityStatusText = texts.find(t => t.text && t.text.includes("城市状态："));
    return { ok: true, hasCityStatus, text: cityStatusText ? cityStatusText.text : "" };
  });
  assert(mapCityStatus.ok, "MapScene 场景存在");
  assert(mapCityStatus.hasCityStatus, `MapScene 显示城市状态: "${mapCityStatus.text}"`);

  // ========== 13. 初始城市贡献为 0 ==========
  console.log("13. 初始城市贡献为 0");
  const initialContrib = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      cityId: gs.selectedCityId,
      contrib: gs.cityContributions[gs.selectedCityId] || 0,
    };
  });
  assert(initialContrib.contrib === 0, `初始贡献 = 0 (实际: ${initialContrib.contrib})`);

  // ========== 14. 找到目标节点并 BFS 寻路 ==========
  console.log("14. 找到目标节点并 BFS 寻路");

  // 找到目标节点
  const goalCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    const cells = gs.mapCells;
    const rows = gs.mapHeight;
    const cols = gs.mapWidth;
    const start = gs.currentPosition;

    // 找到 isGoal 或 boss 节点
    let goalCell = null;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = cells[y][x];
        if (cell.isGoal || cell.type === "boss") {
          goalCell = { x, y, isGoal: cell.isGoal, type: cell.type };
          break;
        }
      }
      if (goalCell) break;
    }

    return { hasGoal: !!goalCell, goalCell, start, rows, cols };
  });

  assert(goalCheck.hasGoal, `找到目标节点: ${JSON.stringify(goalCheck.goalCell)}`);

  if (!goalCheck.hasGoal) {
    console.error("无法找到目标节点，测试失败");
    await browser.close();
    process.exit(1);
  }

  // BFS 寻路
  const pathResult = await page.evaluate(({ gx, gy }) => {
    const gs = window.getGameState();
    const cells = gs.mapCells;
    const rows = gs.mapHeight;
    const cols = gs.mapWidth;
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
      path: foundPath || [],
    };
  }, { gx: goalCheck.goalCell.x, gy: goalCheck.goalCell.y });

  assert(pathResult.pathFound, `BFS 找到路径 (长度: ${pathResult.pathLength})`);
  console.log(`    路径长度: ${pathResult.pathLength} 步`);

  if (!pathResult.pathFound) {
    console.error("无法找到到达目标节点的路径，测试失败");
    await browser.close();
    process.exit(1);
  }

  // ========== 15. 逐步移动到目标节点 ==========
  console.log("15. 逐步移动到目标节点");

  // 设置自动移动模式以跳过战斗
  await page.evaluate(() => {
    const gs = window.getGameState();
    gs._isAutoMoving = true;
    window.setGameState(gs);
  });

  const movePath = pathResult.path;
  const MAX_STEPS = Math.min(movePath.length, 100);
  let reachedGoal = false;

  for (let i = 0; i < MAX_STEPS; i++) {
    const step = movePath[i];
    const prev = i > 0 ? movePath[i - 1] : pathResult.start;

    const dx = step.x - prev.x;
    const dy = step.y - prev.y;

    if (dy === -1) await page.keyboard.press("ArrowUp");
    else if (dy === 1) await page.keyboard.press("ArrowDown");
    else if (dx === -1) await page.keyboard.press("ArrowLeft");
    else if (dx === 1) await page.keyboard.press("ArrowRight");

    await sleep(150);

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

  // ========== 16. 验证交付结果 ==========
  console.log("16. 验证交付结果");
  const deliveryResult = await page.evaluate(() => {
    const gs = window.getGameState();
    return {
      completedOrderIds: gs.completedOrderIds || [],
      silver: gs.silver,
      embers: gs.embers,
      cityContributions: gs.cityContributions || {},
      selectedCityId: gs.selectedCityId,
    };
  });

  assert(deliveryResult.completedOrderIds.length > 0,
    `completedOrderIds 包含订单: ${JSON.stringify(deliveryResult.completedOrderIds)}`);

  const cityId = deliveryResult.selectedCityId;
  const contribAfter = deliveryResult.cityContributions[cityId] || 0;
  assert(contribAfter > 0, `城市贡献增加: ${contribAfter} (城市: ${cityId})`);

  // ========== 17. 验证城市状态变为"已联络" ==========
  console.log("17. 验证城市状态变为已联络");
  const statusAfter = await page.evaluate(() => {
    const gs = window.getGameState();
    const cityId = gs.selectedCityId;
    return {
      label: window.getCityStatusLabel(cityId, gs.cityContributions),
      fmt: window.formatCityProgress(cityId, gs.cityContributions),
      contrib: gs.cityContributions[cityId] || 0,
    };
  });
  assert(statusAfter.label === "已联络", `城市状态为"已联络" (实际: ${statusAfter.label})`);
  console.log(`    城市状态: ${statusAfter.fmt}`);

  // ========== 18. 验证 MapScene 信息面板或弹窗显示"已联络" ==========
  console.log("18. 验证 UI 显示已联络");
  const uiCheck = await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { found: false, text: "" };

    // 搜索所有文本（包括弹窗）
    const allTexts = [];
    const searchChildren = (obj) => {
      if (!obj) return;
      if (obj.list && Array.isArray(obj.list)) {
        for (const child of obj.list) {
          if (child.type === "Text" && child.text) allTexts.push(child.text);
          searchChildren(child);
        }
      }
      if (obj.children && obj.children.list && Array.isArray(obj.children.list)) {
        for (const child of obj.children.list) {
          if (child.type === "Text" && child.text) allTexts.push(child.text);
          searchChildren(child);
        }
      }
    };
    searchChildren(ms);
    if (ms.children && ms.children.list) {
      for (const child of ms.children.list) searchChildren(child);
    }

    const hasContacted = allTexts.some(t => t.includes("已联络"));
    const contactedText = allTexts.find(t => t.includes("已联络"));
    return { found: hasContacted, text: contactedText || "" };
  });
  assert(uiCheck.found, `UI 显示"已联络": "${uiCheck.text}"`);

  // 关闭弹窗（如果有）
  await page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return;
    for (const child of ms.children.list) {
      if (child.type === "Rectangle" && child.depth === 900) {
        child.emit("pointerdown");
        break;
      }
    }
  });
  await sleep(500);

  // ========== 19. 防重复交付 ==========
  console.log("19. 防重复交付");
  const contribBeforeRepeat = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.cityContributions[gs.selectedCityId] || 0;
  });

  // 再次尝试交付
  const repeatCheck = await page.evaluate(() => {
    const gs = window.getGameState();
    const order = gs.selectedOrderId ? window.getOrderById(gs.selectedOrderId) : undefined;
    const result = window.deliverOrder({
      order,
      cargo: gs.cargo,
      completedOrderIds: gs.completedOrderIds,
    });
    return { ok: result.ok, reason: result.reason };
  });

  const contribAfterRepeat = await page.evaluate(() => {
    const gs = window.getGameState();
    return gs.cityContributions[gs.selectedCityId] || 0;
  });

  assert(!repeatCheck.ok, `重复交付被拒绝 (reason: ${repeatCheck.reason})`);
  assert(contribAfterRepeat === contribBeforeRepeat,
    `重复交付不增加贡献: ${contribBeforeRepeat} → ${contribAfterRepeat}`);

  // 截图
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "final-city-status.png") });

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
