import Phaser from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import { formatExpeditionResult } from "../systems/expeditionResultSystem";

/**
 * ExpeditionResultScene.ts
 * 远征结算界面（阶段8.7）
 *
 * 显示远征结果：订单、奖励、城市贡献、城市状态等
 * 注意：遗产系统已移除（阶段10.4）
 */
export class ExpeditionResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "ExpeditionResultScene" });
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // 背景
    this.add.rectangle(w / 2, h / 2, w, h, 0x0a0a1a, 0.95).setDepth(0);

    const gameState = getGameState();
    const result = gameState.lastExpeditionResult;

    // 标题
    this.add.text(w / 2, 40, "远征结算", {
      fontSize: "28px",
      color: "#e8c97a",
      fontFamily: "sans-serif",
    }).setOrigin(0.5).setDepth(1);

    let currentY = 80;

    if (result) {
      // 结果类型
      let resultLabel: string;
      let resultColor: string;
      if (result.resultType === "success") {
        resultLabel = "远征成功";
        resultColor = "#a8d8a8";
      } else if (result.resultType === "retreated") {
        resultLabel = "远征撤退";
        resultColor = "#d8d8a8";
      } else {
        resultLabel = "远征失败";
        resultColor = "#d8a8a8";
      }
      this.add.text(w / 2, currentY, resultLabel, {
        fontSize: "22px",
        color: resultColor,
        fontFamily: "sans-serif",
      }).setOrigin(0.5).setDepth(1);
      currentY += 40;

      // 格式化内容
      const lines = formatExpeditionResult(result);
      for (const line of lines) {
        if (line === "") {
          currentY += 10;
          continue;
        }
        this.add.text(w / 2, currentY, line, {
          fontSize: "16px",
          color: "#cccccc",
          fontFamily: "sans-serif",
          wordWrap: { width: w - 80 },
        }).setOrigin(0.5, 0).setDepth(1);
        currentY += 28;
      }
    } else {
      this.add.text(w / 2, currentY, "暂无结算数据", {
        fontSize: "18px",
        color: "#888888",
        fontFamily: "sans-serif",
      }).setOrigin(0.5).setDepth(1);
      currentY += 40;
    }

    // 按钮区域
    const isFailureOrRetreat = result &&
      (result.resultType === "failed" || result.resultType === "retreated");

    const btnY = Math.min(currentY + 30, h - 80);
    const btnGap = 160;

    // 所有结果都显示"返回主菜单"和"再来一局"（取消遗产选择入口）
    this.createButton(w / 2 - btnGap / 2, btnY, "返回主菜单", () => {
      this.clearResultState();
      this.scene.start("MainMenuScene");
    });
    this.createButton(w / 2 + btnGap / 2, btnY, "再来一局", () => {
      this.clearResultState();
      // 显式停止所有相关场景，确保场景状态完全重置
      const scenesToStop = ["MapScene", "BattleScene", "CargoPrepScene", "CharacterSelectScene", "RouteSelectScene"];
      for (const sceneKey of scenesToStop) {
        const scene = this.scene.get(sceneKey);
        if (scene) {
          this.scene.stop(sceneKey);
        }
      }
      // 进入城镇（阶段11.1新流程：再来一局 → 城镇 → 商路）
      this.scene.start("TownScene");
    });

    // ESC 返回主菜单
    this.input.keyboard?.on("keydown-ESC", () => {
      console.log("[远征结算] ESC 返回主菜单");
      this.clearResultState();
      this.scene.start("MainMenuScene");
    });
  }

  /**
   * 清理结算状态，防止跨局污染
   */
  private clearResultState(): void {
    const gs = getGameState();
    gs.lastExpeditionResult = null;
    gs.selectedOrderId = null;
    // 重置角色选择状态，防止再来一局时角色选择判定残留
    gs.selectedCharacters = [];
    gs.reserveCharacters = [];
    // 重置位置状态，防止再来一局时位置污染
    gs.currentPosition = { x: 0, y: 0 };
    gs.startPosition = { x: 0, y: 0 };
    // 重置战斗相关状态，防止BattleScene残留污染
    gs.currentBattleType = null;
    gs.currentBattleNodePosition = null;
    gs.battleResult = null;
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
    // 不清空 completedOrderIds / cityContributions / orderTimeStates / unfinishedOrderIds，这些需要持久化
    setGameState(gs);
    console.log("[ExpeditionResult] 结算状态已清理");
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void
  ): void {
    const btnW = 140;
    const btnH = 40;

    const bg = this.add.rectangle(x, y, btnW, btnH, 0x2a2a4a, 0.9)
      .setStrokeStyle(2, 0x4a4a8a)
      .setInteractive({ useHandCursor: true })
      .setDepth(1);

    const text = this.add.text(x, y, label, {
      fontSize: "16px",
      color: "#e8c97a",
      fontFamily: "sans-serif",
    }).setOrigin(0.5).setDepth(2);

    bg.on("pointerover", () => {
      bg.setFillStyle(0x3a3a6a);
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x2a2a4a);
    });
    bg.on("pointerdown", () => {
      onClick();
    });
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown-ESC");
  }
}
