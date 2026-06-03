import Phaser from "phaser";
import { CHARACTER_DEFS, CharacterId, getStartingDeck } from "../data/characters";
import { hasCargo } from "../systems/cargoSystem";
import {
  getGameState,
  setGameState,
} from "../systems/GameState";
import { TooltipManager } from "../systems/tooltipSystem";

export class CharacterSelectScene extends Phaser.Scene {
  private selectedChars: CharacterId[] = [];
  private characterCards: Phaser.GameObjects.Container[] = [];
  private confirmBtn!: Phaser.GameObjects.Text;
  private selectionText!: Phaser.GameObjects.Text;
  private tooltipManager: TooltipManager | null = null;

  constructor() {
    super({ key: "CharacterSelectScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.tooltipManager = new TooltipManager(this, 500);

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, w, h);

    // 标题
    this.add
      .text(w / 2, 40, "选择远征队伍", {
        fontSize: "36px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // 说明文字
    this.selectionText = this.add
      .text(w / 2, 90, "请选择 3 名角色 (0/3)", {
        fontSize: "20px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 创建5个角色卡片
    const allChars: CharacterId[] = [
      "guardian",
      "sharpshooter",
      "repairman",
      "scout",
      "inspirer",
    ];
    const maxCardWidth = 180;
    const maxCardHeight = 260;
    const cardGap = 15;
    const minCardWidth = 120;

    // 判断是否使用两行布局（屏幕宽度不足时）
    const availableWidth = w - 40;
    const singleRowCardWidth = (availableWidth - (allChars.length - 1) * cardGap) / allChars.length;
    const useTwoRows = singleRowCardWidth < minCardWidth;

    let cardWidth: number;
    let cardHeight: number;
    let cardsPerRow: number;
    let rowGap: number;

    if (useTwoRows) {
      // 两行布局：3+2
      cardsPerRow = 3;
      cardWidth = Math.min(maxCardWidth, (availableWidth - (cardsPerRow - 1) * cardGap) / cardsPerRow);
      rowGap = 20;
      cardHeight = Math.min(maxCardHeight, (h - 180 - rowGap) / 2);
    } else {
      // 单行布局
      cardsPerRow = 5;
      cardWidth = Math.min(maxCardWidth, singleRowCardWidth);
      rowGap = 0;
      cardHeight = Math.min(maxCardHeight, h - 160);
    }

    const startX = (w - Math.min(cardsPerRow, allChars.length) * cardWidth - (Math.min(cardsPerRow, allChars.length) - 1) * cardGap) / 2 + cardWidth / 2;
    const firstRowY = useTwoRows ? h / 2 - cardHeight / 2 - rowGap / 2 : Math.min(h / 2, h - cardHeight / 2 - 70);
    const secondRowY = useTwoRows ? h / 2 + cardHeight / 2 + rowGap / 2 : firstRowY;

    for (let i = 0; i < allChars.length; i++) {
      const charId = allChars[i];
      const charDef = CHARACTER_DEFS[charId];

      const row = useTwoRows && i >= 3 ? 1 : 0;
      const col = useTwoRows ? (row === 0 ? i : i - 3) : i;
      const rowCards = row === 0 ? Math.min(3, allChars.length) : allChars.length - 3;
      const x = (w - rowCards * cardWidth - (rowCards - 1) * cardGap) / 2 + cardWidth / 2 + col * (cardWidth + cardGap);
      const y = row === 0 ? firstRowY : secondRowY;

      const card = this.createCharacterCard(
        x,
        y,
        charId,
        charDef,
        cardWidth,
        cardHeight,
      );
      this.characterCards.push(card);
    }

    // 确认按钮 - 固定在底部安全区域
    this.confirmBtn = this.add
      .text(w / 2, h - 50, "开始远征", {
        fontSize: "28px",
        color: "#666666",
        backgroundColor: "#2a2a3a",
        padding: { x: 50, y: 15 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.updateConfirmButton();

    // 键盘快捷键：按1-5选择角色，Enter确认
    const charList: CharacterId[] = [
      "guardian",
      "sharpshooter",
      "repairman",
      "scout",
      "inspirer",
    ];
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const num = parseInt(event.key);
      if (num >= 1 && num <= 5) {
        this.toggleCharacterByIndex(num - 1);
      }
      if (event.key === "Enter" && this.selectedChars.length === 3) {
        this.startExpedition();
      }
    });

    console.log("[角色选择] 角色选择场景已加载");
  }

  private createCharacterCard(
    x: number,
    y: number,
    charId: CharacterId,
    charDef: (typeof CHARACTER_DEFS)["guardian"],
    width: number,
    height: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // 背景框
    const bg = this.add.graphics();
    const color = charDef.color;
    bg.fillStyle(0x2a2a3e, 1);
    bg.fillRect(-width / 2, -height / 2, width, height);
    bg.lineStyle(2, color, 0.8);
    bg.strokeRect(-width / 2, -height / 2, width, height);
    container.add(bg);

    // 选中标记（初始隐藏）
    const selectedMark = this.add.graphics();
    selectedMark.fillStyle(color, 0.3);
    selectedMark.fillRect(-width / 2, -height / 2, width, height);
    selectedMark.lineStyle(4, color, 1);
    selectedMark.strokeRect(-width / 2, -height / 2, width, height);
    selectedMark.setVisible(false);
    container.add(selectedMark);

    // 图标
    const icon = this.add
      .text(0, -height / 2 + 40, charDef.icon, {
        fontSize: "48px",
      })
      .setOrigin(0.5);
    container.add(icon);

    // 名字
    const name = this.add
      .text(0, -height / 2 + 90, charDef.name, {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    container.add(name);

    // 定位：小卡片缩小字体避免重叠
    const roleFontSize = width < 140 ? "11px" : "14px";
    const role = this.add
      .text(0, -height / 2 + 120, charDef.role, {
        fontSize: roleFontSize,
        color: "#aaaaaa",
        fontFamily: "monospace",
        wordWrap: { width: width - 10 },
        align: "center",
      })
      .setOrigin(0.5);
    container.add(role);

    // 生命值
    const hpText = width < 140 ? `${charDef.maxHp}HP` : `❤️ ${charDef.maxHp} HP`;
    const hpFontSize = width < 140 ? "12px" : "16px";
    const hp = this.add
      .text(0, -height / 2 + 155, hpText, {
        fontSize: hpFontSize,
        color: "#ff6666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    container.add(hp);

    // 被动说明：小卡片隐藏被动说明，避免文字重叠；大卡片显示
    const showPassive = width >= 140;
    if (showPassive) {
      const passiveY = Math.min(20, height / 2 - 40);
      const passive = this.add
        .text(0, passiveY, charDef.passiveDesc, {
          fontSize: "12px",
          color: "#cccccc",
          fontFamily: "monospace",
          align: "center",
          wordWrap: { width: width - 16 },
        })
        .setOrigin(0.5);
      container.add(passive);
    }

    // 点击区域
    const hitArea = this.add
      .zone(0, 0, width, height)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    // 点击事件
    hitArea.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x3a3a4e, 1);
      bg.fillRect(-width / 2, -height / 2, width, height);
      bg.lineStyle(2, color, 1);
      bg.strokeRect(-width / 2, -height / 2, width, height);

      // 显示角色 Tooltip
      if (this.tooltipManager) {
        const pointer = this.input.activePointer;
        const deck = getStartingDeck(charId);
        const deckNames = deck.map((c) => c.name);
        this.tooltipManager.show(
          {
            title: `${charDef.icon} ${charDef.name}`,
            lines: [
              `定位：${charDef.role}`,
              `生命：${charDef.maxHp} HP`,
              "",
              `被动：${charDef.passiveDesc}`,
              "",
              `初始牌组(${deckNames.length}张)：`,
              ...deckNames.slice(0, 6).map(n => `  · ${n}`),
              deckNames.length > 6 ? `  ...共${deckNames.length}张` : "",
            ].filter(l => l !== ""),
          },
          pointer.x, pointer.y, 260
        );
      }
    });

    hitArea.on("pointerout", () => {
      const isSelected = this.selectedChars.includes(charId);
      bg.clear();
      bg.fillStyle(0x2a2a3e, 1);
      bg.fillRect(-width / 2, -height / 2, width, height);
      bg.lineStyle(2, color, isSelected ? 1 : 0.8);
      bg.strokeRect(-width / 2, -height / 2, width, height);

      if (this.tooltipManager) this.tooltipManager.hide();
    });

    hitArea.on("pointerdown", () => {
      this.toggleCharacter(charId, selectedMark, bg, color, width, height);
    });

    return container;
  }

  private toggleCharacterByIndex(index: number): void {
    const allChars: CharacterId[] = [
      "guardian",
      "sharpshooter",
      "repairman",
      "scout",
      "inspirer",
    ];
    if (index >= 0 && index < allChars.length) {
      const charId = allChars[index];
      const existingIndex = this.selectedChars.indexOf(charId);
      if (existingIndex > -1) {
        this.selectedChars.splice(existingIndex, 1);
      } else if (this.selectedChars.length < 3) {
        this.selectedChars.push(charId);
      }
      this.updateUI();
    }
  }

  private toggleCharacter(
    charId: CharacterId,
    selectedMark: Phaser.GameObjects.Graphics,
    bg: Phaser.GameObjects.Graphics,
    color: number,
    width: number,
    height: number,
  ): void {
    const index = this.selectedChars.indexOf(charId);

    if (index > -1) {
      // 取消选择
      this.selectedChars.splice(index, 1);
      selectedMark.setVisible(false);
      bg.clear();
      bg.fillStyle(0x2a2a3e, 1);
      bg.fillRect(-width / 2, -height / 2, width, height);
      bg.lineStyle(2, color, 0.8);
      bg.strokeRect(-width / 2, -height / 2, width, height);
    } else {
      // 选择（最多3个）
      if (this.selectedChars.length < 3) {
        this.selectedChars.push(charId);
        selectedMark.setVisible(true);
        bg.clear();
        bg.fillStyle(0x3a3a4e, 1);
        bg.fillRect(-width / 2, -height / 2, width, height);
        bg.lineStyle(2, color, 1);
        bg.strokeRect(-width / 2, -height / 2, width, height);
      }
    }

    this.updateUI();
  }

  private updateUI(): void {
    this.selectionText.setText(
      `请选择 3 名角色 (${this.selectedChars.length}/3)`,
    );
    this.updateConfirmButton();
  }

  private updateConfirmButton(): void {
    const canStart = this.selectedChars.length === 3;

    if (canStart) {
      this.confirmBtn.setStyle({
        color: "#ffffff",
        backgroundColor: "#2a8a4a",
      });
      this.confirmBtn.setInteractive({ useHandCursor: true });

      this.confirmBtn.off("pointerover");
      this.confirmBtn.off("pointerout");
      this.confirmBtn.off("pointerdown");

      this.confirmBtn.on("pointerover", () => {
        this.confirmBtn.setStyle({ backgroundColor: "#3aca6a" });
      });

      this.confirmBtn.on("pointerout", () => {
        this.confirmBtn.setStyle({ backgroundColor: "#2a8a4a" });
      });

      this.confirmBtn.on("pointerdown", () => {
        this.startExpedition();
      });
    } else {
      this.confirmBtn.setStyle({
        color: "#666666",
        backgroundColor: "#2a2a3a",
      });
      this.confirmBtn.disableInteractive();
    }
  }

  private startExpedition(): void {
    // 保存选择
    const gameState = getGameState();
    gameState.selectedCharacters = [...this.selectedChars];

    // 未选择的角色进入候补池
    const allChars: CharacterId[] = [
      "guardian",
      "sharpshooter",
      "repairman",
      "scout",
      "inspirer",
    ];
    gameState.reserveCharacters = allChars.filter(
      (c) => !this.selectedChars.includes(c),
    );

    // 阶段8.5：角色选择后进入货物准备场景
    // 地图生成和货物初始化移到 CargoPrepScene
    setGameState(gameState);

    console.log("[角色选择] 队伍:", gameState.selectedCharacters);
    console.log("[角色选择] 候补:", gameState.reserveCharacters);

    // 进入货物准备场景
    this.scene.start("CargoPrepScene");
  }
}
