/**
 * 阶段10.6.4 真实输入测试工具函数
 *  - gameToScreen: Phaser 游戏坐标 → 浏览器视口坐标
 *  - clickGamePoint: 真实点击游戏坐标
 *  - waitForSceneReady: 等待场景 ready（不只判断 getScene 存在）
 */

async function gameToScreen(page, point) {
  return page.evaluate(({ x, y }) => {
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("canvas not found");
    const rect = canvas.getBoundingClientRect();
    const game = window.game;
    const gameWidth =
      game?.scale?.gameSize?.width ??
      game?.config?.width ??
      canvas.width;
    const gameHeight =
      game?.scale?.gameSize?.height ??
      game?.config?.height ??
      canvas.height;
    const screenX = rect.left + (x / gameWidth) * rect.width;
    const screenY = rect.top + (y / gameHeight) * rect.height;
    return {
      x: screenX,
      y: screenY,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      gameWidth,
      gameHeight,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      devicePixelRatio: window.devicePixelRatio,
    };
  }, point);
}

async function clickGamePoint(page, point, label) {
  const screen = await gameToScreen(page, point);
  console.log(
    "[clickGamePoint] " +
      label +
      " game=(" + point.x + ", " + point.y + ") " +
      "screen=(" + Math.round(screen.x) + ", " + Math.round(screen.y) + ") " +
      "canvasRect=(" + Math.round(screen.rect.left) + "," + Math.round(screen.rect.top) + "," +
      Math.round(screen.rect.width) + "," + Math.round(screen.rect.height) + ") " +
      "gameSize=" + screen.gameWidth + "x" + screen.gameHeight +
      " dpr=" + screen.devicePixelRatio
  );
  await page.mouse.click(screen.x, screen.y);
  await page.waitForTimeout(300);
  return screen;
}

