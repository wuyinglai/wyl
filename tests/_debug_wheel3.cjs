const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("商店")) console.log("[page]", text);
  });

  await page.goto("http://localhost:5179", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });

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

  // 记录初始 container 引用
  const info0 = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    return {
      idx: ts.shopScrollIndex,
      containerRef: !!ts.shopPanelContainer,
      handler: !!ts.shopWheelHandler,
    };
  });
  console.log("初始: " + JSON.stringify(info0));

  // 派发一次 wheel
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const evt = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, clientX: 720, clientY: 435 });
    canvas.dispatchEvent(evt);
  });
  await page.waitForTimeout(800);

  // 检查
  const info1 = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    // 收集工具名
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
    return {
      idx: ts.shopScrollIndex,
      containerRef: !!ts.shopPanelContainer,
      handler: !!ts.shopWheelHandler,
      tools: names,
    };
  });
  console.log("滚动1后: " + JSON.stringify(info1));

  // 再滚一次
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const evt = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, clientX: 720, clientY: 435 });
    canvas.dispatchEvent(evt);
  });
  await page.waitForTimeout(800);

  const info2 = await page.evaluate(() => {
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
    return { idx: ts.shopScrollIndex, tools: names };
  });
  console.log("滚动2后: " + JSON.stringify(info2));

  await browser.close();
})();
