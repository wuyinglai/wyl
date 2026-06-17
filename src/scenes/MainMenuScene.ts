import Phaser from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import { applyPassiveCityRevival } from "../systems/cityRevivalSystem";

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MainMenuScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, w, h);

    // 装饰性边框
    const border = this.add.graphics();
    border.lineStyle(3, 0x4488ff, 0.5);
    border.strokeRect(20, 20, w - 40, h - 40);

    // 标题
    this.add
      .text(w / 2, h * 0.3, "《余烬商队》", {
        fontSize: "64px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // 副标题
    this.add
      .text(w / 2, h * 0.42, "Ember Caravan", {
        fontSize: "24px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 开始按钮
    const startBtn = this.add
      .text(w / 2, h * 0.6, "开始远征", {
        fontSize: "32px",
        color: "#ffffff",
        backgroundColor: "#2a4a8a",
        padding: { x: 40, y: 15 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // 按钮悬停效果
    startBtn.on("pointerover", () => {
      startBtn.setStyle({ backgroundColor: "#3a6aca" });
    });

    startBtn.on("pointerout", () => {
      startBtn.setStyle({ backgroundColor: "#2a4a8a" });
    });

    startBtn.on("pointerdown", () => {
      this.resetGameStateForNewRun();
      this.scene.start("TownScene");
    });

    // 版本信息
    this.add
      .text(w / 2, h - 40, "阶段 2 - 地图探索原型", {
        fontSize: "14px",
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 键盘快捷键（备用触发方式）
    this.input.keyboard?.on("keydown-ENTER", () => {
      this.resetGameStateForNewRun();
      this.scene.start("TownScene");
    });

    console.log("[主菜单] 主菜单场景已加载");
  }

  /**
   * 重置游戏状态，防止跨局污染
   * 保留持久化数据（completedOrderIds, cityContributions, embers, orderTimeStates, unfinishedOrderIds）
   * 清空每局临时状态（cargo, silver, selectedRouteId, selectedCityId, selectedOrderId, lastExpeditionResult 等）
   */
  private resetGameStateForNewRun(): void {
    const gs = getGameState();
    // 保存需要保留的状态
    const orderTimeStates = gs.orderTimeStates;
    const unfinishedOrderIds = gs.unfinishedOrderIds;
    const completedOrderIds = gs.completedOrderIds;
    const cityContributions = gs.cityContributions;
    const embers = gs.embers;
    // 城市复兴状态（阶段13.1）：跨局保留，先递增轮次再触发被动自建
    const cityRevivalStates = gs.cityRevivalStates;
    gs.expeditionCycle += 1;
    const runId = String(gs.expeditionCycle);
    gs.cityRevivalStates = applyPassiveCityRevival(cityRevivalStates, runId);
    // 清空每局临时状态
    gs.cargo = {};
    gs.silver = 50;
    gs.selectedRouteId = null;
    gs.selectedCityId = null;
    gs.selectedOrderId = null;
    gs.lastExpeditionResult = null;
    gs.currentPosition = { x: 0, y: 0 };
    gs.currentBattleType = null;
    gs.currentBattleNodePosition = null;
    gs.mapCells = [];
    gs.bossPosition = null;
    gs.expeditionGoal = null;
    gs.selectedCharacters = [];
    gs.maxCargoWeight = 20;
    // 重置每局资源
    gs.day = 1;
    gs.maxDay = 120;
    gs.food = 8;
    gs.morale = 3;
    gs.caravanHp = 45;
    gs.caravanMaxHp = 45;
    gs.gold = 0;
    // 重置工具选择状态，防止新开局时工具选择残留（阶段12.3）
    gs.selectedToolId = null;
    // 重置临时测试状态，防止跨局污染
    gs._isAutoMoving = false;
    gs._autoMoveResumeStep = 0;
    gs._autoMovePrevPos = null;
    gs._debugStep = 0;
    gs._isClickTesting = false;
    gs._clickTestStep = 0;
    gs._clickTestResumeStep = 0;
    gs._clickTestMaxSteps = 0;
    gs._isDirectionalTesting = false;
    gs._directionalTestStep = 0;
    gs._directionalTestResumeStep = 0;
    gs._directionalTestMaxSteps = 0;
    // 恢复保留的状态
    gs.orderTimeStates = orderTimeStates;
    gs.unfinishedOrderIds = unfinishedOrderIds;
    gs.completedOrderIds = completedOrderIds;
    gs.cityContributions = cityContributions;
    gs.embers = embers;
    // 保留持久化数据：completedOrderIds, cityContributions, embers, orderTimeStates, unfinishedOrderIds
    setGameState(gs);
    console.log("[主菜单] 游戏状态已重置，开始新局，保留订单时间状态和未完成订单");
  }
}
