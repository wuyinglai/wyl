const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("[page]", msg.text()));

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
      if (!target && c.type === "Text" && /仓库/.test(c.text))
        target = { x: c.x, y: c.y };
    });
    window.__t = target;
  });
  const t2 = await page.evaluate(() => window.__t);
  await page.mouse.click(t2.x, t2.y);
  await page.waitForTimeout(800);

  const diag = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    const g = window.game;
    return {
      hasSceneInputOn: typeof ts.input.on,
      hasGameInputOn: typeof g.input.on,
      shopWheelHandler: typeof ts.shopWheelHandler,
      shopScrollIndex: ts.shopScrollIndex,
      gameVersion: g.config.phaser?.version || "n/a",
    };
  });
  console.log("诊断: " + JSON.stringify(diag, null, 2));

  await page.evaluate(() => {
    window.__wheelCount = 0;
    window.__phaserWheelCount = 0;
    const canvas = document.querySelector("canvas");
    canvas.addEventListener(
      "wheel",
      (e) => {
        window.__wheelCount = (window.__wheelCount || 0) + 1;
        console.log("raw canvas wheel: deltaY=" + e.deltaY + ", clientX=" + e.clientX + ", clientY=" + e.clientY);
      },
      { passive: false }
    );
    // 尝试多种方式在 Phaser v4 注册 wheel
    const ts = window.game.scene.getScene("TownScene");
    ts.input.on("wheel", (p) => {
      window.__phaserWheelCount = (window.__phaserWheelCount || 0) + 1;
      console.log("phaser wheel via ts.input.on: deltaY=" + p.deltaY + ", x=" + p.x + ", y=" + p.y);
    });
    // 检查 ts.input 是否有其他事件
    console.log("ts.input 属性: " + Object.keys(ts.input).slice(0, 30).join(", "));
    // 看看 game.events 或其他事件
    try { console.log("game.events: " + typeof window.game.events); } catch(e) { console.log("no game.events"); }
    try { console.log("game.input: " + typeof window.game.input + " keys: " + Object.keys(window.game.input || {}).slice(0,20)); } catch(e) { console.log("no game.input"); }
    // 直接查看 Pointer 是否派发 wheel
    try { console.log("ts.input.mouse?: " + typeof ts.input.mouse); } catch(e) {}
    try { console.log("ts.input.pointers count?: " + (ts.input.pointers?.length || 0)); } catch(e) {}
  });

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const evt = new WheelEvent("wheel", {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
        clientX: 720,
        clientY: 435,
      });
      canvas.dispatchEvent(evt);
    });
    await page.waitForTimeout(200);
  }

  await page.waitForTimeout(800);
  const final = await page.evaluate(() => {
    const ts = window.game.scene.getScene("TownScene");
    return {
      shopScrollIndex: ts.shopScrollIndex,
      rawWheelCount: window.__wheelCount,
      phaserWheelCount: window.__phaserWheelCount,
    };
  });
  console.log("最终: " + JSON.stringify(final));

  await browser.close();
})();
