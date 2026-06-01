// 通用 Tooltip 系统（阶段8-hotfix）
// 提供轻量级悬浮说明框，可在任意场景中使用

import Phaser from "phaser";

export interface TooltipContent {
  title: string;
  lines: string[];
}

export class TooltipManager {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private bg: Phaser.GameObjects.Graphics | null = null;
  private texts: Phaser.GameObjects.Text[] = [];
  private depth: number;

  constructor(scene: Phaser.Scene, depth = 500) {
    this.scene = scene;
    this.depth = depth;
  }

  /**
   * 显示 Tooltip
   * @param content 标题和内容行
   * @param x 鼠标/目标 x 坐标
   * @param y 鼠标/目标 y 坐标
   * @param maxWidth 最大宽度（默认 250）
   */
  show(content: TooltipContent, x: number, y: number, maxWidth = 250): void {
    this.hide();

    const padding = 10;
    const lineHeight = 16;
    const titleFontSize = "14px";
    const bodyFontSize = "12px";

    // 创建文本对象来测量宽度
    const titleText = this.scene.add.text(0, 0, content.title, {
      fontSize: titleFontSize,
      color: "#ffdd66",
      fontFamily: "monospace",
      fontStyle: "bold",
      wordWrap: { width: maxWidth - padding * 2 },
    }).setOrigin(0, 0);

    const bodyTexts: Phaser.GameObjects.Text[] = [];
    let totalHeight = titleText.height + 4;

    for (const line of content.lines) {
      const bt = this.scene.add.text(0, 0, line, {
        fontSize: bodyFontSize,
        color: "#dddddd",
        fontFamily: "monospace",
        wordWrap: { width: maxWidth - padding * 2 },
      }).setOrigin(0, 0);
      bodyTexts.push(bt);
      totalHeight += bt.height + 2;
    }

    // 计算实际需要的宽度
    let actualWidth = titleText.width;
    for (const bt of bodyTexts) {
      actualWidth = Math.max(actualWidth, bt.width);
    }
    actualWidth = Math.min(actualWidth + padding * 2, maxWidth);

    // 计算 Tooltip 位置（避免超出屏幕）
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    let tx = x + 15;
    let ty = y - 10;

    // 如果超出右边界，移到左边
    if (tx + actualWidth > w - 5) {
      tx = x - actualWidth - 15;
    }
    // 如果超出下边界，向上移
    if (ty + totalHeight + padding * 2 > h - 5) {
      ty = h - totalHeight - padding * 2 - 5;
    }
    // 如果超出上边界
    if (ty < 5) ty = 5;
    // 如果超出左边界
    if (tx < 5) tx = 5;

    // 创建容器
    this.container = this.scene.add.container(tx, ty).setDepth(this.depth);

    // 背景
    this.bg = this.scene.add.graphics();
    this.bg.fillStyle(0x111122, 0.92);
    this.bg.lineStyle(1, 0x666688, 1);
    this.bg.fillRoundedRect(0, 0, actualWidth, totalHeight + padding * 2, 6);
    this.bg.strokeRoundedRect(0, 0, actualWidth, totalHeight + padding * 2, 6);
    this.container.add(this.bg);

    // 标题
    titleText.setPosition(padding, padding);
    this.container.add(titleText);
    this.texts.push(titleText);

    // 内容行
    let currentY = padding + titleText.height + 4;
    for (const bt of bodyTexts) {
      bt.setPosition(padding, currentY);
      this.container.add(bt);
      this.texts.push(bt);
      currentY += bt.height + 2;
    }
  }

  /**
   * 隐藏 Tooltip
   */
  hide(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
      this.bg = null;
      this.texts = [];
    }
  }

  /**
   * 给目标对象附加 Tooltip
   * @param target Phaser Game Object（需要 setInteractive）
   * @param contentBuilder 返回 TooltipContent 的函数
   */
  attachTooltip(
    target: Phaser.GameObjects.GameObject,
    contentBuilder: () => TooltipContent
  ): void {
    target.on("pointerover", () => {
      const pointer = this.scene.input.activePointer;
      this.show(contentBuilder(), pointer.x, pointer.y);
    });
    target.on("pointerout", () => {
      this.hide();
    });
  }
}
