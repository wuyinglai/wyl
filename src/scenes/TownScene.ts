import Phaser from "phaser";
import { getGameState } from "../systems/GameState";

/**
 * TownScene.ts — 阶段11.1 城镇入口 v1
 *
 * 玩家从主菜单进入城镇，作为远征前的整备界面。
 * 目前提供基础信息展示和进入商路选择的入口。
 */
export class TownScene extends Phaser.Scene {
  constructor() {
    super({ key: "TownScene" });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gs = getGameState();

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, w, h);

    // 顶部装饰线
    const topLine = this.add.graphics();
    topLine.lineStyle(2, 0x4488ff, 0.4);
    topLine.strokeRect(20, 20, w - 40, h - 40);

    // 标题
    this.add.text(w / 2, 70, "灰烬城镇", {
      fontSize: "48px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // 副标题
    this.add.text(w / 2, 115, "远征前的最后整备地", {
      fontSize: "20px",
      color: "#aaaaaa",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // ========== 信息区 ==========
    const infoX = 200;
    const infoStartY = 180;
    const infoLineH = 36;
    const infoLabelStyle = { fontSize: "18px", color: "#888888", fontFamily: "monospace" };
    const infoValueStyle = { fontSize: "18px", color: "#ffffff", fontFamily: "monospace" };
    const infoValues: Array<[string, string]> = [
      ["火种", `${gs.embers}`],
      ["银币", `${gs.silver}`],
      ["已完成订单", `${gs.completedOrderIds?.length ?? 0}`],
      ["未完成订单", `${gs.unfinishedOrderIds?.length ?? 0}`],
      ["城市贡献", `${Object.values(gs.cityContributions ?? {}).reduce((s: number, v: unknown) => s + (Number(v) || 0), 0)}`],
    ];

    infoValues.forEach(([label, value], i) => {
      const y = infoStartY + i * infoLineH;
      this.add.text(infoX, y, `${label}：`, infoLabelStyle).setOrigin(0, 0.5);
      this.add.text(infoX + 160, y, value, infoValueStyle).setOrigin(0, 0.5);
    });

    // 信息区边框
    const infoBox = this.add.graphics();
    infoBox.lineStyle(1, 0x4488ff, 0.3);
    infoBox.strokeRect(infoX - 20, infoStartY - 15, 280, infoValues.length * infoLineH + 20);

    // ========== 按钮区 ==========
    const btnX = w / 2 + 80;
    const btnStartY = 180;
    const btnGap = 65;
    const btnW = 220;
    const btnH = 50;

    const buttons = [
      { label: "查看商路", target: "RouteSelectScene" },
      { label: "接取订单", target: "RouteSelectScene" },
      { label: "出发准备", target: "RouteSelectScene" },
    ];

    buttons.forEach((btn, i) => {
      const y = btnStartY + i * btnGap;
      const rect = this.add.graphics();
      rect.fillStyle(0x2a4a8a, 1);
      rect.fillRoundedRect(btnX, y, btnW, btnH, 8);

      const text = this.add.text(btnX + btnW / 2, y + btnH / 2, btn.label, {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: "monospace",
      }).setOrigin(0.5);

      const hitArea = this.add.rectangle(btnX + btnW / 2, y + btnH / 2, btnW, btnH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      hitArea.on("pointerover", () => {
        rect.clear();
        rect.fillStyle(0x3a6aca, 1);
        rect.fillRoundedRect(btnX, y, btnW, btnH, 8);
      });

      hitArea.on("pointerout", () => {
        rect.clear();
        rect.fillStyle(0x2a4a8a, 1);
        rect.fillRoundedRect(btnX, y, btnW, btnH, 8);
      });

      hitArea.on("pointerdown", () => {
        console.log(`[城镇] 点击「${btn.label}」，进入 ${btn.target}`);
        this.scene.start(btn.target);
      });
    });

    // ========== 底部提示 ==========
    this.add.text(w / 2, h - 35, "阶段11.1：城镇入口 v1，更多设施后续开放", {
      fontSize: "14px",
      color: "#555555",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    console.log("[城镇] 城镇场景已加载");
  }
}
