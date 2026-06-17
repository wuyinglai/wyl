import Phaser from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import {
  getAllCityRevivalStates,
  getCityRevivalLevelLabel,
  getCityDisplayName,
  calculateCityRevivalLevel,
} from "../systems/cityRevivalSystem";
import { getAllTools, formatToolSummary, isToolOwned, tryBuyTool, getRarityLabel } from "../systems/toolSystem";

/**
 * TownScene.ts — 阶段12 城镇整备界面
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

  /** 默认设施说明面板的背景/标题元素（需在显示详情面板时隐藏） */
  private defaultPanelBg: Phaser.GameObjects.Graphics | null = null;
  private defaultPanelTitle: Phaser.GameObjects.Text | null = null;
  private defaultPanelSep: Phaser.GameObjects.Graphics | null = null;

  // ===== 工具商店（虚拟滚动列表 — 只渲染可见项）=====
  private storageToolsPanelContainer: Phaser.GameObjects.Container | null = null;
  private storageToolsViewportContainer: Phaser.GameObjects.Container | null = null;
  private storageToolsScrollIndex: number = 0;
  private storageToolsVisibleCount: number = 4;
  private storageToolsCardHeight: number = 76;
  private storageToolsCardGap: number = 10;
  private storageToolsWheelHandler: ((pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => void) | null = null;
  private storageToolsPanelX: number = 520;
  private storageToolsPanelY: number = 160;
  private storageToolsPanelW: number = 400;
  private storageToolsPanelH: number = 520;
  private storageToolsBoxX: number = 520;
  private storageToolsBoxY: number = 255;
  private storageToolsBoxW: number = 400;
  private storageToolsBoxH: number = 360;

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

    // ========== 阶段13.3：城市复兴轻量显示（不挡按钮、不做复杂UI） ==========
    const revivalStartY = infoStartY + infoValues.length * infoLineH + 32;
    const revivalLabelStyle = { fontSize: "14px", color: "#88ccff", fontFamily: "monospace" };
    const revivalTextStyle = { fontSize: "12px", color: "#aacccc", fontFamily: "monospace" };
    this.add.text(infoX - 15, revivalStartY - 2, "城市复兴", revivalLabelStyle).setOrigin(0, 0.5);
    const allRevival = getAllCityRevivalStates(gs.cityRevivalStates);
    if (allRevival.length > 0) {
      allRevival.forEach((cs, idx) => {
        const cityName = getCityDisplayName(cs.cityId);
        const label = getCityRevivalLevelLabel(cs.level);
        const y = revivalStartY + 20 + idx * 22;
        this.add.text(
          infoX - 15,
          y,
          `${cityName} · Lv.${cs.level} ${label} · ${cs.progress}%`,
          revivalTextStyle
        ).setOrigin(0, 0.5);
      });
    }

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
      { id: "warehouse", label: "仓库/工具", desc: "仓库/工具：查看工具、购买工具、为远征做准备。", action: "storage_tools" },
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
          this.scene.start("RouteSelectScene");
        } else if (facility.action === "workshop") {
          this.showWorkshopDetail();
        } else if (facility.action === "rest_house") {
          this.showRestHouseDetail();
        } else if (facility.action === "intel_office") {
          this.showIntelOfficeDetail();
        } else if (facility.action === "storage_tools") {
          this.showStorageToolsDetail();
        } else {
          this.updateDescPanel(facility.label, facility.desc);
        }
      });
    });

    // ========== 右侧：默认设施说明面板 ==========
    const panelX = 520;
    const panelY = 180;
    const panelW = 400;
    const panelH = 320;

    this.defaultPanelBg = this.add.graphics();
    this.defaultPanelBg.fillStyle(0x0d1b2a, 0.9);
    this.defaultPanelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    this.defaultPanelBg.lineStyle(2, 0x4488ff, 0.5);
    this.defaultPanelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);

    this.defaultPanelTitle = this.add.text(panelX + panelW / 2, panelY + 30, "设施说明", {
      fontSize: "20px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.defaultPanelSep = this.add.graphics();
    this.defaultPanelSep.lineStyle(1, 0x4488ff, 0.3);
    this.defaultPanelSep.strokeLineShape(new Phaser.Geom.Line(panelX + 20, panelY + 55, panelX + panelW - 20, panelY + 55));

    this.descText = this.add.text(panelX + panelW / 2, panelY + panelH / 2 + 20, "请选择左侧设施查看详情", {
      fontSize: "16px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);

    // ========== 返回主菜单按钮 ==========
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
      this.scene.start("MainMenuScene");
    });

    // ESC 返回主菜单
    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });

    // ========== 底部提示 ==========
    this.add.text(w / 2, h - 35, "阶段12：城镇整备 — 可在仓库/工具中购买并携带远征工具", {
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
   * 隐藏默认设施说明面板
   */
  private hideDefaultPanel(): void {
    if (this.defaultPanelBg) this.defaultPanelBg.setVisible(false);
    if (this.defaultPanelTitle) this.defaultPanelTitle.setVisible(false);
    if (this.defaultPanelSep) this.defaultPanelSep.setVisible(false);
  }

  /**
   * 显示默认设施说明面板
   */
  private showDefaultPanel(): void {
    if (this.defaultPanelBg) this.defaultPanelBg.setVisible(true);
    if (this.defaultPanelTitle) this.defaultPanelTitle.setVisible(true);
    if (this.defaultPanelSep) this.defaultPanelSep.setVisible(true);
  }

  /**
   * 销毁工具商店（释放滚动事件、销毁所有卡片和按钮）
   * 所有 GameObject（工具卡、购买按钮、hitArea）都会被彻底摧毁。
   * preserveIndex: 若为 true，不重置滚动索引（用于滚动重建时保留位置）
   */
  private destroyStorageToolsShop(preserveIndex: boolean = false): void {
    // 1. 移除滚轮监听
    if (this.storageToolsWheelHandler) {
      this.input.off("wheel", this.storageToolsWheelHandler);
      this.storageToolsWheelHandler = null;
    }
    // 2. 销毁可视区容器（内部所有工具卡+购买按钮+hitArea 一并销毁）
    if (this.storageToolsViewportContainer) {
      this.storageToolsViewportContainer.destroy();
      this.storageToolsViewportContainer = null;
    }
    // 3. 销毁主面板容器（标题、银币、滚动框背景、底部提示等）
    if (this.storageToolsPanelContainer) {
      this.storageToolsPanelContainer.destroy();
      this.storageToolsPanelContainer = null;
    }
    // 4. 重置滚动索引
    if (!preserveIndex) {
      this.storageToolsScrollIndex = 0;
    }
  }

  /**
   * 更新说明面板内容（普通设施）
   */
  private updateDescPanel(title: string, desc: string): void {
    // 销毁工具商店
    this.destroyStorageToolsShop();
    // 隐藏其他详情面板
    if (this.workshopCards) this.workshopCards.setVisible(false);
    if (this.restHouseCards) this.restHouseCards.setVisible(false);
    if (this.intelOfficeCards) this.intelOfficeCards.setVisible(false);

    this.showDefaultPanel();
    if (!this.descText) return;
    this.descText.setVisible(true);
    this.descText.setText(`${title}\n\n${desc}`);
  }

  /**
   * 显示工坊详情面板
   */
  private showWorkshopDetail(): void {
    this.destroyStorageToolsShop();
    this.hideDefaultPanel();
    if (this.descText) this.descText.setVisible(false);
    if (this.restHouseCards) this.restHouseCards.setVisible(false);
    if (this.intelOfficeCards) this.intelOfficeCards.setVisible(false);

    if (this.workshopCards) {
      this.workshopCards.setVisible(true);
      return;
    }

    const panelX = 520;
    const panelY = 180;
    const panelW = 400;

    this.workshopCards = this.add.container(0, 0);

    const titleText = this.add.text(panelX + panelW / 2, panelY + 75, "工坊", {
      fontSize: "22px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.workshopCards.add(titleText);

    const subtitleText = this.add.text(panelX + panelW / 2, panelY + 105, "修理、制作与商队设备升级将在这里进行。", {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);
    this.workshopCards.add(subtitleText);

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
    this.destroyStorageToolsShop();
    this.hideDefaultPanel();
    if (this.descText) this.descText.setVisible(false);
    if (this.workshopCards) this.workshopCards.setVisible(false);
    if (this.intelOfficeCards) this.intelOfficeCards.setVisible(false);

    if (this.restHouseCards) {
      this.restHouseCards.setVisible(true);
      return;
    }

    const panelX = 520;
    const panelY = 180;
    const panelW = 400;

    this.restHouseCards = this.add.container(0, 0);

    const titleText = this.add.text(panelX + panelW / 2, panelY + 75, "休整所", {
      fontSize: "22px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.restHouseCards.add(titleText);

    const subtitleText = this.add.text(panelX + panelW / 2, panelY + 105, "恢复、休整与队伍调整将在这里进行。", {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);
    this.restHouseCards.add(subtitleText);

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
    this.destroyStorageToolsShop();
    this.hideDefaultPanel();
    if (this.descText) this.descText.setVisible(false);
    if (this.workshopCards) this.workshopCards.setVisible(false);
    if (this.restHouseCards) this.restHouseCards.setVisible(false);

    if (this.intelOfficeCards) {
      this.intelOfficeCards.setVisible(true);
      return;
    }

    const panelX = 520;
    const panelY = 180;
    const panelW = 400;

    this.intelOfficeCards = this.add.container(0, 0);

    const titleText = this.add.text(panelX + panelW / 2, panelY + 75, "情报所", {
      fontSize: "22px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    }).setOrigin(0.5);
    this.intelOfficeCards.add(titleText);

    const subtitleText = this.add.text(panelX + panelW / 2, panelY + 105, "商路风险、城市状态与订单线索将在这里汇总。", {
      fontSize: "14px",
      color: "#aaaaaa",
      fontFamily: "monospace",
      align: "center",
      wordWrap: { width: panelW - 40 },
    }).setOrigin(0.5);
    this.intelOfficeCards.add(subtitleText);

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

    const hint = this.add.text(panelX + panelW / 2, panelY + 305, "阶段11.5：情报所详情占位，真实情报系统后续开放。", {
      fontSize: "12px",
      color: "#666666",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    this.intelOfficeCards.add(hint);
  }

  /**
   * 显示工具商店（虚拟滚动列表 — 只渲染可见项，无隐藏卡片/按钮/hitArea
   *
   * 结构：
   *   storageToolsPanelContainer (整个面板，坐标 0,0）
   *     ├─ 外层边框 (x=520, y=160, w=400, h=520)
   *     ├─ 标题区（固定在滚动框上方）
   *     │   └─ 标题/银币/副标题/分隔线
   *     ├─ 滚动框边框 (y=255, h=360) —— 明确的滚动区域边框
   *     ├─ storageToolsViewportContainer (viewport，只存放当前可见的 4 张工具卡)
   *     └─ 底部（固定文本 + 滚动提示/滚动条）
   *
   * 可见性保证：
   *   - 不在 visibleTools = allTools.slice(storageToolsScrollIndex,
   *     storageToolsScrollIndex+storageToolsVisibleCount)
   *   - 其他工具根本不创建 GameObject、不创建按钮、不创建 hitArea
   *
   * @param preserveScrollIndex 若为 true，保留当前滚动索引
   */
  private showStorageToolsDetail(preserveScrollIndex: boolean = false): void {
    const gs = getGameState();

    // 1. 隐藏默认面板和普通说明文本
    this.hideDefaultPanel();
    if (this.descText) this.descText.setVisible(false);

    // 2. 隐藏其他详情面板
    if (this.workshopCards) this.workshopCards.setVisible(false);
    if (this.restHouseCards) this.restHouseCards.setVisible(false);
    if (this.intelOfficeCards) this.intelOfficeCards.setVisible(false);

    // 3. 销毁旧的工具商店（确保没有残留卡片、按钮、hitArea）
    this.destroyStorageToolsShop(preserveScrollIndex);

    // 4. 读取工具列表和布局参数
    const allTools = getAllTools();
    const totalCount = allTools.length;
    const panelX = this.storageToolsPanelX; // 520
    const panelY = this.storageToolsPanelY; // 160
    const panelW = this.storageToolsPanelW; // 400
    const panelH = this.storageToolsPanelH; // 520
    const boxX = this.storageToolsBoxX;       // 520
    const boxY = this.storageToolsBoxY;       // 255
    const boxW = this.storageToolsBoxW;       // 400
    const boxH = this.storageToolsBoxH;       // 360
    const visibleCount = this.storageToolsVisibleCount; // 4
    const maxScrollIndex = Math.max(0, totalCount - visibleCount);

    // 5. clamp 滚动索引
    this.storageToolsScrollIndex = Phaser.Math.Clamp(
      this.storageToolsScrollIndex,
      0,
      maxScrollIndex
    );

    // 6. 创建主面板容器
    this.storageToolsPanelContainer = this.add.container(0, 0);

    // 7. 外层面板背景（带圆角边框，明确面板）
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0d1b2a, 0.95);
    panelBg.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
    panelBg.lineStyle(2, 0x4488ff, 0.5);
    panelBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
    this.storageToolsPanelContainer.add(panelBg);

    // 8. 标题区（固定在滚动框上方，不随滚动移动）
    const titleText = this.add.text(panelX + panelW / 2, panelY + 22,
      "仓库 / 远征工具", {
        fontSize: "20px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
      }).setOrigin(0.5);
    this.storageToolsPanelContainer.add(titleText);

    const silverText = this.add.text(panelX + panelW - 15, panelY + 22,
      `银币: ${gs.silver}`, {
        fontSize: "13px",
        color: "#ffd700",
        fontFamily: "monospace",
      }).setOrigin(1, 0.5);
    this.storageToolsPanelContainer.add(silverText);

    const subtitleText = this.add.text(panelX + 20, panelY + 50,
      "鼠标滚轮在列表区域内滚动查看更多工具", {
        fontSize: "11px",
        color: "#6688aa",
        fontFamily: "monospace",
      }).setOrigin(0, 0);
    this.storageToolsPanelContainer.add(subtitleText);

    const headerSep = this.add.graphics();
    headerSep.lineStyle(1, 0x4488ff, 0.25);
    headerSep.strokeLineShape(
      new Phaser.Geom.Line(panelX + 20, panelY + 90, panelX + panelW - 20, panelY + 90)
    );
    this.storageToolsPanelContainer.add(headerSep);

    // 9. 滚动框（带边框，明显告诉用户"这里是滚动区域"）
    const boxBg = this.add.graphics();
    boxBg.fillStyle(0x0a1520, 1);
    boxBg.fillRoundedRect(boxX, boxY, boxW, boxH, 6);
    boxBg.lineStyle(2, 0x4488ff, 0.7);
    boxBg.strokeRoundedRect(boxX, boxY, boxW, boxH, 6);
    this.storageToolsPanelContainer.add(boxBg);

    // 10. viewport container —— 专门放可见卡片的容器
    this.storageToolsViewportContainer = this.add.container(0, 0);
    this.storageToolsPanelContainer.add(this.storageToolsViewportContainer);

    // 11. 只渲染当前可见的工具卡（其他工具完全不创建 GameObject）
    this.renderVisibleToolCards();

    // 12. 底部：可见范围文本 + 简单滚动条指示
    const footerY = panelY + panelH - 25;
    const startIdx = this.storageToolsScrollIndex;
    const endIdx = Math.min(startIdx + visibleCount, totalCount);
    const rangeText = this.add.text(panelX + 20, footerY,
      `工具 ${startIdx + 1}-${endIdx} / ${totalCount}`, {
        fontSize: "12px",
        color: "#888888",
        fontFamily: "monospace",
      }).setOrigin(0, 0.5);
    this.storageToolsPanelContainer.add(rangeText);

    if (maxScrollIndex > 0) {
      const scrollBarX = panelX + panelW - 80;
      const scrollBarY = footerY;
      const scrollBarW = 60;
      const scrollBarH = 4;
      const scrollTrack = this.add.graphics();
      scrollTrack.fillStyle(0x1a2a3a, 1);
      scrollTrack.fillRect(scrollBarX, scrollBarY - scrollBarH / 2, scrollBarW, scrollBarH);
      this.storageToolsPanelContainer.add(scrollTrack);

      const positionRatio = this.storageToolsScrollIndex / maxScrollIndex;
      const thumbW = 15;
      const thumbX = scrollBarX + positionRatio * (scrollBarW - thumbW);
      const scrollThumb = this.add.graphics();
      scrollThumb.fillStyle(0x4488ff, 1);
      scrollThumb.fillRect(thumbX, scrollBarY - scrollBarH / 2, thumbW, scrollBarH);
      this.storageToolsPanelContainer.add(scrollThumb);
    }

    // 13. 注册滚轮监听（只在滚动框区域内响应）
    this.storageToolsWheelHandler = (pointer: Phaser.Input.Pointer) => {
      const inBox =
        pointer.x >= boxX &&
        pointer.x <= boxX + boxW &&
        pointer.y >= boxY &&
        pointer.y <= boxY + boxH;
      if (!inBox) return;

      const oldIndex = this.storageToolsScrollIndex;
      let newIndex = oldIndex;
      if (pointer.deltaY > 0) newIndex = Math.min(maxScrollIndex, oldIndex + visibleCount);
      else if (pointer.deltaY < 0) newIndex = Math.max(0, oldIndex - visibleCount);

      if (newIndex !== oldIndex) {
        this.storageToolsScrollIndex = newIndex;
        // 清空 viewport 并重新渲染可见卡；滚动索引不会被 destroyShop 清理
        // （不会调用 destroyShop 以避免重建整个面板，
        // 直接清空 viewport 并重新渲染 + 更新底部提示）
        if (this.storageToolsViewportContainer) {
          this.storageToolsViewportContainer.removeAll(true);
        }
        this.renderVisibleToolCards();
        // 更新底部 "工具 X-Y / Z" 文本
        if (this.storageToolsPanelContainer) {
          const newStart = newIndex + 1;
          const newEnd = Math.min(newIndex + visibleCount, totalCount);
          const list = this.storageToolsPanelContainer.list;
          for (let ci = 0; ci < list.length; ci++) {
            const child = list[ci] as any;
            if (child.type === "Text" && /^工具 \d+/.test(child.text)) {
              child.setText(`工具 ${newStart}-${newEnd} / ${totalCount}`);
              break;
            }
          }
          // 更新滚动条位置块
          if (maxScrollIndex > 0) {
            const newPos = newIndex / maxScrollIndex;
            const scrollBarX2 = panelX + panelW - 80;
            const scrollBarY2 = footerY;
            const scrollBarW2 = 60;
            const thumbW2 = 15;
            const thumbX2 = scrollBarX2 + newPos * (scrollBarW2 - thumbW2);
            // 找到最后一个 graphics（滚动条位置块是最后一个 graphics）
            let gfxCount = 0;
            let targetGfx: Phaser.GameObjects.Graphics | null = null;
            for (let ci = list.length - 1; ci >= 0; ci--) {
              if ((list[ci] as any).type === "Graphics") {
                gfxCount++;
                if (gfxCount === 1) {
                  targetGfx = list[ci] as Phaser.GameObjects.Graphics;
                  break;
                }
              }
            }
            if (targetGfx) {
              targetGfx.clear();
              targetGfx.fillStyle(0x4488ff, 1);
              targetGfx.fillRect(thumbX2, scrollBarY2 - 2, thumbW2, 4);
            }
          }
          // 更新银币文本
          for (let ci = 0; ci < list.length; ci++) {
            const child = list[ci] as any;
            if (child.type === "Text" && /^银币:/.test(child.text)) {
              child.setText(`银币: ${getGameState().silver}`);
              break;
            }
          }
        }
      }
    };

    this.input.on("wheel", this.storageToolsWheelHandler);
  }

  /**
   * 渲染当前可见工具卡（只渲染 storageToolsVisibleCount 张）
   *
   * 原则：
   *   1. 使用 storageToolsScrollIndex 作为起始索引
   *   2. 只渲染 tools.slice(scrollIndex, scrollIndex+visibleCount)
   *   3. 不在可视范围的工具不创建任何对象
   *   4. 每张卡的购买按钮 = Container，hitArea 精确
   */
  private renderVisibleToolCards(): void {
    const gs = getGameState();
    const allTools = getAllTools();
    const totalCount = allTools.length;
    const boxY = this.storageToolsBoxY;
    const boxW = this.storageToolsBoxW;
    const cardW = boxW - 40;
    const cardH = this.storageToolsCardHeight;
    const cardGap = this.storageToolsCardGap;
    const cardStartX = this.storageToolsBoxX + 20;
    const visibleCount = this.storageToolsVisibleCount;
    const maxScrollIndex = Math.max(0, totalCount - visibleCount);
    this.storageToolsScrollIndex = Phaser.Math.Clamp(
      this.storageToolsScrollIndex, 0, maxScrollIndex
    );

    const startIdx = this.storageToolsScrollIndex;
    const endIdx = Math.min(startIdx + visibleCount, totalCount);
    const visibleTools = allTools.slice(startIdx, endIdx);

    // 清空 viewport，旧卡片/按钮/hitArea 会被 removeAll(true) 销毁
    if (this.storageToolsViewportContainer) {
      this.storageToolsViewportContainer.removeAll(true);
    }

    for (let i = 0; i < visibleTools.length; i++) {
      const tool = visibleTools[i];
      const cardTopY = boxY + 10 + i * (cardH + cardGap);

      // 卡片背景
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x1a2a3a, 0.9);
      cardBg.fillRoundedRect(cardStartX, cardTopY, cardW, cardH, 6);
      cardBg.lineStyle(1, 0x4488ff, 0.3);
      cardBg.strokeRoundedRect(cardStartX, cardTopY, cardW, cardH, 6);
      this.storageToolsViewportContainer!.add(cardBg);

      // 工具名
      const nameText = this.add.text(cardStartX + 12, cardTopY + 10, tool.name, {
        fontSize: "15px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      }).setOrigin(0, 0);
      this.storageToolsViewportContainer!.add(nameText);

      // 稀有度 + 价格
      const rarity = getRarityLabel(tool.rarity);
      const priceText = this.add.text(cardStartX + 12, cardTopY + 32, `${rarity} · ${tool.price}银`, {
        fontSize: "12px",
        color: tool.rarity === "rare" ? "#ff6b6b" : tool.rarity === "uncommon" ? "#4ecdc4" : "#888888",
        fontFamily: "monospace",
      }).setOrigin(0, 0);
      this.storageToolsViewportContainer!.add(priceText);

      // 描述
      const descText = this.add.text(cardStartX + 12, cardTopY + 50, tool.description, {
        fontSize: "11px",
        color: "#888888",
        fontFamily: "monospace",
        wordWrap: { width: cardW - 110 },
      }).setOrigin(0, 0);
      this.storageToolsViewportContainer!.add(descText);

      // 购买按钮（Container，内部坐标 0,0，hitArea 使用 Rectangle(-btnW/2,-btnH/2,btnW,btnH)
      const btnW = 90;
      const btnH = 28;
      const btnCenterX = cardStartX + cardW - btnW / 2 - 12;
      const btnCenterY = cardTopY + cardH / 2;

      const owned = isToolOwned(gs.ownedTools, tool.id);
      const canAfford = gs.silver >= tool.price;

      let btnText: string;
      let btnColor: number;
      let btnInteractive: boolean;

      if (!tool.isImplemented) {
        btnText = "暂未开放";
        btnColor = 0x555555;
        btnInteractive = false;
      } else if (owned) {
        btnText = "已拥有";
        btnColor = 0x4a8c4a;
        btnInteractive = false;
      } else if (!canAfford) {
        btnText = "缺银";
        btnColor = 0x8b4513;
        btnInteractive = false;
      } else {
        btnText = `购买 ${tool.price}银`;
        btnColor = 0x4a6fa5;
        btnInteractive = true;
      }

      // Container = 按钮视觉中心
      const btnContainer = this.add.container(btnCenterX, btnCenterY);
      // 背景 rectangle 在 container 内部坐标 0,0
      const bgRect = this.add.rectangle(0, 0, btnW, btnH, btnColor);
      bgRect.setStrokeStyle(1, btnColor);
      // 文本在 container 内部坐标 0,0
      const textEl = this.add.text(0, 0, btnText, {
        fontSize: "11px",
        color: "#ffffff",
        fontFamily: "monospace",
      }).setOrigin(0.5);
      btnContainer.add([bgRect, textEl]);

      if (btnInteractive) {
        btnContainer.setSize(btnW, btnH);
        // hitArea 使用 Rectangle(-btnW/2, -btnH/2, btnW, btnH)
        btnContainer.setInteractive(
          new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
          Phaser.Geom.Rectangle.Contains
        );

        btnContainer.on("pointerover", () => {
          bgRect.setFillStyle(0x5a8fd5);
        });
        btnContainer.on("pointerout", () => {
          bgRect.setFillStyle(btnColor);
        });
        btnContainer.on("pointerdown", () => {
          const currentGs = getGameState();
          const result = tryBuyTool(currentGs.ownedTools, currentGs.silver, tool.id);
          if (result.success) {
            currentGs.ownedTools = result.newOwned!;
            currentGs.silver = result.newSilver!;
            setGameState(currentGs);
            console.log(`[商店] 购买工具: ${tool.name}，剩余银币: ${currentGs.silver}`);
            // 购买后重新渲染可见卡片（保持滚动位置）
            this.renderVisibleToolCards();
            // 更新面板上的银币显示
            if (this.storageToolsPanelContainer) {
              const list = this.storageToolsPanelContainer.list;
              for (let ci = 0; ci < list.length; ci++) {
                const child = list[ci] as any;
                if (child.type === "Text" && /^银币:/.test(child.text)) {
                  child.setText(`银币: ${currentGs.silver}`);
                  break;
                }
              }
            }
          }
        });
      }
      this.storageToolsViewportContainer!.add(btnContainer);
    }
  }

  /**
   * 复用方法：添加详情卡片（工坊、休整所、情报所共用）
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

    cards.forEach((card, i) => {
      const cardY = cardStartY + i * (cardH + cardGap);

      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x1a2a3a, 0.9);
      cardBg.fillRoundedRect(panelX + 20, cardY, cardW, cardH, 6);
      cardBg.lineStyle(1, 0x4488ff, 0.3);
      cardBg.strokeRoundedRect(panelX + 20, cardY, cardW, cardH, 6);
      container.add(cardBg);

      const cardTitle = this.add.text(panelX + 35, cardY + 15, card.title, {
        fontSize: "16px",
        color: "#88ccff",
        fontFamily: "monospace",
        fontStyle: "bold",
      }).setOrigin(0, 0);
      container.add(cardTitle);

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
    this.destroyStorageToolsShop();
  }
}