async function waitForSceneReady(page, sceneKey, options = {}) {
  const {
    minChildren = 1,
    requireActive = true,
    requireRouteCards = false,
    requireCharacterCards = false,
    timeoutMs = 8000,
  } = options;

  const start = Date.now();
  let last = null;

  while (Date.now() - start < timeoutMs) {
    last = await page.evaluate(
      (args) => {
        const game = window.game;
        const scene = game?.scene?.getScene(args.sceneKey);
        const isActive = game?.scene?.isActive?.(args.sceneKey) ?? false;
        const childrenCount =
          scene?.children?.getAll?.().length ??
          scene?.children?.list?.length ??
          0;
        const routeCardsLength = scene?.routeCards?.length ?? 0;
        const characterCardsLength = scene?.characterCards?.length ?? 0;
        const hasMapCells = scene?.mapCells?.length ?? 0;
        const ok =
          !!scene &&
          (!args.requireActive || isActive) &&
          childrenCount >= args.minChildren &&
          (!args.requireRouteCards || routeCardsLength > 0) &&
          (!args.requireCharacterCards || characterCardsLength > 0);
        return {
          ok,
          exists: !!scene,
          isActive,
          childrenCount,
          routeCardsLength,
          characterCardsLength,
          hasMapCells,
          activeScenes:
            game?.scene?.scenes
              ?.filter((s) => s?.scene?.isActive?.())
              ?.map((s) => s.scene.key) ?? [],
        };
      },
      { sceneKey, minChildren, requireActive, requireRouteCards, requireCharacterCards }
    );

    if (last.ok) return last;
    await page.waitForTimeout(250);
  }

  throw new Error("Scene not ready: " + sceneKey + " last=" + JSON.stringify(last));
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 查找 scene 中匹配文本的可交互按钮（Text 自身 interactive 或 Rectangle 旁边 Text）
 * 返回 { x, y }，用于 clickGamePoint
 */
async function findInteractiveButtonByText(page, sceneKey, textPattern) {
  return page.evaluate(([key, patStr]) => {
    const scene = window.game.scene.getScene(key);
    if (!scene) return null;
    const pat = new RegExp(patStr);
    let result = null;

    // 1. Text 自身 interactive
    scene.children?.each?.((child) => {
      if (result) return;
      if (child.type === "Text" && child.input && child.input.enabled) {
        if (child.text && pat.test(child.text)) {
          result = { x: child.x, y: child.y };
        }
      }
    });

    // 2. Rectangle + 旁边 Text（例如 MapScene 撤退按钮、CargoPrepScene 的按钮）
    if (!result) {
      const rects = [];
      const texts = [];
      scene.children?.each?.((child) => {
        if (child.type === "Rectangle" && child.input && child.input.enabled) {
          rects.push({ x: child.x, y: child.y });
        }
        if (child.type === "Text" && child.text && pat.test(child.text)) {
          texts.push({ x: child.x, y: child.y, text: child.text });
        }
      });
      // 找最接近的 rectangle-text 对
      let bestDist = 999999;
      let bestRect = null;
      for (const r of rects) {
        for (const t of texts) {
          const d = Math.abs(r.x - t.x) + Math.abs(r.y - t.y);
          if (d < 50 && d < bestDist) {
            bestDist = d;
            bestRect = r;
          }
        }
      }
      if (bestRect) result = { x: bestRect.x, y: bestRect.y };
    }

    // 3. Container（按钮容器，子元素含 Text）
    if (!result) {
      scene.children?.each?.((child) => {
        if (result) return;
        if (child.type !== "Text" && child.type !== "Rectangle" && child.input && child.input.enabled && child.list) {
          for (const sub of child.list) {
            if (sub.type === "Text" && sub.text && pat.test(sub.text)) {
              result = { x: child.x, y: child.y };
              break;
            }
          }
        }
      });
    }
    return result;
  }, [sceneKey, textPattern]);
}

/**
 * 共享真实流程：主菜单点击 → 路线选择 → 角色选择 → CargoPrep → MapScene
 * 完成后 MapScene 已 ready 并可交互
 * 返回：MapScene 的初始诊断状态（currentPosition、selectedOrderId 等）
 */
async function startRealExpeditionToMap(page, opts = {}) {
  const { startFromMainMenu = true, needOneClickLoad = true } = opts;

  if (startFromMainMenu) {
    // 确保当前在 MainMenuScene
    const hasMM = await page.evaluate(() => {
      return (
        window.game.scene.getScene("MainMenuScene") &&
        (window.game.scene.isActive("MainMenuScene") || window.game.scene.getScene("MainMenuScene").scene.isActive())
      );
    });
    if (!hasMM) {
      await page.evaluate(() => { window.game.scene.start("MainMenuScene"); });
      await sleep(1500);
    } else {
      // 已经在 MainMenu
      await sleep(500);
    }

    // 真实点击主菜单的"开始远征"
    const startBtn = await page.evaluate(() => {
      const mm = window.game.scene.getScene("MainMenuScene");
      if (!mm) return null;
      let btn = null;
      mm.children.each((child) => {
        if (btn) return;
        if (child.type === "Text" && child.input && child.input.enabled) {
          if (child.text && /开始远征|开始游戏/.test(child.text)) {
            btn = { x: child.x, y: child.y };
          }
        }
      });
      return btn;
    });
    if (!startBtn) throw new Error("未找到主菜单开始远征按钮");
    await clickGamePoint(page, { x: startBtn.x, y: startBtn.y }, "主菜单开始远征");
  }

  // 等待 RouteSelectScene ready
  await waitForSceneReady(page, "RouteSelectScene", { requireRouteCards: true, timeoutMs: 10000 });

  // 真实点击第一张路线卡
  const routeCardPt = await page.evaluate(() => {
    const rs = window.game.scene.getScene("RouteSelectScene");
    if (!rs || !rs.routeCards || rs.routeCards.length === 0) return null;
    return { x: rs.routeCards[0].x, y: rs.routeCards[0].y };
  });
  if (!routeCardPt) throw new Error("RouteSelectScene routeCards[0] 不存在");
  await clickGamePoint(page, { x: routeCardPt.x, y: routeCardPt.y }, "路线卡1");

  // 等待 CharacterSelectScene ready
  await waitForSceneReady(page, "CharacterSelectScene", { requireCharacterCards: true, timeoutMs: 10000 });

  // 真实点击 3 张角色卡
  const charCards = await page.evaluate(() => {
    const cs = window.game.scene.getScene("CharacterSelectScene");
    if (!cs || !cs.characterCards || cs.characterCards.length < 3) return null;
    return [
      { x: cs.characterCards[0].x, y: cs.characterCards[0].y },
      { x: cs.characterCards[1].x, y: cs.characterCards[1].y },
      { x: cs.characterCards[2].x, y: cs.characterCards[2].y },
    ];
  });
  if (!charCards) throw new Error("CharacterSelectScene 没有 3 张角色卡");
  for (let i = 0; i < 3; i++) {
    await clickGamePoint(page, { x: charCards[i].x, y: charCards[i].y }, "角色卡" + (i + 1));
    await sleep(300);
  }

  // 真实点击 CharacterSelectScene 的"开始远征"
  const csStartBtn = await findInteractiveButtonByText(page, "CharacterSelectScene", "开始远征");
  if (!csStartBtn) throw new Error("CharacterSelectScene 没有找到开始远征按钮");
  await clickGamePoint(page, { x: csStartBtn.x, y: csStartBtn.y }, "CharacterSelectScene 开始远征");

  // 等待 CargoPrepScene ready
  await waitForSceneReady(page, "CargoPrepScene", { minChildren: 3, timeoutMs: 10000 });

  // 真实点击 CargoPrepScene 的"开始远征"
  const cpStartBtn = await findInteractiveButtonByText(page, "CargoPrepScene", "开始远征");
  if (!cpStartBtn) throw new Error("CargoPrepScene 没有找到开始远征按钮");
  await clickGamePoint(page, { x: cpStartBtn.x, y: cpStartBtn.y }, "CargoPrepScene 开始远征");

  // 等待 MapScene ready
  const mapReady = await waitForSceneReady(page, "MapScene", { minChildren: 20, timeoutMs: 15000 });

  // 读取 MapScene 初始诊断状态
  const diag = await page.evaluate(() => {
    const gs = window.getGameState();
    const ms = window.game.scene.getScene("MapScene");
    const infoTexts = (ms && ms._infoPanelTexts) ? ms._infoPanelTexts.map((t) => (t && t.text) || "") : [];
    return {
      active: ms && ms.scene.isActive(),
      currentPosition: gs.currentPosition,
      selectedOrderId: gs.selectedOrderId,
      selectedCharacters: gs.selectedCharacters && gs.selectedCharacters.length,
      mapCells: gs.mapCells && gs.mapCells.length,
      modalOpen: !!(ms && ms.modalContainer),
      infoTexts: infoTexts,
      activeScenes: window.game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key),
    };
  });

  return { mapReady, diag };
}

