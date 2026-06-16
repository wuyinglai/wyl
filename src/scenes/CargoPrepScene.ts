/**
 * CargoPrepScene.ts
 * 阶段8.5：出发前货物准备系统 v1
 *
 * 在 CharacterSelectScene 之后、MapScene 之前插入。
 * 允许玩家调整 cargo（买卖货物），然后点击"开始远征"进入地图。
 */

import Phaser, { Scene } from "phaser";
import {
  getGameState,
  setGameState,
  createExpeditionMap,
  updateReachableCells,
  initializeCharacterStates,
} from "../systems/GameState";

// 阶段10.3：未完成订单显示
function getUnfinishedOrderInfo(): string | null {
  const gs = getGameState();
  if (!gs.selectedOrderId) return null;
  if (!gs.unfinishedOrderIds || !gs.unfinishedOrderIds.includes(gs.selectedOrderId)) return null;
  
  const timeState = gs.orderTimeStates[gs.selectedOrderId];
  if (!timeState) return null;
  
  return `【继续未完成订单】剩余步数：${timeState.remainingSteps}/${timeState.limitSteps}`;
}
import { getOrderById } from "../data/cityOrders";
import { GOODS, getGoodById, formatGoodsRequirement } from "../data/goods";
import { calculateCargoWeight } from "../systems/cargoSystem";
import { getOrderCargoStatusText } from "../systems/orderCargoSystem";
import { TooltipManager } from "../systems/tooltipSystem";
import { getAllTools, formatToolSummary, getToolById, isToolOwned } from "../systems/toolSystem";

export class CargoPrepScene extends Scene {
  private tooltipManager: TooltipManager | null = null;
  private cargoText: Phaser.GameObjects.Text | null = null;
  private silverText: Phaser.GameObjects.Text | null = null;
  private weightText: Phaser.GameObjects.Text | null = null;
  private orderStatusText: Phaser.GameObjects.Text | null = null;
  private carriedToolText: Phaser.GameObjects.Text | null = null;
  private goodCards: Phaser.GameObjects.Container[] = [];
  private toolButtons: { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; toolId: string }[] = [];
  // 9.1.7 调试层
  private debugText: Phaser.GameObjects.Text | null = null;
  private debugHitBorders: Phaser.GameObjects.Rectangle[] = [];
  private lastHitTarget: string = "none";
  private debugClickLog: string[] = []; // 记录点击日志，供测试读取

  constructor() {
    super({ key: "CargoPrepScene" });
  }

  create(): void {
    console.log("[CargoPrepScene] 场景初始化");
    const gameState = getGameState();

    // 初始化 Tooltip
    this.tooltipManager = new TooltipManager(this);

    // 初始化 cargo（如果为空且有订单，默认装载订单需求）
    if (!gameState.cargo || Object.keys(gameState.cargo).length === 0) {
      if (gameState.selectedOrderId) {
        const order = getOrderById(gameState.selectedOrderId);
        if (order && order.requiredGoods) {
          gameState.cargo = { ...order.requiredGoods };
          console.log(`[CargoPrepScene] 默认装载订单货物: ${JSON.stringify(gameState.cargo)}`);
        } else {
          gameState.cargo = {};
        }
      } else {
        gameState.cargo = {};
      }
      setGameState(gameState);
    }

    this.createUI();
    this.updateDisplay();
    this.initDebugOverlay();
  }

