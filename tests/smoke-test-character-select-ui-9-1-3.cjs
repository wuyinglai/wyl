/**
 * smoke-test-character-select-ui-9-1-3.cjs
 * 阶段9.1.3：角色选择 UI 布局验证
 *
 * 验证：
 * 1. 真实流程进入 CharacterSelectScene
 * 2. 1280/1024/800 分辨率下卡片组左右边距不能明显失衡
 * 3. 最后一张卡不能超出屏幕
 * 4. 文本对象不能跨出卡片区域太多
 * 5. 角色卡不重叠
 * 6. hover 角色卡能显示 Tooltip
 * 7. 能点击选择 3 个角色
 * 8. 能进入 CargoPrepScene
 */

const { chromium } = require("playwright");
const BASE_URL = process.env.BASE_URL || "http://localhost:5180";

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

async function testResolution(page, width, height) {
  console.log(`\n--- 测试分辨率 ${width}x${height} ---`);

  await page.setViewportSize({ width, height });

  // 重新进入 CharacterSelectScene 以应用新分辨率
  // 必须同时 resize Phaser canvas
  await page.evaluate(({ w, h }) => {
    window.game.scale.resize(w, h);
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (cs) cs.scene.restart();
    else window.game.scene.start("CharacterSelectScene");
  }, { w: width, h: height });
  await sleep(1500);

  const csReady = await page.evaluate(() => !!window.game.scene.getScene("CharacterSelectScene"));
  if (!assert(csReady, `CharacterSelectScene 就绪 (${width}x${height})`)) return false;

  const layout = await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    const cards = cs.characterCards || [];
    const w = cs.scale.width;
    const h = cs.scale.height;

    if (cards.length === 0) return { error: "no cards" };

    const bounds = cards.map(c => {
      const b = c.getBounds();
      return { x: c.x, y: c.y, left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height, w: b.width, h: b.height };
    });

    const firstLeft = bounds[0].left;
    const lastRight = bounds[bounds.length - 1].right;
    const leftMargin = firstLeft;
    const rightMargin = w - lastRight;

    // 检查重叠
    let overlap = false;
    for (let i = 0; i < bounds.length; i++) {
      for (let j = i + 1; j < bounds.length; j++) {
        const dx = Math.abs(bounds[i].x - bounds[j].x);
        const dy = Math.abs(bounds[i].y - bounds[j].y);
        if (dx < bounds[i].w * 0.5 && dy < bounds[i].h * 0.5) {
          overlap = true;
        }
      }
    }

    // 检查文本是否超出卡片
    let textOverflow = false;
    for (let ci = 0; ci < cards.length; ci++) {
      const card = cards[ci];
      const cb = bounds[ci];
      for (const child of card.list) {
        if (child.type === "Text") {
          const tb = child.getBounds();
          if (tb.x < cb.left - 5 || tb.x + tb.width > cb.right + 5) {
            textOverflow = true;
          }
        }
      }
    }

    return {
      cardCount: cards.length,
      canvasW: w,
      canvasH: h,
      leftMargin,
      rightMargin,
      lastRight,
      overlap,
      textOverflow,
      balanced: Math.abs(leftMargin - rightMargin) < 80,
      inBounds: lastRight <= w + 5
    };
  });

  assert(layout.cardCount >= 5, `有 5 张角色卡 (实际: ${layout.cardCount})`);
  assert(layout.balanced, `左右边距均衡: 左=${layout.leftMargin?.toFixed?.(1) || layout.leftMargin}, 右=${layout.rightMargin?.toFixed?.(1) || layout.rightMargin}`);
  assert(layout.inBounds, `最后一张卡在屏幕内: right=${layout.lastRight?.toFixed?.(1) || layout.lastRight} <= ${width}`);
  assert(!layout.overlap, "角色卡片不重叠");
  assert(!layout.textOverflow, "文本不超出卡片区域");

  return true;
}

async function runTest() {
  console.log("========================================");
  console.log("阶段9.1.3：角色选择 UI 布局验证");
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

    // 2. 真实流程进入 RouteSelectScene
    console.log("2. 真实流程: MainMenu -> RouteSelect");
    await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (mm) mm.scene.start("RouteSelectScene");
    });
    await sleep(1500);

    // 3. 选择商路
    console.log("3. 选择第一条商路");
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
    });
    await sleep(1500);

    const activeScene = await page.evaluate(() => {
      const scenes = window.game.scene.scenes;
      return scenes.find(s => s.scene.isActive())?.scene?.key;
    });
    assert(activeScene === "CharacterSelectScene", `进入 CharacterSelectScene (实际: ${activeScene})`);

    // 4. 测试 1280x720
    await testResolution(page, 1280, 720);

    // 5. 测试 1024x768
    await testResolution(page, 1024, 768);

    // 6. 测试 800x600
    await testResolution(page, 800, 600);

    // 7. hover 显示 Tooltip
    console.log("\n7. hover 角色卡显示 Tooltip");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.evaluate(() => {
      window.game.scene.start("CharacterSelectScene");
    });
    await sleep(1500);

    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const card = cs.characterCards[0];
      for (const child of card.list) {
        if (child.type === "Zone" && child.input && child.input.enabled) {
          child.emit("pointerover");
          break;
        }
      }
    });
    await sleep(300);

    const tooltipCheck = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const tm = cs.tooltipManager;
      if (tm && tm.container && tm.container.visible) {
        const texts = tm.container.list.filter(c => c.type === "Text").map(t => t.text);
        return { visible: true, hasPassive: texts.some(t => t.includes("被动")), texts: texts.join(" | ") };
      }
      return { visible: false };
    });
    assert(tooltipCheck.visible, "Tooltip 可见");
    assert(tooltipCheck.hasPassive, `Tooltip 包含被动说明: ${tooltipCheck.texts?.substring(0, 100)}`);

    // 8. 选择 3 个角色并进入 CargoPrepScene
    console.log("\n8. 选择 3 个角色并进入 CargoPrepScene");
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

    const selected = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      return cs.selectedChars.length;
    });
    assert(selected === 3, `选择了 3 个角色 (实际: ${selected})`);

    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs.startExpedition) cs.startExpedition();
    });
    await sleep(2000);

    const afterScene = await page.evaluate(() => {
      const scenes = window.game.scene.scenes;
      return scenes.find(s => s.scene.isActive())?.scene?.key;
    });
    assert(afterScene === "CargoPrepScene", `进入 CargoPrepScene (实际: ${afterScene})`);

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
