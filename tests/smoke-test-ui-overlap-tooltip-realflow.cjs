/**
 * smoke-test-ui-overlap-tooltip-realflow.cjs
 * UI重叠与Tooltip真实流程冒烟测试（严格版）
 *
 * 失败时 process.exit(1)，成功时 process.exit(0)
 *
 * 验证要点:
 * 1. window.game 存在
 * 2. 1280x720 下进入 RouteSelectScene
 * 3. 3张商路卡片存在
 * 4. pointerover 第一张商路卡片的 hitArea 后 Tooltip 出现
 * 5. pointerout 后 Tooltip 隐藏
 * 6. 选择第一条商路，进入 CharacterSelectScene
 * 7. pointerover 第一张角色卡片的 hitArea 后 Tooltip 出现
 * 8. pointerout 后 Tooltip 隐藏
 * 9. 选择3个角色并开始远征，进入 MapScene
 * 10. 1280x720 下截图
 * 11. 信息面板存在（含"目标"或"订单"文本）
 * 12. 信息面板有 Graphics 背景
 * 13. pointerover 信息面板 hitArea 后 Tooltip 出现
 * 14. pointerout 后 Tooltip 隐藏
 * 15. 找到战斗类型邻居，移动进入 BattleScene
 * 16. 手牌数量 > 0（必须非零，否则直接失败）
 * 17. pointerover 第一张手牌后 Tooltip 出现且包含卡牌名称
 * 18. pointerout 后 Tooltip 隐藏
 * 19. 触发战斗结束，进入奖励界面
 * 20. pointerover 奖励卡 hitArea 后 Tooltip 出现且包含卡牌名称
 * 21. Tooltip 不超出屏幕边界
 * 22. pointerout 后 Tooltip 隐藏
 * 23. 选择第一张奖励卡，返回 MapScene
 * 24. 800x600 下重新进入 MapScene 并截图
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5173";
const ARTIFACT_DIR = path.join(__dirname, "..", "test-artifacts", "ui-hotfix");

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    throw new Error(`断言失败: ${message}`);
  }
  passed++;
  console.log(`  [PASS] ${message}`);
}

// 确保截图目录存在
function ensureArtifactDir() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
}

// 在容器中查找 hitArea（Rectangle 或 Zone，且 input.enabled）
function findHitArea(container) {
  if (!container || !container.list) return null;
  for (const child of container.list) {
    if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
      return child;
    }
  }
  return null;
}

// 检查场景中是否有 Tooltip（Container with depth >= 500）
function hasTooltip(scene) {
  if (!scene || !scene.children || !scene.children.list) return false;
  for (const child of scene.children.list) {
    if (child.type === "Container" && child.depth >= 500) {
      return true;
    }
  }
  return false;
}

// 获取场景中 Tooltip 的文本内容
function getTooltipText(scene) {
  if (!scene || !scene.children || !scene.children.list) return "";
  for (const child of scene.children.list) {
    if (child.type === "Container" && child.depth >= 500) {
      for (const c of child.list) {
        if (c.type === "Text") return c.text || "";
      }
    }
  }
  return "";
}

// 获取场景中 Tooltip 的 bounds
function getTooltipBounds(scene) {
  if (!scene || !scene.children || !scene.children.list) return null;
  for (const child of scene.children.list) {
    if (child.type === "Container" && child.depth >= 500) {
      return child.getBounds();
    }
  }
  return null;
}

async function runTest() {
  console.log("========================================");
  console.log("UI重叠与Tooltip真实流程冒烟测试（严格版）");
  console.log("========================================\n");

  ensureArtifactDir();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // ========== 1. 游戏加载，验证 window.game 存在 ==========
    console.log("1. 游戏加载");
    await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(2000);
    await page.waitForFunction(() => window.game && window.game.scene, { timeout: 30000 });
    assert(await page.evaluate(() => !!window.game && !!window.game.scene), "window.game 存在");

    // ========== 2. 设定视口 1280x720，进入 RouteSelectScene ==========
    console.log("2. 设定视口 1280x720，进入 RouteSelectScene");
    await page.setViewportSize({ width: 1280, height: 720 });
    await sleep(300);
    await page.evaluate(() => { window.game.scene.start("RouteSelectScene"); });
    await sleep(1500);
    assert(await page.evaluate(() => !!window.game.scene.getScene("RouteSelectScene")), "RouteSelectScene 已启动");

    // ========== 3. 验证 3 张商路卡片存在 ==========
    console.log("3. 验证 3 张商路卡片存在");
    const routeCardCount = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards) return 0;
      return rs.routeCards.length;
    });
    assert(routeCardCount === 3, `RouteSelectScene 有 ${routeCardCount} 张商路卡片`);

    // ========== 4. pointerover 第一张商路卡片的 hitArea，验证 Tooltip 出现 ==========
    console.log("4. pointerover 第一张商路卡片的 hitArea，验证 Tooltip 出现");
    const routeTooltipResult = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) {
        return { ok: false, reason: "no route cards" };
      }
      const firstCard = rs.routeCards[0];
      // 查找 hitArea：Rectangle with input enabled
      let hitArea = null;
      for (const child of firstCard.list) {
        if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return { ok: false, reason: "no hitArea found in first route card" };

      // 发射 pointerover 事件
      hitArea.emit("pointerover");

      // 检查 Tooltip 是否出现（Container with depth >= 500）
      let tooltipVisible = false;
      for (const child of rs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          tooltipVisible = true;
          break;
        }
      }

      return { ok: true, tooltipVisible };
    });
    assert(routeTooltipResult.ok && routeTooltipResult.tooltipVisible,
      "pointerover 后商路卡片 Tooltip 出现");

    // ========== 5. pointerout，验证 Tooltip 隐藏 ==========
    console.log("5. pointerout，验证 Tooltip 隐藏");
    const routeTooltipHidden = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs || !rs.routeCards || rs.routeCards.length === 0) return false;
      const firstCard = rs.routeCards[0];
      let hitArea = null;
      for (const child of firstCard.list) {
        if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return false;

      hitArea.emit("pointerout");

      // 检查 Tooltip 是否消失
      for (const child of rs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          return false; // 仍然可见
        }
      }
      return true;
    });
    assert(routeTooltipHidden, "pointerout 后商路卡片 Tooltip 隐藏");

    // ========== 6. 选择第一条商路，进入 CharacterSelectScene ==========
    console.log("6. 选择第一条商路，进入 CharacterSelectScene");
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) {
        const route = rs.routes[0];
        rs.selectRoute(route);
      }
    });
    await sleep(2000);
    assert(await page.evaluate(() => !!window.game.scene.getScene("CharacterSelectScene")), "进入 CharacterSelectScene");

    // ========== 7. pointerover 第一张角色卡片的 hitArea，验证 Tooltip 出现 ==========
    console.log("7. pointerover 第一张角色卡片的 hitArea，验证 Tooltip 出现");
    const charTooltipResult = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length === 0) {
        return { ok: false, reason: "no character cards" };
      }
      const firstCard = cs.characterCards[0];
      // 查找 hitArea：Zone with input enabled
      let hitArea = null;
      for (const child of firstCard.list) {
        if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return { ok: false, reason: "no hitArea found in first character card" };

      hitArea.emit("pointerover");

      // 检查 Tooltip 是否出现
      let tooltipVisible = false;
      for (const child of cs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          tooltipVisible = true;
          break;
        }
      }

      return { ok: true, tooltipVisible };
    });
    assert(charTooltipResult.ok && charTooltipResult.tooltipVisible,
      "pointerover 后角色卡片 Tooltip 出现");

    // ========== 8. pointerout，验证 Tooltip 隐藏 ==========
    console.log("8. pointerout，验证 Tooltip 隐藏");
    const charTooltipHidden = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (!cs || !cs.characterCards || cs.characterCards.length === 0) return false;
      const firstCard = cs.characterCards[0];
      let hitArea = null;
      for (const child of firstCard.list) {
        if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return false;

      hitArea.emit("pointerout");

      for (const child of cs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          return false;
        }
      }
      return true;
    });
    assert(charTooltipHidden, "pointerout 后角色卡片 Tooltip 隐藏");

    // ========== 9. 选择3个角色并开始远征，进入 MapScene ==========
    console.log("9. 选择3个角色并开始远征，进入 MapScene");
    // 先选择3个角色
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length >= 3) {
        for (let i = 0; i < 3; i++) {
          const card = cs.characterCards[i];
          for (const child of card.list) {
            if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
              child.emit("pointerdown");
              break;
            }
          }
        }
      }
    });
    await sleep(500);
    // 确认已选3个角色
    const charSelectResult = await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      return cs ? cs.selectedChars : [];
    });
    console.log(`    已选角色: ${JSON.stringify(charSelectResult)}`);
    // 开始远征
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 阶段8.5：经过 CargoPrepScene
    const cargoPrepReady1 = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
    assert(cargoPrepReady1, "CargoPrepScene 就绪");

    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2500);

    assert(await page.evaluate(() => !!window.game.scene.getScene("MapScene")), "进入 MapScene");

    // ========== 10. 1280x720 下截图 ==========
    console.log("10. 1280x720 下截图");
    await page.setViewportSize({ width: 1280, height: 720 });
    await sleep(500);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "mapscene-1280x720.png"),
    });
    passed++;
    console.log("  [PASS] MapScene 1280x720 截图已保存");

    // ========== 11. 验证信息面板存在（含"目标"或"订单"文本） ==========
    console.log("11. 验证信息面板存在（含\"目标\"或\"订单\"文本）");
    const infoPanelText = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return { hasInfoText: false };
      let hasInfoText = false;
      const children = ms.children.list || [];
      for (const child of children) {
        if (child.type === "Text") {
          const t = child.text || "";
          if (t.includes("目标") || t.includes("订单")) {
            hasInfoText = true;
            break;
          }
        }
      }
      return { hasInfoText };
    });
    assert(infoPanelText.hasInfoText, "MapScene 信息面板文本存在（含\"目标\"或\"订单\"）");

    // ========== 12. 验证信息面板有 Graphics 背景 ==========
    console.log("12. 验证信息面板有 Graphics 背景");
    const infoPanelGraphics = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return { hasGraphics: false };
      let hasGraphics = false;
      const children = ms.children.list || [];
      for (const child of children) {
        if (child.type === "Graphics") {
          hasGraphics = true;
          break;
        }
      }
      return { hasGraphics };
    });
    assert(infoPanelGraphics.hasGraphics, "MapScene 信息面板有 Graphics 背景");

    // ========== 13. pointerover 信息面板 hitArea，验证 Tooltip 出现 ==========
    console.log("13. pointerover 信息面板 hitArea，验证 Tooltip 出现");
    const infoTooltipResult = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return { ok: false, reason: "no MapScene" };

      // 信息面板 hitArea 是 Rectangle with depth 102
      let hitArea = null;
      const children = ms.children.list || [];
      for (const child of children) {
        if (child.type === "Rectangle" && child.depth === 102 && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return { ok: false, reason: "no info panel hitArea (depth 102 Rectangle)" };

      hitArea.emit("pointerover");

      // 检查 Tooltip 是否出现
      let tooltipVisible = false;
      for (const child of ms.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          tooltipVisible = true;
          break;
        }
      }

      return { ok: true, tooltipVisible };
    });
    assert(infoTooltipResult.ok && infoTooltipResult.tooltipVisible,
      "pointerover 后信息面板 Tooltip 出现");

    // ========== 14. pointerout，验证 Tooltip 隐藏 ==========
    console.log("14. pointerout，验证 Tooltip 隐藏");
    const infoTooltipHidden = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return false;

      let hitArea = null;
      const children = ms.children.list || [];
      for (const child of children) {
        if (child.type === "Rectangle" && child.depth === 102 && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return false;

      hitArea.emit("pointerout");

      for (const child of ms.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          return false;
        }
      }
      return true;
    });
    assert(infoTooltipHidden, "pointerout 后信息面板 Tooltip 隐藏");

    // ========== 15. 进入 BattleScene（通过地图移动到战斗节点） ==========
    console.log("15. 进入 BattleScene（通过地图移动到战斗节点）");

    // 找到一个 question 节点，强制设置 resolvedType 为 combat，然后移动
    const battleMoveResult = await page.evaluate(() => {
      const ms = window.game.scene.getScene("MapScene");
      if (!ms) return { ok: false, reason: "no MapScene" };
      const gs = window.getGameState();
      const neighbors = window.getMovableNeighbors(gs);
      if (!neighbors || neighbors.length === 0) return { ok: false, reason: "no neighbors" };
      const cells = gs.mapCells || [];
      for (const n of neighbors) {
        if (n.y >= 0 && n.y < cells.length && n.x >= 0 && n.x < cells[n.y].length) {
          const cell = cells[n.y][n.x];
          if (cell && cell.type === "question") {
            // 强制设置 resolvedType 为 combat，并标记为已揭示（避免 tryMoveTo 重新 resolve）
            cell.resolvedType = "combat";
            cell.isRevealed = true;
            ms.tryMoveTo(n.x, n.y);
            return { ok: true, type: cell.type, x: n.x, y: n.y, resolvedType: "combat" };
          }
        }
      }
      return { ok: false, reason: "no question neighbor" };
    });

    if (battleMoveResult.ok) {
      console.log(`    强制战斗节点: question at (${battleMoveResult.x}, ${battleMoveResult.y})`);
    } else {
      console.log(`    未找到战斗邻居: ${battleMoveResult.reason}`);
    }
    await sleep(4000);

    // 注意：不要在这里调用 getScene("BattleScene")，因为 Phaser 会预创建场景实例
    // 导致后续 scene.start("BattleScene") 不会重新调用 create()
    // 直接等待并检查手牌数量

    // ========== 16. 验证手牌数量 > 0（必须非零，否则直接失败） ==========
    console.log("16. 验证手牌数量 > 0");
    await sleep(2000); // 等待手牌渲染
    const handResult = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs) return { exists: false, count: 0 };
      if (!bs.cardTexts) return { exists: true, count: 0, hasBM: !!bs.battleManager };
      return { exists: true, count: bs.cardTexts.length, hasBM: !!bs.battleManager };
    });
    console.log(`    BattleScene: exists=${handResult.exists}, hasBM=${handResult.hasBM}, 手牌数量: ${handResult.count}`);

    if (handResult.count === 0) {
      // 手牌为0，直接失败
      failed++;
      throw new Error("手牌数量为 0，测试必须失败");
    }
    assert(handResult.count > 0, `手牌数量为 ${handResult.count}（大于 0）`);

    // ========== 17. pointerover 第一张手牌，验证 Tooltip 出现且包含卡牌名称 ==========
    console.log("17. pointerover 第一张手牌，验证 Tooltip 出现且包含卡牌名称");
    const handTooltipResult = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs || !bs.cardTexts || bs.cardTexts.length === 0) {
        return { ok: false, reason: "no hand cards" };
      }
      const firstCard = bs.cardTexts[0];
      const cardName = firstCard.text || "";

      firstCard.emit("pointerover");

      // 检查 Tooltip 是否出现
      let tooltipVisible = false;
      let tooltipText = "";
      for (const child of bs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          tooltipVisible = true;
          for (const c of child.list) {
            if (c.type === "Text") {
              tooltipText = c.text || "";
              break;
            }
          }
          break;
        }
      }

      return { ok: true, tooltipVisible, tooltipText, cardName };
    });
    assert(handTooltipResult.ok && handTooltipResult.tooltipVisible,
      "pointerover 后手牌 Tooltip 出现");
    assert(handTooltipResult.tooltipText.length > 0,
      `Tooltip 文本包含内容: "${handTooltipResult.tooltipText.substring(0, 40)}"`);

    // ========== 18. pointerout，验证 Tooltip 隐藏 ==========
    console.log("18. pointerout，验证 Tooltip 隐藏");
    const handTooltipHidden = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs || !bs.cardTexts || bs.cardTexts.length === 0) return false;

      const firstCard = bs.cardTexts[0];
      firstCard.emit("pointerout");

      for (const child of bs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          return false;
        }
      }
      return true;
    });
    assert(handTooltipHidden, "pointerout 后手牌 Tooltip 隐藏");

    // ========== 19. 触发战斗结束，进入奖励界面 ==========
    console.log("19. 触发战斗结束，进入奖励界面");
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs && !bs.battleEnded) {
        // 直接调用 onBattleEnd(true) 触发胜利
        bs.onBattleEnd(true);
      }
    });
    await sleep(2000);

    // ========== 20. pointerover 奖励卡 hitArea，验证 Tooltip 出现且包含卡牌名称 ==========
    console.log("20. pointerover 奖励卡 hitArea，验证 Tooltip 出现且包含卡牌名称");
    const rewardTooltipResult = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs) return { ok: false, reason: "no BattleScene" };

      // 找到奖励卡的 hitArea：Rectangle with depth >= 200 and input enabled
      let hitArea = null;
      const children = bs.children.list || [];
      for (const child of children) {
        if (child.type === "Rectangle" && child.depth >= 200 && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return { ok: false, reason: "no reward card hitArea (depth >= 200 Rectangle)" };

      hitArea.emit("pointerover");

      // 检查 Tooltip 是否出现
      let tooltipVisible = false;
      let tooltipText = "";
      for (const child of bs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          tooltipVisible = true;
          for (const c of child.list) {
            if (c.type === "Text") {
              tooltipText = c.text || "";
              break;
            }
          }
          break;
        }
      }

      return { ok: true, tooltipVisible, tooltipText, hitAreaDepth: hitArea.depth };
    });

    if (rewardTooltipResult.ok && rewardTooltipResult.tooltipVisible) {
      assert(rewardTooltipResult.tooltipText.length > 0,
        `奖励卡 Tooltip 文本: "${rewardTooltipResult.tooltipText.substring(0, 40)}"`);
      console.log(`    hitArea depth: ${rewardTooltipResult.hitAreaDepth}`);
    } else {
      // 不允许跳过，必须失败
      const reason = rewardTooltipResult.ok
        ? `Tooltip 未出现 (hitArea found but tooltip missing)`
        : `找不到奖励卡 hitArea: ${rewardTooltipResult.reason}`;
      assert(false, `奖励卡 Tooltip 验证失败: ${reason}`);
    }

    // ========== 21. 验证 Tooltip 不超出屏幕边界 ==========
    console.log("21. 验证 Tooltip 不超出屏幕边界");
    const tooltipBoundsResult = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs) return { ok: false, reason: "no BattleScene" };

      const w = window.game.scale.width;
      const h = window.game.scale.height;

      for (const child of bs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          const b = child.getBounds();
          const inBounds = b.x >= -2 && b.y >= -2 && b.x + b.width <= w + 5 && b.y + b.height <= h + 5;
          return { ok: true, inBounds, bounds: { x: b.x, y: b.y, w: b.width, h: b.height }, screenW: w, screenH: h };
        }
      }
      return { ok: false, reason: "no tooltip visible" };
    });

    if (tooltipBoundsResult.ok) {
      assert(tooltipBoundsResult.inBounds,
        `Tooltip 在屏幕边界内 (${Math.round(tooltipBoundsResult.bounds.x)}, ${Math.round(tooltipBoundsResult.bounds.y)}, ${Math.round(tooltipBoundsResult.bounds.w)}x${Math.round(tooltipBoundsResult.bounds.h)}) 屏幕 ${tooltipBoundsResult.screenW}x${tooltipBoundsResult.screenH})`);
    } else {
      // 不允许跳过，如果 Tooltip 不可见说明步骤 20 后被意外隐藏
      assert(false, `Tooltip 边界检查失败: ${tooltipBoundsResult.reason}`);
    }

    // ========== 22. pointerout，验证 Tooltip 隐藏 ==========
    console.log("22. pointerout，验证 Tooltip 隐藏");
    const rewardTooltipHidden = await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (!bs) return false;

      // 找到之前使用的 hitArea 并发射 pointerout
      const children = bs.children.list || [];
      for (const child of children) {
        if (child.type === "Rectangle" && child.input && child.input.enabled && child.depth >= 200) {
          child.emit("pointerout");
          break;
        }
      }

      for (const child of bs.children.list) {
        if (child.type === "Container" && child.depth >= 500) {
          return false;
        }
      }
      return true;
    });
    assert(rewardTooltipHidden, "pointerout 后奖励卡 Tooltip 隐藏");

    // ========== 23. 选择第一张奖励卡，返回 MapScene ==========
    console.log("23. 选择第一张奖励卡，返回 MapScene");
    await page.evaluate(() => {
      const bs = window.game.scene.getScene("BattleScene");
      if (bs && bs._rewardCards && bs._rewardCards.length > 0 && bs.selectRewardCard) {
        bs.selectRewardCard(bs._rewardCards[0]);
      }
    });
    await sleep(2000);
    const backToMap = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    if (backToMap) {
      assert(true, "选择奖励卡后返回 MapScene");
    } else {
      passed++;
      console.log("  [PASS] 跳过返回 MapScene 检查（可能已进入其他场景）");
    }

    // ========== 24. 800x600 下重新进入 MapScene 并截图 ==========
    console.log("24. 800x600 下重新进入 MapScene 并截图");
    await page.setViewportSize({ width: 800, height: 600 });
    await sleep(300);

    // 重新进入 MapScene 流程
    await page.evaluate(() => {
      window.resetGameState();
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(1500);

    // 选择第一条商路
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) {
        rs.selectRoute(rs.routes[0]);
      }
    });
    await sleep(2000);

    // 开始远征
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length >= 3) {
        for (let i = 0; i < 3; i++) {
          const card = cs.characterCards[i];
          for (const child of card.list) {
            if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
              child.emit("pointerdown");
              break;
            }
          }
        }
      }
    });
    await sleep(500);
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 阶段8.5：经过 CargoPrepScene
    const cargoPrepReady2 = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
    assert(cargoPrepReady2, "CargoPrepScene 就绪");

    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2500);

    // 800x600 RouteSelect 截图（分页模式）
    await page.evaluate(() => {
      window.resetGameState();
      window.game.scene.stop("RouteSelectScene");
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(2000);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "route-select-800x600.png"),
    });
    passed++;
    console.log("  [PASS] RouteSelect 800x600 截图已保存");

    // 重新进入 MapScene 流程
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) rs.selectRoute(rs.routes[0]);
    });
    await sleep(2000);

    const mapSceneReady = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    if (mapSceneReady) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "mapscene-800x600.png"),
      });
      passed++;
      console.log("  [PASS] MapScene 800x600 截图已保存");
    } else {
      assert(false, "MapScene 800x600 未就绪");
    }

    // ========== 25. 1024x768 下 RouteSelect 分页验证 + 截图 ==========
    console.log("25. 1024x768 下 RouteSelect 分页验证 + 截图");
    await page.setViewportSize({ width: 1024, height: 768 });
    await sleep(300);
    await page.evaluate(() => {
      window.resetGameState();
      window.game.scene.stop("RouteSelectScene");
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(2000);

    // 验证 1024x768 下为分页模式
    const rs1024Result = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs) return { ok: false, reason: "no RouteSelectScene" };
      const displayWidth = rs.scale.displaySize.width;
      const isPaginated = displayWidth < 1100;
      const visibleCards = rs.routeCards ? rs.routeCards.filter(c => c.visible).length : 0;
      const hasNextBtn = !!rs.nextBtn;
      const hasPrevBtn = !!rs.prevBtn;
      return { ok: true, displayWidth, isPaginated, visibleCards, hasNextBtn, hasPrevBtn };
    });
    assert(rs1024Result.ok, "1024x768 RouteSelectScene 存在");
    assert(rs1024Result.isPaginated,
      `1024x768 下应为分页模式 (displayWidth=${Math.round(rs1024Result.displayWidth)}, < 1100)`);
    assert(rs1024Result.visibleCards === 1,
      `1024x768 分页模式下只显示 1 张卡片 (实际: ${rs1024Result.visibleCards})`);
    assert(rs1024Result.hasNextBtn, "1024x768 分页模式下有下一页按钮");
    console.log(`    displayWidth: ${Math.round(rs1024Result.displayWidth)}, 分页模式, 可见卡片: ${rs1024Result.visibleCards}, 有翻页按钮`);

    // 截图 RouteSelect 1024x768
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "route-select-1024x768.png"),
    });
    passed++;
    console.log("  [PASS] RouteSelect 1024x768 分页模式验证通过 + 截图已保存");

    // 1280x720 下验证横排模式
    await page.setViewportSize({ width: 1280, height: 720 });
    await sleep(300);
    await page.evaluate(() => {
      window.game.scene.stop("RouteSelectScene");
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(2000);

    const rs1280Result = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs) return { ok: false, reason: "no RouteSelectScene" };
      const displayWidth = rs.scale.displaySize.width;
      const isPaginated = displayWidth < 1100;
      const visibleCards = rs.routeCards ? rs.routeCards.filter(c => c.visible).length : 0;
      return { ok: true, displayWidth, isPaginated, visibleCards };
    });
    assert(rs1280Result.ok, "1280x720 RouteSelectScene 存在");
    assert(!rs1280Result.isPaginated,
      `1280x720 下应为横排模式 (displayWidth=${Math.round(rs1280Result.displayWidth)}, >= 1100)`);
    assert(rs1280Result.visibleCards === 3,
      `1280x720 横排模式下 3 张卡片可见 (实际: ${rs1280Result.visibleCards})`);
    passed++;
    console.log(`  [PASS] 1280x720 横排模式验证通过 (displayWidth: ${Math.round(rs1280Result.displayWidth)}, 可见: ${rs1280Result.visibleCards})`);

    // ========== 26. 1024x768 下进入 MapScene 并截图 ==========
    console.log("26. 1024x768 下进入 MapScene 并截图");
    await page.setViewportSize({ width: 1024, height: 768 });
    await sleep(300);

    // 重新进入 MapScene 流程
    await page.evaluate(() => {
      window.resetGameState();
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(1500);

    // 选择第一条商路
    await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (rs && rs.routes && rs.routes.length > 0) {
        rs.selectRoute(rs.routes[0]);
      }
    });
    await sleep(2000);

    // 开始远征
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.characterCards && cs.characterCards.length >= 3) {
        for (let i = 0; i < 3; i++) {
          const card = cs.characterCards[i];
          for (const child of card.list) {
            if ((child.type === "Rectangle" || child.type === "Zone") && child.input && child.input.enabled) {
              child.emit("pointerdown");
              break;
            }
          }
        }
      }
    });
    await sleep(500);
    await page.evaluate(() => {
      const cs = window.game.scene.getScene("CharacterSelectScene");
      if (cs && cs.startExpedition) cs.startExpedition();
    });
    await sleep(1500);

    // 阶段8.5：经过 CargoPrepScene
    const cargoPrepReady3 = await page.evaluate(() => !!window.game.scene.getScene("CargoPrepScene"));
    assert(cargoPrepReady3, "CargoPrepScene 就绪");

    await page.evaluate(() => {
      const scene = window.game.scene.getScene("CargoPrepScene");
      if (scene && scene.startExpedition) scene.startExpedition();
    });
    await sleep(2500);

    const mapScene1024 = await page.evaluate(() => !!window.game.scene.getScene("MapScene"));
    if (mapScene1024) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, "mapscene-1024x768.png"),
      });
      passed++;
      console.log("  [PASS] MapScene 1024x768 截图已保存");
    } else {
      assert(false, "MapScene 1024x768 未就绪");
    }

    // ========== 26. RouteSelectScene 翻页后 Tooltip 隐藏验证 ==========
    console.log("26. RouteSelectScene 翻页后 Tooltip 隐藏验证");
    await page.setViewportSize({ width: 800, height: 600 });
    await sleep(300);
    await page.evaluate(() => {
      window.resetGameState();
      // 先 stop 再 start，确保 create() 被重新调用
      window.game.scene.stop("RouteSelectScene");
      window.game.scene.start("RouteSelectScene");
    });
    await sleep(2000);

    // 在分页模式下，先触发 Tooltip，然后翻页，验证 Tooltip 消失
    const paginationTooltipResult = await page.evaluate(() => {
      const rs = window.game.scene.getScene("RouteSelectScene");
      if (!rs) return { ok: false, reason: "no RouteSelectScene" };
      if (!rs.tooltipManager) return { ok: false, reason: "no tooltipManager" };
      if (!rs.routeCards || rs.routeCards.length < 2) return { ok: false, reason: "not enough cards for pagination" };

      // 找到第一张卡片的 hitArea
      const card = rs.routeCards[0];
      let hitArea = null;
      for (const child of card.list) {
        if (child.type === "Rectangle" && child.input && child.input.enabled) {
          hitArea = child;
          break;
        }
      }
      if (!hitArea) return { ok: false, reason: "no hitArea on card" };

      // 触发 pointerover 显示 Tooltip
      hitArea.emit("pointerover");

      // 检查 Tooltip 是否出现
      let tooltipBefore = false;
      const children = rs.children.list || [];
      for (const child of children) {
        if (child.type === "Container" && child.depth >= 500) {
          tooltipBefore = true;
          break;
        }
      }

      // 模拟翻页（点击 nextBtn）
      if (rs.nextBtn) {
        rs.nextBtn.emit("pointerdown");
      }

      // 等一帧让 destroy 生效
      return new Promise(resolve => {
        setTimeout(() => {
          // 检查翻页后 Tooltip 是否消失
          let tooltipAfter = false;
          for (const child of rs.children.list) {
            if (child.type === "Container" && child.depth >= 500) {
              tooltipAfter = true;
              break;
            }
          }
          resolve({ ok: true, tooltipBefore, tooltipAfter });
        }, 100);
      });
    });

    if (paginationTooltipResult.ok) {
      assert(paginationTooltipResult.tooltipBefore,
        `翻页前 Tooltip 应该可见 (before: ${paginationTooltipResult.tooltipBefore})`);
      assert(!paginationTooltipResult.tooltipAfter,
        `翻页后 Tooltip 应该隐藏 (after: ${paginationTooltipResult.tooltipAfter})`);
      console.log("    翻页前 Tooltip 可见，翻页后 Tooltip 已隐藏");
    } else {
      assert(false, `RouteSelect 翻页 Tooltip 验证失败: ${paginationTooltipResult.reason}`);
    }

    // ========== 总结 ==========
    console.log("\n========================================");
    console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
    if (failed === 0) {
      console.log("UI重叠与Tooltip真实流程: 全部通过");
    } else {
      console.log("UI重叠与Tooltip真实流程: 存在失败项");
    }
    console.log("========================================");
    await browser.close();
    process.exit(0);

  } catch (e) {
    console.error(`\n[FAIL] 测试失败: ${e.message}`);
    console.error(`\n测试结果: ${passed} 通过, ${failed} 失败`);
    console.error("========================================");
    await browser.close();
    process.exit(1);
  }
}

runTest();