/**
 * 在 MapScene children + _infoPanelTexts 中查找包含"目标/订单"的文本
 * 用于 UI overlap 测试判断信息面板是否存在
 */
function hasInfoTextInMapSceneChildren(page) {
  return page.evaluate(() => {
    const ms = window.game.scene.getScene("MapScene");
    if (!ms) return { ok: false, reason: "no MapScene" };
    const hasGraphics = { found: false };
    const seen = new Set();
    const infoMatches = [];

    // children.getAll()
    if (ms.children && typeof ms.children.getAll === "function") {
      try {
        const arr = ms.children.getAll();
        for (const child of arr) {
          if (!child) continue;
          if (child.type === "Graphics") hasGraphics.found = true;
          if (child.type === "Text" && child.text) {
            const t = String(child.text);
            if (t.includes("目标") || t.includes("订单")) infoMatches.push(t.slice(0, 80));
          }
        }
      } catch (e) {}
    }
    // children.list
    if (ms.children && ms.children.list) {
      for (const child of ms.children.list) {
        if (!child) continue;
        if (seen.has(child)) continue;
        seen.add(child);
        if (child.type === "Graphics") hasGraphics.found = true;
        if (child.type === "Text" && child.text) {
          const t = String(child.text);
          if (t.includes("目标") || t.includes("订单")) infoMatches.push(t.slice(0, 80));
        }
      }
    }
    // children.each fallback
    if (!hasGraphics.found || infoMatches.length === 0) {
      try {
        ms.children.each((child) => {
          if (!child) return;
          if (seen.has(child)) return;
          seen.add(child);
          if (child.type === "Graphics") hasGraphics.found = true;
          if (child.type === "Text" && child.text) {
            const t = String(child.text);
            if (t.includes("目标") || t.includes("订单")) infoMatches.push(t.slice(0, 80));
          }
        });
      } catch (e) {}
    }
    // _infoPanelTexts
    if (ms._infoPanelTexts && ms._infoPanelTexts.length) {
      for (const t of ms._infoPanelTexts) {
        if (t && t.text) {
          const str = String(t.text);
          if (str.includes("目标") || str.includes("订单")) infoMatches.push(str.slice(0, 80));
        }
      }
    }
    return {
      ok: infoMatches.length > 0,
      hasGraphics: hasGraphics.found,
      matches: infoMatches.slice(0, 5),
      infoPanelTextsCount: ms._infoPanelTexts ? ms._infoPanelTexts.length : 0,
    };
  });
}

module.exports = {
  gameToScreen,
  clickGamePoint,
  waitForSceneReady,
  sleep,
  findInteractiveButtonByText,
  startRealExpeditionToMap,
  hasInfoTextInMapSceneChildren,
};
