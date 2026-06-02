import Phaser from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import { getLegacyRelicById, LegacyRelic } from "../data/legacyRelics";

/**
 * LegacySelectScene.ts
 * 失败遗产选择界面（阶段8.8）
 *
 * 显示 3 张遗产卡片供玩家选择
 */
export class LegacySelectScene extends Phaser.Scene {
  constructor() {
    super({ key: "LegacySelectScene" });
  }

  create(): void {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // 背景
    this.add.rectangle(w / 2, h / 2, w, h, 0x0a0a1a, 0.95).setDepth(0);

    // 标题
    this.add.text(w / 2, 40, "选择失败遗产", {
      fontSize: "28px",
      color: "#e8c97a",
      fontFamily: "sans-serif",
    }).setOrigin(0.5).setDepth(1);

    const gameState = getGameState();
    const choiceIds = gameState.legacyChoices || [];
    const choices = choiceIds
      .map((id) => getLegacyRelicById(id))
      .filter((r): r is LegacyRelic => !!r);

    // 卡片布局
    const cardW = 220;
    const cardH = 280;
    const gap = 20;
    const totalWidth = choices.length * cardW + (choices.length - 1) * gap;
    const startX = (w - totalWidth) / 2 + cardW / 2;

    choices.forEach((relic, index) => {
      const cx = startX + index * (cardW + gap);
      const cy = h / 2;

      this.createRelicCard(cx, cy, cardW, cardH, relic);
    });

    // 跳过按钮
    this.createSkipButton(w / 2, h - 50);
  }

  private createRelicCard(
    x: number,
    y: number,
    w: number,
    h: number,
    relic: LegacyRelic
  ): void {
    const container = this.add.container(x, y);

    // 卡片背景
    const bg = this.add.rectangle(0, 0, w, h, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4a4a6a)
      .setInteractive({ useHandCursor: true });
    container.add(bg);

    // 稀有度颜色
    const rarityColor = relic.rarity === "rare" ? "#d4a574" : "#888888";

    // 名称
    const nameText = this.add.text(0, -h / 2 + 30, relic.name, {
      fontSize: "18px",
      color: "#e8c97a",
      fontFamily: "sans-serif",
      wordWrap: { width: w - 20 },
    }).setOrigin(0.5);
    container.add(nameText);

    // 稀有度
    const rarityText = this.add.text(0, -h / 2 + 55, relic.rarity === "rare" ? "稀有" : "普通", {
      fontSize: "12px",
      color: rarityColor,
      fontFamily: "sans-serif",
    }).setOrigin(0.5);
    container.add(rarityText);

    // 描述
    const descText = this.add.text(0, -h / 2 + 90, relic.description, {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "sans-serif",
      wordWrap: { width: w - 20 },
      align: "center",
    }).setOrigin(0.5, 0);
    container.add(descText);

    // 效果
    const effectText = this.add.text(0, h / 2 - 60, relic.effectText, {
      fontSize: "13px",
      color: "#88aacc",
      fontFamily: "sans-serif",
      wordWrap: { width: w - 20 },
      align: "center",
    }).setOrigin(0.5, 0);
    container.add(effectText);

    // 交互
    bg.on("pointerover", () => {
      bg.setFillStyle(0x2a2a4e);
      bg.setStrokeStyle(2, 0x6a6a9a);
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x1a1a2e);
      bg.setStrokeStyle(2, 0x4a4a6a);
    });
    bg.on("pointerdown", () => {
      this.selectRelic(relic.id);
    });
  }

  private createSkipButton(x: number, y: number): void {
    const btnW = 120;
    const btnH = 36;

    const bg = this.add.rectangle(x, y, btnW, btnH, 0x2a2a4a, 0.9)
      .setStrokeStyle(2, 0x4a4a8a)
      .setInteractive({ useHandCursor: true })
      .setDepth(1);

    const text = this.add.text(x, y, "跳过遗产", {
      fontSize: "16px",
      color: "#888888",
      fontFamily: "sans-serif",
    }).setOrigin(0.5).setDepth(2);

    bg.on("pointerover", () => bg.setFillStyle(0x3a3a6a));
    bg.on("pointerout", () => bg.setFillStyle(0x2a2a4a));
    bg.on("pointerdown", () => {
      this.skipRelic();
    });
  }

  private selectRelic(relicId: string): void {
    const gs = getGameState();
    gs.activeLegacyRelicId = relicId;
    gs.legacyChoices = [];
    if (!gs.usedLegacyRelicIds.includes(relicId)) {
      gs.usedLegacyRelicIds.push(relicId);
    }
    setGameState(gs);
    this.scene.start("RouteSelectScene");
  }

  private skipRelic(): void {
    const gs = getGameState();
    gs.activeLegacyRelicId = undefined;
    gs.legacyChoices = [];
    setGameState(gs);
    this.scene.start("RouteSelectScene");
  }
}
