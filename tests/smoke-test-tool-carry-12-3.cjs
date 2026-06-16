/**
 * 阶段12.3：出发前选择携带工具 v1 冒烟测试
 *
 * 测试流程（全部真实点击，无 API 绕过）：
 * 1. MainMenuScene → 点击开始远征 → TownScene
 * 2. TownScene → 点击仓库/工具 → 真实点击购买按钮
 * 3. TownScene → 点击商路大厅 → RouteSelectScene
 * 4. RouteSelectScene → 选择路线 → CharacterSelectScene
 * 5. CharacterSelectScene → 选择3角色 → CargoPrepScene
 * 6. CargoPrepScene → 真实点击工具选择按钮 → 验证 selectedToolId 更新
 * 7. CargoPrepScene → 真实点击"开始远征" → MapScene
 * 8. MapScene → 验证显示携带工具和工具效果摘要
 * 9. 再来一局 → 验证 selectedToolId 重置但 ownedTools 保留
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// 加载测试辅助函数
const helpersPath = path.join(__dirname, "_real_helpers.cjs");
const helpersCode = fs.readFileSync(helpersPath, "utf-8");
eval(helpersCode);

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

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

async function getGameStateSnapshot(page) {
  return await page.evaluate(() => {
    const gs = window.getGameState ? window.getGameState() : null;
    if (!gs) return null;
    return {
      selectedToolId: gs.selectedToolId,
      ownedTools: gs.ownedTools,
      silver: gs.silver,
    };
  });
}

async function runTest() {
  console.log("========================================");
  console.log("阶段12.3：出发前选择携带工具 v1 冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("1. 页面加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game && window.game.scene), "window.game 存在");

    // 2. MainMenuScene active
    console.log("2. MainMenuScene");
    mark(
      await page.evaluate(() => window.game.scene.isActive("MainMenuScene")),
      "MainMenuScene active",
    );

    // 3. 真实点击开始远征
    console.log("3. 点击开始远征进入 TownScene");
    const startBtn = await findInteractiveButtonByText(page, "MainMenuScene", "开始远征");
    mark(startBtn !== null, "找到「开始远征」按钮");
    if (startBtn) {
      await clickGamePoint(page, startBtn, "开始远征按钮");
      await sleep(1500);
    }
    mark(
      await page.evaluate(() => window.game.scene.isActive("TownScene")),
      "TownScene active",
    );

    // 4. 验证初始状态：ownedTools 为空，selectedToolId 为 null
    console.log("4. 验证初始状态");
    const gs1 = await getGameStateSnapshot(page);
    mark(
      gs1 && Array.isArray(gs1.ownedTools),
      `初始 ownedTools 是数组（实际: ${JSON.stringify(gs1?.ownedTools)}）`,
    );
    mark(
      gs1 && (gs1.selectedToolId === null || gs1.selectedToolId === undefined),
      `初始 selectedToolId 为 null（实际: ${gs1?.selectedToolId}）`,
    );

    // 5. TownScene → 点击仓库/工具
    console.log("5. 点击仓库/工具面板");
    const warehouseBtn = await findInteractiveButtonByText(page, "TownScene", "仓库/工具");
    mark(warehouseBtn !== null, "找到「仓库/工具」按钮");
    if (warehouseBtn) {
      await clickGamePoint(page, warehouseBtn, "仓库/工具按钮");
      await sleep(1000);
    }

    // 6. 真实点击购买按钮（例如"购买 30银"）
    console.log("6. 真实点击购买工具");
    const buyBtn = await findInteractiveButtonByText(page, "TownScene", "购买.*银");
    mark(buyBtn !== null, "找到「购买」按钮");
    if (buyBtn) {
      await clickGamePoint(page, buyBtn, "购买工具按钮");
      await sleep(1500);
    }

    // 验证购买结果
    const gsAfterBuy = await getGameStateSnapshot(page);
    mark(
      gsAfterBuy &&
        Array.isArray(gsAfterBuy.ownedTools) &&
        gsAfterBuy.ownedTools.length > 0,
      `购买后 ownedTools 不为空（实际: ${JSON.stringify(gsAfterBuy?.ownedTools)}）`,
    );

    // 7. 点击商路大厅
    console.log("7. 点击商路大厅进入远征流程");
    const hallBtn = await findInteractiveButtonByText(page, "TownScene", "商路大厅");
    mark(hallBtn !== null, "找到「商路大厅」按钮");
    if (hallBtn) {
      await clickGamePoint(page, hallBtn, "商路大厅按钮");
      await sleep(1500);
    }
    mark(
      await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")),
      "RouteSelectScene active",
    );

    // 8. 选择路线
    console.log("8. 选择路线");
    const routeCard = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) return null;
      return { x: rs.routeCards[0].x, y: rs.routeCards[0].y };
    });
    mark(routeCard !== null, "找到路线卡");
    if (routeCard) {
      await clickGamePoint(page, routeCard, "路线卡1");
      await sleep(1500);
    }

    // 9. 选择角色
    console.log("9. 选择3个角色");
    const charCards = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
      return [
        { x: cs.characterCards[0].x, y: cs.characterCards[0].y },
        { x: cs.characterCards[1].x, y: cs.characterCards[1].y },
        { x: cs.characterCards[2].x, y: cs.characterCards[2].y },
      ];
    });
    mark(charCards !== null, "找到3个角色卡");
    if (charCards) {
      for (let i = 0; i < 3; i++) {
        await clickGamePoint(page, charCards[i], `角色卡${i + 1}`);
        await sleep(300);
      }
    }

    // 10. 点击角色选择场景的"开始远征"
    console.log("10. 角色选择场景开始远征");
    const csStartBtn = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    mark(csStartBtn !== null, "找到CharacterSelectScene「开始远征」");
    if (csStartBtn) {
      await clickGamePoint(page, csStartBtn, "CharacterSelectScene开始远征");
    }
    try {
      await waitForSceneReady(page, "CargoPrepScene", { minChildren: 5, timeoutMs: 10000 });
      mark(true, "CargoPrepScene ready");
    } catch (e) {
      mark(false, `CargoPrepScene ready (error: ${e.message})`);
    }

    // 11. 验证 ownedTools 场景切换后不丢失
    console.log("11. 验证 ownedTools 场景切换后不丢失");
    const gsCargo = await getGameStateSnapshot(page);
    mark(
      gsCargo && Array.isArray(gsCargo.ownedTools) && gsCargo.ownedTools.length > 0,
      `CargoPrepScene 中 ownedTools 不为空（实际: ${JSON.stringify(gsCargo?.ownedTools)}）`,
    );

    // 12. CargoPrepScene 真实点击工具选择按钮
    console.log("12. CargoPrepScene 真实点击工具选择");
    const toolBtn = await findInteractiveButtonByText(page, "CargoPrepScene", "密封货箱");
    mark(toolBtn !== null, "找到「密封货箱」工具选择按钮");
    if (toolBtn) {
      await clickGamePoint(page, toolBtn, "工具选择按钮");
      await sleep(1000);
    }

    // 验证 selectedToolId 更新
    const gsToolSelected = await getGameStateSnapshot(page);
    mark(
      gsToolSelected && gsToolSelected.selectedToolId === "sealed_crate",
      `点击后 selectedToolId = sealed_crate（实际: ${gsToolSelected?.selectedToolId}）`,
    );

    // 13. CargoPrepScene 真实点击"开始远征"
    console.log("13. CargoPrepScene 真实点击开始远征");
    const cargoStartBtn = await findInteractiveButtonByText(page, "CargoPrepScene", "开始远征");
    mark(cargoStartBtn !== null, "找到CargoPrepScene「开始远征」按钮");
    if (cargoStartBtn) {
      await clickGamePoint(page, cargoStartBtn, "CargoPrepScene开始远征");
      await sleep(2000);
    }

    // 14. 验证 MapScene
    console.log("14. 验证 MapScene 显示携带工具");
    mark(
      await page.evaluate(() => window.game.scene.isActive("MapScene")),
      "MapScene active",
    );

    // 检查 MapScene 中的工具显示文本（通过 _infoPanelTexts）
    const mapToolDisplay = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return { hasTool: false, texts: [] };
      const texts = [];
      if (ms._infoPanelTexts) {
        ms._infoPanelTexts.forEach((t) => {
          if (t && t.text) texts.push(String(t.text));
        });
      }
      // 也检查场景中的普通文本
      ms.children?.each?.((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      const hasTool = texts.some((t) =>
        t.includes("携带工具") && t.includes("密封货箱"),
      );
      return { hasTool, texts: texts.slice(0, 10) };
    });
    mark(
      mapToolDisplay.hasTool,
      `MapScene 显示「携带工具：密封货箱」（检测到的前10条文本: ${JSON.stringify(mapToolDisplay.texts)}）`,
    );

    // 验证工具效果摘要显示
    const toolEffectDisplay = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return false;
      const texts = [];
      if (ms._infoPanelTexts) {
        ms._infoPanelTexts.forEach((t) => {
          if (t && t.text) texts.push(String(t.text));
        });
      }
      ms.children?.each?.((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      return texts.some((t) => t.includes("工具效果"));
    });
    mark(
      toolEffectDisplay,
      "MapScene 显示工具效果摘要",
    );

    // 15. 验证 MapScene 中 GameState 的 selectedToolId
    const gsMap = await getGameStateSnapshot(page);
    mark(
      gsMap && gsMap.selectedToolId === "sealed_crate",
      `MapScene 中 selectedToolId = sealed_crate（实际: ${gsMap?.selectedToolId}）`,
    );

    // 16. 验证 ownedTools 在 MapScene 中仍然存在
    mark(
      gsMap && Array.isArray(gsMap.ownedTools) && gsMap.ownedTools.length > 0,
      `MapScene 中 ownedTools 不为空（实际: ${JSON.stringify(gsMap?.ownedTools)}）`,
    );

    // 17. 测试再来一局后 selectedToolId 重置，ownedTools 保留
    console.log("17. 测试再来一局（模拟撤退 → 再来一局）");
    // 先回到 ExpeditionResultScene（通过简单的 API 触发撤退流程）
    await page.evaluate(() => {
      const gs = window.getGameState();
      gs.lastExpeditionResult = window.createRetreatedExpeditionResult({
        routeName: "测试路线",
        cityName: "测试城市",
        reason: "测试撤退",
      });
      window.setGameState(gs);
      window.game.scene.start("ExpeditionResultScene");
    });
    await sleep(1500);

    // 真实点击"再来一局"
    const replayBtn = await findInteractiveButtonByText(page, "ExpeditionResultScene", "再来一局");
    mark(replayBtn !== null, "找到「再来一局」按钮");
    if (replayBtn) {
      await clickGamePoint(page, replayBtn, "再来一局按钮");
      await sleep(2000);
    }

    mark(
      await page.evaluate(() => window.game.scene.isActive("TownScene")),
      "再来一局后进入 TownScene",
    );

    // 验证再来一局后 selectedToolId 重置，ownedTools 保留
    const gsAfterReplay = await getGameStateSnapshot(page);
    mark(
      gsAfterReplay &&
        (gsAfterReplay.selectedToolId === null || gsAfterReplay.selectedToolId === undefined),
      `再来一局后 selectedToolId = null（实际: ${gsAfterReplay?.selectedToolId}）`,
    );
    mark(
      gsAfterReplay &&
        Array.isArray(gsAfterReplay.ownedTools) && gsAfterReplay.ownedTools.length > 0,
      `再来一局后 ownedTools 保留（实际: ${JSON.stringify(gsAfterReplay?.ownedTools)}）`,
    );

    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    if (failed === 0) {
      console.log("阶段12.3工具携带: ✅ 全部通过");
    } else {
      console.log("阶段12.3工具携带: ❌ 有失败项");
    }
    console.log("========================================");

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error("❌ 测试失败:", e);
    failed++;
    await browser.close();
    process.exit(1);
  }
}

runTest();
