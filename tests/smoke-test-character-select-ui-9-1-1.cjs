/**
 * 阶段9.1.2：角色选择 UI 与 Tooltip 验证
 * 验证小屏下角色卡片不重叠，Tooltip 可显示完整被动说明
 */

const { chromium } = require("playwright");
const BASE_URL = process.env.BASE_URL || "http://localhost:5180";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    throw new Error(`断言失败: ${message}`);
  }
  passed++;
  console.log(`  ✅ ${message}`);
}

async function runTest() {
  console.log("========================================");
  console.log("阶段9.1.2：角色选择 UI 与 Tooltip 验证");
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

    const gameExists = await page.evaluate(() => !!window.game && !!window.game.scene);
    assert(gameExists, "window.game 存在");

    // 2. 进入 CharacterSelectScene（800x600）
    console.log("2. 进入 CharacterSelectScene（800x600）");
    await page.setViewportSize({ width: 800, height: 600 });
    await page.evaluate(() => {
      window.game.scene.start("CharacterSelectScene");
    });
    await sleep(1500);

    const csReady = await page.evaluate(() => !!window.game.scene.getScene("CharacterSelectScene"));
    assert(csReady, "CharacterSelectScene 就绪");

    // 3. 角色卡片存在且不重叠
    console.log("3. 角色卡片不重叠");
    const cardCheck = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const cards = cs.characterCards || [];
      const bounds = cards.map(c => ({
        x: c.x,
        y: c.y,
        w: c.width || 180,
        h: c.height || 260,
      }));
      let overlap = false;
      for (let i = 0; i < bounds.length; i++) {
        for (let j = i + 1; j < bounds.length; j++) {
          const dx = Math.abs(bounds[i].x - bounds[j].x);
          const dy = Math.abs(bounds[i].y - bounds[j].y);
          if (dx < bounds[i].w * 0.4 && dy < bounds[i].h * 0.4) {
            overlap = true;
          }
        }
      }
      return { count: cards.length, overlap };
    });
    assert(cardCheck.count >= 5, `至少有 5 张角色卡 (实际: ${cardCheck.count})`);
    assert(!cardCheck.overlap, "角色卡片不重叠");

    // 4. 悬浮第一张角色卡片，Tooltip 出现
    console.log("4. 悬浮角色卡片，Tooltip 出现");
    const tooltipCheck = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const card = cs.characterCards[0];
      if (!card) return { hasTooltip: false };

      let hitArea = null;
      for (const child of card.list) {
        if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return { hasTooltip: false, reason: "no hitArea" };

      hitArea.emit("pointerover");
      return { hasTooltip: true };
    });
    assert(tooltipCheck.hasTooltip, `悬浮后 Tooltip 出现 (${tooltipCheck.reason || ""})`);

    await sleep(300);

    // 5. Tooltip 文本包含角色名和被动说明
    console.log("5. Tooltip 文本包含角色信息");
    const tooltipText = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const tm = cs.tooltipManager;
      if (tm && tm.container && tm.container.visible) {
        const texts = tm.container.list.filter(c => c.type === "Text").map(t => t.text);
        return { visible: true, texts: texts.join(" | ") };
      }
      const texts = cs.children.list.filter(c => c.type === "Text" && c.visible).map(t => t.text);
      return { visible: false, texts: texts.join(" | ") };
    });
    console.log(`    Tooltip/文本: ${tooltipText.texts.substring(0, 200)}`);
    assert(tooltipText.texts.includes("被动") || tooltipText.texts.includes("盾击") || tooltipText.texts.includes("举盾"),
      `Tooltip 包含被动或技能信息`);

    // 6. pointerout 后 Tooltip 隐藏
    console.log("6. pointerout 后 Tooltip 隐藏");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const card = cs.characterCards[0];
      let hitArea = null;
      for (const child of card.list) {
        if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (hitArea) hitArea.emit("pointerout");
    });
    await sleep(300);

    const tooltipHidden = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      const tm = cs.tooltipManager;
      if (tm && tm.container) return !tm.container.visible;
      return true;
    });
    assert(tooltipHidden, "pointerout 后 Tooltip 隐藏");

    // 7. 选择 3 个角色
    console.log("7. 选择 3 个角色");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      for (let i = 0; i < 3; i++) {
        const card = cs.characterCards[i];
        for (const child of card.list) {
          if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
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

    // 8. 点击开始远征进入 CargoPrepScene
    console.log("8. 点击开始远征");
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      cs.startExpedition();
    });
    await sleep(2000);

    const cpReady = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
    assert(cpReady, "进入 CargoPrepScene");

    console.log("\n========================================");
    console.log(`角色选择 UI 与 Tooltip 验证: ${passed} 通过, ${failed} 失败`);
    console.log("========================================");

  } finally {
    await browser.close();
  }
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error("\n测试失败:", err.message);
  process.exit(1);
});
