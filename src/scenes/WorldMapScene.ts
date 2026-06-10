/**
 * 阶段11.1：大格子自由探索地图原型
 * WorldMapScene v1
 *
 * 设计目标：
 *   从城镇出发 → 进入一张较大的格子远征地图 → 玩家自由上下左右探索
 *
 * 地图规格：
 *   20 × 20 格
 *   每格 48 像素
 *   地图总尺寸 960 × 960（大于屏幕，需要摄像机跟随）
 *
 * 注意：
 *   这是一个原型验证场景，不替换现有 MapScene
 *   不接入真实战斗、订单交付、撤退等系统
 */

import Phaser from "phaser";

const TILE_SIZE = 48;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 20;

/** 地图点位类型 */
type CellType =
  | "Town"
  | "TargetCity"
  | "Outpost"
  | "Village"
  | "Ruin"
  | "Enemy"
  | "Event"
  | "Plain";

interface CellInfo {
  x: number;
  y: number;
  type: CellType;
  label?: string;
  color: number;
  desc: string;
}

export class WorldMapScene extends Phaser.Scene {
  /** 地图格子（含特殊点位） */
  private cells: CellInfo[][] = [];

  /** 玩家逻辑坐标 */
  private currentPosition: { x: number; y: number } = { x: 0, y: 0 };

  /** 初始位置（城镇） */
  private townPosition: { x: number; y: number } = { x: 2, y: 17 };

  /** 补给 */
  private supplies: number = 20;

  /** 订单剩余步数 */
  private orderSteps: number = 30;

  /** 玩家精灵（图形） */
  private playerSprite: Phaser.GameObjects.Graphics | null = null;

  /** UI Text 元素 */
  private uiTexts: {
    position: Phaser.GameObjects.Text;
    supplies: Phaser.GameObjects.Text;
    orderSteps: Phaser.GameObjects.Text;
    terrain: Phaser.GameObjects.Text;
    bottomDesc: Phaser.GameObjects.Text;
  } | null = null;

  constructor() {
    super({ key: "WorldMapScene" });
  }

  create() {
    // 深色背景（覆盖整个摄像机视野）
    const bg = this.add.graphics();
    bg.fillStyle(0x0d1b2a, 1);
    bg.fillRect(-5000, -5000, 10000, 10000);

    // 初始化 20×20 地图，全部默认为 Plain
    this.initCells();

    // 手动布置特殊点位（原型版本，不做随机生成）
    this.placeSpecialPoint(2, 17, "Town", "灰烬城镇", 0xffcc44, "你的出发点，可以在这里整备。");
    this.placeSpecialPoint(17, 2, "TargetCity", "目标城市", 0x22cc66, "订单目标点，抵达后交付货物。");
    this.placeSpecialPoint(10, 10, "Outpost", "驿站", 0x66aaff, "可以短暂休整，后续开放补给功能。");
    this.placeSpecialPoint(5, 7, "Village", "村落", 0xaa7744, "可交易的村落，后续开放交易功能。");
    this.placeSpecialPoint(14, 14, "Ruin", "废墟 A", 0x666666, "可能有物资，也可能有危险。");
    this.placeSpecialPoint(8, 3, "Ruin", "废墟 B", 0x555555, "残破的建筑，藏有未知。");
    this.placeSpecialPoint(12, 7, "Enemy", "敌人点 A", 0xcc3344, "危险区域，后续接入战斗系统。");
    this.placeSpecialPoint(16, 12, "Enemy", "敌人点 B", 0xbb2233, "危险区域，小心遭遇战。");
    this.placeSpecialPoint(6, 13, "Event", "事件点 A", 0xbb44cc, "随机事件点，后续接入事件系统。");
    this.placeSpecialPoint(15, 5, "Event", "事件点 B", 0xaa33bb, "随机事件点，后续接入事件系统。");

    // 绘制格子地图
    this.drawMap();

    // 玩家初始位置（城镇）
    this.currentPosition = { x: this.townPosition.x, y: this.townPosition.y };
    this.drawPlayer();

    // 设置摄像机跟随
    this.cameras.main.startFollow(
      this.playerSprite!,
      true,
      0.15,
      0.15,
      0,
      0
    );
    this.cameras.main.setBackgroundColor("#0d1b2a");

    // UI 面板（左上角，固定在屏幕上，不跟随地图滚动）
    this.createUI();

    // 键盘输入
    this.setupInput();

    console.log("[WorldMapScene] 大格子自由探索地图原型已加载");
    console.log(`[WorldMapScene] 地图规格: ${MAP_WIDTH}x${MAP_HEIGHT}, 每格 ${TILE_SIZE}px`);
    console.log(`[WorldMapScene] 初始位置: (${this.currentPosition.x}, ${this.currentPosition.y})`);
  }

