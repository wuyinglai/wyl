import Phaser from "phaser";
import { getGameState } from "../systems/GameState";

/**
 * TownScene.ts — 阶段11.5 情报所详情占位 v1
 *
 * 玩家从主菜单进入城镇，作为远征前的整备界面。
 * 本轮新增情报所详情区：商路风险、城市状态、目标情报。
 * 只做 UI 占位，不做真实情报计算、风险生成、怪物巢穴系统。
 */
export class TownScene extends Phaser.Scene {
  /** 当前选中的设施 */
  private selectedFacility: string | null = null;

  /** 说明面板文本 */
  private descText: Phaser.GameObjects.Text | null = null;

  /** 设施按钮背景图形列表 */
  private facilityBtnGraphics: Phaser.GameObjects.Graphics[] = [];

  /** 工坊详情卡片容器 */
  private workshopCards: Phaser.GameObjects.Container | null = null;

  /** 休整所详情卡片容器 */
  private restHouseCards: Phaser.GameObjects.Container | null = null;

  /** 情报所详情卡片容器 */
  private intelOfficeCards: Phaser.GameObjects.Container | null = null;

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
      { id: "workshop", label: "工坊", desc: "工坊：后续可用于修理装备、制作工具、升级商队设备。", action: "workshop" },
      { id: "rest_house", label: "休整所", desc: "休整所：后续可用于恢复角色状态、处理伤病、调整队伍。", action: "rest_house" },
      { id: "intel_office", label: "情报所", desc: "情报所：后续可用于查看商路风险、城市状态、订单情报。", action: "intel_office" },
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
        } else if (facility.action === "workshop") {
          // 工坊：显示工坊详情面板
          this.showWorkshopDetail();
        } else if (facility.action === "rest_house") {
          // 休整所：显示休整所详情面板
          this.showRestHouseDetail();
        } else if (facility.action === "intel_office") {
          // 情报所：显示情报所详情面板
          this.showIntelOfficeDetail();
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
    this.add.text(w / 2, h - 35, "阶段11.5：情报所详情占位 v1，真实情报系统后续开放", {
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
   * 更新说明面板内容（普通设施）
   */
  private updateDescPanel(title: string, desc: string): void {
    // 隐藏工坊详情卡片
    if (this.workshopCards) {
      this.workshopCards.setVisible(false);
    }
    // 隐藏休整所详情卡片
    if (this.restHouseCards) {
      this.restHouseCards.setVisible(false);
    }
    // 隐藏情报所详情卡片
    if (this.intelOfficeCards) {
      this.intelOfficeCards.setVisible(false);
    }
    if (!this.descText) return;
    this.descText.setVisible(true);
    this.descText.setText(`${title}\n\n${desc}`);
  }

  /**
   * 显示工坊详情面板
   */
  private showWorkshopDetail(): void {
    // 隐藏普通说明文本
    if (this.descText) {
      this.descText.setVisible(false);
    }
    // 隐藏休整所详情卡片
    if (this.restHouseCards) {
      this.restHouseCards.setVisible(false);
    }
    // 隐藏情报所详情卡片
    if (this.intelOfficeCards) {
      this.intelOfficeCards.setVisible(false);
    }

    // 如果已有工坊卡片，直接显示
    if (this.workshopCards) {
      this.workshopCards.setVisible(true);
      return;
    }

    // 创建工坊详情卡片容器
    const panelX = 520;
    const panelY = 180;
    const panelW = 400;

    this.workshopCards = this.add.container(0, 0);

    // 工坊标题
    const titleText = this.add.text(panelX + panelW / 2, panelY + 75, "工坊", {
      fontSize: "22px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.workshopCards.add(titleText);

    // 工坊副标题
    const subtitleText = this.add.text(panelX + panelW / 2, panelY + 105, "修理、制作与商队设备升级将在这里进行。", {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);
    this.workshopCards.add(subtitleText);

    // 详情卡片
    const cardStartY = panelY + 140;
    const cardH = 55;
    const cardGap = 8;
    const cardW = panelW - 40;

    const cards = [
      { title: "工具图纸", desc: "后续可查看已解锁的工具图纸，并制作远征工具。" },
      { title: "修理商队设备", desc: "后续可修理车轮、货架、防护装置等商队设备。" },
      { title: "升级商队设备", desc: "后续可提升载重、防护、侦察和补给效率。" },
    ];

    this.addDetailCards(this.workshopCards, cardStartY, cardW, cardH, cardGap, cards);

    // 底部提示
    const hint = this.add.text(panelX + panelW / 2, panelY + 305, "阶段11.3：工坊详情占位，真实制作系统后续开放。", {
      fontSize: "12px",
      color: "#666666",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    this.workshopCards.add(hint);
  }

  /**
   * 显示休整所详情面板
   */
  private showRestHouseDetail(): void {
    // 隐藏普通说明文本
    if (this.descText) {
      this.descText.setVisible(false);
    }
    // 隐藏工坊详情卡片
    if (this.workshopCards) {
      this.workshopCards.setVisible(false);
    }
    // 隐藏情报所详情卡片
    if (this.intelOfficeCards) {
      this.intelOfficeCards.setVisible(false);
    }

    // 如果已有休整所卡片，直接显示
    if (this.restHouseCards) {
      this.restHouseCards.setVisible(true);
      return;
    }

    // 创建休整所详情卡片容器
    const panelX = 520;
    const panelY = 180;
    const panelW = 400;

    this.restHouseCards = this.add.container(0, 0);

    // 休整所标题
    const titleText = this.add.text(panelX + panelW / 2, panelY + 75, "休整所", {
      fontSize: "22px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.restHouseCards.add(titleText);

    // 休整所副标题
    const subtitleText = this.add.text(panelX + panelW / 2, panelY + 105, "恢复、休整与队伍调整将在这里进行。", {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);
    this.restHouseCards.add(subtitleText);

    // 详情卡片
    const cardStartY = panelY + 140;
    const cardH = 55;
    const cardGap = 8;
    const cardW = panelW - 40;

    const cards = [
      { title: "队伍休整", desc: "后续可让角色恢复状态，降低远征后的疲惫影响。" },
      { title: "伤病处理", desc: "后续可处理受伤、虚弱、异常状态等远征损耗。" },
      { title: "队伍调整", desc: "后续可查看角色状态，并为下一次远征调整出发队伍。" },
    ];

    this.addDetailCards(this.restHouseCards, cardStartY, cardW, cardH, cardGap, cards);

    // 底部提示
    const hint = this.add.text(panelX + panelW / 2, panelY + 305, "阶段11.4：休整所详情占位，真实恢复系统后续开放。", {
      fontSize: "12px",
      color: "#666666",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    this.restHouseCards.add(hint);
  }

  /**
   * 显示情报所详情面板
   */
  private showIntelOfficeDetail(): void {
    // 隐藏普通说明文本
    if (this.descText) {
      this.descText.setVisible(false);
    }
    // 隐藏工坊详情卡片
    if (this.workshopCards) {
      this.workshopCards.setVisible(false);
    }
    // 隐藏休整所详情卡片
    if (this.restHouseCards) {
      this.restHouseCards.setVisible(false);
    }

    // 如果已有情报所卡片，直接显示
    if (this.intelOfficeCards) {
      this.intelOfficeCards.setVisible(true);
      return;
    }

    // 创建情报所详情卡片容器
    const panelX = 520;
    const panelY = 180;
    const panelW = 400;

    this.intelOfficeCards = this.add.container(0, 0);

    // 情报所标题
    const titleText = this.add.text(panelX + panelW / 2, panelY + 75, "情报所", {
      fontSize: "22px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.intelOfficeCards.add(titleText);

    // 情报所副标题
    const subtitleText = this.add.text(panelX + panelW / 2, panelY + 105, "商路风险、城市状态与订单线索将在这里汇总。", {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);
    this.intelOfficeCards.add(subtitleText);

    // 详情卡片
    const cardStartY = panelY + 140;
    const cardH = 55;
    const cardGap = 8;
    const cardW = panelW - 40;

    const cards = [
      { title: "商路风险", desc: "后续可查看商路危险等级、敌人活动和特殊条款风险。" },
      { title: "城市状态", desc: "后续可查看各城市贡献、恢复进度和可用订单变化。" },
      { title: "目标情报", desc: "后续可查看订单目标、怪物巢穴、废墟和特殊地点线索。" },
    ];

    this.addDetailCards(this.intelOfficeCards, cardStartY, cardW, cardH, cardGap, cards);

    // 底部提示
    const hint = this.add.text(panelX + panelW / 2, panelY + 305, "阶段11.5：情报所详情占位，真实情报系统后续开放。", {
      fontSize: "12px",
      color: "#666666",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    this.intelOfficeCards.add(hint);
  }

  /**
   * 复用方法：添加详情卡片（工坊、休整所和情报所共用）
   */
  private addDetailCards(
    container: Phaser.GameObjects.Container,
    cardStartY: number,
    cardW: number,
    cardH: number,
    cardGap: number,
    cards: Array<{ title: string; desc: string }>
  ): void {
    const panelX = 520;
    const panelY = 180;

    cards.forEach((card, i) => {
      const cardY = cardStartY + i * (cardH + cardGap);

      // 卡片背景
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x1a2a3a, 0.9);
      cardBg.fillRoundedRect(panelX + 20, cardY, cardW, cardH, 6);
      cardBg.lineStyle(1, 0x4488ff, 0.3);
      cardBg.strokeRoundedRect(panelX + 20, cardY, cardW, cardH, 6);
      container.add(cardBg);

      // 卡片标题
      const cardTitle = this.add.text(panelX + 35, cardY + 15, card.title, {
        fontSize: "16px",
        color: "#88ccff",
        fontFamily: "monospace",
        fontStyle: "bold",
      }).setOrigin(0, 0);
      container.add(cardTitle);

      // 卡片描述
      const cardDesc = this.add.text(panelX + 35, cardY + 35, card.desc, {
        fontSize: "12px",
        color: "#888888",
        fontFamily: "monospace",
        wordWrap: { width: cardW - 30 },
      }).setOrigin(0, 0);
      container.add(cardDesc);
    });
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown-ESC");
  }
}
