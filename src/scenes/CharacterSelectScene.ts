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

    // 清理旧元素（场景重启时）
    this.characterCards.forEach((card) => card.destroy());
    this.characterCards = [];
    if (this.tooltipManager) {
      this.tooltipManager.hide();
    }

    this.tooltipManager = new TooltipManager(this, 500);

    // 从 GameState 同步角色选择状态，确保再来一局后状态正确
    const gameState = getGameState();
    this.selectedChars = gameState.selectedCharacters ? [...gameState.selectedCharacters] : [];

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

    // 创建5个角色卡片 - 使用 calculateCharacterCardLayout 计算布局
    const allChars: CharacterId[] = [
      "guardian",
      "sharpshooter",
      "repairman",
      "scout",
      "inspirer",
    ];

    const layout = this.calculateCharacterCardLayout(w, h, allChars.length);

    for (let i = 0; i < allChars.length; i++) {
      const charId = allChars[i];
      const charDef = CHARACTER_DEFS[charId];
      const pos = layout.positions[i];

      const card = this.createCharacterCard(
        pos.x,
        pos.y,
        charId,
        charDef,
        layout.cardWidth,
        layout.cardHeight,
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

    // 使用相对间距布局文本，避免固定坐标导致重叠
    const padTop = 16; // 顶部内边距
    const lineGap = 6;  // 行间距
    let currentY = -height / 2 + padTop;

    // 图标
    const iconSize = Math.min(48, width / 3);
    const icon = this.add
      .text(0, currentY + iconSize / 2, charDef.icon, {
        fontSize: `${iconSize}px`,
      })
      .setOrigin(0.5);
    container.add(icon);
    currentY += iconSize + lineGap;

    // 名字
    const nameSize = Math.min(24, width / 6);
    const name = this.add
      .text(0, currentY + nameSize / 2, charDef.name, {
        fontSize: `${nameSize}px`,
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    container.add(name);
    currentY += nameSize + lineGap;

    // 定位
    const roleSize = width < 140 ? 10 : 12;
    const role = this.add
      .text(0, currentY + roleSize / 2, charDef.role, {
        fontSize: `${roleSize}px`,
        color: "#aaaaaa",
        fontFamily: "monospace",
        wordWrap: { width: width - 10 },
        align: "center",
      })
      .setOrigin(0.5);
    container.add(role);
    currentY += roleSize + lineGap;

    // 生命值
    const hpSize = width < 140 ? 11 : 14;
    const hpText = width < 140 ? `${charDef.maxHp}HP` : `❤️ ${charDef.maxHp} HP`;
    const hp = this.add
      .text(0, currentY + hpSize / 2, hpText, {
        fontSize: `${hpSize}px`,
        color: "#ff6666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);
    container.add(hp);
    currentY += hpSize + lineGap;

    // 被动说明不再显示在卡片上，只通过 Tooltip 展示
    // 避免文本重叠和卡片内容过多

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

    // 同步到 GameState，确保状态一致
    const gameState = getGameState();
    gameState.selectedCharacters = [...this.selectedChars];
    setGameState(gameState);
  }

  /**
   * 计算角色卡片布局
   * 返回每张卡的 x/y 位置、卡片宽高
   */
  private calculateCharacterCardLayout(
    screenW: number,
    screenH: number,
    count: number,
  ): {
    cardWidth: number;
    cardHeight: number;
    positions: { x: number; y: number }[];
  } {
    const maxCardW = 180;
    const maxCardH = 260;
    const gap = 15;
    const marginX = 20; // 左右边距
    const marginY = 140; // 顶部标题 + 底部按钮空间
    const availableW = screenW - marginX * 2;
    const availableH = screenH - marginY;

    // 判断布局模式
    const singleRowW = (availableW - (count - 1) * gap) / count;
    const useSingleRow = singleRowW >= 130; // 每张至少 130px 才单行

    let cardW: number;
    let cardH: number;
    let positions: { x: number; y: number }[] = [];

    if (useSingleRow) {
      // 单行布局：5 张卡片居中
      cardW = Math.min(maxCardW, Math.max(130, singleRowW));
      cardH = Math.min(maxCardH, availableH);
      const totalW = count * cardW + (count - 1) * gap;
      const startX = (screenW - totalW) / 2 + cardW / 2;
      const y = Math.min(screenH / 2, screenH - cardH / 2 - 70);

      for (let i = 0; i < count; i++) {
        positions.push({ x: startX + i * (cardW + gap), y });
      }
    } else if (availableW >= 3 * 130 + 2 * gap) {
      // 两行布局：3+2，每行独立居中
      const row1Count = 3;
      const row2Count = count - 3;
      cardW = Math.min(maxCardW, (availableW - (row1Count - 1) * gap) / row1Count);
      cardW = Math.max(120, cardW);
      cardH = Math.min(maxCardH, (availableH - gap) / 2);

      // 第一行 3 张居中
      const row1TotalW = row1Count * cardW + (row1Count - 1) * gap;
      const row1StartX = (screenW - row1TotalW) / 2 + cardW / 2;
      const row1Y = screenH / 2 - cardH / 2 - gap / 2;

      for (let i = 0; i < row1Count; i++) {
        positions.push({ x: row1StartX + i * (cardW + gap), y: row1Y });
      }

      // 第二行 2 张居中
      const row2TotalW = row2Count * cardW + (row2Count - 1) * gap;
      const row2StartX = (screenW - row2TotalW) / 2 + cardW / 2;
      const row2Y = screenH / 2 + cardH / 2 + gap / 2;

      for (let i = 0; i < row2Count; i++) {
        positions.push({ x: row2StartX + i * (cardW + gap), y: row2Y });
      }
    } else {
      // 屏幕太窄：分页模式，每页 2 张
      const perPage = 2;
      cardW = Math.min(maxCardW, (availableW - (perPage - 1) * gap) / perPage);
      cardW = Math.max(140, cardW);
      cardH = Math.min(maxCardH, availableH);
      const y = Math.min(screenH / 2, screenH - cardH / 2 - 70);

      // 默认显示第一页
      const pageTotalW = perPage * cardW + (perPage - 1) * gap;
      const startX = (screenW - pageTotalW) / 2 + cardW / 2;

      for (let i = 0; i < count; i++) {
        // 所有卡片放在同一位置（简化：只显示前 2 张，其余重叠）
        // 实际应该实现分页，这里先简化
        const pageIndex = i % perPage;
        positions.push({ x: startX + pageIndex * (cardW + gap), y });
      }
    }

    return { cardWidth: cardW, cardHeight: cardH, positions };
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
