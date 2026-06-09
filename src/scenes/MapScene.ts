import Phaser from "phaser";
import {
  getGameState,
  setGameState,
  moveToCell,
  checkGameOver,
  checkVictory,
  MapCell,
  resetGameState,
  resolveQuestionCell,
  updateReachableCells,
  canMoveTo,
  getMovableNeighbors,
  processInjuryRecovery,
  checkExpeditionFailed,
  initOrderTimeState,
  addUnfinishedOrder,
  markOrderCompleted,
  removeUnfinishedOrder,
} from "../systems/GameState";
import { CHARACTER_DEFS, createCharacterState } from "../data/characters";
import { CharacterState, CardDef } from "../data/types";
import { getRouteById } from "../data/cityRoutes";
import { getOrderById, formatRequiredGoods } from "../data/cityOrders";
import { formatCargo, calculateCargoWeight, hasCargo } from "../systems/cargoSystem";
import {
  checkOrderCargo,
  checkCargoWeight,
  getOrderCargoStatusText,
  getCargoWeightStatusText,
  getOrderCargoDetailLines,
} from "../systems/orderCargoSystem";
import { deliverOrder } from "../systems/orderDeliverySystem";
import { TooltipManager } from "../systems/tooltipSystem";
import { formatCityProgress } from "../systems/cityProgressSystem";
import { createSuccessExpeditionResult, createRetreatedExpeditionResult } from "../systems/expeditionResultSystem";
import { checkRetreatCost, getRetreatCostText, RetreatCostCheck } from "../systems/retreatSystem";
import { isDevCheatEnabled } from "../systems/devConfig";

/**
 * MapScene - 地图探索场景（V2 稳定重构版）
 *
 * 命名说明：
 * - 文件名: MapScene.ts（保持不变，避免 BattleScene 返回路径失效）
 * - 类名: MapScene（保持不变，同上）
 * - Scene key: 'MapScene'（BattleScene、CharacterSelectScene 均引用此 key）
 * - "V2" 仅表示这是经过稳定重构的版本，旧 MapScene 逻辑已完全替换
 *
 * 核心设计：
 * 1. 整个地图只监听一次 pointerdown，根据坐标换算格子
 * 2. 动态 canMoveTo() 判断移动，不依赖 isReachable 状态
 * 3. 统一 tryMoveTo() 入口，所有移动方式共用
 * 4. 单一 modalContainer 弹窗系统
 * 5. WASD/方向键移动商队（不是镜头）
 * 6. T/Y/G 自动测试键
 */
export class MapScene extends Phaser.Scene {
  // 地图格子图形和文字
  private cellGraphics: Phaser.GameObjects.Graphics[][] = [];
  private cellTexts: Phaser.GameObjects.Text[][] = [];

  // 资源显示
  private resourceTexts: { [key: string]: Phaser.GameObjects.Text } = {};
  private debugTexts: { [key: string]: Phaser.GameObjects.Text } = {};

  // 地图参数
  private cellSize = 42;
  private cellGap = 4;
  private mapContainer!: Phaser.GameObjects.Container;

  // 弹窗系统：单一容器
  private modalContainer?: Phaser.GameObjects.Container;
  private modalActions: (() => void)[] = [];

  private partyDisplayContainer!: Phaser.GameObjects.Container;

  // 自动测试状态
  private _autoTestTimer?: Phaser.Time.TimerEvent;

  // 牌组查看器状态
  private _deckViewerOpen = false;
  private _deckViewerClose?: () => void;

  // 终局界面状态（胜利/失败弹窗）
  private _victoryOverlayOpen = false;

