const { chromium } = require("playwright");

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 步骤 0: 打开页面
  console.log("=== [步骤 0] 打开页面 ===");
  try {
    await page.goto("http://localhost:5180/", { timeout: 8000 });
    console.log("  → 5180 端口");
  } catch (e) {
    await page.goto("http://localhost:5181/", { timeout: 8000 });
    console.log("  → 5181 端口");
  }
  await page.waitForTimeout(2000);

  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) { console.error("未找到 canvas"); await browser.close(); return; }
  const cx = box.x;
  const cy = box.y;
  const gx = box.width / 1280;
  const gy = box.height / 720;

  const clickAt = async (x, y, label = "") => {
    const sx = cx + x * gx;
    const sy = cy + y * gy;
    console.log(`  → 点击 (游戏坐标): x=${x}, y=${y} ${label}`);
    await page.mouse.click(sx, sy);
    await page.waitForTimeout(600);
  };

  // 辅助：输出 TownScene 状态
  const dumpState = async () => {
    return await page.evaluate(() => {
      const s = window.game?.scene?.getScene("TownScene");
      if (!s) return { status: "no TownScene" };
      return {
        selectedFacility: s.selectedFacility,
        hasPanel: !!s.storageToolsPanelContainer,
        hasViewport: !!s.storageToolsViewportContainer,
        scrollIndex: s.storageToolsScrollIndex,
        visibleCount: s.storageToolsVisibleCount,
        viewportItems: s.storageToolsViewportContainer ? s.storageToolsViewportContainer.list.length : 0,
      };
    });
  };

  // 步骤 1: 切换到 TownScene
  console.log("\n=== [步骤 1] 打开 TownScene ===");
  const r = await page.evaluate(() => {
    return new Promise((resolve) => {
      const tick = () => {
        if (window.game?.scene?.getScene("TownScene")) {
          try {
            const activeKey = Object.keys(window.game.scene.keys).find(k => window.game.scene.getScene(k).scene.isActive());
            if (activeKey && activeKey !== "TownScene") window.game.scene.stop(activeKey);
            window.game.scene.start("TownScene");
            setTimeout(() => resolve("switched"), 600);
          } catch (e) { resolve("err: " + e.message); }
        } else if (window.game) {
          setTimeout(() => resolve("no TownScene"), 500);
        } else {
          setTimeout(tick, 200);
        }
      };
      tick();
    });
  });
  console.log("  →", r);
  await page.waitForTimeout(1500);
  console.log("  → 状态:", JSON.stringify(await dumpState()));

  // 步骤 2: 点击仓库/工具按钮
  console.log("\n=== [步骤 2] 点击「仓库/工具」按钮 ===");
  await clickAt(380, 435, "「仓库/工具」");
  console.log("  → 状态:", JSON.stringify(await dumpState()));
  await page.screenshot({ path: "tests/_screenshot_2_warehouse.png" });

  // 步骤 3: 检查滚动框
  console.log("\n=== [步骤 3] 检查滚动框 ===");
  const s3 = await dumpState();
  console.log("  → 面板存在?", s3.hasPanel ? "是 ✓" : "否 ✗");
  console.log("  → 可视区存在?", s3.hasViewport ? "是 ✓" : "否 ✗");
  await page.screenshot({ path: "tests/_screenshot_3_storage_panel.png" });

  // 步骤 4: 检查滚动框内工具卡数量
  console.log("\n=== [步骤 4] 检查滚动框内工具卡数量 ===");
  const cards = await page.evaluate(() => {
    const s = window.game.scene.getScene("TownScene");
    if (!s?.storageToolsViewportContainer) return { cards: 0 };
    const vp = s.storageToolsViewportContainer;
    // 工具卡 = 每张对应 1 个 button Container
    let cardContainers = 0;
    let cardBgs = 0;
    for (let i = 0; i < vp.list.length; i++) {
      const el = vp.list[i];
      if (el.type === "Container" && el.list?.length >= 2) cardContainers++;
      if (el.type === "Graphics") cardBgs++;
    }
    return { cardContainers, cardBgs, total: vp.list.length };
  });
  console.log("  → 可视区按钮容器数:", cards.cardContainers, "(应为 4)");
  console.log("  → 可视区 Graphics 数:", cards.cardBgs, "(应为 4)");
  console.log("  → 可视区总对象数:", cards.total);

  // 步骤 5: 检查标题/银币在滚动框上方
  console.log("\n=== [步骤 5] 检查标题/银币显示在滚动框上方 ===");
  const layout = await page.evaluate(() => {
    const s = window.game.scene.getScene("TownScene");
    if (!s?.storageToolsPanelContainer) return null;
    const panel = s.storageToolsPanelContainer;
    const boxY = s.storageToolsBoxY;
    const result = { boxY, items: [] };
    for (let i = 0; i < panel.list.length; i++) {
      const el = panel.list[i];
      if (el.type === "Text" && (el.text.includes("仓库") || el.text.startsWith("银币"))) {
        result.items.push({ text: el.text, y: el.y });
      }
    }
    return result;
  });
  if (layout) {
    console.log("  → 滚动框顶部 y =", layout.boxY);
    layout.items.forEach(it => {
      const ok = it.y < layout.boxY;
      console.log(`  → 文本「${it.text}」 y=${it.y} ${ok ? "✓" : "✗ (在框内或下方)"}`);
    });
  } else {
    console.log("  → 无面板，无法判断");
  }

  // 步骤 6: 鼠标滚轮向下滚动
  console.log("\n=== [步骤 6] 鼠标滚轮向下滚动 ===");
  const sx = cx + 720 * gx;
  const sy = cy + 435 * gy;
  await page.mouse.move(sx, sy);
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);

  // 步骤 7: 检查切换到下一批
  console.log("\n=== [步骤 7] 检查切换到下一批工具 ===");
  const afterDown = await page.evaluate(() => {
    const s = window.game.scene.getScene("TownScene");
    if (!s?.storageToolsViewportContainer) return null;
    const vp = s.storageToolsViewportContainer;
    const texts = [];
    for (let i = 0; i < vp.list.length; i++) {
      const el = vp.list[i];
      if (el.type === "Text") texts.push(el.text);
    }
    return { scrollIndex: s.storageToolsScrollIndex, firstToolName: texts[0], firstTexts: texts.slice(0, 4) };
  });
  console.log("  → scrollIndex =", afterDown?.scrollIndex, "(应为 1 或 > 0)");
  console.log("  → 当前第一张工具:", afterDown?.firstToolName);
  console.log("  → 可见工具名:", afterDown?.firstTexts);
  await page.screenshot({ path: "tests/_screenshot_7_after_scroll_down.png" });

  // 步骤 8: 滚轮向上
  console.log("\n=== [步骤 8] 鼠标滚轮向上滚动，检查回到上一批 ===");
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(500);
  const afterUp = await page.evaluate(() => {
    const s = window.game.scene.getScene("TownScene");
    if (!s?.storageToolsViewportContainer) return null;
    const vp = s.storageToolsViewportContainer;
    const texts = [];
    for (let i = 0; i < vp.list.length; i++) {
      const el = vp.list[i];
      if (el.type === "Text") texts.push(el.text);
    }
    return { scrollIndex: s.storageToolsScrollIndex, firstToolName: texts[0] };
  });
  console.log("  → scrollIndex =", afterUp?.scrollIndex, "(应为 0)");
  console.log("  → 当前第一张工具:", afterUp?.firstToolName);
  await page.screenshot({ path: "tests/_screenshot_8_after_scroll_up.png" });

  // 步骤 9: 点击购买按钮
  console.log("\n=== [步骤 9] 点击购买按钮，检查购买正确工具 ===");
  const beforeBuy = await page.evaluate(() => {
    const s = window.game.scene.getScene("TownScene");
    const gs = (typeof window.getGameState === "function") ? window.getGameState() : null;
    const vp = s.storageToolsViewportContainer;
    const texts = [];
    if (vp) for (let i = 0; i < vp.list.length; i++) {
      const el = vp.list[i];
      if (el.type === "Text") texts.push(el.text);
    }
    return { silver: gs?.silver, firstTool: texts[0], firstPrice: texts[1] };
  });
  console.log("  → 购买前银币:", beforeBuy.silver);
  console.log("  → 第一张工具:", beforeBuy.firstTool, "价格:", beforeBuy.firstPrice);

  // 点击第一张卡片的购买按钮中心 (843, 303)
  await clickAt(843, 303, "点击第 1 张卡购买按钮");

  const afterBuy = await page.evaluate(() => {
    const s = window.game.scene.getScene("TownScene");
    const gs = (typeof window.getGameState === "function") ? window.getGameState() : null;
    const vp = s.storageToolsViewportContainer;
    const texts = [];
    if (vp) for (let i = 0; i < vp.list.length; i++) {
      const el = vp.list[i];
      if (el.type === "Text") texts.push(el.text);
    }
    return { silver: gs?.silver, firstTool: texts[0], firstStatus: texts[3] || texts[1] };
  });
  console.log("  → 购买后银币:", afterBuy.silver, "(应减少工具价格)");
  console.log("  → 第一张工具:", afterBuy.firstTool);
  console.log("  → 按钮状态:", afterBuy.firstStatus, "(应显示「已拥有」)");
  await page.screenshot({ path: "tests/_screenshot_9_after_buy.png" });

  // 步骤 10: 切换到其他设施
  console.log("\n=== [步骤 10] 切换到「工坊」，检查工具商店消失 ===");
  await clickAt(380, 261, "「工坊」");
  await page.waitForTimeout(800);
  const workshopState = await page.evaluate(() => {
    const s = window.game.scene.getScene("TownScene");
    return {
      storagePanel: s.storageToolsPanelContainer ? "存在" : "不存在",
      workshopCards: s.workshopCards ? (s.workshopCards.visible ? "显示中" : "已隐藏") : "不存在",
      descPanel: s.defaultPanelBg ? (s.defaultPanelBg.visible ? "默认面板显示中" : "默认面板已隐藏") : "无默认面板",
      selectedFacility: s.selectedFacility,
    };
  });
  console.log("  → 当前设施:", workshopState.selectedFacility);
  console.log("  → 工具商店面板:", workshopState.storagePanel, "(应为「不存在」)");
  console.log("  → 工坊卡片:", workshopState.workshopCards);
  console.log("  → 默认说明面板:", workshopState.descPanel);
  await page.screenshot({ path: "tests/_screenshot_10_workshop.png" });

  console.log("\n=== 所有步骤完成，保持浏览器 15 秒供观察 ===");
  await page.waitForTimeout(15000);
  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
