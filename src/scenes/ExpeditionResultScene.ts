import Phaser from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import { formatExpeditionResult } from "../systems/expeditionResultSystem";
import { generateFailureLegacyChoices } from "../systems/legacySystem";

/**
 * ExpeditionResultScene.ts
 * 远征结算界面（阶段8.7）
 *
 * 显示远征结果：订单、奖励、城市贡献、城市状态等
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
      const resultLabel = result.resultType === "success" ? "远征成功" : "远征结束";
      this.add.text(w / 2, currentY, resultLabel, {
        fontSize: "22px",
        color: result.resultType === "success" ? "#a8d8a8" : "#d8a8a8",
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
    const btnY = Math.min(currentY + 30, h - 80);
    const btnGap = 160;

    // 返回主菜单按钮
    this.createButton(w / 2 - btnGap / 2, btnY, "返回主菜单", () => {
      this.scene.start("MainMenuScene");
    });

    // 再来一局按钮
    this.createButton(w / 2 + btnGap / 2, btnY, "再来一局", () => {
      this.scene.start("RouteSelectScene");
    });
  }

  /**
   * 测试入口：生成失败遗产候选并进入 LegacySelectScene
   * 仅用于测试/开发
   */
  startLegacySelectionForTest(): void {
    const gs = getGameState();
    gs.legacyChoices = generateFailureLegacyChoices();
    setGameState(gs);
    this.scene.start("LegacySelectScene");
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
}