  // Tooltip 系统
  private tooltipManager: TooltipManager | null = null;
  /** 信息面板文本对象引用（阶段8.4：交付后更新） */
  private _infoPanelTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super({ key: "MapScene" });
  }

  /**
   * 场景关闭时清理全局监听器。
   * Phaser 自动清理 scene-scoped 的 timer/tween/event，
   * 但 this.input.keyboard 和 this.input 是全局 InputManager，
   * 其 listener 不会随 scene 关闭而自动移除，必须手动清理。
   */
  shutdown() {
    // 清理牌组查看器（Bug 5: 场景切换时UI残留）
    if (this._deckViewerOpen && this._deckViewerClose) {
      this._deckViewerClose();
      this._deckViewerOpen = false;
    }
    this._victoryOverlayOpen = false;
    // 清理弹窗容器（防止场景切换后弹窗残留）
    if (this.modalContainer) {
      this.modalContainer.destroy(true);
      this.modalContainer = undefined;
    }
    this.input.keyboard?.off("keydown");
    this.input.off("pointerdown");
  }

  // ==================== 场景创建 ====================

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, w, h);

    // 获取游戏状态
    const gameState = getGameState();

    // 更新可达格显示
    updateReachableCells(gameState);
    setGameState(gameState);

    // 创建地图容器
    this.mapContainer = this.add.container(0, 30);

    // 创建资源显示（固定UI层）
    this.createResourceDisplay(w, h);

    // 创建地图格子（加到 mapContainer）
    this.createMapGrid(gameState);

    // 创建队伍显示（固定UI层）
    this.createPartyDisplay(gameState);

    // 整个地图只监听一次 pointerdown
    this.setupMapPointer();

    // 键盘事件
    this.setupKeyboard();

    // 初始化时居中到玩家
    this.centerCameraOnPlayer();

    // 检查游戏状态
    this.checkGameStatus(gameState);

    console.log("[地图V2] 地图场景已加载");

    // 显示当前商路/目标城市（阶段7.1）+ 订单摘要（阶段7.2）
    // 使用精简信息面板 + Tooltip 显示详情
    this.tooltipManager = new TooltipManager(this, 500);

    const routeInfo = this.getRouteInfoText();
    const orderSummary = this.getOrderSummaryText();
    
    // 初始化订单时间状态（阶段10.2）
    if (gameState.selectedOrderId) {
      const order = getOrderById(gameState.selectedOrderId);
      if (order && order.timeLimitSteps) {
        initOrderTimeState(gameState.selectedOrderId, order.timeLimitSteps);
      }
    }
    
    // 阶段8.3：使用 orderCargoSystem 生成订单/货物状态摘要
    // 阶段8.4：已完成订单显示"已完成"
    let orderStatusText: string;
    if (
      gameState.selectedOrderId &&
      gameState.completedOrderIds &&
      gameState.completedOrderIds.includes(gameState.selectedOrderId)
    ) {
      const order = getOrderById(gameState.selectedOrderId);
      orderStatusText = `订单：${order ? order.title : "已完成"}（已完成）`;
    } else {
      orderStatusText = getOrderCargoStatusText(
        gameState.selectedOrderId ? getOrderById(gameState.selectedOrderId) : undefined,
        gameState.cargo
      );
    }
    const weightStatusText = getCargoWeightStatusText(
      gameState.cargo,
      gameState.maxCargoWeight
    );
    const infoLines: string[] = [];
    if (routeInfo) {
      infoLines.push(routeInfo);
      console.log(`[地图V2] ${routeInfo}`);
    }
    if (orderSummary) {
      infoLines.push(orderSummary.text);
      console.log(`[地图V2] ${orderSummary.title}`);
    }
    // 订单状态和载重状态（常驻面板显示）
    infoLines.push(orderStatusText);
    infoLines.push(weightStatusText);
    
    // 阶段10.2 订单时间显示
    if (gameState.selectedOrderId) {
      const orderTimeState = gameState.orderTimeStates[gameState.selectedOrderId];
      if (orderTimeState) {
        const timeText = orderTimeState.isCompleted 
          ? `订单时限：已完成（${orderTimeState.elapsedSteps}步）`
          : `订单时限：${orderTimeState.remainingSteps}/${orderTimeState.limitSteps}步（已走${orderTimeState.elapsedSteps}步）`;
        infoLines.push(timeText);
      }
    }
    // 阶段10.3：未完成订单标记
    if (gameState.selectedOrderId && gameState.unfinishedOrderIds && gameState.unfinishedOrderIds.includes(gameState.selectedOrderId)) {
      infoLines.push("【未完成订单继续中】");
    }
    // 阶段10.5：订单附加条款显示
    if (gameState.selectedOrderId) {
      const currentOrder = getOrderById(gameState.selectedOrderId);
      if (currentOrder && currentOrder.specialTerms && currentOrder.specialTerms.length > 0) {
        for (const term of currentOrder.specialTerms) {
          const termText = term.type === "confidential" ? "【保密】" : "【易损】";
          infoLines.push(`附加条款：${termText}`);
        }
      }
    }
    // 城市状态（阶段8.6）
    if (gameState.selectedCityId) {
      infoLines.push(formatCityProgress(gameState.selectedCityId, gameState.cityContributions));
    }

    if (infoLines.length > 0) {
      const panelPadding = 8;
      const panelLineHeight = 16;
      const panelWidth = 260;
      const panelHeight = infoLines.length * panelLineHeight + panelPadding * 2;
      const panelX = this.scale.width - panelWidth - 10;
      const panelY = 10;

      // 半透明背景框
      const panelBg = this.add.graphics();
      panelBg.fillStyle(0x000000, 0.6);
      panelBg.fillRect(panelX, panelY, panelWidth, panelHeight);
      panelBg.setDepth(100);

      // 信息文本
      this._infoPanelTexts = [];
      infoLines.forEach((line, i) => {
        const txt = this.add
          .text(panelX + panelPadding, panelY + panelPadding + i * panelLineHeight, line, {
            fontSize: "11px",
            color: i === 0 ? "#ffcc44" : "#ffaa44",
            fontFamily: "monospace",
            wordWrap: { width: panelWidth - panelPadding * 2 },
          })
          .setOrigin(0, 0)
          .setDepth(101);
        this._infoPanelTexts.push(txt);
      });

      // 信息面板可交互：悬浮显示完整订单详情 Tooltip
      const panelHitArea = this.add.rectangle(
        panelX + panelWidth / 2, panelY + panelHeight / 2,
        panelWidth, panelHeight, 0x000000, 0
      ).setInteractive({ useHandCursor: true }).setDepth(102);

      panelHitArea.on("pointerover", () => {
        if (!this.tooltipManager) return;
        const gs = getGameState();
        const pointer = this.input.activePointer;
        const route = gs.selectedRouteId ? getRouteById(gs.selectedRouteId) : null;
        const order = gs.selectedOrderId ? getOrderById(gs.selectedOrderId) : null;
        const lines: string[] = [];
        if (route) {
          lines.push(`城市：${route.cityName}`);
          lines.push(`商路：${route.routeName}`);
          lines.push(`定位：${route.tagline}`);
          lines.push(`风险：${route.riskLevel} | 收益：${route.profitLevel}`);
          lines.push(`推荐货物：${route.recommendedGoods.join("、")}`);
          lines.push(`推荐角色：${route.recommendedCharacters.join("、")}`);
        }
        if (order) {
          lines.push("");
          lines.push(`订单：${order.title}`);
          lines.push(`描述：${order.description}`);
          lines.push(`需求：${formatRequiredGoods(order.requiredGoods)}`);
          lines.push(`奖励：银币 +${order.rewardSilver}，火种 +${order.rewardEmbers}`);
          lines.push(`贡献：+${order.cityContribution}`);
          lines.push(`难度：${order.difficulty}`);
          // 阶段10.5：附加条款详情
          if (order.specialTerms && order.specialTerms.length > 0) {
            lines.push("");
            lines.push("附加条款：");
            for (const term of order.specialTerms) {
              lines.push(`• ${term.title}: ${term.description}`);
            }
          }
        }
        // 阶段8.3：使用 orderCargoSystem 显示订单货物详情
        const detailLines = getOrderCargoDetailLines(
          gs.selectedOrderId ? getOrderById(gs.selectedOrderId) : undefined,
          gs.cargo,
          gs.maxCargoWeight
        );
        lines.push("");
        lines.push(...detailLines);
        if (lines.length > 0) {
          this.tooltipManager!.show(
            { title: "任务详情", lines },
            pointer.x, pointer.y, 280
          );
        }
      });
      panelHitArea.on("pointerout", () => {
        if (this.tooltipManager) this.tooltipManager.hide();
      });
    }

    // 撤退按钮（阶段8.9）
    this.createRetreatButton();

    // 清理并重置所有测试状态，防止旧状态干扰新一局游戏
    const gs = getGameState();
    const hasPendingTest = (gs._isAutoMoving && gs._autoMoveResumeStep > 0) ||
      (gs._isClickTesting && gs._clickTestResumeStep > 0) ||
      (gs._isDirectionalTesting && gs._directionalTestResumeStep > 0);

    if (hasPendingTest) {
      console.log("[地图V2] 清理未完成的测试状态，防止干扰新一局游戏");
      gs._isAutoMoving = false;
      gs._autoMoveResumeStep = 0;
      gs._autoMovePrevPos = null;
      gs._isClickTesting = false;
      gs._clickTestResumeStep = 0;
      gs._clickTestStep = 0;
      gs._isDirectionalTesting = false;
      gs._directionalTestResumeStep = 0;
      gs._directionalTestStep = 0;
      setGameState(gs);
    }
  }

  // ==================== 单一 pointerdown 监听 ====================

  private setupMapPointer(): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handleMapPointer(pointer);
    });
  }

  /** 处理地图 pointer 点击（坐标换算→tryMoveTo） */
  private handleMapPointer(pointer: Phaser.Input.Pointer): void {
    // 如果有弹窗打开，不处理地图点击
    if (this.modalContainer) return;

    // Bug 1 (Item 1 P0): 如果牌组查看界面打开，不处理地图点击
    if (this._deckViewerOpen) return;

    // 将鼠标坐标转换为地图容器内坐标
    const worldX = pointer.x - this.mapContainer.x;
    const worldY = pointer.y - this.mapContainer.y;

    // 换算成格子坐标
    const cellX = Math.floor(worldX / (this.cellSize + this.cellGap));
    const cellY = Math.floor(worldY / (this.cellSize + this.cellGap));

    // 检查是否在格子范围内（排除间隙区域）
    const pixelX = cellX * (this.cellSize + this.cellGap);
    const pixelY = cellY * (this.cellSize + this.cellGap);
    const inCellX = worldX - pixelX;
    const inCellY = worldY - pixelY;

    if (inCellX < 0 || inCellX >= this.cellSize) return;
    if (inCellY < 0 || inCellY >= this.cellSize) return;

    const gameState = getGameState();
    if (
      cellX < 0 ||
      cellY < 0 ||
      cellX >= gameState.mapWidth ||
      cellY >= gameState.mapHeight
    ) {
      return;
    }

    console.log(
      `[地图V2] 点击格子 (${cellX}, ${cellY})`,
      `pointer=(${pointer.x},${pointer.y})`,
      `world=(${worldX},${worldY})`,
    );

    // 统一调用 tryMoveTo
    this.tryMoveTo(cellX, cellY);
  }

  // ==================== 键盘事件 ====================

  private setupKeyboard(): void {
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      // 终局界面打开时，禁止所有键盘操作
      if (this._victoryOverlayOpen) return;

      // 牌组查看器打开时，只允许 V/ESC 关闭，其他键忽略（Bug 1）
      if (this._deckViewerOpen) {
        if (key === "v" || key === "escape") {
          this._deckViewerOpen = false;
          this._deckViewerClose?.();
          this._deckViewerClose = undefined;
        }
        return;
      }

      // 弹窗打开时，允许数字键选择选项，Escape 关闭弹窗，禁止移动和测试快捷键
      if (this.modalContainer) {
        if (key === "escape") {
          this.closeModal();
          return;
        }
        // 数字键 1-9 选择弹窗选项
        const num = parseInt(key);
        if (num >= 1 && num <= 9 && this.modalActions.length >= num) {
          console.log(
            `[弹窗] 数字键 ${num} 选择选项: ${this.modalActions[num - 1] ? "执行" : "无"}`,
          );
          this.modalActions[num - 1]();
          return;
        }
        return; // 其他键忽略
      }

      switch (key) {
        case "w":
        case "arrowup": {
          const gs = getGameState();
          this.tryMoveTo(gs.currentPosition.x, gs.currentPosition.y - 1);
          break;
        }
        case "s":
        case "arrowdown": {
          const gs = getGameState();
          this.tryMoveTo(gs.currentPosition.x, gs.currentPosition.y + 1);
          break;
        }
        case "a":
        case "arrowleft": {
          const gs = getGameState();
          this.tryMoveTo(gs.currentPosition.x - 1, gs.currentPosition.y);
          break;
        }
        case "d":
        case "arrowright": {
          const gs = getGameState();
          this.tryMoveTo(gs.currentPosition.x + 1, gs.currentPosition.y);
          break;
        }
        case " ":
          this.centerCameraOnPlayer();
          break;
        case "t":
          if (!isDevCheatEnabled()) break;
          // dev-only: 鼠标点击模拟测试，正式版本移除
          this.clickSimulationTest();
          break;
        case "y":
          if (!isDevCheatEnabled()) break;
          // dev-only: 自动移动测试，正式版本移除
          this.autoMoveTest();
          break;
        case "g": {
          if (!isDevCheatEnabled()) break;
          // dev-only: 方向点击测试，正式版本移除
          this.directionalClickTest();
          break;
        }
        case "escape":
          if (this.modalContainer) {
            console.log("[地图V2] Escape 关闭弹窗");
            this.closeModal();
            // 如果自动移动测试正在进行，关闭弹窗后继续
            const gs = getGameState();
            if (gs._isAutoMoving && gs._autoMoveResumeStep > 0) {
              this.time.delayedCall(300, () => {
                this.autoMoveStep(gs._autoMoveResumeStep);
              });
            }
          }
          break;
        // ========== dev-only 调试键：后续正式版本应移除 ==========
        case "i": {
          if (!isDevCheatEnabled()) break;
          // I 键：让第一个角色进入重伤
          const gs = getGameState();
          const firstId = gs.selectedCharacters[0];
          if (firstId && gs.characterStates[firstId]) {
            const cs = gs.characterStates[firstId];
            cs.currentHp = 1;
            cs.isWounded = true;
            cs.restNodes = 3;
            cs.graveWounds += 1;
            setGameState(gs);
            console.log(
              `[调试I] ${cs.def.name} 已进入重伤:`,
              JSON.stringify({
                currentHp: cs.currentHp,
                isWounded: cs.isWounded,
                restNodes: cs.restNodes,
                graveWounds: cs.graveWounds,
              }),
            );
            this.updatePartyDisplay();
          } else {
            console.log("[调试I] 没有找到第一个角色");
          }
          break;
        }
        case "o": {
          if (!isDevCheatEnabled()) break;
          // O 键：让第一个角色累计重伤 +1
          const gs = getGameState();
          const firstId = gs.selectedCharacters[0];
          if (firstId && gs.characterStates[firstId]) {
            const cs = gs.characterStates[firstId];
            cs.graveWounds += 1;
            if (cs.graveWounds >= 3) {
              cs.isDead = true;
              cs.isWounded = false;
              console.log(`[调试O] ${cs.def.name} 重伤次数达到3次，已死亡！`);
            } else {
              console.log(
                `[调试O] ${cs.def.name} 重伤次数+1，当前=${cs.graveWounds}/3`,
              );
            }
            setGameState(gs);
            this.updatePartyDisplay();
          }
          break;
        }
        case "p": {
          if (!isDevCheatEnabled()) break;
          // P 键：打印当前 characterStates
          const gs = getGameState();
          console.log("[调试P] ========== characterStates ==========");
          for (const id of gs.selectedCharacters) {
            const cs = gs.characterStates[id];
            if (cs) {
              console.log(
                `  ${cs.def.name}:`,
                JSON.stringify({
                  currentHp: cs.currentHp,
                  maxHp: cs.def.maxHp,
                  isWounded: cs.isWounded,
                  isDead: cs.isDead,
                  restNodes: cs.restNodes,
                  graveWounds: cs.graveWounds,
                }),
              );
            }
          }
          console.log(
            `[调试P] 商队: ${gs.caravanHp}/${gs.caravanMaxHp}, 士气: ${gs.morale}, 金币: ${gs.gold}, 天数: ${gs.day}`,
          );
          console.log("[调试P] ====================================");
          break;
        }
        case "l": {
          if (!isDevCheatEnabled()) break;
          // L 键：让全队进入重伤（测试远征失败）
          const gs = getGameState();
          for (const id of gs.selectedCharacters) {
            const cs = gs.characterStates[id];
            if (cs && !cs.isDead) {
              cs.currentHp = 1;
              cs.isWounded = true;
              cs.restNodes = 3;
              cs.graveWounds += 1;
              console.log(`[调试L] ${cs.def.name} 已进入重伤`);
            }
          }
          setGameState(gs);
          this.updatePartyDisplay();
          // 检查远征失败
          if (checkExpeditionFailed()) {
            console.log("[调试L] 全队重伤，远征失败！");
            this.showExpeditionFailedModal();
          }
          break;
        }
        case "k": {
          if (!isDevCheatEnabled()) break;
          // K 键：触发补给点弹窗（测试补给功能）
          const gsK = getGameState();
          const mockSupplyCell: MapCell = {
            x: gsK.currentPosition.x,
            y: gsK.currentPosition.y,
            type: "supply",
            resolvedType: null,
            visited: false,
            isCurrent: false,
            isReachable: false,
            isRevealed: true,
            isCleared: false,
            isGoal: false,
            rewardType: null,
          };
          console.log("[调试K] 触发补给点弹窗");
          this.showSupplyPopup(mockSupplyCell);
          break;
        }
        case "m": {
          if (!isDevCheatEnabled()) break;
          // M 键：触发营地弹窗（测试营地功能）
          const gsM = getGameState();
          const mockCampCell: MapCell = {
            x: gsM.currentPosition.x,
            y: gsM.currentPosition.y,
            type: "camp",
            resolvedType: null,
            visited: false,
            isCurrent: false,
            isReachable: false,
            isRevealed: true,
            isCleared: false,
            isGoal: false,
            rewardType: null,
          };
          console.log("[调试M] 触发营地弹窗");
          this.showCampPopup(mockCampCell);
          break;
        }
        // ========== dev-only 调试键（B/E/X/H/U） ==========
        case "b": {
          if (!isDevCheatEnabled()) break;
          // B 键：直接进入普通战斗（dev-only）
          // Item 33 (P0): 检查全队是否可用
          if (checkExpeditionFailed()) {
            console.log("[调试B] 全队重伤/死亡，无法进入战斗");
            this.showExpeditionFailedModal();
          } else {
            console.log("[调试B] 直接进入普通战斗");
            this.scene.start("BattleScene", { battleType: "normal" });
          }
          break;
        }
        case "e": {
          if (!isDevCheatEnabled()) break;
          // E 键：直接进入精英战斗（dev-only）
          const gsE = getGameState();
          gsE.currentBattleType = "elite";
          setGameState(gsE);
          console.log("[调试E] 直接进入精英战斗");
          this.scene.start("BattleScene");
          break;
        }
        case "x": {
          if (!isDevCheatEnabled()) break;
          // X 键：直接进入Boss战斗（dev-only）
          const gsX = getGameState();
          gsX.currentBattleType = "boss";
          setGameState(gsX);
          console.log("[调试X] 直接进入Boss战斗");
          this.scene.start("BattleScene");
          break;
        }
        case "h": {
          if (!isDevCheatEnabled()) break;
          // H 键：商队 HP -20（dev-only）
          const gsH = getGameState();
          gsH.caravanHp = Math.max(0, gsH.caravanHp - 20);
          setGameState(gsH);
          this.updateResourceDisplay();
          console.log(
            `[调试H] 商队 HP -20，当前=${gsH.caravanHp}/${gsH.caravanMaxHp}`,
          );
          break;
        }
        case "u": {
          if (!isDevCheatEnabled()) break;
          // U 键：所有角色 HP -10（dev-only）
          const gsU = getGameState();
          for (const id of gsU.selectedCharacters) {
            const cs = gsU.characterStates[id];
            if (cs && !cs.isDead) {
              cs.currentHp = Math.max(1, cs.currentHp - 10);
              console.log(
                `[调试U] ${cs.def.name} HP -10，当前=${cs.currentHp}/${cs.def.maxHp}`,
              );
            }
          }
          setGameState(gsU);
          this.updatePartyDisplay();
          console.log("[调试U] 全队HP-10完成");
          break;
        }
        case "v": {
          // V 键：查看牌组（阶段4.1验收用）
          // Bug 2: 统一在 setupKeyboard 中处理开关，不再使用 once 监听器
          if (this._deckViewerOpen) {
            this._deckViewerOpen = false;
            this._deckViewerClose?.();
            this._deckViewerClose = undefined;
          } else {
            this.showDeckViewer();
          }
          break;
        }
        case "n": {
          // N 键：查看商队部件（阶段6）
          this.showCaravanPartsViewer();
          break;
        }
        default:
          return;
      }
    });
  }

  // ==================== 统一移动入口 ====================

  /**
   * 唯一移动入口。所有移动方式（鼠标、键盘、T键、Y键）都调用此方法。
   *
   * 逻辑：
   * 1. 判断 canMoveTo(x, y)
   * 2. 如果不能移动，打印日志并 return
   * 3. 更新 currentPosition
   * 4. day +1
   * 5. 标记 cell.isVisited = true
   * 6. 如果未揭示，则揭示
   * 7. 重新绘制地图
   * 8. 更新资源 UI
   * 9. 处理当前格内容
   */
  private tryMoveTo(x: number, y: number): void {
    const gameState = getGameState();

    // 1. 动态判断是否可移动
    if (!canMoveTo(gameState, x, y)) {
      console.log(
        `[地图V2] 不能移动到 (${x}, ${y})`,
        `current=(${gameState.currentPosition.x},${gameState.currentPosition.y})`,
      );
      return;
    }

    // 2. 执行移动
    const moved = moveToCell(gameState, x, y);
    if (!moved) {
      console.log(`[地图V2] moveToCell 返回 false`);
      return;
    }

    // 3. 保存状态
    setGameState(gameState);

    // 4. 揭示未揭示的格子
    const cell = gameState.mapCells[y][x];
    if (!cell.isRevealed) {
      cell.isRevealed = true;
      if (cell.type === "question") {
        cell.resolvedType = resolveQuestionCell(
          cell,
          gameState.startPosition,
          gameState.bossPosition,
        );
      }
      setGameState(gameState);
    }

    // 5. 重新绘制地图
    this.redrawMap();
    this.updateResourceDisplay();

    // 6. 居中镜头
    this.centerCameraOnPlayer();

    // 7. 处理格子内容（阶段8.4.1：移到 checkGameStatus 之前，确保订单交付先执行）
    this.handleCellContent(cell);

    // 8. 检查游戏状态（胜利/失败）
    if (this.checkGameStatus(gameState)) return;

    // 8.5 处理重伤倒计时
    processInjuryRecovery();
    if (checkExpeditionFailed()) {
      this.showExpeditionFailedModal();
      return;
    }
  }

  // ==================== 弹窗系统（单一 modalContainer） ====================

  /** 关闭弹窗 */
  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy(true);
      this.modalContainer = undefined;
      this.modalActions = [];
      console.log("[弹窗] 已关闭 modalContainer=undefined");
    }
  }

  /** 打开弹窗前先关闭旧弹窗 */
  private openModal(
    title: string,
    desc: string,
    options: { text: string; action: () => void }[],
  ): void {
    // 先关闭旧弹窗
    this.closeModal();

    const w = this.scale.width;
    const h = this.scale.height;

    // 创建弹窗容器
    this.modalContainer = this.add.container(0, 0);

    // 遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, w, h);
    this.modalContainer.add(overlay);

    // 弹窗宽度（根据屏幕自适应）
    const popupW = Math.min(480, w - 40);
    const padding = 20;
    const btnHeight = 40;
    const btnSpacing = 15;
    const titleHeight = 40;
    const descLineHeight = 22;
    
    // 计算描述文本需要的高度（估算行数）
    const descLines = Math.max(3, Math.ceil(desc.length / 40));
    const descHeight = descLines * descLineHeight;
    
    // 动态计算弹窗高度
    const popupH = Math.min(
      h - 40,
      padding * 2 + titleHeight + descHeight + btnSpacing + btnHeight + (options.length - 1) * (btnHeight + btnSpacing)
    );

    // 弹窗背景（动态尺寸）
    const popupBg = this.add.graphics();
    popupBg.fillStyle(0x2a2a3e, 1);
    popupBg.fillRect(w / 2 - popupW / 2, h / 2 - popupH / 2, popupW, popupH);
    popupBg.lineStyle(3, 0x555566, 1);
    popupBg.strokeRect(w / 2 - popupW / 2, h / 2 - popupH / 2, popupW, popupH);
    this.modalContainer.add(popupBg);

    // 标题
    const titleY = h / 2 - popupH / 2 + padding + titleHeight / 2;
    const titleText = this.add
      .text(w / 2, titleY, title, {
        fontSize: "22px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
        wordWrap: { width: popupW - padding * 2 },
      })
      .setOrigin(0.5);
    this.modalContainer.add(titleText);

    // 描述（带 wordWrap）
    const descY = titleY + titleHeight / 2 + btnSpacing;
    const descText = this.add
      .text(w / 2, descY, desc, {
        fontSize: "15px",
        color: "#cccccc",
        fontFamily: "monospace",
        align: "center",
        wordWrap: { width: popupW - padding * 3 },
      })
      .setOrigin(0.5, 0);
    this.modalContainer.add(descText);

    // 选项按钮（垂直排列，适应小屏）
    const btnStartY = descY + descHeight + btnSpacing * 2;
    const btnWidth = Math.min(180, popupW - padding * 2);
    const btnX = w / 2;

    options.forEach((opt, index) => {
      const btnY = btnStartY + index * (btnHeight + btnSpacing);
      const btn = this.add
        .text(btnX, btnY, opt.text, {
          fontSize: "15px",
          color: "#ffffff",
          backgroundColor: "#2a4a6a",
          padding: { x: 20, y: 10 },
          fontFamily: "monospace",
          wordWrap: { width: btnWidth - 40 },
        })
        .setOrigin(0.5)
        .setInteractive();
      this.modalContainer!.add(btn);
      this.modalActions.push(opt.action);

      btn.on("pointerdown", opt.action);
      btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#3a6aaa" }));
      btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#2a4a6a" }));
    });

    console.log(
      `[弹窗] 已打开: ${title} modalContainer=${this.modalContainer ? "ok" : "undefined"}, size=${popupW}x${popupH}`,
    );
  }

  /**
   * 打开纯文本弹窗（无按钮，用数字键选择）
   * 用于选项较多时（如卡牌列表），避免按钮溢出
   * 选项通过数字键 1-9 选择，与 setupKeyboard 的 modalContainer 逻辑配合
   */
  private openTextModal(
    title: string,
    desc: string,
    options: { text: string; action: () => void }[],
  ): void {
    this.closeModal();

    const w = this.scale.width;
    const h = this.scale.height;

    this.modalContainer = this.add.container(0, 0);

    // 遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, w, h);
    this.modalContainer.add(overlay);

    // 弹窗背景（更宽更高以容纳更多文本）
    const popupW = Math.min(600, w - 40);
    const popupH = Math.min(500, h - 40);
    const popupBg = this.add.graphics();
    popupBg.fillStyle(0x2a2a3e, 1);
    popupBg.fillRect(w / 2 - popupW / 2, h / 2 - popupH / 2, popupW, popupH);
    popupBg.lineStyle(3, 0x555566, 1);
    popupBg.strokeRect(w / 2 - popupW / 2, h / 2 - popupH / 2, popupW, popupH);
    this.modalContainer.add(popupBg);

    // 标题
    const titleText = this.add
      .text(w / 2, h / 2 - popupH / 2 + 25, title, {
        fontSize: "22px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
        wordWrap: { width: popupW - 40 },
      })
      .setOrigin(0.5);
    this.modalContainer.add(titleText);

    // 描述（可换行）
    const descText = this.add
      .text(w / 2, h / 2 - popupH / 2 + 60, desc, {
        fontSize: "14px",
        color: "#cccccc",
        fontFamily: "monospace",
        align: "left",
        wordWrap: { width: popupW - 40 },
      })
      .setOrigin(0.5, 0);
    this.modalContainer.add(descText);

    // 底部提示
    const hintY = h / 2 + popupH / 2 - 25;
    const hintText = this.add
      .text(w / 2, hintY, "按数字键选择 | ESC 返回", {
        fontSize: "14px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    this.modalContainer.add(hintText);

    // 注册 actions（供数字键使用）
    this.modalActions = options.map((opt) => opt.action);

    console.log(`[弹窗] 已打开文本弹窗: ${title} (${options.length}个选项)`);
  }

  /** 执行弹窗第一个按钮的 action */
  private executeFirstModalAction(): boolean {
    if (this.modalActions.length > 0) {
      const action = this.modalActions[0];
      action();
      return true;
    }
    return false;
  }

  // ==================== 格子完成处理 ====================

  /** 标记格子为已完成，刷新地图 */
  private completeCell(cell: MapCell): void {
    cell.isCleared = true;
    cell.isRevealed = true;
    setGameState(getGameState());
    console.log(
      `[地图V2] 格子 (${cell.x}, ${cell.y}) 已完成，type=${cell.type}`,
    );
  }

  // ==================== 地图创建 ====================

  private createResourceDisplay(w: number, h: number): void {
    const gameState = getGameState();
    const y = 10;
    const spacing = 130;
    const startX = w / 2 - spacing * 2;

    this.resourceTexts["day"] = this.add.text(
      startX,
      y,
      `📅 ${gameState.day}/${gameState.maxDay}`,
      {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: "monospace",
      },
    );

    this.resourceTexts["food"] = this.add.text(
      startX + spacing,
      y,
      `🍞 ${gameState.food}`,
      {
        fontSize: "14px",
        color: "#88ff88",
        fontFamily: "monospace",
      },
    );

    const moraleColor =
      gameState.morale >= 3
        ? "#ffcc44"
        : gameState.morale > 0
          ? "#ff8844"
          : "#ff4444";
    this.resourceTexts["morale"] = this.add.text(
      startX + spacing * 2,
      y,
      `💪 ${gameState.morale}`,
      {
        fontSize: "14px",
        color: moraleColor,
        fontFamily: "monospace",
      },
    );

    const caravanColor =
      gameState.caravanHp > gameState.caravanMaxHp * 0.5
        ? "#88ccff"
        : "#ffaa44";
    this.resourceTexts["caravan"] = this.add.text(
      startX + spacing * 3,
      y,
      `🚗 ${gameState.caravanHp}/${gameState.caravanMaxHp}`,
      {
        fontSize: "14px",
        color: caravanColor,
        fontFamily: "monospace",
      },
    );

    this.resourceTexts["gold"] = this.add.text(
      startX + spacing * 4,
      y,
      `💰 ${gameState.gold}`,
      {
        fontSize: "14px",
        color: "#ffdd44",
        fontFamily: "monospace",
      },
    );

    // 调试信息
    this.debugTexts["pos"] = this.add.text(10, y, "", {
      fontSize: "12px",
      color: "#aaaaaa",
      fontFamily: "monospace",
    });

    // 操作提示
    this.add
      .text(
        w / 2,
        h - 20,
        "WASD/方向键=移动商队 | Space=居中 | T=随机走 | Y=自动200步 | 点击格子移动",
        {
          fontSize: "12px",
          color: "#888888",
          fontFamily: "monospace",
        },
      )
      .setOrigin(0.5);
  }

  private createMapGrid(gameState: ReturnType<typeof getGameState>): void {
    for (let y = 0; y < gameState.mapHeight; y++) {
      this.cellGraphics[y] = [];
      this.cellTexts[y] = [];

      for (let x = 0; x < gameState.mapWidth; x++) {
        const cell = gameState.mapCells[y][x];
        const px = x * (this.cellSize + this.cellGap);
        const py = y * (this.cellSize + this.cellGap);

        // 创建格子图形（无 hitArea，点击由全局 pointerdown 处理）
        const graphics = this.add.graphics();
        this.drawCell(graphics, cell, px, py);
        this.cellGraphics[y][x] = graphics;
        this.mapContainer.add(graphics);

        // 格子内容图标
        const icon = this.getCellIcon(cell);
        const text = this.add
          .text(px + this.cellSize / 2, py + this.cellSize / 2, icon, {
            fontSize: "20px",
          })
          .setOrigin(0.5);
        this.cellTexts[y][x] = text;
        this.mapContainer.add(text);
      }
    }
  }

  // ==================== 地图绘制 ====================

  private drawCell(
    graphics: Phaser.GameObjects.Graphics,
    cell: MapCell,
    x: number,
    y: number,
  ): void {
    let fillColor = 0x333344;
    let borderColor = 0x555566;

    if (cell.type === "obstacle") {
      fillColor = 0x222233;
      borderColor = 0x444455;
    } else if (cell.isCurrent) {
      fillColor = 0x44aa44;
      borderColor = 0x66cc66;
    } else if (cell.visited) {
      fillColor = 0x3a3a4e;
      borderColor = 0x5a5a6e;
    } else if (cell.isReachable) {
      fillColor = 0x2a4a6a;
      borderColor = 0x4a8aca;
    }

    graphics.fillStyle(fillColor, 1);
    graphics.fillRect(x, y, this.cellSize, this.cellSize);
    graphics.lineStyle(2, borderColor, 1);
    graphics.strokeRect(x, y, this.cellSize, this.cellSize);
  }

  private getCellIcon(cell: MapCell): string {
    if (cell.isCurrent) return "🚶";
    if (cell.type === "obstacle") return "⬛";
    if (cell.type === "boss") return "👹";
    if (cell.type === "elite") return cell.isCleared ? "✓" : "💀";
    if (cell.type === "camp") return cell.isCleared ? "✓" : "⛺";
    if (cell.type === "supply") return cell.isCleared ? "✓" : "📦";
    if (cell.type === "reward") return cell.isCleared ? "✓" : "🎁";

    if (cell.isGoal) {
      const gameState = getGameState();
      return gameState.expeditionGoal === "boss" ? "👹" : "🏠";
    }

    // 已揭示的问号格
    if (cell.isRevealed && cell.resolvedType) {
      switch (cell.resolvedType) {
        case "combat":
          return cell.isCleared ? "✓" : "⚔️";
        case "event":
          return cell.isCleared ? "✓" : "❓";
        case "opportunity":
          return cell.isCleared ? "✓" : "✨";
        case "danger":
          return cell.isCleared ? "✓" : "⚠️";
        case "reward":
          return cell.isCleared ? "✓" : "🎁";
        default:
          return "·";
      }
    }

    if (cell.type === "question") return "?";
    if (cell.visited) return "·";
    return "";
  }

  /**
   * 获取当前商路信息文本（阶段7.1）
   * 包含 route/city 一致性检查
   */
  private getRouteInfoText(): string | null {
    const gameState = getGameState();
    const { selectedRouteId, selectedCityId } = gameState;

    // 安全：检查字段存在性
    if (!selectedRouteId || !selectedCityId) {
      return null;
    }

    const route = getRouteById(selectedRouteId);

    // 一致性检查：route 存在但 cityId 不匹配
    if (route && route.cityId !== selectedCityId) {
      console.warn(
        `[地图] route/city 不一致: selectedRouteId=${selectedRouteId} 对应 cityId=${route.cityId}, 但 selectedCityId=${selectedCityId}`
      );
      // 以 route 数据为准显示
      return `目标：${route.cityName} | ${route.routeName}`;
    }

    // route 存在且一致
    if (route) {
      return `目标：${route.cityName} | ${route.routeName}`;
    }

    // route 不存在，fallback 到 cityId
    console.warn(`[地图] 未找到商路: ${selectedRouteId}，使用 cityId fallback`);
    return `目标：${selectedCityId}`;
  }

  /**
   * 获取当前订单摘要文本（阶段7.2）
   * 包含 order/route/city 一致性检查
   */
  private getOrderSummaryText(): { title: string; text: string } | null {
    const gameState = getGameState();
    const { selectedOrderId, selectedRouteId, selectedCityId } = gameState;

    // 安全：检查字段存在性
    if (!selectedOrderId) {
      return null;
    }

    const order = getOrderById(selectedOrderId);

    // order 不存在
    if (!order) {
      console.warn(`[地图] 未找到订单: ${selectedOrderId}`);
      return { title: "订单：未知订单", text: "订单：未知订单" };
    }

    // 一致性检查：order.routeId 与 selectedRouteId 不匹配
    if (selectedRouteId && order.routeId !== selectedRouteId) {
      console.warn(
        `[地图] order/route 不一致: orderId=${selectedOrderId} 对应 routeId=${order.routeId}, 但 selectedRouteId=${selectedRouteId}`
      );
    }

    // 一致性检查：order.cityId 与 selectedCityId 不匹配
    if (selectedCityId && order.cityId !== selectedCityId) {
      console.warn(
        `[地图] order/city 不一致: orderId=${selectedOrderId} 对应 cityId=${order.cityId}, 但 selectedCityId=${selectedCityId}`
      );
    }

    // 构建摘要文本
    const summaryText = `订单：${order.title} | 需求：${formatRequiredGoods(order.requiredGoods)} | 火种 +${order.rewardEmbers}`;

    return { title: order.title, text: summaryText };
  }

  /** 商队货物摘要（阶段8.2） */
  private getCargoSummaryText(): string | null {
    const gs = getGameState();
    if (!gs.cargo || Object.keys(gs.cargo).length === 0) {
      return null;
    }
    const weight = calculateCargoWeight(gs.cargo);
    const formatted = formatCargo(gs.cargo);
    // 简短摘要，如 "货物：粮食x5 | 载重：7/20"
    return `货物：${formatted} | 载重：${weight}/${gs.maxCargoWeight}`;
  }

  private redrawMap(): void {
    const gameState = getGameState();
    for (let y = 0; y < gameState.mapHeight; y++) {
      for (let x = 0; x < gameState.mapWidth; x++) {
        const cell = gameState.mapCells[y][x];
        const px = x * (this.cellSize + this.cellGap);
        const py = y * (this.cellSize + this.cellGap);

        const graphics = this.cellGraphics[y][x];
        graphics.clear();
        this.drawCell(graphics, cell, px, py);

        const text = this.cellTexts[y][x];
        text.setText(this.getCellIcon(cell));
      }
    }
  }

  // ==================== 视角控制 ====================

  private centerCameraOnPlayer(): void {
    const gameState = getGameState();
    const mapPixelW =
      gameState.mapWidth * (this.cellSize + this.cellGap) - this.cellGap;
    const mapPixelH =
      gameState.mapHeight * (this.cellSize + this.cellGap) - this.cellGap;
    const screenW = this.scale.width;
    const screenH = this.scale.height;

    const playerPixelX =
      gameState.currentPosition.x * (this.cellSize + this.cellGap) +
      this.cellSize / 2;
    const playerPixelY =
      gameState.currentPosition.y * (this.cellSize + this.cellGap) +
      this.cellSize / 2;

    let offsetX = Math.round(screenW / 2 - playerPixelX);
    let offsetY = Math.round(screenH / 2 - playerPixelY + 30);

    offsetX = Math.max(-(mapPixelW - screenW + 40), Math.min(40, offsetX));
    offsetY = Math.max(-(mapPixelH - screenH + 40), Math.min(40, offsetY));

    this.mapContainer.setPosition(offsetX, offsetY);
  }

  // ==================== 格子内容处理 ====================

  private handleCellContent(cell: MapCell): void {
    // 已清理的格子：不触发任何内容
    if (cell.isCleared) {
      console.log(`[地图V2] 格子 (${cell.x}, ${cell.y}) 已清理，跳过`);
      return;
    }

    const gameState = getGameState();
    const isAutoMoving = gameState._isAutoMoving;
    const isDirectionalTesting = gameState._isDirectionalTesting;

    // Boss 格直接进入战斗（自动测试/方向测试时跳过）
    if (cell.type === "boss") {
      if (isAutoMoving || isDirectionalTesting) {
        console.log(
          `[地图压力测试] 跳过Boss战斗 (${cell.x},${cell.y})，直接标记已清理`,
        );
        cell.isCleared = true;
        setGameState(gameState);
        this.redrawMap();
        this.updateResourceDisplay();
        return;
      }
      gameState.currentBattleType = "boss";
      gameState.currentBattleNodePosition = { x: cell.x, y: cell.y };
      setGameState(gameState);
      this.scene.start("BattleScene");
      return;
    }

    // 强敌格进入精英战斗（自动测试/方向测试时跳过）
    if (cell.type === "elite") {
      if (isAutoMoving || isDirectionalTesting) {
        console.log(
          `[地图压力测试] 跳过精英战斗 (${cell.x},${cell.y})，直接标记已清理`,
        );
        cell.isCleared = true;
        setGameState(gameState);
        this.redrawMap();
        this.updateResourceDisplay();
        return;
      }
      gameState.currentBattleType = "elite";
      gameState.currentBattleNodePosition = { x: cell.x, y: cell.y };
      setGameState(gameState);
      this.scene.start("BattleScene");
      return;
    }

    // 营地格（自动测试/方向测试时直接标记清理）
    if (cell.type === "camp") {
      if (isAutoMoving || isDirectionalTesting) {
        console.log(`[地图压力测试] 自动处理营地 (${cell.x},${cell.y})`);
        cell.isCleared = true;
        setGameState(gameState);
        this.redrawMap();
        this.updateResourceDisplay();
        return;
      }
      this.showCampPopup(cell);
      return;
    }

    // 补给点（自动测试/方向测试时直接标记清理）
    if (cell.type === "supply") {
      if (isAutoMoving || isDirectionalTesting) {
        console.log(`[地图压力测试] 自动处理补给 (${cell.x},${cell.y})`);
        cell.isCleared = true;
        setGameState(gameState);
        this.redrawMap();
        this.updateResourceDisplay();
        return;
      }
      this.showSupplyPopup(cell);
      return;
    }

    // 奖励点（自动测试/方向测试时直接标记清理）
    if (cell.type === "reward") {
      if (isAutoMoving || isDirectionalTesting) {
        console.log(`[地图压力测试] 自动处理奖励 (${cell.x},${cell.y})`);
        cell.isCleared = true;
        setGameState(gameState);
        this.redrawMap();
        this.updateResourceDisplay();
        return;
      }
      this.showRewardPopup(cell);
      return;
    }

    // 目标点 → 触发订单交付（阶段8.4.1：优先用 selectedOrderId 判断）
    if (cell.isGoal && gameState.selectedOrderId) {
      this.handleOrderDelivery(cell);
      return;
    }

    // 问号格：根据揭示的内容触发
    if (cell.type === "question" && cell.resolvedType) {
      this.triggerResolvedContent(cell);
    }
  }

  /** 订单交付处理（阶段8.4） */
  handleOrderDelivery(cell: MapCell): void {
    const gameState = getGameState();
    const orderId = gameState.selectedOrderId;
    const order = orderId ? getOrderById(orderId) : undefined;

    const result = deliverOrder({
      order,
      cargo: gameState.cargo,
      completedOrderIds: gameState.completedOrderIds,
    });

    if (result.ok) {
      // 交付成功：更新 GameState
      gameState.cargo = result.updatedCargo;
      gameState.silver += result.rewardSilver;
      gameState.embers += result.rewardEmbers;
      gameState.completedOrderIds.push(order!.id);
      if (!gameState.cityContributions[order!.cityId]) {
        gameState.cityContributions[order!.cityId] = 0;
      }
      gameState.cityContributions[order!.cityId] += result.cityContribution;

      // 阶段10.2：标记订单完成
      markOrderCompleted(order!.id);
      // 阶段10.3：从未完成订单列表移除
      removeUnfinishedOrder(order!.id);

      // 生成远征结算结果（阶段8.7）
      const route = gameState.selectedRouteId ? getRouteById(gameState.selectedRouteId) : undefined;
      gameState.lastExpeditionResult = createSuccessExpeditionResult({
        order: order!,
        cityName: route ? route.cityName : order!.cityId,
        deliveryResult: result,
        gameState: {
          cityContributions: gameState.cityContributions,
          completedOrderIds: gameState.completedOrderIds,
        },
      });

      setGameState(gameState);

      console.log(
        `[地图V2] 订单交付成功: ${result.message}，银币+${result.rewardSilver}，火种+${result.rewardEmbers}，贡献+${result.cityContribution}`
      );

      // 显示交付成功弹窗（带结算入口）
      this.showOrderDeliveryPopup(result, order!);
    } else {
      console.log(`[地图V2] 订单交付失败: ${result.message} (${result.reason})`);

      if (result.reason === "already_delivered") {
        this.showOrderDeliveryPopup(result, order!);
      } else if (result.reason === "not_enough_cargo") {
        this.showOrderDeliveryPopup(result, order!);
      } else {
        // missing_order 等情况不弹窗
      }
    }

    // 标记目标节点已清理
    cell.isCleared = true;
    setGameState(gameState);
    this.redrawMap();
    this.updateResourceDisplay();

    // 更新信息面板显示订单状态
    this.updateInfoPanelText();
  }

  /** 更新信息面板文本（阶段8.4：交付后刷新） */
  private updateInfoPanelText(): void {
    if (this._infoPanelTexts.length === 0) return;
    const gameState = getGameState();

    // 重新生成订单状态文本
    let orderStatusText: string;
    if (
      gameState.selectedOrderId &&
      gameState.completedOrderIds &&
      gameState.completedOrderIds.includes(gameState.selectedOrderId)
    ) {
      const order = getOrderById(gameState.selectedOrderId);
      orderStatusText = `订单：${order ? order.title : "已完成"}（已完成）`;
    } else {
      orderStatusText = getOrderCargoStatusText(
        gameState.selectedOrderId ? getOrderById(gameState.selectedOrderId) : undefined,
        gameState.cargo
      );
    }

    // 更新第3个文本（订单状态行，索引2）
    // 面板结构：[0]=routeInfo, [1]=orderSummary, [2]=orderStatus, [3]=weightStatus
    if (this._infoPanelTexts.length >= 3) {
      this._infoPanelTexts[2].setText(orderStatusText);
    }
  }

  /** 订单交付弹窗 */
  private showOrderDeliveryPopup(
    result: import("../systems/orderDeliverySystem").OrderDeliveryResult,
    order: import("../data/cityOrders").CityOrder
  ): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // 半透明背景
    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.6)
      .setDepth(900)
      .setInteractive({ useHandCursor: true });

    // 弹窗面板
    const panelW = 480;
    const panelH = result.ok ? 280 : 200;
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x2a1a0e, 0.95)
      .setDepth(901)
      .setStrokeStyle(2, 0xd4a574);

    // 标题
    const titleText = result.ok
      ? `✅ 订单完成`
      : result.reason === "already_delivered"
        ? `📋 订单已完成`
        : `❌ 货物不足`;
    this.add.text(w / 2, h / 2 - panelH / 2 + 30, titleText, {
      fontSize: "22px",
      color: "#f0e6d2",
      fontFamily: "sans-serif",
    })
      .setOrigin(0.5)
      .setDepth(902);

    // 订单名称
    this.add.text(w / 2, h / 2 - panelH / 2 + 65, order.title, {
      fontSize: "18px",
      color: "#d4a574",
      fontFamily: "sans-serif",
    })
      .setOrigin(0.5)
      .setDepth(902);

    if (result.ok) {
      // 奖励信息
      const rewardLine = `获得：银币 +${result.rewardSilver}，火种 +${result.rewardEmbers}，贡献 +${result.cityContribution}`;
      this.add.text(w / 2, h / 2 - panelH / 2 + 105, rewardLine, {
        fontSize: "16px",
        color: "#a8d8a8",
        fontFamily: "sans-serif",
        wordWrap: { width: panelW - 40 },
      })
        .setOrigin(0.5)
        .setDepth(902);

      // 城市状态变化（阶段8.6）
      const gs = getGameState();
      if (order.cityId) {
        const cityStatusLine = formatCityProgress(order.cityId, gs.cityContributions);
        this.add.text(w / 2, h / 2 - panelH / 2 + 140, cityStatusLine, {
          fontSize: "15px",
          color: "#88aacc",
          fontFamily: "sans-serif",
          wordWrap: { width: panelW - 40 },
        })
          .setOrigin(0.5)
          .setDepth(902);
      }
    } else if (result.reason === "not_enough_cargo") {
      this.add.text(w / 2, h / 2 - panelH / 2 + 105, "当前货物不满足订单需求", {
        fontSize: "16px",
        color: "#d4a574",
        fontFamily: "sans-serif",
        wordWrap: { width: panelW - 40 },
      })
        .setOrigin(0.5)
        .setDepth(902);
    }

    // 关闭提示或查看结算按钮
    if (result.ok) {
      // 成功时显示"查看结算"按钮
      const btnY = h / 2 + panelH / 2 - 45;
      const btnContainer = this.add.container(w / 2, btnY)
        .setSize(160, 36)
        .setInteractive({ useHandCursor: true })
        .setDepth(902);
      const btnBg = this.add.rectangle(0, 0, 160, 36, 0x3a2a1a, 0.95)
        .setStrokeStyle(2, 0xd4a574)
        .setOrigin(0.5);
      const btnText = this.add.text(0, 0, "查看结算", {
        fontSize: "16px",
        color: "#e8c97a",
        fontFamily: "sans-serif",
      }).setOrigin(0.5);
      btnContainer.add([btnBg, btnText]);

      btnContainer.on("pointerover", () => btnBg.setFillStyle(0x5a4a3a));
      btnContainer.on("pointerout", () => btnBg.setFillStyle(0x3a2a1a));
      btnContainer.on("pointerdown", () => {
        console.log("[OrderDeliveryPopup] click view result");
        this.scene.start("ExpeditionResultScene");
      });

      // 点击背景也可关闭（不进入结算）
      bg.on("pointerdown", () => {
        bg.destroy();
        panel.destroy();
        btnContainer.destroy();
        const toDestroy = this.children.list.filter(
          (c) => (c as Phaser.GameObjects.Text).depth >= 902 && c.type === "Text"
        );
        toDestroy.forEach((c) => c.destroy());
      });
    } else {
      // 失败时显示关闭提示
      this.add.text(w / 2, h / 2 + panelH / 2 - 35, "点击任意位置关闭", {
        fontSize: "14px",
        color: "#888888",
        fontFamily: "sans-serif",
      })
        .setOrigin(0.5)
        .setDepth(902);

      bg.on("pointerdown", () => {
        bg.destroy();
        panel.destroy();
        const toDestroy = this.children.list.filter(
          (c) => (c as Phaser.GameObjects.Text).depth >= 902 && c.type === "Text"
        );
        toDestroy.forEach((c) => c.destroy());
      });
    }
  }

  private triggerResolvedContent(cell: MapCell): void {
    if (!cell.resolvedType) return;

    const gameState = getGameState();
    const isAutoMoving = gameState._isAutoMoving;
    const isDirectionalTesting = gameState._isDirectionalTesting;

    switch (cell.resolvedType) {
      case "combat":
        if (isAutoMoving || isDirectionalTesting) {
          console.log(
            `[地图压力测试] 跳过战斗 (${cell.x},${cell.y})，resolvedType=combat，直接标记已清理`,
          );
          cell.isCleared = true;
          setGameState(gameState);
          this.redrawMap();
          this.updateResourceDisplay();
          return;
        }
        this.enterCombat(cell);
        break;
      case "event":
        if (isAutoMoving || isDirectionalTesting) {
          console.log(`[地图压力测试] 自动处理事件 (${cell.x},${cell.y})`);
          cell.isCleared = true;
          setGameState(gameState);
          this.redrawMap();
          this.updateResourceDisplay();
          return;
        }
        this.showEventPopup(cell);
        break;
      case "opportunity":
        if (isAutoMoving || isDirectionalTesting) {
          console.log(`[地图压力测试] 自动处理机遇 (${cell.x},${cell.y})`);
          cell.isCleared = true;
          setGameState(gameState);
          this.redrawMap();
          this.updateResourceDisplay();
          return;
        }
        this.showOpportunityPopup(cell);
        break;
      case "danger":
        if (isAutoMoving || isDirectionalTesting) {
          console.log(
            `[地图压力测试] 跳过危险 (${cell.x},${cell.y})，resolvedType=danger，直接标记已清理`,
          );
          cell.isCleared = true;
          setGameState(gameState);
          this.redrawMap();
          this.updateResourceDisplay();
          return;
        }
        this.showDangerPopup(cell);
        break;
      case "reward":
        if (isAutoMoving || isDirectionalTesting) {
          console.log(`[地图压力测试] 自动处理奖励 (${cell.x},${cell.y})`);
          cell.isCleared = true;
          setGameState(gameState);
          this.redrawMap();
          this.updateResourceDisplay();
          return;
        }
        this.showQuestionRewardPopup(cell);
        break;
    }
  }

  private enterCombat(cell: MapCell): void {
    const gameState = getGameState();
    gameState.currentBattleType = "normal";
    gameState.currentBattleNodePosition = { x: cell.x, y: cell.y };
    setGameState(gameState);
    this.scene.start("BattleScene");
  }

  // ==================== 弹窗：事件 ====================

  private showEventPopup(cell: MapCell): void {
    const events = [
      {
        name: "废弃货箱",
        desc: "发现一个废弃的货箱",
        options: [
          {
            text: "搜索",
            action: () => {
              this.modifyFood(2);
              this.completeCell(cell);
              this.closeModal();
              this.redrawMap();
              this.updateResourceDisplay();
            },
          },
          {
            text: "谨慎离开",
            action: () => {
              this.completeCell(cell);
              this.closeModal();
              this.redrawMap();
              this.updateResourceDisplay();
            },
          },
        ],
      },
      {
        name: "风暴前兆",
        desc: "天空阴沉，风暴即将来临",
        options: [
          {
            text: "强行前进",
            action: () => {
              this.modifyCaravanHp(-5);
              this.completeCell(cell);
              this.closeModal();
              this.redrawMap();
              this.updateResourceDisplay();
            },
          },
          {
            text: "原地等待",
            action: () => {
              this.modifyDay(1);
              this.completeCell(cell);
              this.closeModal();
              this.redrawMap();
              this.updateResourceDisplay();
            },
          },
        ],
      },
      {
        name: "陌生旅人",
        desc: "遇到一位疲惫的旅人",
        options: [
          {
            text: "交易",
            action: () => {
              this.modifyFood(1);
              this.modifyMorale(-1);
              this.completeCell(cell);
              this.closeModal();
              this.redrawMap();
              this.updateResourceDisplay();
            },
          },
          {
            text: "帮助他",
            action: () => {
              this.modifyMorale(1);
              this.completeCell(cell);
              this.closeModal();
              this.redrawMap();
              this.updateResourceDisplay();
            },
          },
        ],
      },
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    this.openModal(event.name, event.desc, event.options);
  }

  // ==================== 弹窗：机遇 ====================

  private showOpportunityPopup(cell: MapCell): void {
    const opportunities = [
      {
        name: "发现补给",
        desc: "找到一些食物",
        effect: () => this.modifyFood(2),
      },
      {
        name: "士气提升",
        desc: "队伍状态良好",
        effect: () => this.modifyMorale(1),
      },
      {
        name: "发现零件",
        desc: "可以修理商队",
        effect: () => this.modifyCaravanHp(5),
      },
      {
        name: "短暂休息",
        desc: "一位角色恢复了一些体力",
        effect: () => this.healRandomCharacter(3),
      },
    ];

    const opp = opportunities[Math.floor(Math.random() * opportunities.length)];
    opp.effect();
    this.openModal("机遇", opp.desc, [
      {
        text: "确定",
        action: () => {
          this.completeCell(cell);
          this.closeModal();
          this.redrawMap();
          this.updateResourceDisplay();
        },
      },
    ]);
  }

  // ==================== 弹窗：危险 ====================

  private showDangerPopup(cell: MapCell): void {
    const dangers = [
      {
        name: "陷阱",
        desc: "商队触发了陷阱",
        effect: () => this.modifyCaravanHp(-5),
      },
      {
        name: "偷袭",
        desc: "一名角色受了轻伤",
        effect: () => this.damageRandomCharacter(3),
      },
      {
        name: "恶劣天气",
        desc: "士气下降",
        effect: () => this.modifyMorale(-1),
      },
    ];

    const danger = dangers[Math.floor(Math.random() * dangers.length)];
    danger.effect();

    // 50% 概率进入战斗
    if (Math.random() < 0.5) {
      this.openModal("危险", danger.desc + "\n\n遭遇敌人！", [
        {
          text: "进入战斗",
          action: () => {
            this.closeModal();
            this.enterCombat(cell);
          },
        },
      ]);
    } else {
      this.openModal("危险", danger.desc, [
        {
          text: "确定",
          action: () => {
            this.completeCell(cell);
            this.closeModal();
            this.redrawMap();
            this.updateResourceDisplay();
          },
        },
      ]);
    }
  }

  // ==================== 弹窗：问号中的奖励 ====================

  private showQuestionRewardPopup(cell: MapCell): void {
    const goldAmount = 5 + Math.floor(Math.random() * 10);
    this.modifyGold(goldAmount);
    this.openModal("意外收获", `发现了 ${goldAmount} 枚金币！`, [
      {
        text: "收下",
        action: () => {
          this.completeCell(cell);
          this.closeModal();
          this.redrawMap();
          this.updateResourceDisplay();
        },
      },
    ]);
  }

  // ==================== 弹窗：营地 ====================

  private showCampPopup(cell: MapCell): void {
    const gameState = getGameState();
    // 营地效果：所有未死亡角色 HP+5，重伤角色 restNodes-1，士气+1
    for (const id of gameState.selectedCharacters) {
      const cs = gameState.characterStates[id];
      if (!cs || cs.isDead) continue;
      cs.currentHp = Math.min(cs.def.maxHp, cs.currentHp + 5);
      if (cs.isWounded) {
        cs.restNodes = Math.max(0, cs.restNodes - 1);
        if (cs.restNodes <= 0) {
          cs.isWounded = false;
          console.log(`[营地] ${cs.def.name} 重伤恢复，可以重新上场`);
        }
      }
    }
    gameState.morale = Math.min(10, gameState.morale + 1);
    setGameState(gameState);

    // 构建状态描述
    const statusLines = gameState.selectedCharacters
      .map((id) => {
        const cs = gameState.characterStates[id];
        if (!cs) return "";
        const status = cs.isDead
          ? "💀离队"
          : cs.isWounded
            ? `🩹重伤(剩${cs.restNodes}节点)`
            : `❤️${cs.currentHp}/${cs.def.maxHp}`;
        return `${cs.def.name}: ${status}`;
      })
      .filter(Boolean)
      .join("\n");

    this.openModal(
      "🏕️ 营地",
      `在营地休息恢复\n\n所有未死亡角色 HP +5\n重伤角色休息倒计时 -1\n士气 +1\n\n${statusLines}\n\n💡 升旗/路标功能尚未开放，敬请期待`,
      [
        {
          text: "继续",
          action: () => {
            this.completeCell(cell);
            this.closeModal();
            this.redrawMap();
            this.updateResourceDisplay();
            this.updatePartyDisplay();
          },
        },
      ],
    );
  }

  // ==================== 弹窗：补给站 ====================

  private showSupplyPopup(cell: MapCell): void {
    const gameState = getGameState();

    // 构建角色状态信息
    const charStatusLines = gameState.selectedCharacters
      .map((id) => {
        const cs = gameState.characterStates[id];
        if (!cs) return "";
        const status = cs.isDead
          ? "💀离队"
          : cs.isWounded
            ? `🩹重伤(剩${cs.restNodes}节点)`
            : `❤️${cs.currentHp}/${cs.def.maxHp}`;
        return `${cs.def.name}: ${status}`;
      })
      .filter(Boolean)
      .join("\n");

    const desc = `剩余金币: ${gameState.gold}\n商队: ${gameState.caravanHp}/${gameState.caravanMaxHp}\n\n队伍状态:\n${charStatusLines}\n\n选择补给项目：`;

    const options: { text: string; action: () => void }[] = [];

    // 选项1：深度治疗（选择一名角色）
    const woundedChars = gameState.selectedCharacters.filter((id) => {
      const cs = gameState.characterStates[id];
      return cs && !cs.isDead;
    });
    if (woundedChars.length > 0) {
      options.push({
        text: "深度治疗 (选角色)",
        action: () => {
          this.showDeepHealPopup(cell);
        },
      });
    }

    // 选项2：修复商队
    // 修理工具箱效果：补给点修复商队额外 +10
    const hasRepairToolkit = gameState.caravanParts.some(
      (p) => p.id === "repair_toolkit",
    );
    const repairBonus = hasRepairToolkit ? 10 : 0;
    const repairAmount = 20 + repairBonus;
    options.push({
      text: `修复商队 (+${repairAmount}${hasRepairToolkit ? " 含工具箱)" : ")"}`,
      action: () => {
        gameState.caravanHp = Math.min(
          gameState.caravanMaxHp,
          gameState.caravanHp + repairAmount,
        );
        console.log(
          `[补给] 修复商队: ${gameState.caravanHp}/${gameState.caravanMaxHp}${hasRepairToolkit ? " (修理工具箱 +10)" : ""}`,
        );
        setGameState(gameState);
        this.completeCell(cell);
        this.closeModal();
        this.redrawMap();
        this.updateResourceDisplay();
        this.updatePartyDisplay();
      },
    });

    // 选项3：全队休整
    options.push({
      text: "全队休整 (HP+8, 士气+1)",
      action: () => {
        for (const id of gameState.selectedCharacters) {
          const cs = gameState.characterStates[id];
          if (!cs || cs.isDead) continue;
          cs.currentHp = Math.min(cs.def.maxHp, cs.currentHp + 8);
        }
        gameState.morale = Math.min(10, gameState.morale + 1);
        console.log(`[补给] 全队休整: morale=${gameState.morale}`);
        setGameState(gameState);
        this.completeCell(cell);
        this.closeModal();
        this.redrawMap();
        this.updateResourceDisplay();
        this.updatePartyDisplay();
      },
    });

    // 选项4：升级卡牌（阶段5）
    const aliveChars = gameState.selectedCharacters.filter((id) => {
      const cs = gameState.characterStates[id];
      return cs && !cs.isDead;
    });
    if (aliveChars.length > 0) {
      options.push({
        text: "升级卡牌",
        action: () => {
          this.showUpgradeCardSelectCharacter(cell);
        },
      });
    }

    // 选项5：删除卡牌（阶段5）
    if (aliveChars.length > 0) {
      options.push({
        text: "删除卡牌",
        action: () => {
          this.showDeleteCardSelectCharacter(cell);
        },
      });
    }

    // 离开选项
    options.push({
      text: "离开",
      action: () => {
        this.completeCell(cell);
        this.closeModal();
        this.redrawMap();
        this.updateResourceDisplay();
      },
    });

    this.openModal("补给站", desc, options);
  }

  private showDeepHealPopup(supplyCell: MapCell): void {
    const gameState = getGameState();
    const healableChars = gameState.selectedCharacters.filter((id) => {
      const cs = gameState.characterStates[id];
      return cs && !cs.isDead;
    });

    const options: { text: string; action: () => void }[] = healableChars.map(
      (id) => {
        const cs = gameState.characterStates[id];
        const woundedTag = cs.isWounded ? " [🩹重伤]" : "";
        return {
          text: `${cs.def.name}${woundedTag} (${cs.currentHp}/${cs.def.maxHp})`,
          action: () => {
            // 深度治疗：HP恢复满，清除重伤
            cs.currentHp = cs.def.maxHp;
            cs.isWounded = false;
            cs.restNodes = 0;
            // injuryCount 不减少
            setGameState(gameState);
            console.log(`[补给] 深度治疗: ${cs.def.name} → HP满, 重伤清除`);
            this.completeCell(supplyCell);
            this.closeModal();
            this.redrawMap();
            this.updateResourceDisplay();
            this.updatePartyDisplay();
          },
        };
      },
    );

    options.push({
      text: "取消",
      action: () => {
        this.closeModal();
        // 重新显示补给站弹窗
        this.showSupplyPopup(supplyCell);
      },
    });

    this.openModal(
      "深度治疗",
      "选择一名角色进行深度治疗\n\nHP 恢复到最大值\n清除当前重伤状态\n(重伤次数不减少)",
      options,
    );
  }

  private showExpeditionFailedModal(): void {
    this._victoryOverlayOpen = true;
    this.openModal("💀 远征失败", "全队重伤或死亡，无法继续远征", [
      {
        text: "返回主菜单",
        action: () => {
          this._victoryOverlayOpen = false;
          resetGameState();
          this.closeModal();
          this.scene.start("MainMenuScene");
        },
      },
    ]);
  }

  // ==================== 弹窗：奖励点 ====================

  private showRewardPopup(cell: MapCell): void {
    const rewards: Record<
      string,
      {
        name: string;
        gold: number;
        food?: number;
        caravanHp?: number;
        morale?: number;
      }
    > = {
      small: { name: "小货箱", gold: 10, food: 1 },
      medium: { name: "商队残骸", gold: 15, caravanHp: 5 },
      large: { name: "旧世界储藏箱", gold: 25, morale: 1 },
    };
    const reward = rewards[cell.rewardType || "small"];
    this.modifyGold(reward.gold);
    if (reward.food) this.modifyFood(reward.food);
    if (reward.caravanHp) this.modifyCaravanHp(reward.caravanHp);
    if (reward.morale) this.modifyMorale(reward.morale);

    const descParts = [`金币 +${reward.gold}`];
    if (reward.food) descParts.push(`食物 +${reward.food}`);
    if (reward.caravanHp) descParts.push(`商队耐久 +${reward.caravanHp}`);
    if (reward.morale) descParts.push(`士气 +${reward.morale}`);

    this.openModal(
      reward.name,
      `发现了${reward.name}！\n\n${descParts.join("\n")}`,
      [
        {
          text: "继续",
          action: () => {
            this.completeCell(cell);
            this.closeModal();
            this.redrawMap();
            this.updateResourceDisplay();
          },
        },
      ],
    );
  }

  // ==================== 资源修改方法 ====================

  private modifyFood(delta: number): void {
    const gameState = getGameState();
    gameState.food = Math.max(0, gameState.food + delta);
    setGameState(gameState);
  }

  private modifyMorale(delta: number): void {
    const gameState = getGameState();
    gameState.morale = Math.max(0, gameState.morale + delta);
    setGameState(gameState);
  }

  private modifyCaravanHp(delta: number): void {
    const gameState = getGameState();
    gameState.caravanHp = Math.max(
      0,
      Math.min(gameState.caravanMaxHp, gameState.caravanHp + delta),
    );
    setGameState(gameState);
  }

  private modifyGold(delta: number): void {
    const gameState = getGameState();
    gameState.gold = Math.max(0, gameState.gold + delta);
    setGameState(gameState);
  }

  private modifyDay(delta: number): void {
    const gameState = getGameState();
    gameState.day += delta;
    setGameState(gameState);
  }

  private healAllCharacters(amount: number): void {
    const gameState = getGameState();
    for (const id of gameState.selectedCharacters) {
      const cs = gameState.characterStates[id];
      if (!cs || cs.isDead) continue;
      cs.currentHp = Math.min(cs.def.maxHp, cs.currentHp + amount);
      console.log(
        `[地图V2] ${cs.def.name} 恢复 ${amount} HP → ${cs.currentHp}/${cs.def.maxHp}`,
      );
    }
    setGameState(gameState);
  }

  private healRandomCharacter(amount: number): void {
    console.log(`[地图V2] 随机角色恢复 ${amount} HP`);
  }

  private damageRandomCharacter(amount: number): void {
    console.log(`[地图V2] 随机角色受到 ${amount} 伤害`);
  }

  // ==================== UI 更新 ====================

  private updateResourceDisplay(): void {
    const gameState = getGameState();

    this.resourceTexts["day"].setText(
      `📅 ${gameState.day}/${gameState.maxDay}`,
    );
    this.resourceTexts["food"].setText(`🍞 ${gameState.food}`);

    const moraleColor =
      gameState.morale >= 3
        ? "#ffcc44"
        : gameState.morale > 0
          ? "#ff8844"
          : "#ff4444";
    this.resourceTexts["morale"].setText(`💪 ${gameState.morale}`);
    this.resourceTexts["morale"].setColor(moraleColor);

    const caravanColor =
      gameState.caravanHp > gameState.caravanMaxHp * 0.5
        ? "#88ccff"
        : "#ffaa44";
    this.resourceTexts["caravan"].setText(
      `🚗 ${gameState.caravanHp}/${gameState.caravanMaxHp}`,
    );
    this.resourceTexts["caravan"].setColor(caravanColor);

    this.resourceTexts["gold"].setText(`💰 ${gameState.gold}`);

    // 调试信息
    const movable = getMovableNeighbors(gameState);
    if (this.debugTexts["pos"]) {
      this.debugTexts["pos"].setText(
        `位置:(${gameState.currentPosition.x},${gameState.currentPosition.y}) 可走:${movable.length} 弹窗:${this.modalContainer ? "开" : "关"}`,
      );
    }
  }

  private createPartyDisplay(gameState: ReturnType<typeof getGameState>): void {
    this.partyDisplayContainer = this.add.container(0, 0);
    this.updatePartyDisplay();
  }

  private updatePartyDisplay(): void {
    // 清除旧显示
    if (this.partyDisplayContainer) {
      this.partyDisplayContainer.removeAll(true);
    }

    const gameState = getGameState();
    const chars = gameState.selectedCharacters;
    const spacing = 100;
    const totalWidth = (chars.length - 1) * spacing;
    const x = (this.scale.width - totalWidth) / 2;
    const startY = 45;

    chars.forEach((charId, index) => {
      const cs = gameState.characterStates[charId];
      const charDef = CHARACTER_DEFS[charId];
      const px = x + index * spacing;

      // 背景
      const bg = this.add.graphics();
      if (cs?.isDead) {
        bg.fillStyle(0x333333, 0.5);
      } else if (cs?.isWounded) {
        bg.fillStyle(0x662222, 0.5);
      } else {
        bg.fillStyle(charDef.color, 0.3);
      }
      bg.fillRect(px - 25, startY - 5, 50, 50);
      bg.lineStyle(
        2,
        cs?.isDead ? 0x444444 : cs?.isWounded ? 0xaa3333 : charDef.color,
        1,
      );
      bg.strokeRect(px - 25, startY - 5, 50, 50);
      this.partyDisplayContainer.add(bg);

      // 角色名
      this.add
        .text(px, startY + 5, charDef.name.slice(0, 2), {
          fontSize: "14px",
          color: cs?.isDead ? "#666666" : "#ffffff",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);

      // HP 或状态
      if (cs) {
        if (cs.isDead) {
          this.add
            .text(px, startY + 22, "💀离队", {
              fontSize: "10px",
              color: "#ff4444",
              fontFamily: "monospace",
            })
            .setOrigin(0.5);
        } else if (cs.isWounded) {
          this.add
            .text(px, startY + 22, `🩹${cs.restNodes}`, {
              fontSize: "10px",
              color: "#ff8844",
              fontFamily: "monospace",
            })
            .setOrigin(0.5);
        } else {
          this.add
            .text(px, startY + 22, `${cs.currentHp}/${cs.def.maxHp}`, {
              fontSize: "10px",
              color: "#88ff88",
              fontFamily: "monospace",
            })
            .setOrigin(0.5);
        }

        // 重伤次数
        if (cs.graveWounds > 0) {
          this.add
            .text(px, startY + 35, `${cs.graveWounds}/3`, {
              fontSize: "9px",
              color: cs.graveWounds >= 3 ? "#ff4444" : "#ffaa44",
              fontFamily: "monospace",
            })
            .setOrigin(0.5);
        }
      }
    });
  }

  // ==================== 游戏状态检查 ====================

  private checkGameStatus(gameState: ReturnType<typeof getGameState>): boolean {
    const gameOver = checkGameOver(gameState);
    if (gameOver.isOver) {
      this.showGameOver(gameOver.reason!);
      return true;
    }

    if (checkVictory(gameState)) {
      this.showVictory();
      return true;
    }

    return false;
  }

  private showGameOver(reason: string): void {
    const w = this.scale.width;
    const h = this.scale.height;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, w, h);

    const title = this.add
      .text(w / 2, h / 2 - 40, "💀 远征失败", {
        fontSize: "36px",
        color: "#ff4444",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const desc = this.add
      .text(w / 2, h / 2 + 10, reason, {
        fontSize: "18px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(w / 2, h / 2 + 60, "【返回主菜单】", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#444466",
        padding: { x: 20, y: 10 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive();

    btn.on("pointerdown", () => {
      resetGameState();
      this.scene.start("MainMenuScene");
    });
  }

  private showVictory(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gameState = getGameState();

    this._victoryOverlayOpen = true;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, w, h);

    const title = this.add
      .text(w / 2, h / 2 - 40, "🎉 远征胜利！", {
        fontSize: "36px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const victoryText =
      gameState.expeditionGoal === "boss"
        ? "你成功击败了首领，完成了远征！"
        : "你成功抵达了安全据点，完成了远征！";

    const desc = this.add
      .text(w / 2, h / 2 + 10, victoryText, {
        fontSize: "18px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    const btn = this.add
      .text(w / 2, h / 2 + 60, "【返回主菜单】", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#2a4a8a",
        padding: { x: 20, y: 10 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive();

    btn.on("pointerdown", () => {
      this._victoryOverlayOpen = false;
      resetGameState();
      this.scene.start("MainMenuScene");
    });
  }

  // ==================== 调试功能：T 键鼠标点击模拟测试 ====================

  /**
   * 真正的鼠标点击模拟测试。
   * 通过 Phaser Input Manager 发出真实的 pointerdown 事件，
   * 走完整个 UI 交互链路（与人类点击完全一致）。
   *
   * 流程：
   * 1. 模拟点击地图格子移动（pointerdown → setupMapPointer handler → tryMoveTo）
   * 2. 弹窗出现时，找到弹窗按钮游戏对象，emit pointerdown
   * 3. 如果进入战斗，BattleScene 中模拟点击卡牌→敌人→结束回合
   */
  private clickSimulationTest(): void {
    const gs = getGameState();
    if (gs._isClickTesting) {
      console.log("[鼠标模拟测试] 已在进行中，忽略");
      return;
    }
    gs._isClickTesting = true;
    gs._clickTestStep = 0;
    setGameState(gs);
    console.log("[鼠标模拟测试] 开始！模拟人类鼠标点击操作（30步）");
    this.clickSimStep();
  }

  private clickSimStep(): void {
    const gs = getGameState();
    const step = gs._clickTestStep;

    if (step >= 30) {
      console.log("[鼠标模拟测试] 完成！成功模拟 30 步鼠标点击");
      gs._isClickTesting = false;
      gs._clickTestStep = 0;
      setGameState(gs);
      return;
    }

    // 如果有弹窗，模拟点击弹窗按钮
    if (this.modalContainer) {
      this.clickSimModalButton(step);
      return;
    }

    // 模拟点击地图格子
    this.clickSimMapCell(step);
  }

  /** 模拟点击弹窗中的第一个按钮 */
  private clickSimModalButton(step: number): void {
    // 在 modalContainer 中找到按钮（Text 游戏对象且 interactive 的）
    const buttons: Phaser.GameObjects.Text[] = [];
    if (this.modalContainer) {
      this.modalContainer.each((child) => {
        if (child instanceof Phaser.GameObjects.Text && child.input?.enabled) {
          buttons.push(child);
        }
      });
    }

    // 判断当前是方向测试还是T键随机测试
    const gs = getGameState();
    const isDirectional = gs._isDirectionalTesting;

    if (buttons.length > 0) {
      const btn = buttons[0];
      console.log(
        `[鼠标模拟测试] step=${step} 模拟点击弹窗按钮: "${btn.text}"`,
      );

      // 保存恢复步数
      if (isDirectional) {
        gs._directionalTestResumeStep = step + 1;
      } else {
        gs._clickTestResumeStep = step + 1;
      }
      setGameState(gs);

      // 通过游戏对象的 emit 直接触发 pointerdown 事件
      btn.emit("pointerdown");

      // 延迟检查是否进入战斗
      this.time.delayedCall(500, () => {
        if (!this.scene.isActive()) {
          console.log(
            `[鼠标模拟测试] step=${step} 弹窗操作后进入战斗，等待返回...`,
          );
          return;
        }
        const gs2 = getGameState();
        if (isDirectional) {
          gs2._directionalTestResumeStep = 0;
          gs2._directionalTestStep = step + 1;
          setGameState(gs2);
          this.directionalSimStep();
        } else {
          gs2._clickTestResumeStep = 0;
          gs2._clickTestStep = step + 1;
          setGameState(gs2);
          this.clickSimStep();
        }
      });
    } else {
      console.log(`[鼠标模拟测试] step=${step} 弹窗中没有找到可点击按钮，跳过`);
      if (isDirectional) {
        gs._directionalTestStep = step + 1;
        setGameState(gs);
        this.directionalSimStep();
      } else {
        gs._clickTestStep = step + 1;
        setGameState(gs);
        this.clickSimStep();
      }
    }
  }

  /** 模拟点击地图格子（通过 Phaser pointerdown 事件） */
  private clickSimMapCell(step: number): void {
    const gameState = getGameState();
    const movable = getMovableNeighbors(gameState);

    if (movable.length === 0) {
      console.log(`[鼠标模拟测试] step=${step} 无可走格，测试结束`);
      const gs = getGameState();
      gs._isClickTesting = false;
      gs._clickTestStep = 0;
      setGameState(gs);
      return;
    }

    const target = movable[Math.floor(Math.random() * movable.length)];

    // 计算格子中心在 canvas 中的坐标
    // 格子坐标 = cellIndex * (cellSize + cellGap) + cellSize/2
    // pointer 坐标 = 格子坐标 + mapContainer 位置（因为 handleMapPointer 会减去 mapContainer 位置）
    const cellCenterX =
      target.x * (this.cellSize + this.cellGap) + this.cellSize / 2;
    const cellCenterY =
      target.y * (this.cellSize + this.cellGap) + this.cellSize / 2;

    console.log(
      `[鼠标模拟测试] step=${step + 1} 模拟点击格子 (${target.x},${target.y})`,
      `mapContainer=(${this.mapContainer.x},${this.mapContainer.y})`,
      `pointer=(${cellCenterX + this.mapContainer.x},${cellCenterY + this.mapContainer.y})`,
    );

    // 保存恢复步数
    const gs = getGameState();
    gs._clickTestResumeStep = step + 1;
    gs._clickTestStep = step + 1;
    setGameState(gs);

    // 构造模拟 pointer 对象，设置位置为格子中心在屏幕上的实际坐标
    const pointer = this.input.activePointer;
    pointer.x = cellCenterX + this.mapContainer.x;
    pointer.y = cellCenterY + this.mapContainer.y;

    // 直接调用 handleMapPointer，走完完整的坐标换算→tryMoveTo 链路
    // （与人类点击地图格子走完全相同的代码路径）
    this.handleMapPointer(pointer);

    // 延迟后检查状态
    this.time.delayedCall(300, () => {
      // 检查是否弹出了弹窗
      if (this.modalContainer) {
        console.log(
          `[鼠标模拟测试] step=${step + 1} 点击后弹出弹窗，自动点击按钮`,
        );
        this.time.delayedCall(500, () => {
          this.clickSimStep(); // clickSimStep 会检测到弹窗并点击按钮
        });
        return;
      }

      // 检查是否进入战斗
      if (!this.scene.isActive()) {
        console.log(`[鼠标模拟测试] step=${step + 1} 进入战斗，等待返回...`);
        return; // BattleScene 的 clickSimAutoBattle 会处理战斗，返回后 create 中恢复
      }

      // 正常继续
      const gs2 = getGameState();
      gs2._clickTestResumeStep = 0;
      setGameState(gs2);
      this.clickSimStep();
    });
  }

  // ==================== 调试功能：Y 键自动 200 步 ====================

  private autoMoveTest(): void {
    const gs = getGameState();
    if (gs._isAutoMoving) {
      console.log("[地图V2] 自动移动测试已在进行中，忽略");
      return;
    }

    gs._isAutoMoving = true;
    gs._debugStep = 0;
    setGameState(gs);
    console.log("[地图V2] 开始自动移动测试（200步）");

    this.autoMoveStep(0);
  }

  private autoMoveStep(step: number): void {
    if (step >= 200) {
      console.log("[地图V2] 自动移动测试完成！成功执行 200 步");
      const gs = getGameState();
      gs._isAutoMoving = false;
      gs._autoMoveResumeStep = 0;
      gs._autoMovePrevPos = null;
      setGameState(gs);
      return;
    }

    // 如果有弹窗，先执行弹窗 action
    if (this.modalContainer) {
      console.log(`[地图压力测试] step=${step} 检测到弹窗，自动执行第一个选项`);
      // 保存恢复步数（弹窗 action 可能触发战斗）
      const gs = getGameState();
      gs._autoMoveResumeStep = step + 1;
      setGameState(gs);

      this.executeFirstModalAction();

      // 延迟检查是否进入战斗
      this.time.delayedCall(300, () => {
        if (!this.scene.isActive()) {
          console.log(
            `[地图压力测试] step=${step} 弹窗操作导致进入战斗，等待返回...`,
          );
          return;
        }
        // 没有进入战斗，继续
        const gs2 = getGameState();
        gs2._autoMoveResumeStep = 0;
        setGameState(gs2);
        this.autoMoveStep(step + 1);
      });
      return;
    }

    const gameState = getGameState();
    let movable = getMovableNeighbors(gameState);

    // 卡死兜底：如果 movableCount=0 但四周存在非障碍格
    if (movable.length === 0) {
      const { x, y } = gameState.currentPosition;
      const dirs = [
        { name: "上", dx: 0, dy: -1 },
        { name: "下", dx: 0, dy: 1 },
        { name: "左", dx: -1, dy: 0 },
        { name: "右", dx: 1, dy: 0 },
      ];

      // 打印四周状态
      for (const dir of dirs) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (
          nx >= 0 &&
          nx < gameState.mapWidth &&
          ny >= 0 &&
          ny < gameState.mapHeight
        ) {
          const c = gameState.mapCells[ny][nx];
          console.log(
            `[地图压力测试]   ${dir.name} (${nx},${ny}): type=${c.type} obstacle=${c.type === "obstacle"}`,
          );
        }
      }

      // 检查是否有非障碍格但 canMoveTo 返回 false 的情况
      const nonObstacleNeighbors: { x: number; y: number }[] = [];
      for (const dir of dirs) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (
          nx >= 0 &&
          nx < gameState.mapWidth &&
          ny >= 0 &&
          ny < gameState.mapHeight &&
          gameState.mapCells[ny][nx].type !== "obstacle"
        ) {
          nonObstacleNeighbors.push({ x: nx, y: ny });
        }
      }

      if (nonObstacleNeighbors.length > 0) {
        console.log(`[地图错误] movableCount=0，但周围存在非障碍格，自动修复`);
        // 允许移动到任意相邻非障碍格
        movable = nonObstacleNeighbors;
      } else {
        console.log(`[地图压力测试] step=${step + 1} 真正的死胡同，无法继续`);
        const gs = getGameState();
        gs._isAutoMoving = false;
        gs._autoMoveResumeStep = 0;
        gs._autoMovePrevPos = null;
        setGameState(gs);
        return;
      }
    }

    // 每 10 步打印日志
    if ((step + 1) % 10 === 0 || step === 0) {
      console.log(
        `[地图压力测试] step=${step + 1}`,
        `current=(${gameState.currentPosition.x},${gameState.currentPosition.y})`,
        `movableCount=${movable.length}`,
        `day=${gameState.day}`,
      );
    }

    // 随机选择一个可移动格（尽量避免立即走回上一步）
    const prevPos = gameState._autoMovePrevPos;
    let candidates = movable;
    if (movable.length > 1 && prevPos) {
      candidates = movable.filter(
        (m) => !(m.x === prevPos.x && m.y === prevPos.y),
      );
    }
    const target = candidates[Math.floor(Math.random() * candidates.length)];

    // 记录当前位置，供下一步避免走回
    const gsBeforeMove = getGameState();
    gsBeforeMove._autoMovePrevPos = {
      x: gsBeforeMove.currentPosition.x,
      y: gsBeforeMove.currentPosition.y,
    };
    setGameState(gsBeforeMove);

    // 统一调用 tryMoveTo（内部已处理自动测试跳过战斗逻辑）
    this.tryMoveTo(target.x, target.y);

    // 检查移动后是否弹出了新弹窗（非自动测试弹窗应该不会出现）
    if (this.modalContainer) {
      // 保存恢复步数
      const gsSave = getGameState();
      gsSave._autoMoveResumeStep = step + 1;
      setGameState(gsSave);

      // 下一轮会处理弹窗
      this.time.delayedCall(300, () => {
        if (!this.scene.isActive()) {
          console.log(`[地图压力测试] step=${step + 1} 进入战斗，等待返回...`);
          return;
        }
        const gs2 = getGameState();
        gs2._autoMoveResumeStep = 0;
        setGameState(gs2);
        this.autoMoveStep(step + 1);
      });
      return;
    }

    // 没有弹窗，检查是否进入战斗（scene 切换了）
    const gsSave = getGameState();
    gsSave._autoMoveResumeStep = step + 1;
    setGameState(gsSave);

    this.time.delayedCall(100, () => {
      if (!this.scene.isActive()) {
        console.log(`[地图压力测试] step=${step + 1} 进入战斗，等待返回...`);
        return;
      }
      const gs2 = getGameState();
      gs2._autoMoveResumeStep = 0;
      setGameState(gs2);
      this.autoMoveStep(step + 1);
    });
  }

  // ==================== 调试功能：G 键方向模拟测试（走向右上角） ====================

  private directionalClickTest(): void {
    const gs = getGameState();
    if (gs._isDirectionalTesting) {
      console.log("[方向模拟测试] 已在进行中，忽略");
      return;
    }
    // 同时关闭T键测试（避免冲突）
    if (gs._isClickTesting) {
      gs._isClickTesting = false;
      gs._clickTestStep = 0;
      gs._clickTestResumeStep = 0;
    }
    gs._isDirectionalTesting = true;
    gs._directionalTestStep = 0;
    gs._directionalTestMaxSteps = 200;
    setGameState(gs);
    console.log("[方向模拟测试] 开始！目标：地图右上角，最多200步");
    this.directionalSimStep();
  }

  private directionalSimStep(): void {
    const gs = getGameState();
    const step = gs._directionalTestStep;
    const maxSteps = gs._directionalTestMaxSteps || 200;
    const pos = gs.currentPosition;

    if (step >= maxSteps) {
      console.log(`[方向模拟测试] ⛔ 达到最大步数 ${maxSteps}，测试结束`);
      gs._isDirectionalTesting = false;
      gs._directionalTestStep = 0;
      setGameState(gs);
      return;
    }

    // 检查是否已到达右上角区域 (x >= 17, y <= 2)
    if (pos.x >= 17 && pos.y <= 2) {
      console.log(
        `[方向模拟测试] ✅ 已到达右上角区域 (${pos.x},${pos.y})，` +
          `共 ${step} 步，测试结束！`,
      );
      gs._isDirectionalTesting = false;
      gs._directionalTestStep = 0;
      setGameState(gs);
      return;
    }

    // 如果有弹窗，模拟点击弹窗按钮
    if (this.modalContainer) {
      this.clickSimModalButton(step);
      return;
    }

    // 获取可移动的相邻格子
    const movable = getMovableNeighbors(gs);
    if (movable.length === 0) {
      console.log(
        `[方向模拟测试] step=${step} ⛔ 无可走格 ` +
          `当前位置=(${pos.x},${pos.y})，测试结束`,
      );
      gs._isDirectionalTesting = false;
      gs._directionalTestStep = 0;
      setGameState(gs);
      return;
    }

    // 使用 BFS 选择下一步
    const target = this.pickDirectionalTarget(movable, pos);

    if (!target) {
      console.log(
        `[方向模拟测试] step=${step + 1} ⛔ BFS 无路径，` +
          `当前位置=(${pos.x},${pos.y})，测试结束`,
      );
      gs._isDirectionalTesting = false;
      gs._directionalTestStep = 0;
      gs._directionalTestResumeStep = 0;
      setGameState(gs);
      return;
    }

    console.log(
      `[方向模拟测试] step=${step + 1}/${maxSteps} ` +
        `(${pos.x},${pos.y}) → (${target.x},${target.y}) ` +
        `目标区域: x≥17,y≤2`,
    );

    // 保存恢复步数
    gs._directionalTestResumeStep = step + 1;
    gs._directionalTestStep = step + 1;
    setGameState(gs);

    // 模拟点击格子
    const cellCenterX =
      target.x * (this.cellSize + this.cellGap) + this.cellSize / 2;
    const cellCenterY =
      target.y * (this.cellSize + this.cellGap) + this.cellSize / 2;
    const pointer = this.input.activePointer;
    pointer.x = cellCenterX + this.mapContainer.x;
    pointer.y = cellCenterY + this.mapContainer.y;
    this.handleMapPointer(pointer);

    // 延迟后检查状态
    this.time.delayedCall(300, () => {
      if (this.modalContainer) {
        console.log(`[方向模拟测试] step=${step + 1} 弹出弹窗，自动点击`);
        this.time.delayedCall(500, () => {
          this.directionalSimStep();
        });
        return;
      }

      // 检查是否进入战斗
      if (!this.scene.isActive()) {
        console.log(`[方向模拟测试] step=${step + 1} ⚔️ 进入战斗，等待返回...`);
        return; // BattleScene 的 clickSimAutoBattle 会处理
      }

      // 正常继续
      const gs2 = getGameState();
      gs2._directionalTestResumeStep = 0;
      setGameState(gs2);
      this.directionalSimStep();
    });
  }

  // ==================== BFS 寻路工具函数 ====================

  /** BFS 判断格子是否可行走（用于寻路，不限于相邻） */
  private isWalkable(x: number, y: number): boolean {
    const gs = getGameState();
    if (x < 0 || y < 0 || x >= gs.mapWidth || y >= gs.mapHeight) return false;
    return gs.mapCells[y][x].type !== "obstacle";
  }

  /**
   * BFS 寻路：从当前位置搜索通往目标区域的最短路径，返回第一步坐标。
   * @param current 当前位置
   * @param movable 当前可移动的相邻格子（作为 BFS 起点）
   * @param targetPredicate 目标判定函数，返回 true 表示到达目标
   * @returns 第一步坐标，如果找不到路径返回 null
   */
  private findPathToTargetArea(
    current: { x: number; y: number },
    movable: Array<{ x: number; y: number }>,
    targetPredicate: (x: number, y: number) => boolean,
  ): { x: number; y: number; pathLen: number } | null {
    const visited = new Set<string>();
    const queue: Array<{
      x: number;
      y: number;
      firstStep: { x: number; y: number } | null;
      depth: number;
    }> = [];

    visited.add(`${current.x},${current.y}`);

    for (const m of movable) {
      const key = `${m.x},${m.y}`;
      visited.add(key);
      queue.push({ x: m.x, y: m.y, firstStep: { x: m.x, y: m.y }, depth: 1 });
    }

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    while (queue.length > 0) {
      const node = queue.shift()!;

      if (targetPredicate(node.x, node.y)) {
        return {
          x: node.firstStep!.x,
          y: node.firstStep!.y,
          pathLen: node.depth,
        };
      }

      for (const dir of dirs) {
        const nx = node.x + dir.dx;
        const ny = node.y + dir.dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!this.isWalkable(nx, ny)) continue;
        visited.add(key);
        queue.push({
          x: nx,
          y: ny,
          firstStep: node.firstStep,
          depth: node.depth + 1,
        });
      }
    }

    return null; // 无路径
  }

  /**
   * 方向模拟测试：选择下一步移动目标。
   * 使用 BFS 寻路。找不到路径时返回 null，由调用方安全停止。
   */
  private pickDirectionalTarget(
    movable: Array<{ x: number; y: number }>,
    current: { x: number; y: number },
  ): { x: number; y: number } | null {
    const firstStep = this.findPathToTargetArea(
      current,
      movable,
      (x, y) => x >= 17 && y <= 2,
    );

    if (firstStep) {
      console.log(
        `[方向模拟BFS] 路径长度=${firstStep.pathLen}步，第一步: (${firstStep.x},${firstStep.y})`,
      );
      return { x: firstStep.x, y: firstStep.y };
    }

    console.log("[方向模拟BFS] 未找到通往目标的路径，停止方向模拟");
    return null;
  }

  // ==================== 牌组查看界面（阶段4.1） ====================

  /** 显示牌组查看界面 */
  private showDeckViewer(): void {
    // Bug 3: 防止重复打开叠加多层UI
    if (this._deckViewerOpen) {
      this._deckViewerClose?.();
      this._deckViewerOpen = false;
    }

    this._deckViewerOpen = true;

    const w = this.scale.width;
    const h = this.scale.height;
    const gameState = getGameState();

    console.log("[牌组查看] 打开牌组查看界面");

    // 半透明遮罩
    const overlay = this.add
      .rectangle(w / 2, h / 2, w, h, 0x000000, 0.85)
      .setDepth(200);

    // 标题
    const title = this.add
      .text(w / 2, 40, "牌组查看", {
        fontSize: "28px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(201);

    // 关闭提示
    const closeHint = this.add
      .text(w / 2, h - 30, "按 V 或 ESC 关闭", {
        fontSize: "16px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(201);

    // 角色列表
    const characters = gameState.selectedCharacters.map((id) => ({
      id,
      state: gameState.characterStates[id],
      def: CHARACTER_DEFS[id],
    }));

    const startY = 80;
    const charHeight = 180;
    const colWidth = w / characters.length;

    const charContainers: Phaser.GameObjects.Container[] = [];

    characters.forEach((char, idx) => {
      const centerX = colWidth * idx + colWidth / 2;
      const container = this.add.container(centerX, startY).setDepth(201);
      charContainers.push(container);

      // 角色名
      const nameColor = char.state?.isDead
        ? "#666666"
        : char.state?.isWounded
          ? "#ff6666"
          : "#ffffff";
      const nameText = this.add
        .text(0, 0, char.def.name, {
          fontSize: "22px",
          color: nameColor,
          fontFamily: "monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      container.add(nameText);

      // HP 和状态
      const hp = char.state?.currentHp ?? char.def.maxHp;
      const maxHp = char.def.maxHp;
      let statusText = `HP: ${hp}/${maxHp}`;
      if (char.state?.isDead) {
        statusText += " [死亡]";
      } else if (char.state?.isWounded) {
        statusText += ` [重伤 restNodes=${char.state.restNodes}]`;
      }
      const gw = char.state?.graveWounds ?? 0;
      if (gw > 0) {
        statusText += ` 重伤次数:${gw}/3`;
      }

      const hpText = this.add
        .text(0, 28, statusText, {
          fontSize: "14px",
          color: char.state?.isDead
            ? "#666666"
            : char.state?.isWounded
              ? "#ff6666"
              : "#88ff88",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);
      container.add(hpText);

      // 牌组数量
      const deck = char.state?.deck ?? [];
      const deckCountText = this.add
        .text(0, 50, `牌组: ${deck.length}张`, {
          fontSize: "16px",
          color: "#ffcc44",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);
      container.add(deckCountText);

      // 卡牌列表（最多显示10张）
      const maxShow = 10;
      const cardsToShow = deck.slice(0, maxShow);
      const cardStartY = 75;

      // 统计同名卡数量，用于 instanceId 区分
      const nameCount: Record<string, number> = {};
      for (const c of deck) {
        nameCount[c.name] = (nameCount[c.name] || 0) + 1;
      }

      cardsToShow.forEach((card, cardIdx) => {
        const cardColor = card.upgraded ? "#44ff88" : "#cccccc";
        // 同名卡多张时，附加 instanceId 后4位用于区分
        let cardLabel = card.name;
        if (nameCount[card.name] > 1 && card.instanceId) {
          const suffix = card.instanceId.slice(-4);
          cardLabel = `${card.name} #${suffix}`;
        }
        const cardText = this.add
          .text(0, cardStartY + cardIdx * 18, `⚡${card.cost} ${cardLabel}`, {
            fontSize: "12px",
            color: cardColor,
            fontFamily: "monospace",
          })
          .setOrigin(0.5);
        container.add(cardText);
      });

      // 如果卡牌超过 maxShow，显示省略
      if (deck.length > maxShow) {
        const moreText = this.add
          .text(
            0,
            cardStartY + maxShow * 18,
            `... 还有 ${deck.length - maxShow} 张`,
            {
              fontSize: "12px",
              color: "#888888",
              fontFamily: "monospace",
            },
          )
          .setOrigin(0.5);
        container.add(moreText);
      }

      // 打印到控制台（含 instanceId 便于测试验证）
      console.log(
        `[牌组] ${char.def.name} deck=${deck.length}: ${deck.map((c) => {
          if (nameCount[c.name] > 1) {
            return `${c.name}#${c.instanceId?.slice(-4) ?? "????"}`;
          }
          return c.name;
        }).join(", ")}`,
      );
    });

    // 关闭函数
    const closeViewer = () => {
      overlay.destroy();
      title.destroy();
      closeHint.destroy();
      charContainers.forEach((c) => c.destroy());
    };

    // Bug 2: 存储关闭函数，由 setupKeyboard 统一处理按键关闭
    this._deckViewerClose = () => {
      closeViewer();
      this._deckViewerOpen = false;
      this._deckViewerClose = undefined;
      console.log("[牌组查看] 已关闭，UI 对象已销毁");
    };
  }

  /** 显示商队部件查看界面（阶段6） */
  private showCaravanPartsViewer(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gameState = getGameState();
    const parts = gameState.caravanParts;

    // 遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, w, h);
    overlay.setDepth(200);

    // 标题
    const title = this.add
      .text(w / 2, 30, `🔧 商队部件 (${parts.length})`, {
        fontSize: "24px",
        color: "#ffcc44",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(210);

    // 关闭提示
    const closeHint = this.add
      .text(w / 2, h - 20, "按 N 或 ESC 关闭", {
        fontSize: "14px",
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(210);

    if (parts.length === 0) {
      const emptyText = this.add
        .text(w / 2, h / 2, "暂无商队部件\n\n精英战斗胜利可获得", {
          fontSize: "18px",
          color: "#888888",
          fontFamily: "monospace",
          align: "center",
        })
        .setOrigin(0.5)
        .setDepth(210);

      // 3秒后自动关闭
      this.time.delayedCall(3000, () => {
        overlay.destroy();
        title.destroy();
        closeHint.destroy();
        emptyText.destroy();
      });
      return;
    }

    // 部件列表
    const triggerNames: Record<string, string> = {
      passive: "被动",
      battle_start: "战斗开始",
      battle_end: "战斗结束",
      map_move: "地图移动",
      card_play: "卡牌打出",
      supply_repair: "补给修复",
    };

    const partContainers: Phaser.GameObjects.Container[] = [];
    const startY = 80;
    const lineHeight = 60;

    parts.forEach((part, index) => {
      const y = startY + index * lineHeight;
      const container = this.add.container(50, y).setDepth(210);

      // 背景框
      const bg = this.add.graphics();
      bg.fillStyle(0x2a2a4a, 1);
      bg.fillRoundedRect(0, 0, w - 100, 50, 8);
      bg.lineStyle(2, 0xffcc44, 0.5);
      bg.strokeRoundedRect(0, 0, w - 100, 50, 8);
      container.add(bg);

      // 部件名称
      const nameText = this.add
        .text(15, 8, part.name, {
          fontSize: "18px",
          color: "#ffcc44",
          fontStyle: "bold",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0);
      container.add(nameText);

      // 触发类型标签
      const triggerText = this.add
        .text(w - 115, 8, `[${triggerNames[part.trigger] || part.trigger}]`, {
          fontSize: "12px",
          color: "#888888",
          fontFamily: "monospace",
        })
        .setOrigin(1, 0);
      container.add(triggerText);

      // 描述
      const descText = this.add
        .text(15, 28, part.description, {
          fontSize: "13px",
          color: "#cccccc",
          fontFamily: "monospace",
          wordWrap: { width: w - 130 },
        })
        .setOrigin(0, 0);
      container.add(descText);

      partContainers.push(container);
    });

    // 打印到控制台
    console.log(`[部件] 当前拥有 ${parts.length} 个部件:`);
    parts.forEach((p) => {
      console.log(`  - ${p.name} [${p.trigger}]: ${p.description}`);
    });

    // 3秒后自动关闭
    this.time.delayedCall(5000, () => {
      overlay.destroy();
      title.destroy();
      closeHint.destroy();
      partContainers.forEach((c) => c.destroy());
      console.log("[部件查看] 已关闭");
    });
  }

  // ==================== 阶段5：补给点卡牌升级/删除 ====================

  /**
   * 升级一张卡牌：复制卡牌对象，增强数值，标记 upgraded
   * 不修改 ALL_CARDS 原始定义，只修改角色 deck 中的副本
   */
  private upgradeCard(card: CardDef): CardDef {
    const upgradedCard: CardDef = {
      ...card,
      // 保留原 id 和 instanceId，不生成 _up 后缀（避免同名卡升级后 id 重复）
      name: `${card.name}+`,
      upgraded: true,
      effects: card.effects.map((eff) => {
        // 攻击/治疗/护甲/修理类 value +3
        if (
          eff.type === "damage" ||
          eff.type === "heal" ||
          eff.type === "armor" ||
          eff.type === "repair_caravan"
        ) {
          return { ...eff, value: eff.value + 3 };
        }
        // 标记/抽牌/特殊类保持不变
        return { ...eff };
      }),
    };

    // 更新描述：把数值替换为升级后的值
    const descMap: Record<string, string> = {};
    for (const eff of upgradedCard.effects) {
      if (
        eff.type === "damage" ||
        eff.type === "heal" ||
        eff.type === "armor" ||
        eff.type === "repair_caravan"
      ) {
        descMap[eff.type] = String(eff.value);
      }
    }
    // 简单替换描述中的数字（第一版不追求完美）
    let newDesc = card.description;
    if (descMap["damage"]) {
      newDesc = newDesc.replace(
        /造成\d+点伤害/,
        `造成${descMap["damage"]}点伤害`,
      );
    }
    if (descMap["heal"]) {
      newDesc = newDesc.replace(/恢复\d+点/, `恢复${descMap["heal"]}点`);
      newDesc = newDesc.replace(
        /恢复生命最低的可上场角色\d+点/,
        `恢复生命最低的可上场角色${descMap["heal"]}点`,
      );
    }
    if (descMap["armor"]) {
      newDesc = newDesc.replace(
        /获得\d+点护甲/,
        `获得${descMap["armor"]}点护甲`,
      );
      newDesc = newDesc.replace(/获得6点护甲/, `获得${descMap["armor"]}点护甲`);
    }
    if (descMap["repair_caravan"]) {
      newDesc = newDesc.replace(
        /恢复\d+点/,
        `恢复${descMap["repair_caravan"]}点`,
      );
    }
    upgradedCard.description = newDesc;

    return upgradedCard;
  }

  /** 升级卡牌 - 步骤1：选择角色 */
  private showUpgradeCardSelectCharacter(supplyCell: MapCell): void {
    const gameState = getGameState();
    const aliveChars = gameState.selectedCharacters.filter((id) => {
      const cs = gameState.characterStates[id];
      return cs && !cs.isDead;
    });

    const options: { text: string; action: () => void }[] = aliveChars.map(
      (id) => {
        const cs = gameState.characterStates[id];
        const upgradableCount = cs.deck.filter((c) => !c.upgraded).length;
        return {
          text: `${cs.def.name} (可升级: ${upgradableCount}张)`,
          action: () => {
            this.showUpgradeCardSelectCard(id, supplyCell);
          },
        };
      },
    );

    options.push({
      text: "取消",
      action: () => {
        this.closeModal();
        this.showSupplyPopup(supplyCell);
      },
    });

    this.openModal("升级卡牌 - 选择角色", "选择要升级卡牌的角色", options);
  }

  /** 升级卡牌 - 步骤2：选择卡牌 */
  private showUpgradeCardSelectCard(charId: string, supplyCell: MapCell): void {
    const gameState = getGameState();
    const cs =
      gameState.characterStates[
        charId as keyof typeof gameState.characterStates
      ];
    if (!cs) return;

    // 构建卡牌列表描述（带 deck 原始索引）
    const upgradableWithIndex: { card: CardDef; deckIndex: number }[] = [];
    cs.deck.forEach((c, idx) => {
      if (!c.upgraded) {
        upgradableWithIndex.push({ card: c, deckIndex: idx });
      }
    });

    if (upgradableWithIndex.length === 0) {
      this.openModal("升级卡牌", `${cs.def.name} 没有可升级的卡牌`, [
        {
          text: "返回",
          action: () => {
            this.closeModal();
            this.showSupplyPopup(supplyCell);
          },
        },
      ]);
      return;
    }

    // 构建卡牌列表描述
    const cardLines = upgradableWithIndex
      .map(
        ({ card }, i) =>
          `${i + 1}. ⚡${card.cost} ${card.name} [${card.type}] ${card.description}`,
      )
      .join("\n");

    const options: { text: string; action: () => void }[] =
      upgradableWithIndex.map(({ card }, index) => ({
        text: `${index + 1}. ${card.name}`,
        action: () => {
          // 先弹出确认框，不直接升级
          const upgradedCard = this.upgradeCard(card);
          this.openModal(
            "确认升级",
            `确认升级 ${cs.def.name} 的【${card.name}】为【${upgradedCard.name}】吗？`,
            [
              {
                text: "确认升级",
                action: () => {
                  // 按 instanceId 精确定位
                  const targetIdx = cs.deck.findIndex((c) => c.instanceId === card.instanceId);
                  if (targetIdx === -1) {
                    console.warn(`[补给] 升级失败: instanceId=${card.instanceId} 在deck中未找到`);
                    return;
                  }
                  cs.deck[targetIdx] = upgradedCard;
                  setGameState(gameState);
                  console.log(
                    `[补给] 升级卡牌: ${cs.def.name} ${card.name} → ${upgradedCard.name}`,
                  );
                  console.log(
                    `[牌组] ${cs.def.name} deck=${cs.deck.length}: ${cs.deck.map((c) => c.name).join(", ")}`,
                  );
                  // 显示升级结果后，返回补给点菜单
                  this.openModal(
                    "升级成功",
                    `${cs.def.name} 的 ${card.name} 已升级为 ${upgradedCard.name}\n\n${upgradedCard.description}`,
                    [
                      {
                        text: "返回补给点",
                        action: () => {
                          this.closeModal();
                          this.showSupplyPopup(supplyCell);
                        },
                      },
                    ],
                  );
                },
              },
              {
                text: "取消",
                action: () => {
                  // 返回该角色可升级列表
                  this.closeModal();
                  this.showUpgradeCardSelectCard(charId, supplyCell);
                },
              },
            ],
          );
        },
      }));

    options.push({
      text: "取消",
      action: () => {
        this.closeModal();
        this.showSupplyPopup(supplyCell);
      },
    });

    this.openTextModal(
      `升级卡牌 - ${cs.def.name}`,
      `选择要升级的卡牌：\n\n${cardLines}`,
      options,
    );
  }

  /** 删除卡牌 - 步骤1：选择角色 */
  private showDeleteCardSelectCharacter(supplyCell: MapCell): void {
    const gameState = getGameState();
    const aliveChars = gameState.selectedCharacters.filter((id) => {
      const cs = gameState.characterStates[id];
      return cs && !cs.isDead;
    });

    const options: { text: string; action: () => void }[] = aliveChars.map(
      (id) => {
        const cs = gameState.characterStates[id];
        return {
          text: `${cs.def.name} (牌组: ${cs.deck.length}张)`,
          action: () => {
            this.showDeleteCardSelectCard(id, supplyCell);
          },
        };
      },
    );

    options.push({
      text: "取消",
      action: () => {
        this.closeModal();
        this.showSupplyPopup(supplyCell);
      },
    });

    this.openModal("删除卡牌 - 选择角色", "选择要删除卡牌的角色", options);
  }

  /** 删除卡牌 - 步骤2：选择卡牌 */
  private showDeleteCardSelectCard(charId: string, supplyCell: MapCell): void {
    const gameState = getGameState();
    const cs =
      gameState.characterStates[
        charId as keyof typeof gameState.characterStates
      ];
    if (!cs) return;

    if (cs.deck.length === 0) {
      this.openModal("删除卡牌", `${cs.def.name} 的牌组为空`, [
        {
          text: "返回",
          action: () => {
            this.closeModal();
            this.showSupplyPopup(supplyCell);
          },
        },
      ]);
      return;
    }

    // 构建卡牌列表描述
    const cardLines = cs.deck
      .map(
        (c, i) =>
          `${i + 1}. ⚡${c.cost} ${c.name} [${c.type}] ${c.description}`,
      )
      .join("\n");

    const options: { text: string; action: () => void }[] = cs.deck.map(
      (card, index) => ({
        text: `${index + 1}. ${card.name}`,
        action: () => {
          // 先弹出确认框，不直接删除
          this.openModal(
            "确认删除",
            `确认删除 ${cs.def.name} 的【${card.name}】吗？`,
            [
              {
                text: "确认删除",
                action: () => {
                  // 按 instanceId 精确定位删除
                  const targetIdx = cs.deck.findIndex((c) => c.instanceId === card.instanceId);
                  if (targetIdx === -1) {
                    console.warn(`[补给] 删除失败: instanceId=${card.instanceId} 在deck中未找到`);
                    return;
                  }
                  const removedCard = cs.deck.splice(targetIdx, 1)[0];
                  setGameState(gameState);
                  console.log(
                    `[牌组] ${cs.def.name} 删除卡牌：${removedCard.name}，当前 deck=${cs.deck.length}`,
                  );
                  console.log(
                    `[牌组] ${cs.def.name} deck=${cs.deck.length}: ${cs.deck.map((c) => c.name).join(", ")}`,
                  );
                  // 显示删除结果后，返回补给点菜单
                  this.openModal(
                    "删除成功",
                    `${cs.def.name} 的 ${removedCard.name} 已从牌组移除\n当前牌组: ${cs.deck.length} 张`,
                    [
                      {
                        text: "返回补给点",
                        action: () => {
                          this.closeModal();
                          this.showSupplyPopup(supplyCell);
                        },
                      },
                    ],
                  );
                },
              },
              {
                text: "取消",
                action: () => {
                  // 返回该角色牌组列表
                  this.closeModal();
                  this.showDeleteCardSelectCard(charId, supplyCell);
                },
              },
            ],
          );
        },
      }),
    );

    options.push({
      text: "取消",
      action: () => {
        this.closeModal();
        this.showSupplyPopup(supplyCell);
      },
    });

    this.openTextModal(
      `删除卡牌 - ${cs.def.name}`,
      `选择要删除的卡牌：\n\n${cardLines}`,
      options,
    );
  }

  /**
   * 创建撤退按钮（阶段8.9）
   */
  private createRetreatButton(): void {
    const btnX = 10;
    const btnY = this.scale.height - 50;
    const btnW = 80;
    const btnH = 36;

    const bg = this.add.rectangle(btnX + btnW / 2, btnY, btnW, btnH, 0x2a1a1a, 0.9)
      .setStrokeStyle(2, 0x8a4a4a)
      .setInteractive({ useHandCursor: true })
      .setDepth(200);

    const text = this.add.text(btnX + btnW / 2, btnY, "撤退", {
      fontSize: "14px",
      color: "#d8a8a8",
      fontFamily: "sans-serif",
    }).setOrigin(0.5).setDepth(201);

    bg.on("pointerover", () => bg.setFillStyle(0x4a2a2a));
    bg.on("pointerout", () => bg.setFillStyle(0x2a1a1a));
    bg.on("pointerdown", () => this.handleRetreat());
  }

  /**
   * 处理撤退（阶段8.9/10.1）
   */
  private handleRetreat(): void {
    const gs = getGameState();
    
    // 计算撤退成本
    const retreatCheck = checkRetreatCost(
      gs.currentPosition,
      gs.startPosition,
      gs.food // 使用food作为补给
    );

    // 获取撤退文本提示
    const costLines = getRetreatCostText(retreatCheck);

    // 显示确认弹窗
    this.openModal(
      "确认撤退",
      costLines.join("\n"),
      [
        {
          text: "确认撤退",
          action: () => this.executeRetreat(retreatCheck)
        },
        {
          text: "取消",
          action: () => this.closeModal()
        }
      ]
    );
  }

  /**
   * 执行撤退（阶段10.1）
   */
  private executeRetreat(retreatCheck: RetreatCostCheck): void {
    const gs = getGameState();

    // 根据撤退结果决定消耗多少补给
    if (retreatCheck.canRetreatSafely) {
      gs.food = Math.max(0, gs.food - retreatCheck.retreatSupplyCost);
    } else {
      // 补给不足时仍然消耗所有补给
      gs.food = 0;
    }

    // 获取订单时间状态（阶段10.2）
    const orderTimeState = gs.selectedOrderId ? gs.orderTimeStates[gs.selectedOrderId] : undefined;

    // 阶段10.3：处理未完成订单
    if (gs.selectedOrderId) {
      const isCompleted = gs.completedOrderIds && gs.completedOrderIds.includes(gs.selectedOrderId);
      if (!isCompleted) {
        addUnfinishedOrder(gs.selectedOrderId);
      }
    }

    // 创建撤退结果
    const result = createRetreatedExpeditionResult({
      cargo: gs.cargo,
      selectedOrderId: gs.selectedOrderId,
      retreatResultData: {
        retreatResultType: retreatCheck.resultType,
        retreatSupplyCost: retreatCheck.retreatSupplyCost,
        currentSupply: retreatCheck.currentSupply,
        shortage: retreatCheck.shortage,
      },
      orderTimeState,
    });

    gs.lastExpeditionResult = result;
    gs.embers += result.embersGained;
    setGameState(gs);

    console.log(`[MapScene] 撤退: 火种+${result.embersGained}, 结果: ${retreatCheck.resultType}`);

    // 关闭弹窗（防止弹窗残留到下一局）
    if (this.modalContainer) {
      this.modalContainer.destroy(true);
      this.modalContainer = undefined;
    }

    this.scene.start("ExpeditionResultScene");
  }
}