  /**
   * 初始化所有格子为 Plain
   */
  private initCells(): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.cells[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        this.cells[y][x] = {
          x,
          y,
          type: "Plain",
          color: 0x2a3a4a,
          desc: "荒野：风沙很大，商队缓慢前进。",
        };
      }
    }
  }

  /**
   * 放置特殊点位
   */
  private placeSpecialPoint(
    x: number,
    y: number,
    type: CellType,
    label: string,
    color: number,
    desc: string
  ): void {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return;
    this.cells[y][x] = { x, y, type, label, color, desc };
  }

  /**
   * 绘制地图格子
   */
  private drawMap(): void {
    const g = this.add.graphics();

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const cell = this.cells[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // 格子背景
        g.fillStyle(cell.color, 0.85);
        g.fillRect(px, py, TILE_SIZE - 1, TILE_SIZE - 1);

        // 格线
        g.lineStyle(1, 0x1a2a3a, 0.6);
        g.strokeRect(px, py, TILE_SIZE - 1, TILE_SIZE - 1);

        // 特殊点位的文字标签
        if (cell.label) {
          this.add
            .text(px + TILE_SIZE / 2, py + TILE_SIZE / 2, cell.label, {
              fontSize: "10px",
              color: "#ffffff",
              fontFamily: "monospace",
              align: "center",
              wordWrap: { width: TILE_SIZE - 4 },
            })
            .setOrigin(0.5);
        }
      }
    }
  }

  /**
   * 绘制玩家（商队图标）
   */
  private drawPlayer(): void {
    if (this.playerSprite) {
      this.playerSprite.destroy();
    }
    const px = this.currentPosition.x * TILE_SIZE + TILE_SIZE / 2;
    const py = this.currentPosition.y * TILE_SIZE + TILE_SIZE / 2;

    const g = this.add.graphics();
    // 外圆（商队）
    g.fillStyle(0xff8844, 1);
    g.fillCircle(0, 0, TILE_SIZE * 0.35);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(0, 0, TILE_SIZE * 0.35);
    // 内点
    g.fillStyle(0xffffff, 1);
    g.fillCircle(0, 0, TILE_SIZE * 0.1);
    g.setPosition(px, py);
    // 玩家在特殊点位上层
    g.setDepth(100);

    this.playerSprite = g;
  }

  /**
   * UI 面板（固定屏幕坐标）
   */
  private createUI(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // 背景面板
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.55);
    panel.fillRoundedRect(15, 15, 280, 150, 8);
    panel.lineStyle(2, 0x4488ff, 0.6);
    panel.strokeRoundedRect(15, 15, 280, 150, 8);
    // 固定在屏幕上
    panel.setScrollFactor(0);
    panel.setDepth(1000);

    // 顶部标题
    const titleText = this.add.text(160, 30, "远征地图状态", {
      fontSize: "14px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    titleText.setOrigin(0.5);
    titleText.setScrollFactor(0);
    titleText.setDepth(1000);

    // 位置
    const posText = this.add.text(30, 55, "位置: (0, 0)", {
      fontSize: "13px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    posText.setScrollFactor(0);
    posText.setDepth(1000);

    // 补给
    const suppliesText = this.add.text(30, 78, "补给: 20", {
      fontSize: "13px",
      color: "#88ffcc",
      fontFamily: "monospace",
    });
    suppliesText.setScrollFactor(0);
    suppliesText.setDepth(1000);

    // 订单剩余步数
    const orderText = this.add.text(30, 101, "订单剩余步数: 30", {
      fontSize: "13px",
      color: "#88ccff",
      fontFamily: "monospace",
    });
    orderText.setScrollFactor(0);
    orderText.setDepth(1000);

    // 当前地形
    const terrainText = this.add.text(30, 124, "当前地形: Plain", {
      fontSize: "13px",
      color: "#ffdd88",
      fontFamily: "monospace",
    });
    terrainText.setScrollFactor(0);
    terrainText.setDepth(1000);

    this.uiTexts = {
      position: posText,
      supplies: suppliesText,
      orderSteps: orderText,
      terrain: terrainText,
      bottomDesc: null as any, // 稍后设置
    };

    // 右上角小提示
    const hintText = this.add.text(w - 15, 25, "大格子自由探索地图原型 v1", {
      fontSize: "12px",
      color: "#888888",
      fontFamily: "monospace",
    });
    hintText.setOrigin(1, 0);
    hintText.setScrollFactor(0);
    hintText.setDepth(1000);

    // 底部说明（固定在屏幕底部，显示当前格子信息）
    const bottomPanel = this.add.graphics();
    bottomPanel.fillStyle(0x000000, 0.55);
    bottomPanel.fillRoundedRect(15, h - 55, w - 30, 40, 8);
    bottomPanel.lineStyle(2, 0x4488ff, 0.4);
    bottomPanel.strokeRoundedRect(15, h - 55, w - 30, 40, 8);
    bottomPanel.setScrollFactor(0);
    bottomPanel.setDepth(1000);

    const bottomDescText = this.add.text(w / 2, h - 35, "", {
      fontSize: "14px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    bottomDescText.setOrigin(0.5);
    bottomDescText.setScrollFactor(0);
    bottomDescText.setDepth(1000);
    this.uiTexts.bottomDesc = bottomDescText;

    // 操作提示
    const hint2 = this.add.text(15, h - 20, "方向键移动 ｜ ESC 返回主菜单", {
      fontSize: "12px",
      color: "#666666",
      fontFamily: "monospace",
    });
    hint2.setScrollFactor(0);
    hint2.setDepth(1000);

    this.updateUI();
  }

  /**
   * 更新 UI 显示
   */
  private updateUI(): void {
    if (!this.uiTexts) return;
    const cell = this.cells[this.currentPosition.y][this.currentPosition.x];

    this.uiTexts.position.setText(
      `位置: (${this.currentPosition.x}, ${this.currentPosition.y})`
    );
    this.uiTexts.supplies.setText(`补给: ${this.supplies}`);
    this.uiTexts.orderSteps.setText(`订单剩余步数: ${this.orderSteps}`);
    this.uiTexts.terrain.setText(`当前地形: ${cell.type}`);

    // 订单步数提醒
    if (this.orderSteps <= 5 && this.orderSteps > 0) {
      this.uiTexts.orderSteps.setColor("#ff6666");
    } else if (this.orderSteps <= 0) {
      this.uiTexts.orderSteps.setColor("#ff2222");
      this.uiTexts.orderSteps.setText("订单剩余步数: 0 (已超时)");
    } else {
      this.uiTexts.orderSteps.setColor("#88ccff");
    }

    // 补给低提醒
    if (this.supplies <= 5 && this.supplies > 0) {
      this.uiTexts.supplies.setColor("#ff8844");
    } else if (this.supplies <= 0) {
      this.uiTexts.supplies.setColor("#ff2222");
    } else {
      this.uiTexts.supplies.setColor("#88ffcc");
    }

    // 底部说明
    this.uiTexts.bottomDesc.setText(cell.desc);
  }

  /**
   * 键盘输入绑定
   */
  private setupInput(): void {
    // 使用 cursorKeys 检测方向键
    const cursors = this.input.keyboard!.createCursorKeys();

    // 为避免快速连续按下导致多次移动，记录上次移动时间
    let lastMoveTime = 0;
    const moveCooldown = 150; // ms

    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      // ESC 直接处理，不受移动冷却影响
      if (event.key === "Escape") {
        console.log("[WorldMapScene] ESC 返回主菜单");
        this.scene.start("MainMenuScene");
        return;
      }

      const now = Date.now();
      if (now - lastMoveTime < moveCooldown) return;

      let dx = 0;
      let dy = 0;

      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        dy = -1;
      } else if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        dy = 1;
      } else if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        dx = -1;
      } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        dx = 1;
      } else {
        return;
      }

      this.tryMove(dx, dy);
      lastMoveTime = now;
    });
  }

  /**
   * 尝试移动一格
   */
  private tryMove(dx: number, dy: number): void {
    const newX = this.currentPosition.x + dx;
    const newY = this.currentPosition.y + dy;

    // 边界检查
    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) {
      console.log(`[WorldMapScene] 越界: 尝试移动到 (${newX}, ${newY})`);
      return;
    }

    // 更新位置
    this.currentPosition = { x: newX, y: newY };

    // 消耗补给和订单步数
    if (this.supplies > 0) {
      this.supplies--;
    }
    if (this.orderSteps > 0) {
      this.orderSteps--;
    }

    // 更新玩家精灵位置
    if (this.playerSprite) {
      this.tweens.add({
        targets: this.playerSprite,
        x: this.currentPosition.x * TILE_SIZE + TILE_SIZE / 2,
        y: this.currentPosition.y * TILE_SIZE + TILE_SIZE / 2,
        duration: 150,
        ease: "Power1",
      });
    }

    // 更新 UI
    this.updateUI();

    console.log(
      `[WorldMapScene] 移动到 (${newX}, ${newY}), 补给=${this.supplies}, 步数=${this.orderSteps}`
    );
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown");
    if (this.playerSprite) {
      this.playerSprite.destroy();
      this.playerSprite = null;
    }
  }
}
