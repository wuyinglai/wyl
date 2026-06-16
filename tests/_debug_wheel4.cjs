const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("商店") || text.includes("wheel")) console.log("[page]", text);
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

  // 看 input 的事件计数
  const count = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    const events = ts.input._events;
    const cnt = events["wheel"] ? events["wheel"].length : 0;
    return { wheelHandlerCount: cnt, shopScrollIndex: ts.shopScrollIndex };
  });
  console.log("初始: " + JSON.stringify(count));

  // 派发 wheel，触发滚动重建
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    for (let i = 0; i < 3; i++) {
      const evt = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, clientX: 720, clientY: 435 });
      canvas.dispatchEvent(evt);
    }
  });
  await page.waitForTimeout(800);

  const count2 = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    const events = ts.input._events;
    const cnt = events["wheel"] ? events["wheel"].length : 0;
    return { wheelHandlerCount: cnt, shopScrollIndex: ts.shopScrollIndex };
  });
  console.log("滚动后: " + JSON.stringify(count2));

  await browser.close();
})();