  /** 9.1.7: 初始化调试覆盖层（depth=10，不遮挡按钮） */
  private initDebugOverlay(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // 调试文本（右下角，depth=10 不遮挡按钮）
    this.debugText = this.add
      .text(w - 10, h - 10, "", {
        fontSize: "12px",
        color: "#00ff88",
        fontFamily: "monospace",
        backgroundColor: "#000000cc",
        padding: { x: 6, y: 4 },
        wordWrap: { width: 300 },
      })
      .setOrigin(1, 1) // 右下角对齐
      .setDepth(10)
      .setScrollFactor(0);

    // 场景级 pointerdown 监听：检测点击位置和命中情况
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const canvas = this.game.canvas as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const scaleInfo = this.scale;

      console.log(`[CargoPrepDebug] pointerdown at pointer=(${pointer.x}, ${pointer.y}) world=(${pointer.worldX}, ${pointer.worldY})`);
      console.log(`[CargoPrepDebug] canvas rect: left=${rect.left} top=${rect.top} w=${rect.width} h=${rect.height}`);
      console.log(`[CargoPrepDebug] game.scale: ${scaleInfo.width}x${scaleInfo.height} display=${scaleInfo.displaySize.width}x${scaleInfo.displaySize.height} zoom=${scaleInfo.zoom}`);

      if (this.lastHitTarget === "none") {
        console.log(`[CargoPrepDebug] scene pointerdown no button hit`);
      }

      this.updateDebugText(pointer);
    });

    // 排查 overlay 遮挡：列出高 depth 对象
    this.listHighDepthObjects();
  }

  /** 更新调试文本内容 */
  private updateDebugText(pointer?: Phaser.Input.Pointer): void {
    if (!this.debugText) return;
    const gs = getGameState();
    const weight = calculateCargoWeight(gs.cargo);
    const cargoStr = Object.entries(gs.cargo)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}:${v}`)
      .join(" ");

    let lines = [
      `[CargoPrep Debug]`,
      `hit: ${this.lastHitTarget}`,
    ];
    if (pointer) {
      lines.push(`pointer: (${pointer.x}, ${pointer.y})`);
      lines.push(`world: (${pointer.worldX}, ${pointer.worldY})`);
    }
    lines.push(`cargo: ${cargoStr || "empty"}`);
    lines.push(`silver: ${gs.silver}`);
    lines.push(`weight: ${weight}/${gs.maxCargoWeight}`);

    this.debugText.setText(lines.join("\n"));
  }

  /** 排查高 depth 对象，确认无遮挡 */
  private listHighDepthObjects(): void {
    const highDepthObjects: { type: string; depth: number; visible: boolean; active: boolean; x: number; y: number }[] = [];
    this.children.each((child: any) => {
      if (child.depth >= 200) {
        highDepthObjects.push({
          type: child.type || "unknown",
          depth: child.depth,
          visible: child.visible,
          active: child.active,
          x: child.x,
          y: child.y,
        });
      }
    });
    if (highDepthObjects.length > 0) {
      console.log(`[CargoPrepDebug] 高 depth 对象 (${highDepthObjects.length}):`);
      highDepthObjects.forEach((obj) => {
        console.log(`  depth=${obj.depth} type=${obj.type} visible=${obj.visible} active=${obj.active} pos=(${obj.x}, ${obj.y})`);
      });
    }
  }

  private createUI(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gameState = getGameState();

    // 背景
    this.add.rectangle(w / 2, h / 2, w, h, 0x1a0f0a);

    // 标题
    this.add
      .text(w / 2, 40, "出发前准备", {
        fontSize: "28px",
        color: "#d4a574",
        fontFamily: "sans-serif",
      })
      .setOrigin(0.5);

    // 订单信息
    const order = gameState.selectedOrderId
      ? getOrderById(gameState.selectedOrderId)
      : null;
    const orderTitle = order ? order.title : "无订单";
    const orderReq = order && order.requiredGoods
      ? formatGoodsRequirement(order.requiredGoods)
      : "无";

    this.add
      .text(30, 80, `当前订单：${orderTitle}`, {
        fontSize: "16px",
        color: "#ffcc44",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    this.add
      .text(30, 105, `需求：${orderReq}`, {
        fontSize: "14px",
        color: "#aaaaaa",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    // 阶段10.3：未完成订单提示
    const unfinishedInfo = getUnfinishedOrderInfo();
    if (unfinishedInfo) {
      this.add
        .text(30, 130, unfinishedInfo, {
          fontSize: "14px",
          color: "#ff8844",
          fontFamily: "sans-serif",
        })
        .setOrigin(0, 0);
    }

    // 阶段10.5：订单附加条款显示
    if (order && order.specialTerms && order.specialTerms.length > 0) {
      let termY = 155;
      for (const term of order.specialTerms) {
        const termText = term.type === "confidential" ? "【保密】" : "【易损】";
        const termColor = term.type === "confidential" ? "#aa88ff" : "#ffaa88";
        this.add
          .text(30, termY, `${termText} ${term.description}`, {
            fontSize: "13px",
            color: termColor,
            fontFamily: "sans-serif",
            wordWrap: { width: 350 },
          })
          .setOrigin(0, 0);
        termY += 20;
      }
    }

    // 状态显示区域
    this.cargoText = this.add
      .text(30, 135 + (order?.specialTerms?.length || 0) * 20, "当前货物：", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    this.weightText = this.add
      .text(30, 160, "载重：", {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    this.silverText = this.add
      .text(30, 185, `银币：${gameState.silver}`, {
        fontSize: "14px",
        color: "#ffcc44",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    this.orderStatusText = this.add
      .text(30, 210, "订单状态：", {
        fontSize: "14px",
        color: "#a8d8a8",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    // 阶段12.3：远征工具选择区域
    this.createToolSelectionUI();

    // 商品列表
    this.createGoodsList();

    // 底部按钮
    this.createBottomButtons();
  }

  /**
   * 阶段12：创建远征工具选择区域（使用 Container 模式确保真实点击有效
   * 在 CargoPrepScene 中显示已拥有的工具列表，允许玩家选择 1 个工具携带
   */
  private createToolSelectionUI(): void {
    const gameState = getGameState();
    const selectedToolId = gameState.selectedToolId || null;

    // 工具选择区域标题
    const toolAreaX = 30;
    const toolAreaY = 235;

    this.add
      .text(toolAreaX, toolAreaY, "【远征工具】点击选择携带", {
        fontSize: "14px",
        color: "#88ccff",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    // 当前携带状态行
    const carriedText = selectedToolId
      ? `当前携带：${getToolById(selectedToolId)?.name || "未知工具"}`
      : "当前携带：未选择";
    this.carriedToolText = this.add
      .text(toolAreaX, toolAreaY + 20, carriedText, {
        fontSize: "13px",
        color: selectedToolId ? "#88ff88" : "#888888",
        fontFamily: "sans-serif",
      })
      .setOrigin(0, 0);

    // 筛选已拥有且已实装的工具
    const ownedTools = getAllTools().filter(t => isToolOwned(gameState.ownedTools, t.id) && t.isImplemented);

    if (ownedTools.length === 0) {
      // 没有可携带的工具
      this.add
        .text(toolAreaX, toolAreaY + 45, "当前没有可携带工具", {
          fontSize: "13px",
          color: "#ff8888",
          fontFamily: "sans-serif",
        })
        .setOrigin(0, 0);
      this.add
        .text(toolAreaX, toolAreaY + 65, "请先在城镇仓库/工具商店购买", {
          fontSize: "12px",
          color: "#888888",
          fontFamily: "sans-serif",
        })
        .setOrigin(0, 0);
      return;
    }

    // 工具列表（横向排列，最多显示 4 个）
    const toolBtnW = 150;
    const toolBtnH = 30;
    const toolBtnGap = 10;
    const toolListY = toolAreaY + 45;

    this.toolButtons = [];

    ownedTools.forEach((tool, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = toolAreaX + col * (toolBtnW + toolBtnGap) + toolBtnW / 2;
      const y = toolListY + row * (toolBtnH + toolBtnGap) + toolBtnH / 2;

      // 使用 Container 模式创建工具按钮（与底部按钮一致）
      const btnContainer = this.add.container(x, y);
      const isSelected = tool.id === selectedToolId;

      const bg = this.add.rectangle(0, 0, toolBtnW, toolBtnH, isSelected ? 0x335533 : 0x2a2a3e);
      bg.setStrokeStyle(1, isSelected ? 0x88ff88 : 0x444466);

      const toolName = tool.name.length > 8 ? tool.name.substring(0, 8) : tool.name;
      const label = this.add.text(0, 0, toolName, {
        fontSize: "12px",
        color: isSelected ? "#ffffff" : "#cccccc",
        fontFamily: "sans-serif",
      }).setOrigin(0.5);

      btnContainer.add([bg, label]);
      btnContainer.setSize(toolBtnW, toolBtnH);
      btnContainer.setInteractive(new Phaser.Geom.Rectangle(-toolBtnW / 2, -toolBtnH / 2, toolBtnW, toolBtnH), Phaser.Geom.Rectangle.Contains);
      btnContainer.setDepth(300);

      btnContainer.on("pointerover", () => {
        const gs = getGameState();
        if (gs.selectedToolId !== tool.id) {
          bg.setFillStyle(0x3a3a5e);
          label.setColor("#ffffff");
        }
      });

      btnContainer.on("pointerout", () => {
        const gs = getGameState();
        if (gs.selectedToolId !== tool.id) {
          bg.setFillStyle(0x2a2a3e);
          label.setColor("#cccccc");
        }
      });

      btnContainer.on("pointerdown", () => {
        const currentGs = getGameState();
        const wasSelected = currentGs.selectedToolId === tool.id;

        if (wasSelected) {
          // 再次点击同一工具则取消选择
          currentGs.selectedToolId = null;
          console.log(`[CargoPrepScene] 取消选择工具: ${tool.name}`);
        } else {
          // 切换工具时，旧工具自动取消
          currentGs.selectedToolId = tool.id;
          console.log(`[CargoPrepScene] 选择工具: ${tool.name} (${tool.id})`);
        }

        setGameState(currentGs);

        // 更新当前携带状态文本
        if (this.carriedToolText) {
          const carriedText = currentGs.selectedToolId
            ? `当前携带：${getToolById(currentGs.selectedToolId)?.name || "未知工具"}`
            : "当前携带：未选择";
          this.carriedToolText.setText(carriedText);
          this.carriedToolText.setColor(currentGs.selectedToolId ? "#88ff88" : "#888888");
        }

        // 更新所有工具按钮的选中状态
        this.updateToolButtonStyles();
      });

      // 保存引用以支持更新
      this.toolButtons.push({ container: btnContainer, bg, label, toolId: tool.id });
    });
  }

  /**
   * 更新所有工具按钮的选中/未选中样式
   * 根据当前 selectedToolId 更新每个按钮的视觉状态
   */
  private updateToolButtonStyles(): void {
    const gs = getGameState();
    for (const btn of this.toolButtons) {
      const isSelected = gs.selectedToolId === btn.toolId;
      btn.bg.setFillStyle(isSelected ? 0x335533 : 0x2a2a3e);
      btn.bg.setStrokeStyle(1, isSelected ? 0x88ff88 : 0x444466);
      btn.label.setColor(isSelected ? "#ffffff" : "#cccccc");
    }
  }

  private createGoodsList(): void {
    const w = this.scale.width;
    // 阶段12.3：商品列表起始位置下移，为工具选择区域留出空间
    const startY = 400;  // 原值 250，工具区域占用约 150px
    const cardHeight = 70;
    const gap = 10;
    const padding = 20;

    // 商品 ID 列表
    const goodIds = ["grain", "medicine", "iron", "parts"];

    goodIds.forEach((goodId, index) => {
      const good = getGoodById(goodId);
      if (!good) return;

      const y = startY + index * (cardHeight + gap);

      // 卡片背景（仅视觉，不设 interactive）
      const bg = this.add
        .rectangle(w / 2, y + cardHeight / 2, w - 40, cardHeight, 0x2a1a0e)
        .setStrokeStyle(1, 0x554433);

      // 商品名称
      const nameText = this.add
        .text(padding, y + 10, good.name, {
          fontSize: "16px",
          color: "#d4a574",
          fontFamily: "sans-serif",
        })
        .setOrigin(0, 0);

      // 单价和重量
      const infoText = this.add
        .text(padding, y + 35, `单价：${good.basePrice}银币  重量：${good.weight}`, {
          fontSize: "12px",
          color: "#888888",
          fontFamily: "sans-serif",
        })
        .setOrigin(0, 0);

      // 数量显示
      const countText = this.add
        .text(w / 2, y + cardHeight / 2, "0", {
          fontSize: "20px",
          color: "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);

      // [-] 按钮：独立 Container，直接添加到 Scene（不在 cardContainer 内）
      // 这样按钮不受 cardContainer 内部 list 顺序和 depth 限制影响
      // 点击区域 56x56（大于视觉 44x44），确保容易点击
      const minusButton = this.add.container(w - 120, y + cardHeight / 2);
      const minusBg = this.add.rectangle(0, 0, 44, 44, 0x554433);
      const minusLabel = this.add.text(0, 0, "-", {
        fontSize: "20px",
        color: "#ffffff",
      }).setOrigin(0.5);
      minusButton.add([minusBg, minusLabel]);
      minusButton.setSize(56, 56);
      minusButton.setInteractive({ useHandCursor: true });
      minusButton.setDepth(300);
      minusButton.setData("goodId", goodId);
      minusButton.setData("action", "minus");

      // 9.1.7: 命中区域边框（红色 = minus，depth=10 不遮挡按钮）
      const minusHitBorder = this.add.rectangle(w - 120, y + cardHeight / 2, 56, 56, 0x000000, 0)
        .setStrokeStyle(2, 0xff4444)
        .setDepth(10);
      this.debugHitBorders.push(minusHitBorder);

      // hover 反馈：变亮
      minusButton.on("pointerover", () => {
        minusBg.setFillStyle(0x776655);
        this.lastHitTarget = `minus ${goodId}`;
        console.log(`[CargoPrepDebug] hover minus ${goodId}`);
        this.updateDebugText();
      });
      minusButton.on("pointerout", () => {
        minusBg.setFillStyle(0x554433);
        this.lastHitTarget = "none";
        this.updateDebugText();
      });
      minusButton.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const logMsg = `[CargoPrepDebug] click minus ${goodId} at pointer=(${pointer.x}, ${pointer.y})`;
        console.log(logMsg);
        this.debugClickLog.push(logMsg);
        this.lastHitTarget = `minus ${goodId}`;
        this.changeCargo(goodId, -1);
        this.updateDebugText(pointer);
      });

      // [+] 按钮：独立 Container，直接添加到 Scene
      const plusButton = this.add.container(w - 60, y + cardHeight / 2);
      const plusBg = this.add.rectangle(0, 0, 44, 44, 0x885533);
      const plusLabel = this.add.text(0, 0, "+", {
        fontSize: "20px",
        color: "#ffffff",
      }).setOrigin(0.5);
      plusButton.add([plusBg, plusLabel]);
      plusButton.setSize(56, 56);
      plusButton.setInteractive({ useHandCursor: true });
      plusButton.setDepth(300);
      plusButton.setData("goodId", goodId);
      plusButton.setData("action", "plus");

      // 9.1.7: 命中区域边框（绿色 = plus，depth=10 不遮挡按钮）
      const plusHitBorder = this.add.rectangle(w - 60, y + cardHeight / 2, 56, 56, 0x000000, 0)
        .setStrokeStyle(2, 0x44ff44)
        .setDepth(10);
      this.debugHitBorders.push(plusHitBorder);

      // hover 反馈：变亮
      plusButton.on("pointerover", () => {
        plusBg.setFillStyle(0xaa7744);
        this.lastHitTarget = `plus ${goodId}`;
        console.log(`[CargoPrepDebug] hover plus ${goodId}`);
        this.updateDebugText();
      });
      plusButton.on("pointerout", () => {
        plusBg.setFillStyle(0x885533);
        this.lastHitTarget = "none";
        this.updateDebugText();
      });
      plusButton.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const logMsg = `[CargoPrepDebug] click plus ${goodId} at pointer=(${pointer.x}, ${pointer.y})`;
        console.log(logMsg);
        this.debugClickLog.push(logMsg);
        this.lastHitTarget = `plus ${goodId}`;
        this.changeCargo(goodId, 1);
        this.updateDebugText(pointer);
      });

      // Tooltip：绑定到卡片背景上（仅非按钮区域）
      // 使用 nameText 作为 tooltip 触发区域，避免遮挡按钮
      nameText.setInteractive();
      nameText.on("pointerover", () => {
        if (this.tooltipManager) {
          this.tooltipManager.show(
            {
              title: good.name,
              lines: [
                good.description,
                `单价：${good.basePrice}银币`,
                `重量：${good.weight}`,
                `标签：${good.tags.join(", ")}`,
              ],
            },
            w / 2,
            y
          );
        }
      });

      nameText.on("pointerout", () => {
        if (this.tooltipManager) {
          this.tooltipManager.hide();
        }
      });

      // 保存引用以便更新（只保存视觉元素到 cardContainer）
      const cardContainer = this.add.container(0, 0);
      cardContainer.add([bg, nameText, infoText, countText]);
      this.goodCards.push(cardContainer);

      // 保存 countText 引用
      (this.goodCards[index] as any).countText = countText;
      (this.goodCards[index] as any).goodId = goodId;
    });
  }

  private createBottomButtons(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const btnY = h - 50;

    // 辅助函数：创建按钮 Container（bg + label 合为一体，避免 Text 拦截点击）
    const makeButton = (
      x: number, y: number, bw: number, bh: number, color: number,
      label: string, fontSize: string, fontColor: string, handler: () => void,
    ): Phaser.GameObjects.Container => {
      const btn = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, bw, bh, color);
      const txt = this.add.text(0, 0, label, {
        fontSize,
        color: fontColor,
        fontStyle: label === "开始远征" ? "bold" : undefined,
      }).setOrigin(0.5);
      btn.add([bg, txt]);
      btn.setSize(bw, bh);
      btn.setInteractive(new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh), Phaser.Geom.Rectangle.Contains);
      btn.setDepth(500);
      btn.on("pointerdown", handler);
      return btn;
    };

    // 一键装载
    makeButton(80, btnY, 140, 40, 0x4a7c59, "一键装载订单", "14px", "#ffffff", () => {
      this.loadOrderRequirements();
    });

    // 清空
    makeButton(230, btnY, 80, 40, 0x7c4a4a, "清空", "14px", "#ffffff", () => {
      this.clearCargo();
    });

    // 开始远征
    makeButton(w - 100, btnY, 140, 40, 0x885533, "开始远征", "16px", "#ffffff", () => {
      this.startExpedition();
    });

    // 返回角色选择
    makeButton(w - 260, btnY, 120, 40, 0x555555, "返回角色选择", "14px", "#aaaaaa", () => {
      this.scene.start("CharacterSelectScene");
    });

    // ESC 返回角色选择
    this.input.keyboard?.on("keydown-ESC", () => {
      console.log("[货物整备] ESC 返回角色选择");
      this.scene.start("CharacterSelectScene");
    });
  }

  private changeCargo(goodId: string, delta: number): void {
    const gameState = getGameState();
    const good = getGoodById(goodId);
    if (!good) return;

    const currentCount = gameState.cargo[goodId] || 0;
    const newCount = currentCount + delta;

    if (delta > 0) {
      // 增加：检查银币和载重
      if (gameState.silver < good.basePrice) {
        console.log(`[CargoPrepScene] 银币不足，无法购买 ${good.name}`);
        return;
      }
      const currentWeight = calculateCargoWeight(gameState.cargo);
      if (currentWeight + good.weight > gameState.maxCargoWeight) {
        console.log(`[CargoPrepScene] 载重不足，无法装载 ${good.name}`);
        return;
      }
      gameState.silver -= good.basePrice;
    } else if (delta < 0) {
      // 减少：检查数量
      if (currentCount <= 0) {
        console.log(`[CargoPrepScene] ${good.name} 数量为 0，无法减少`);
        return;
      }
      gameState.silver += good.basePrice;
    }

    // 更新 cargo
    if (newCount <= 0) {
      delete gameState.cargo[goodId];
    } else {
      gameState.cargo[goodId] = newCount;
    }

    setGameState(gameState);
    this.updateDisplay();
    console.log(`[CargoPrepScene] ${good.name} ${delta > 0 ? "+" : ""}${delta}，当前：${newCount}，银币：${gameState.silver}`);
  }

  private loadOrderRequirements(): void {
    const gameState = getGameState();
    if (!gameState.selectedOrderId) {
      console.log("[CargoPrepScene] 无订单，无法装载");
      return;
    }

    const order = getOrderById(gameState.selectedOrderId);
    if (!order || !order.requiredGoods) {
      console.log("[CargoPrepScene] 订单数据无效");
      return;
    }

    // 计算当前载重和所需银币
    let currentWeight = calculateCargoWeight(gameState.cargo);
    let neededSilver = 0;

    for (const [goodId, requiredCount] of Object.entries(order.requiredGoods)) {
      const good = getGoodById(goodId);
      if (!good) continue;
      const currentCount = gameState.cargo[goodId] || 0;
      const needCount = requiredCount - currentCount;
      if (needCount > 0) {
        neededSilver += needCount * good.basePrice;
        currentWeight += needCount * good.weight;
      }
    }

    if (gameState.silver < neededSilver) {
      console.log(`[CargoPrepScene] 银币不足，需要 ${neededSilver}，当前 ${gameState.silver}`);
      return;
    }

    if (currentWeight > gameState.maxCargoWeight) {
      console.log(`[CargoPrepScene] 载重超限，需要 ${currentWeight}，最大 ${gameState.maxCargoWeight}`);
      return;
    }

    // 装载货物
    for (const [goodId, requiredCount] of Object.entries(order.requiredGoods)) {
      const good = getGoodById(goodId);
      if (!good) continue;
      const currentCount = gameState.cargo[goodId] || 0;
      const needCount = requiredCount - currentCount;
      if (needCount > 0) {
        gameState.cargo[goodId] = requiredCount;
        gameState.silver -= needCount * good.basePrice;
      }
    }

    setGameState(gameState);
    this.updateDisplay();
    console.log(`[CargoPrepScene] 一键装载订单完成，银币：${gameState.silver}`);
  }

  private clearCargo(): void {
    const gameState = getGameState();

    // 返还银币
    for (const [goodId, count] of Object.entries(gameState.cargo)) {
      const good = getGoodById(goodId);
      if (good) {
        gameState.silver += count * good.basePrice;
      }
    }

    gameState.cargo = {};
    setGameState(gameState);
    this.updateDisplay();
    console.log(`[CargoPrepScene] 清空货物，银币：${gameState.silver}`);
  }

  private updateDisplay(): void {
    const gameState = getGameState();

    // 更新货物显示
    const cargoStr = formatGoodsRequirement(gameState.cargo);
    if (this.cargoText) {
      this.cargoText.setText(`当前货物：${cargoStr || "无"}`);
    }

    // 更新载重
    const weight = calculateCargoWeight(gameState.cargo);
    if (this.weightText) {
      this.weightText.setText(`载重：${weight}/${gameState.maxCargoWeight}`);
    }

    // 更新银币
    if (this.silverText) {
      this.silverText.setText(`银币：${gameState.silver}`);
    }

    // 更新订单状态
    const order = gameState.selectedOrderId
      ? getOrderById(gameState.selectedOrderId)
      : null;
    const statusText = getOrderCargoStatusText(order, gameState.cargo);
    if (this.orderStatusText) {
      this.orderStatusText.setText(statusText);
    }

    // 阶段12.3：更新携带工具显示
    if (this.carriedToolText) {
      const carriedText = gameState.selectedToolId
        ? `当前携带：${getToolById(gameState.selectedToolId)?.name || "未知工具"}`
        : "当前携带：未选择";
      this.carriedToolText.setText(carriedText);
    }

    // 更新商品数量
    for (const card of this.goodCards) {
      const goodId = (card as any).goodId;
      const countText = (card as any).countText;
      if (goodId && countText) {
        const count = gameState.cargo[goodId] || 0;
        countText.setText(count.toString());
      }
    }
  }

  private startExpedition(): void {
    const gameState = getGameState();

    // 至少选择3个角色才能开始远征（角色不足时显示提示，不静默失败）
    if (!gameState.selectedCharacters || gameState.selectedCharacters.length < 3) {
      const w = this.scale.width;
      const warn = this.add.text(w / 2, 80, "请先选择至少3名角色", {
        fontSize: "18px",
        color: "#ff6666",
        fontFamily: "monospace",
      }).setOrigin(0.5);
      this.time.delayedCall(1500, () => { if (warn.active) warn.destroy(); });
      console.log("[CargoPrepScene] 角色不足，无法开始远征");
      return;
    }

    // 初始化地图（从 CharacterSelectScene 迁移过来的逻辑）
    const { cells, startPos, bossPos, expeditionGoal } = createExpeditionMap(
      gameState.mapWidth,
      gameState.mapHeight,
    );
    gameState.mapCells = cells;
    gameState.currentPosition = { ...startPos };
    gameState.startPosition = { ...startPos };
    gameState.bossPosition = { ...bossPos };
    gameState.expeditionGoal = expeditionGoal;

    // 阶段8.4.1：有订单时强制为 sanctuary 模式
    if (gameState.selectedOrderId && gameState.expeditionGoal === "boss") {
      gameState.expeditionGoal = "sanctuary";
      const bp = gameState.bossPosition;
      if (bp && gameState.mapCells[bp.y] && gameState.mapCells[bp.y][bp.x]) {
        const goalCell = gameState.mapCells[bp.y][bp.x];
        goalCell.type = "empty";
        goalCell.isGoal = true;
        goalCell.isRevealed = true;
        console.log(`[CargoPrepScene] 订单远征：强制目标节点 (${bp.x}, ${bp.y}) 为 sanctuary`);
      }
    }

    updateReachableCells(gameState);

    // 初始化角色运行时状态
    initializeCharacterStates(gameState.selectedCharacters);

    setGameState(gameState);
    console.log(`[CargoPrepScene] 开始远征，cargo: ${JSON.stringify(gameState.cargo)}, silver: ${gameState.silver}`);

    this.scene.start("MapScene");
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown-ESC");
    if (this.tooltipManager) {
      this.tooltipManager.hide();
    }
  }
}
