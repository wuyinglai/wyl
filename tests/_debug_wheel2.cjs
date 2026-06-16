const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("商店") || text.includes("wheel") || text.includes("scroll") || text.includes("余烬")) console.log("[page]", text);
  });

  await page.goto("http://localhost:5179", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

  // 主菜单 → 开始远征
  await page.evaluate(() => {
    const mm = window.game.scene.getScene("MainMenuScene");
    let target = null;
    mm.children.each((c) => {
      if (!target && c.type === "Text" && c.input?.enabled && /开始远征/.test(c.text))
        target = { x: c.x, y: c.y };
    });
    window.__t = target;
  });
  const t1 = await page.evaluate(() => window.__t);
  await page.mouse.click(t1.x, t1.y);
  await page.waitForTimeout(1500);

  // 点击仓库/工具
  await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    let target = null;
    ts.children.each((c) => {
      if (!target && c.type === "Text" && /仓库/.test(c.text)) target = { x: c.x, y: c.y };
    });
    window.__t = target;
  });
  const t2 = await page.evaluate(() => window.__t);
  await page.mouse.click(t2.x, t2.y);
  await page.waitForTimeout(800);

  // 初始索引
  const idx0 = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    return { shopScrollIndex: ts.shopScrollIndex, shopWheelHandler: !!ts.shopWheelHandler };
  });
  console.log("初始: " + JSON.stringify(idx0));

  // 派发 wheel 事件 (3 次)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const evt = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, clientX: 720, clientY: 435 });
      canvas.dispatchEvent(evt);
    });
    await page.waitForTimeout(400);
  }

  // 最终索引
  const idx1 = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    return { shopScrollIndex: ts.shopScrollIndex };
  });
  console.log("最终: " + JSON.stringify(idx1));

  // 检查当前可见工具名称
  const tools = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    const names = [];
    function walk(parent) {
      if (!parent) return;
      const list = parent === ts ? (ts.children?.list || []) : (parent.list || []);
      for (const child of list) {
        if (!child) continue;
        if (child.type === "Text" && child.visible !== false) {
          const t = String(child.text || "");
          if (["密封货箱","备用轮轴","测距镜","伪装布","防水油布","沙尘面罩","信号焰火","加固护板"].includes(t)) names.push(t);
        }
        if (child.type === "Container") walk(child);
      }
    }
    walk(ts);
    return names;
  });
  console.log("当前可见工具: " + JSON.stringify(tools));

  await browser.close();
})();
