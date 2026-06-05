/**
 * smoke-test-cargo-prep-buy-9-1-3.cjs
 * 阶段9.1.3：CargoPrep 买货真实点击测试
 *
 * 验证：
 * 1. 真实流程进入 CargoPrepScene
 * 2. 点击粮食 [+] 后 cargo.grain +1，silver 减少，weight 增加
 * 3. 点击粮食 [-] 后 cargo.grain -1，silver 返还
 * 4. 清空货物后 cargo 为空
 * 5. 一键装载后 cargo 满足订单
 * 6. 开始远征后 MapScene 中 cargo 不丢
 */

const { chromium } = require("playwright");
const BASE_URL = "http://localhost:5173";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;
const FAILED = [];

function assert(condition, message) {
  if (!condition) {
    failed++;
    FAILED.push(message);
    console.error(`  ❌ ${message}`);
    return false;
  }
  passed++;
  console.log(`  ✅ ${message}`);
  return true;
}

async function runTest() {
  console.log("========================================");
  console.log("阶段9.1.3：CargoPrep 买货真实点击测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 游戏加载
    console.log("1. 游戏加载");
    await page.addInitScript(() => {
          window.__EMBER_TEST_MODE__ = true;
        });
        
        await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    assert(!!(await page.evaluate(() => window.game)), "window.game 存在");

    // 2. 真实流程: MainMenu -> RouteSelect -> CharacterSelect -> CargoPrep
    console.log("2. 真实流程进入 CargoPrepScene");
    await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (mm) mm.scene.start("RouteSelectScene");
    });
    await sleep(1500);

    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
    });
    await sleep(1500);

    // 选择 3 个角色
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      for (let i = 0; i < 3; i++) {
        const card = cs.characterCards[i];
        for (const child of card.list) {
          if (child.type === "Zone" && child.input && child.input.enabled) {
            child.emit("pointerdown");
            break;
          }
        }
      }
    });
    await sleep(500);

    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs.startExpedition) cs.startExpedition();
    });
    await sleep(2000);

    const activeScene = await page.evaluate(() => {
      const scenes = window.game.scene.scenes;
      return scenes.find(s => s.scene.isActive())?.scene?.key;
    });
    assert(activeScene === "CargoPrepScene", `进入 CargoPrepScene (实际: ${activeScene})`);

    // 3. 记录初始状态
    console.log("3. 记录初始状态");
    const beforeState = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        grain: gs.cargo.grain || 0,
        silver: gs.silver,
        weight: window.calculateCargoWeight ? window.calculateCargoWeight(gs.cargo) : 0,
      };
    });
    console.log(`    初始: grain=${beforeState.grain}, silver=${beforeState.silver}, weight=${beforeState.weight}`);

    // 4. 点击粮食 [+] — 按钮是独立 Container，通过 data.action 查找
    console.log("4. 点击粮食 [+]");
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (!scene) return;
      const children = scene.children.list;
      for (const child of children) {
        if (child.type === "Container" && child.getData && child.getData("action") === "plus" && child.getData("goodId") === "grain") {
          child.emit("pointerdown", { x: child.x, y: child.y });
          break;
        }
      }
    });
    await sleep(500);

    const afterPlus = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        grain: gs.cargo.grain || 0,
        silver: gs.silver,
        weight: window.calculateCargoWeight ? window.calculateCargoWeight(gs.cargo) : 0,
      };
    });
    console.log(`    [+]后: grain=${afterPlus.grain}, silver=${afterPlus.silver}, weight=${afterPlus.weight}`);

    assert(afterPlus.grain === beforeState.grain + 1,
      `grain +1: ${beforeState.grain} -> ${afterPlus.grain}`);
    assert(afterPlus.silver < beforeState.silver,
      `silver 减少: ${beforeState.silver} -> ${afterPlus.silver}`);
    assert(afterPlus.weight > beforeState.weight,
      `weight 增加: ${beforeState.weight} -> ${afterPlus.weight}`);

    // 5. 点击粮食 [-] — 按钮是独立 Container，通过 data.action 查找
    console.log("5. 点击粮食 [-]");
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (!scene) return;
      const children = scene.children.list;
      for (const child of children) {
        if (child.type === "Container" && child.getData && child.getData("action") === "minus" && child.getData("goodId") === "grain") {
          child.emit("pointerdown", { x: child.x, y: child.y });
          break;
        }
      }
    });
    await sleep(500);

    const afterMinus = await page.evaluate(() => {
      const gs = window.getGameState();
      return {
        grain: gs.cargo.grain || 0,
        silver: gs.silver,
        weight: window.calculateCargoWeight ? window.calculateCargoWeight(gs.cargo) : 0,
      };
    });
    console.log(`    [-]后: grain=${afterMinus.grain}, silver=${afterMinus.silver}, weight=${afterMinus.weight}`);

    assert(afterMinus.grain === beforeState.grain,
      `grain 恢复: ${afterMinus.grain} === ${beforeState.grain}`);
    assert(afterMinus.silver === beforeState.silver,
      `silver 恢复: ${afterMinus.silver} === ${beforeState.silver}`);
    assert(afterMinus.weight === beforeState.weight,
      `weight 恢复: ${afterMinus.weight} === ${beforeState.weight}`);

    // 6. 清空货物
    console.log("6. 清空货物");
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.clearCargo) scene.clearCargo();
    });
    await sleep(500);

    const afterClear = await page.evaluate(() => {
      const gs = window.getGameState();
      const totalCargo = Object.values(gs.cargo).reduce((a, b) => a + (b || 0), 0);
      return { cargo: gs.cargo, totalCargo };
    });
    console.log(`    清空后: totalCargo=${afterClear.totalCargo}`);
    assert(afterClear.totalCargo === 0, `清空后货物为 0 (实际: ${afterClear.totalCargo})`);

    // 7. 一键装载订单需求
    console.log("7. 一键装载订单需求");
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.loadOrderRequirements) scene.loadOrderRequirements();
    });
    await sleep(500);

    const afterLoad = await page.evaluate(() => {
      const gs = window.getGameState();
      const order = gs.selectedOrderId ? window.getOrderById(gs.selectedOrderId) : null;
      const check = order ? window.checkOrderCargo(order, gs.cargo) : null;
      return {
        cargo: gs.cargo,
        hasEnough: check ? check.hasEnoughCargo : false,
      };
    });
    console.log(`    装载后: cargo=${JSON.stringify(afterLoad.cargo)}`);
    assert(afterLoad.hasEnough, `一键装载后满足订单需求`);

    // 8. 开始远征，验证 MapScene 中 cargo 不丢
    console.log("8. 开始远征，验证 cargo 不丢");
    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2000);

    const mapSceneActive = await page.evaluate(() => {
      const scenes = window.game.scene.scenes;
      return scenes.find(s => s.scene.isActive())?.scene?.key;
    });
    assert(mapSceneActive === "MapScene", `进入 MapScene (实际: ${mapSceneActive})`);

    const mapCargo = await page.evaluate(() => {
      const gs = window.getGameState();
      return { cargo: gs.cargo, silver: gs.silver };
    });
    console.log(`    MapScene cargo: ${JSON.stringify(mapCargo.cargo)}, silver: ${mapCargo.silver}`);
    assert(Object.keys(mapCargo.cargo).length > 0, `MapScene 中 cargo 不为空`);

  } catch (err) {
    console.error("\n测试异常:", err.message);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n========================================");
  console.log(`结果: ${passed} 通过, ${failed} 失败`);
  console.log("========================================");

  if (failed > 0) {
    console.log("\n失败项:");
    FAILED.forEach(f => console.log(`  - ${f}`));
    process.exit(1);
  }
}

runTest();
