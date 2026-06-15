/**
 * 阶段12.3：出发前选择携带工具 v1 冒烟测试
 *
 * 测试流程：
 * 1. MainMenuScene → 点击开始远征 → TownScene
 * 2. TownScene → 点击商路大厅 → RouteSelectScene
 * 3. RouteSelectScene → 选择路线 → CharacterSelectScene
 * 4. CharacterSelectScene → 选择3角色 → CargoPrepScene
 * 5. CargoPrepScene → 工具选择区域 → 选择工具 → MapScene
 * 6. MapScene → 撤退 → ExpeditionResultScene → 再来一局
 * 7. 再来一局后 → selectedToolId = null
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// 加载测试辅助函数
const helpersPath = path.join(__dirname, "_real_helpers.cjs");
const helpersCode = fs.readFileSync(helpersPath, "utf-8");
eval(helpersCode);

const BASE_URL = "http://localhost:5175";

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

async function getGameState(page) {
  return await page.evaluate(() => {
    const gs = window.getGameState ? window.getGameState() : null;
    if (!gs) return null;
    return {
      selectedToolId: gs.selectedToolId,
      selectedCharacters: gs.selectedCharacters,
      silver: gs.silver,
      embers: gs.embers,
    };
  });
}

async function getCargoPrepTexts(page) {
  return await page.evaluate(() => {
    const cps = window.game.scene.getScene("CargoPrepScene");
    if (!cps) return [];
    const texts = [];
    cps.children.each((child) => {
      if (child.type === "Text" && child.text && child.visible) {
        texts.push(String(child.text));
      }
    });
    return texts;
  });
}

async function runTest() {
  console.log("========================================");
  console.log("阶段12.3：出发前选择携带工具 v1 冒烟测试");
  console.log("========================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. 页面加载
    console.log("1. 页面加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    mark(await page.evaluate(() => window.game && window.game.scene), "window.game 存在");

    // 2. MainMenuScene active
    console.log("2. MainMenuScene");
    mark(await page.evaluate(() => window.game.scene.isActive("MainMenuScene")), "MainMenuScene active");

    // 3. 点击开始远征
    console.log("3. 点击开始远征");
    const startBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /开始远征/.test(child.text)) {
            btn = { x: child.x, y: child.y };
          }
        }
      });
      return btn;
    });
    mark(startBtn !== null, "找到「开始远征」按钮");
    if (startBtn) {
      await clickGamePoint(page, startBtn, "开始远征按钮");
      await sleep(1000);
    }
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "TownScene active");

    // 4. 验证初始状态
    console.log("4. 验证初始状态");
    const gs1 = await getGameState(page);
    mark(gs1 && (gs1.selectedToolId === null || gs1.selectedToolId === undefined),
      `初始 selectedToolId 为 null/undefined（实际: ${gs1?.selectedToolId})`);

    // 5. TownScene 仓库/工具面板应只读（阶段12.2行为）
    console.log("5. 点击仓库/工具（验证只读）");
    const warehouseBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text && child.text.includes("仓库/工具")) {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(warehouseBtn !== null, "找到「仓库/工具」按钮");
    if (warehouseBtn) {
      await clickGamePoint(page, warehouseBtn, "仓库/工具按钮");
      await sleep(1000);
    }

    // 验证 TownScene 工具目录只读（不显示"点击选择"）
    const townTexts = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return [];
      const texts = [];
      ts.children.each((child) => {
        if (child.type === "Text" && child.text && child.visible) {
          texts.push(String(child.text));
        }
      });
      // 检查容器
      if (ts.storageToolsCards && ts.storageToolsCards.visible) {
        ts.storageToolsCards.each((child) => {
          if (child.type === "Text" && child.text && child.visible) {
            texts.push(String(child.text));
          }
        });
      }
      return texts;
    });
    mark(townTexts.some(t => typeof t === 'string' && t.includes("仓库/工具")), "仓库/工具面板标题");
    // 阶段12.2：副标题应显示"查看已知远征工具目录"，不显示"点击选择"
    mark(townTexts.some(t => typeof t === 'string' && t.includes("查看已知") || t.includes("携带和制作功能后续开放")),
      "TownScene 工具目录只读提示");
    // 不显示"点击选择"（阶段12.3功能在 CargoPrepScene）
    mark(!townTexts.some(t => typeof t === 'string' && t.includes("点击选择")),
      "TownScene 不显示「点击选择」");

    // 关闭仓库/工具面板（点击空白区域或再次点击按钮）
    await page.mouse.click(100, 100);  // 点击左上角空白区域关闭面板
    await sleep(500);

    // 6. 点击商路大厅进入远征流程
    console.log("6. 点击商路大厅");
    const hallBtn = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text && child.text.includes("商路大厅")) {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(hallBtn !== null, "找到「商路大厅」按钮");
    if (hallBtn) {
      await clickGamePoint(page, hallBtn, "商路大厅");
      await sleep(2000);  // 增加等待时间
    }
    mark(await page.evaluate(() => window.game.scene.isActive("RouteSelectScene")), "RouteSelectScene active");

    // 7. 选择路线
    console.log("7. 选择路线");
    await sleep(500);  // 等待路线卡渲染
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

    // 8. 选择角色
    console.log("8. 选择角色");
    await sleep(500);  // 等待角色卡渲染
    mark(await page.evaluate(() => window.game.scene.isActive("CharacterSelectScene")), "CharacterSelectScene active");
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

    // 9. 点击开始远征进入 CargoPrepScene
    console.log("9. 点击开始远征");
    // 先检查角色选择状态
    const gsBefore = await getGameState(page);
    console.log(`  角色选择前 selectedCharacters: ${JSON.stringify(gsBefore?.selectedCharacters)}`);

    const csStartBtn = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    mark(csStartBtn !== null, "找到CharacterSelectScene「开始远征」");
    if (csStartBtn) {
      await clickGamePoint(page, csStartBtn, "CharacterSelectScene开始远征");
      await sleep(2000);
    }

    // 检查 CargoPrepScene 状态
    const gsAfter = await getGameState(page);
    console.log(`  进入 CargoPrepScene 后 selectedCharacters: ${JSON.stringify(gsAfter?.selectedCharacters)}`);
    console.log(`  进入 CargoPrepScene 后 selectedToolId: ${gsAfter?.selectedToolId}`);

    // 10. 验证 CargoPrepScene
    console.log("10. 验证 CargoPrepScene");
    await sleep(1000);  // 等待场景渲染
    mark(await page.evaluate(() => window.game.scene.isActive("CargoPrepScene")), "CargoPrepScene active");

    // 11. 验证工具选择区域
    console.log("11. 验证工具选择区域");
    const cargoTexts1 = await getCargoPrepTexts(page);
    mark(cargoTexts1.some(t => typeof t === 'string' && t.includes("远征工具")),
      "CargoPrepScene 显示「远征工具」区域");
    mark(cargoTexts1.some(t => typeof t === 'string' && t.includes("当前携带") && t.includes("未选择")),
      "初始显示「当前携带：未选择」");

    // 12. 在 CargoPrepScene 点击工具按钮
    console.log("12. 在 CargoPrepScene 选择工具");
    // 工具按钮位置：toolAreaX=30, toolListY=280, toolBtnW=150, toolBtnH=30
    // 第一个工具（密封货箱）：x=105, y=295
    // 第二个工具（备用轮轴）：x=265, y=295
    const toolBtn1 = { x: 105, y: 295 };  // 密封货箱
    const toolBtn2 = { x: 265, y: 295 };  // 备用轮轴

    await clickGamePoint(page, toolBtn1, "密封货箱按钮");
    await sleep(1500);

    // 13. 验证选择后状态
    console.log("13. 验证选择后状态");
    const gs2 = await getGameState(page);
    mark(gs2 && gs2.selectedToolId !== null, `selectedToolId 已设置（实际: ${gs2?.selectedToolId})`);

    // CargoPrepScene 显示当前携带
    const cargoTexts2 = await getCargoPrepTexts(page);
    mark(cargoTexts2.some(t => typeof t === 'string' && t.includes("当前携带") && !t.includes("未选择")),
      "CargoPrepScene 显示「当前携带：<工具名>」");

    // 14. 切换选择（点击另一个工具）
    console.log("14. 切换工具选择");
    await clickGamePoint(page, toolBtn2, "备用轮轴按钮");
    await sleep(1500);

    const gs3 = await getGameState(page);
    mark(gs3 && gs3.selectedToolId === "spare_axle", `selectedToolId = spare_axle（实际: ${gs3?.selectedToolId})`);

    // 15. 点击开始远征进入 MapScene
    console.log("15. 点击开始远征");
    const cpStartBtn = await findInteractiveButtonByText(page, "CargoPrepScene", "开始远征");
    mark(cpStartBtn !== null, "找到 CargoPrepScene「开始远征」按钮");
    if (cpStartBtn) {
      await clickGamePoint(page, { x: cpStartBtn.x, y: cpStartBtn.y }, "CargoPrepScene开始远征");
      await sleep(2000);
    }

    // 16. 验证 MapScene
    console.log("16. 验证 MapScene");
    mark(await page.evaluate(() => window.game.scene.isActive("MapScene")), "MapScene active");

    const mapTexts = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return [];
      const texts = [];
      ms.children.each((child) => {
        if (child.type === "Text" && child.text) {
          texts.push(String(child.text));
        }
      });
      return texts;
    });
    mark(mapTexts.some(t => typeof t === 'string' && t.includes("携带工具") && t.includes("备用轮轴")),
      `MapScene 显示「携带工具：备用轮轴」`);

    // 17. 测试再来一局
    console.log("17. 测试再来一局");
    const retreatBtn = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return null;
      let btn = null;
      ms.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text && child.text.includes("撤退")) {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    mark(retreatBtn !== null, "找到撤退按钮");
    if (retreatBtn) {
      await clickGamePoint(page, retreatBtn, "撤退按钮");
      await sleep(500);
    }

    // 确认撤退（查找 modalContainer 中可交互的按钮）
    const confirmBtn = await page.evaluate(() => {
      for (const scene of window.game.scene.scenes) {
        if (!scene.scene.isActive()) continue;
        let btn = null;
        if (scene.modalContainer && scene.modalContainer.visible) {
          scene.modalContainer.each((child) => {
            if (btn) return;
            if (child.type === "Text" && child.input && child.input.enabled && child.text && child.text.includes("确认撤退")) {
              btn = { x: child.x, y: child.y };
            }
          });
          if (btn) return btn;
        }
        scene.children.each((child) => {
          if (btn) return;
          if (child.type === "Text" && child.input && child.input.enabled && child.text && child.text.includes("确认撤退")) {
            btn = { x: child.x, y: child.y };
          }
        });
        if (btn) return btn;
      }
      return null;
    });
    mark(confirmBtn !== null, "找到确认撤退按钮");
    if (confirmBtn) {
      await clickGamePoint(page, confirmBtn, "确认撤退");
      await sleep(2000);
    }

    // 点击再来一局（ExpeditionResultScene）
    const replayBtn = await findInteractiveButtonByText(page, "ExpeditionResultScene", "再来一局");
    mark(replayBtn !== null, "找到「再来一局」按钮");
    if (replayBtn) {
      await clickGamePoint(page, replayBtn, "再来一局按钮");
      await sleep(2000);
    }

    // 验证再来一局后 selectedToolId = null
    const gs4 = await getGameState(page);
    mark(gs4 && (gs4.selectedToolId === null || gs4.selectedToolId === undefined),
      `再来一局后 selectedToolId 为 null/undefined（实际: ${gs4?.selectedToolId})`);

    // 18. 再次进入 CargoPrepScene 验证初始状态
    console.log("18. 再次进入 CargoPrepScene");
    mark(await page.evaluate(() => window.game.scene.isActive("TownScene")), "TownScene active");

    // 再次完整流程进入 CargoPrepScene
    const hallBtn2 = await page.evaluate(() => {
      const ts = window.game.scene.getScene("TownScene");
      if (!ts) return null;
      let btn = null;
      ts.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.text && child.text.includes("商路大厅")) {
          btn = { x: child.x, y: child.y };
        }
      });
      return btn;
    });
    if (hallBtn2) {
      await clickGamePoint(page, hallBtn2, "商路大厅(第2次)");
      await sleep(1000);
    }

    // 选择路线
    const routeCard2 = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) return null;
      return { x: rs.routeCards[0].x, y: rs.routeCards[0].y };
    });
    if (routeCard2) {
      await clickGamePoint(page, routeCard2, "路线卡(第2次)");
      await sleep(1500);
    }

    // 选择角色
    const charCards2 = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
      return [
        { x: cs.characterCards[0].x, y: cs.characterCards[0].y },
        { x: cs.characterCards[1].x, y: cs.characterCards[1].y },
        { x: cs.characterCards[2].x, y: cs.characterCards[2].y },
      ];
    });
    if (charCards2) {
      for (let i = 0; i < 3; i++) {
        await clickGamePoint(page, charCards2[i], `角色卡(第2次)${i + 1}`);
        await sleep(300);
      }
    }

    const csStartBtn2 = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
    if (csStartBtn2) {
      await clickGamePoint(page, csStartBtn2, "开始远征(第2次)");
      await sleep(1500);
    }

    mark(await page.evaluate(() => window.game.scene.isActive("CargoPrepScene")), "CargoPrepScene active(第2次)");

    // 验证 CargoPrepScene 显示"当前携带：未选择"
    const cargoTexts3 = await getCargoPrepTexts(page);
    mark(cargoTexts3.some(t => typeof t === 'string' && t.includes("当前携带") && t.includes("未选择")),
      "新一局 CargoPrepScene 显示「当前携带：未选择」");

    // 最终验证
    const gsFinal = await getGameState(page);
    mark(gsFinal && (gsFinal.selectedToolId === null || gsFinal.selectedToolId === undefined),
      `最终 selectedToolId 为 null/undefined（实际: ${gsFinal?.selectedToolId})`);

  } catch (e) {
    console.error("❌ 测试失败:", e);
    failed++;
  } finally {
    await browser.close();
  }

  console.log("\n========================================");
  console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
  if (failed === 0) {
    console.log("阶段12.3工具携带: ✅ 全部通过");
  } else {
    console.log("阶段12.3工具携带: ❌ 有失败项");
  }
  console.log("========================================");

  process.exit(failed > 0 ? 1 : 0);
}

runTest();