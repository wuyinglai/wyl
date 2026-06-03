/**
 * CargoPrepScene.ts
 * 阶段8.5：出发前货物准备系统 v1
 *
 * 在 CharacterSelectScene 之后、MapScene 之前插入。
 * 允许玩家调整 cargo（买卖货物），然后点击"开始远征"进入地图。
 */

import { Scene } from "phaser";
import {
  getGameState,
  setGameState,
  createExpeditionMap,
  updateReachableCells,
  initializeCharacterStates,
} from "../systems/GameState";
import { getOrderById } from "../data/cityOrders";
import { GOODS, getGoodById, formatGoodsRequirement } from "../data/goods";
import { calculateCargoWeight } from "../systems/cargoSystem";
import { getOrderCargoStatusText } from "../systems/orderCargoSystem";
import { TooltipManager } from "../systems/tooltipSystem";
import { applyLegacyRelicToGameState } from "../systems/legacySystem";
import { getLegacyRelicById } from "../data/legacyRelics";

export class CargoPrepScene extends Scene {
  private tooltipManager: TooltipManager | null = null;
  private cargoText: Phaser.GameObjects.Text | null = null;
  private silverText: Phaser.GameObjects.Text | null = null;
  private weightText: Phaser.GameObjects.Text | null = null;
  private orderStatusText: Phaser.GameObjects.Text | null = null;
  private goodCards: Phaser.GameObjects.Container[] = [];

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

    // 应用遗产效果（阶段8.8）
    const updatedState = applyLegacyRelicToGameState(gameState);
    if (updatedState !== gameState) {
      setGameState(updatedState);
      console.log(`[CargoPrepScene] 遗产效果已应用: ${updatedState.activeLegacyRelicId}`);
    }

    this.createUI();
    this.updateDisplay();
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

    // 状态显示区域
    this.cargoText = this.add
      .text(30, 135, "当前货物：", {
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

    // 遗产提示（阶段8.8）
    if (gameState.activeLegacyRelicId) {
      const relic = getLegacyRelicById(gameState.activeLegacyRelicId);
      if (relic) {
        this.add
          .text(30, 235, `遗产：${relic.name}（${relic.effectText}）`, {
            fontSize: "13px",
            color: "#d4a574",
            fontFamily: "sans-serif",
            wordWrap: { width: w - 60 },
          })
          .setOrigin(0, 0);
      }
    }

    // 商品列表
    this.createGoodsList();

    // 底部按钮
    this.createBottomButtons();
  }

  private createGoodsList(): void {
    const w = this.scale.width;
    const startY = 250;
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
      // hover 反馈：变亮
      minusButton.on("pointerover", () => {
        minusBg.setFillStyle(0x776655);
        console.log(`[CargoPrep] hover minus ${goodId}`);
      });
      minusButton.on("pointerout", () => {
        minusBg.setFillStyle(0x554433);
      });
      minusButton.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        console.log(`[CargoPrep] pointerdown minus ${goodId} at pointer=(${pointer.x}, ${pointer.y})`);
        this.changeCargo(goodId, -1);
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
      // hover 反馈：变亮
      plusButton.on("pointerover", () => {
        plusBg.setFillStyle(0xaa7744);
        console.log(`[CargoPrep] hover plus ${goodId}`);
      });
      plusButton.on("pointerout", () => {
        plusBg.setFillStyle(0x885533);
      });
      plusButton.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        console.log(`[CargoPrep] pointerdown plus ${goodId} at pointer=(${pointer.x}, ${pointer.y})`);
        this.changeCargo(goodId, 1);
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
      btn.setInteractive({ useHandCursor: true });
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

    // 返回
    makeButton(w - 260, btnY, 100, 40, 0x555555, "返回", "14px", "#aaaaaa", () => {
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
}
