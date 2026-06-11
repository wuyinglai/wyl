import Phaser from "phaser";
import { getGameState } from "../systems/GameState";

/**
 * TownScene.ts — 阶段11.2 城镇设施入口占位 v1
 *
 * 玩家从主菜单进入城镇，作为远征前的整备界面。
 * 本轮新增设施入口区：商路大厅、工坊、休整所、情报所、仓库/工具。
 * 除商路大厅外，其他设施只显示说明面板，不做真实系统。
 */
export class TownScene extends Phaser.Scene {
  /** 当前选中的设施 */
  private selectedFacility: string | null = null;

  /** 说明面板文本 */
  private descText: Phaser.GameObjects.Text | null = null;

  /** 设施按钮背景图形列表 */
  private facilityBtnGraphics: Phaser.GameObjects.Graphics[] = [];

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

    // ========== 左侧：信息区 ==========
    const infoX = 60;
    const infoStartY = 180;
    const infoLineH = 32;
    const infoLabelStyle = { fontSize: "16px", color: "#888888", fontFamily: "monospace" };
    const infoValueStyle = { fontSize: "16px", color: "#ffffff", fontFamily: "monospace" };
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
      this.add.text(infoX + 130, y, value, infoValueStyle).setOrigin(0, 0.5);
    });

    // 信息区边框
    const infoBox = this.add.graphics();
    infoBox.lineStyle(1, 0x4488ff, 0.3);
    infoBox.strokeRect(infoX - 15, infoStartY - 18, 200, infoValues.length * infoLineH + 24);

    // ========== 中间：设施按钮区 ==========
    const facilityX = 280;
    const facilityStartY = 180;
    const facilityGap = 58;
    const facilityBtnW = 200;
    const facilityBtnH = 46;

    const facilities = [
      { id: "route_hall", label: "商路大厅", desc: "商路大厅：查看可用商路、接取订单并准备出发。", action: "route" },
      { id: "workshop", label: "工坊", desc: "工坊：后续可用于修理装备、制作工具、升级商队设备。", action: "panel" },
      { id: "rest_house", label: "休整所", desc: "休整所：后续可用于恢复角色状态、处理伤病、调整队伍。", action: "panel" },
      { id: "intel_office", label: "情报所", desc: "情报所：后续可用于查看商路风险、城市状态、订单情报。", action: "panel" },
      { id: "warehouse", label: "仓库/工具", desc: "仓库/工具：后续可用于管理货物、查看工具、准备远征物资。", action: "panel" },
    ];

    this.facilityBtnGraphics = [];

    facilities.forEach((facility, i) => {
      const y = facilityStartY + i * facilityGap;
      const rect = this.add.graphics();
      rect.fillStyle(0x2a4a8a, 1);
      rect.fillRoundedRect(facilityX, y, facilityBtnW, facilityBtnH, 8);
      this.facilityBtnGraphics.push(rect);

      const text = this.add.text(facilityX + facilityBtnW / 2, y + facilityBtnH / 2, facility.label, {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
      }).setOrigin(0.5);

      const hitArea = this.add.rectangle(facilityX + facilityBtnW / 2, y + facilityBtnH / 2, facilityBtnW, facilityBtnH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });

      hitArea.on("pointerover", () => {
        rect.clear();
        rect.fillStyle(0x3a6aca, 1);
        rect.fillRoundedRect(facilityX, y, facilityBtnW, facilityBtnH, 8);
      });

      hitArea.on("pointerout", () => {
        this.updateFacilityButtonStyle(i, facility.id === this.selectedFacility);
      });

      hitArea.on("pointerdown", () => {
        console.log(`[城镇] 点击设施「${facility.label}」`);
        this.selectedFacility = facility.id;

        // 更新所有按钮样式
        facilities.forEach((f, idx) => {
          this.updateFacilityButtonStyle(idx, f.id === this.selectedFacility);
        });

        if (facility.action === "route") {
          // 商路大厅：进入 RouteSelectScene
          console.log("[城镇] 点击「商路大厅」，进入 RouteSelectScene");
          this.scene.start("RouteSelectScene");
        } else {
          // 其他设施：更新说明面板
          this.updateDescPanel(facility.label, facility.desc);
        }
      });
    });

    // ========== 右侧：设施说明面板 ==========
    const panelX = 520;
    const panelY = 180;
    const panelW = 400;
    const panelH = 320;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0d1b2a, 0.9);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    panelBg.lineStyle(2, 0x4488ff, 0.5);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

    // 说明面板标题
    this.add.text(panelX + panelW / 2, panelY + 30, "设施说明", {
      fontSize: "20px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);

    // 说明面板分隔线
    const sepLine = this.add.graphics();
    sepLine.lineStyle(1, 0x4488ff, 0.3);
    sepLine.strokeLineShape(new Phaser.Geom.Line(panelX + 20, panelY + 55, panelX + panelW - 20, panelY + 55));

    // 说明面板内容文本
    this.descText = this.add.text(panelX + panelW / 2, panelY + panelH / 2 + 20, "请选择左侧设施查看详情", {
      fontSize: "16px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);

    // ========== 返回主菜单按钮（左上角）==========
    const backBtnX = 30;
    const backBtnY = 30;
    const backBtnW = 140;
    const backBtnH = 36;
    const backBg = this.add.graphics();
    backBg.fillStyle(0x555555, 1);
    backBg.fillRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
    const backText = this.add.text(backBtnX + backBtnW / 2, backBtnY + backBtnH / 2, "返回主菜单", {
      fontSize: "14px",
      color: "#cccccc",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    const backHit = this.add.rectangle(backBtnX + backBtnW / 2, backBtnY + backBtnH / 2, backBtnW, backBtnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    backHit.on("pointerover", () => {
      backBg.clear();
      backBg.fillStyle(0x777777, 1);
      backBg.fillRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
    });
    backHit.on("pointerout", () => {
      backBg.clear();
      backBg.fillStyle(0x555555, 1);
      backBg.fillRoundedRect(backBtnX, backBtnY, backBtnW, backBtnH, 6);
    });
    backHit.on("pointerdown", () => {
      console.log("[城镇] 返回主菜单");
      this.scene.start("MainMenuScene");
    });

    // ESC 返回主菜单
    this.input.keyboard?.on("keydown-ESC", () => {
      console.log("[城镇] ESC 返回主菜单");
      this.scene.start("MainMenuScene");
    });

    // ========== 底部提示 ==========
    this.add.text(w / 2, h - 35, "阶段11.2：城镇设施入口占位 v1，更多功能后续开放", {
      fontSize: "14px",
      color: "#555555",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    console.log("[城镇] 城镇场景已加载");
  }

  /**
   * 更新设施按钮样式
   */
  private updateFacilityButtonStyle(index: number, selected: boolean): void {
    const facilityX = 280;
    const facilityStartY = 180;
    const facilityGap = 58;
    const facilityBtnW = 200;
    const facilityBtnH = 46;
    const y = facilityStartY + index * facilityGap;

    const rect = this.facilityBtnGraphics[index];
    if (!rect) return;

    rect.clear();
    if (selected) {
      // 选中状态：高亮边框
      rect.fillStyle(0x3a8a6a, 1);
      rect.fillRoundedRect(facilityX, y, facilityBtnW, facilityBtnH, 8);
      rect.lineStyle(3, 0x66ffaa, 1);
      rect.strokeRoundedRect(facilityX, y, facilityBtnW, facilityBtnH, 8);
    } else {
      rect.fillStyle(0x2a4a8a, 1);
      rect.fillRoundedRect(facilityX, y, facilityBtnW, facilityBtnH, 8);
    }
  }

  /**
   * 更新说明面板内容
   */
  private updateDescPanel(title: string, desc: string): void {
    if (!this.descText) return;
    this.descText.setText(`${title}\n\n${desc}`);
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown-ESC");
  }
}
