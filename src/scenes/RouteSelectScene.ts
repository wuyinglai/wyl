import { Scene } from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import { CityRoute, getUnlockedRoutes } from "../data/cityRoutes";
import { CityOrder, getDefaultOrderForRoute, getUnlockedOrdersForRoute, formatRequiredGoods } from "../data/cityOrders";
import { TooltipManager } from "../systems/tooltipSystem";
import { formatCityProgress, getCityProgressDetailLines } from "../systems/cityProgressSystem";

/**
 * 商路与目标城市选择场景（阶段7.1）
 * 玩家开始远征前选择要支援的城市与商路
 *
 * 布局策略：
 * - 宽屏（>=1024px）：横排显示所有卡片
 * - 窄屏（<1024px）：分页模式，一次显示一张卡片，左右切换
 */
export class RouteSelectScene extends Scene {
  private selectedRouteId: string | null = null;
  private routeCards: Phaser.GameObjects.Container[] = [];
  private isSelecting = false; // 防重复点击
  private tooltipManager: TooltipManager | null = null;
  private currentPage = 0;
  private routes: CityRoute[] = [];
  private pageIndicatorText!: Phaser.GameObjects.Text;
  private prevBtn!: Phaser.GameObjects.Text;
  private nextBtn!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "RouteSelectScene" });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // 实际显示宽度（用于判断是否需要分页）
    const displayWidth = this.scale.displaySize.width;

    // 重置状态（场景可能被 stop+start 重新创建）
    this.routeCards = [];
    this.currentPage = 0;
    this.selectedRouteId = null;
    this.isSelecting = false;

    this.tooltipManager = new TooltipManager(this, 500);

    // 背景
    this.add.rectangle(w / 2, h / 2, w, h, 0x0a0a1a);

    // 标题
    this.add
      .text(w / 2, 40, "选择商路", {
        fontSize: "32px",
        color: "#ffcc44",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 副标题
    this.add
      .text(w / 2, 80, "选择本次远征要支援的城市与商路", {
        fontSize: "16px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 使用 getUnlockedRoutes() 获取可用商路
    this.routes = getUnlockedRoutes();

    // 无可用商路兜底
    if (this.routes.length === 0) {
      this.showNoRoutesFallback(w, h);
    } else {
      // 判断布局模式：宽屏横排，窄屏分页
      const PAGINATE_THRESHOLD = 1100;
      if (displayWidth < PAGINATE_THRESHOLD) {
        this.createPaginatedLayout(w, h);
      } else {
        this.createGridLayout(w, h);
      }

      // 底部提示
      this.add
        .text(w / 2, h - 30, "点击商路卡片选择 | 按 ESC 返回城镇", {
          fontSize: "14px",
          color: "#666666",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);

      // 返回城镇按钮（左上角）
      this.createBackButton(30, 30, 120, 36, "返回城镇", () => {
        this.scene.start("TownScene");
      });
    }

    // ESC 返回城镇
    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("TownScene");
    });

    console.log("[商路选择] 场景初始化完成，显示", this.routes.length, "条商路");
  }

  /**
   * 宽屏布局：横排显示所有卡片
   */
  private createGridLayout(w: number, h: number): void {
    const routes = this.routes;
    const maxCardWidth = 340;
    const gap = 20;
    const availableWidth = Math.min(w - 40, routes.length * maxCardWidth + (routes.length - 1) * gap);
    const cardWidth = Math.min(maxCardWidth, (availableWidth - (routes.length - 1) * gap) / routes.length);
    const cardHeight = Math.min(400, h - 100);
    const totalWidth = routes.length * cardWidth + (routes.length - 1) * gap;
    const startX = Math.max(cardWidth / 2 + 10, (w - totalWidth) / 2 + cardWidth / 2);
    const cardY = h / 2 + 10;

    routes.forEach((route, index) => {
      const cx = startX + index * (cardWidth + gap);
      const card = this.createRouteCard(cx, cardY, cardWidth, cardHeight, route);
      this.routeCards.push(card);
    });
  }

  /**
   * 窄屏布局：分页模式，一次显示一张卡片
   */
  private createPaginatedLayout(w: number, h: number): void {
    this.currentPage = 0;

    const cardWidth = Math.min(360, w - 80);
    const cardHeight = Math.min(420, h - 180);
    const cardX = w / 2;
    const cardY = h / 2;

    // 创建所有卡片（只显示当前页）
    this.routes.forEach((route, index) => {
      const card = this.createRouteCard(cardX, cardY, cardWidth, cardHeight, route);
      card.setVisible(index === 0);
      this.routeCards.push(card);
    });

    // 页码指示器
    this.pageIndicatorText = this.add
      .text(w / 2, h - 60, `1 / ${this.routes.length}`, {
        fontSize: "16px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 左右切换按钮
    this.prevBtn = this.add
      .text(40, h / 2, "◀", {
        fontSize: "28px",
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.nextBtn = this.add
      .text(w - 40, h / 2, "▶", {
        fontSize: "28px",
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.updatePaginationUI();

    this.prevBtn.on("pointerdown", () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.updatePaginationUI();
      }
    });

    this.nextBtn.on("pointerdown", () => {
      if (this.currentPage < this.routes.length - 1) {
        this.currentPage++;
        this.updatePaginationUI();
      }
    });

    // 键盘左右切换
    this.input.keyboard?.on("keydown-LEFT", () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.updatePaginationUI();
      }
    });
    this.input.keyboard?.on("keydown-RIGHT", () => {
      if (this.currentPage < this.routes.length - 1) {
        this.currentPage++;
        this.updatePaginationUI();
      }
    });
  }

  /**
   * 更新分页 UI
   */
  private updatePaginationUI(): void {
    // 切换页面时隐藏 Tooltip，防止残留
    if (this.tooltipManager) this.tooltipManager.hide();

    this.routeCards.forEach((card, i) => {
      card.setVisible(i === this.currentPage);
    });
    this.pageIndicatorText.setText(`${this.currentPage + 1} / ${this.routes.length}`);
    this.prevBtn.setStyle({ color: this.currentPage > 0 ? "#ffcc44" : "#333333" });
    this.nextBtn.setStyle({ color: this.currentPage < this.routes.length - 1 ? "#ffcc44" : "#333333" });
  }

  /**
   * 无可用商路时显示兜底UI
   */
  private showNoRoutesFallback(w: number, h: number): void {
    this.add
      .text(w / 2, h / 2 - 30, "暂无可用商路", {
        fontSize: "24px",
        color: "#ff4444",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h / 2 + 20, "当前没有解锁的商路，请稍后再试", {
        fontSize: "14px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h - 50, "按 ESC 返回主菜单", {
        fontSize: "14px",
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    console.warn("[商路选择] 无可用商路，显示兜底UI");
  }

  /**
   * 创建单条商路卡片（精简内容 + Tooltip 显示详情）
   */
  private createRouteCard(
    x: number,
    y: number,
    width: number,
    height: number,
    route: CityRoute
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // 卡片背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
    bg.lineStyle(2, 0x333355, 1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
    container.add(bg);

    let currentY = -height / 2 + 20;

    // 城市名
    const cityName = this.add
      .text(0, currentY, route.cityName, {
        fontSize: "24px",
        color: "#ffcc44",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    container.add(cityName);
    currentY += 35;

    // 商路名
    const routeName = this.add
      .text(0, currentY, route.routeName, {
        fontSize: "14px",
        color: "#8888ff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    container.add(routeName);
    currentY += 25;

    // 定位标签
    const tagline = this.add
      .text(0, currentY, route.tagline, {
        fontSize: "13px",
        color: "#44cc88",
        fontStyle: "italic",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    container.add(tagline);
    currentY += 30;

    // 分隔线
    const line = this.add.graphics();
    line.lineStyle(1, 0x444466, 1);
    line.lineBetween(-width / 2 + 20, currentY, width / 2 - 20, currentY);
    container.add(line);
    currentY += 12;

    // 等级信息（精简为两行）
    const levelsRow1 = `风险:${route.riskLevel} 收益:${route.profitLevel} 补给:${route.supplyLevel}`;
    const levelsRow2 = `战斗:${route.combatLevel} 贸易:${route.tradeLevel}`;
    const lvl1 = this.add
      .text(0, currentY, levelsRow1, {
        fontSize: "12px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    container.add(lvl1);
    currentY += 20;
    const lvl2 = this.add
      .text(0, currentY, levelsRow2, {
        fontSize: "12px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    container.add(lvl2);
    currentY += 30;

    // 分隔线
    const line2 = this.add.graphics();
    line2.lineStyle(1, 0x444466, 1);
    line2.lineBetween(-width / 2 + 20, currentY, width / 2 - 20, currentY);
    container.add(line2);
    currentY += 12;

    // 订单信息（精简）
    const order = getDefaultOrderForRoute(route.id);
    if (order) {
      const orderTitle = this.add
        .text(0, currentY, `订单：${order.title}`, {
          fontSize: "13px",
          color: "#ffaa44",
          fontStyle: "bold",
          fontFamily: "monospace",
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5, 0);
      container.add(orderTitle);
      currentY += 22;

      const orderGoods = this.add
        .text(0, currentY, `需求：${formatRequiredGoods(order.requiredGoods)}`, {
          fontSize: "11px",
          color: "#cccccc",
          fontFamily: "monospace",
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5, 0);
      container.add(orderGoods);
      currentY += 18;

      const orderReward = this.add
        .text(0, currentY, `奖励：银币+${order.rewardSilver} 火种+${order.rewardEmbers}`, {
          fontSize: "11px",
          color: "#44cc88",
          fontFamily: "monospace",
          wordWrap: { width: width - 40 },
        })
        .setOrigin(0.5, 0);
      container.add(orderReward);
      currentY += 22;
    } else {
      const noOrderText = this.add
        .text(0, currentY, "暂无可用订单", {
          fontSize: "13px",
          color: "#ff4444",
          fontFamily: "monospace",
        })
        .setOrigin(0.5, 0);
      container.add(noOrderText);
      currentY += 25;
    }

    // 城市状态短文本（阶段8.6）
    const gameState = getGameState();
    const cityStatusText = formatCityProgress(route.cityId, gameState.cityContributions);
    const cityStatusLabel = this.add
      .text(0, currentY, cityStatusText, {
        fontSize: "11px",
        color: "#88aacc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    container.add(cityStatusLabel);
    currentY += 20;

    // 底部提示：悬浮查看详情
    const hint = this.add
      .text(0, currentY, "💡 悬浮查看完整详情", {
        fontSize: "10px",
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5, 0);
    container.add(hint);

    // 点击区域
    const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    // 悬停效果 + Tooltip
    hitArea.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x2a2a4a, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
      bg.lineStyle(3, 0xffcc44, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);

      // 显示 Tooltip
      if (this.tooltipManager) {
        const pointer = this.input.activePointer;
        const lines: string[] = [];
        lines.push(`城市：${route.cityName}`);
        lines.push(`商路：${route.routeName}`);
        lines.push(`定位：${route.tagline}`);
        lines.push(`风险：${route.riskLevel} | 收益：${route.profitLevel}`);
        lines.push(`补给：${route.supplyLevel} | 战斗：${route.combatLevel} | 贸易：${route.tradeLevel}`);
        lines.push(`推荐货物：${route.recommendedGoods.join("、")}`);
        lines.push(`推荐角色：${route.recommendedCharacters.join("、")}`);
        if (order) {
          lines.push("");
          lines.push(`订单：${order.title}`);
          lines.push(`描述：${order.description}`);
          lines.push(`需求：${formatRequiredGoods(order.requiredGoods)}`);
          lines.push(`奖励：银币 +${order.rewardSilver}，火种 +${order.rewardEmbers}`);
          lines.push(`贡献：+${order.cityContribution} | 难度：${order.difficulty}`);
        }
        // 城市状态详情（阶段8.6）
        const gs = getGameState();
        const cityDetailLines = getCityProgressDetailLines(route.cityId, gs.cityContributions);
        lines.push("");
        lines.push(...cityDetailLines);
        this.tooltipManager.show(
          { title: route.cityName, lines },
          pointer.x, pointer.y, 300
        );
      }
    });

    hitArea.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x1a1a2e, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
      bg.lineStyle(2, 0x333355, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);

      if (this.tooltipManager) this.tooltipManager.hide();
    });

    // 点击选择
    hitArea.on("pointerdown", () => {
      this.selectRoute(route);
    });

    return container;
  }

  /**
   * 获取风险等级对应颜色
   */
  private getRiskColor(risk: string): string {
    const colors: Record<string, string> = {
      低: "#44cc88",
      "低-中": "#88cc44",
      中: "#ffcc44",
      "中-高": "#ff8844",
      高: "#ff4444",
    };
    return colors[risk] || "#ffffff";
  }

  /**
   * 获取收益等级对应颜色
   */
  private getProfitColor(profit: string): string {
    const colors: Record<string, string> = {
      低: "#888888",
      "低-中": "#aaaaaa",
      中: "#ffcc44",
      "中-高": "#ffaa44",
      高: "#ff8844",
    };
    return colors[profit] || "#ffffff";
  }

  /**
   * 选择商路（防重复点击，包含订单选择）
   */
  private selectRoute(route: CityRoute): void {
    // 选择时隐藏 Tooltip
    if (this.tooltipManager) this.tooltipManager.hide();

    // 防重复点击
    if (this.isSelecting) {
      console.log("[商路选择] 正在选择中，忽略重复点击");
      return;
    }

    // 检查是否解锁
    if (!route.isUnlocked) {
      console.warn(`[商路选择] 商路 ${route.id} 未解锁，无法选择`);
      return;
    }

    // 检查是否有可用订单（阶段7.2）
    const order = getDefaultOrderForRoute(route.id);
    if (!order) {
      console.warn(`[商路选择] 商路 ${route.id} 没有可用订单，无法选择`);
      return;
    }

    // 标记正在选择
    this.isSelecting = true;
    this.selectedRouteId = route.id;

    // 保存到 GameState
    const gameState = getGameState();
    gameState.selectedRouteId = route.id;
    gameState.selectedCityId = route.cityId;
    gameState.selectedOrderId = order.id;
    setGameState(gameState);

    console.log(`[商路选择] 选择商路: ${route.title}`);
    console.log(`[商路选择] routeId: ${route.id}, cityId: ${route.cityId}`);
    console.log(`[商路选择] 选择订单: ${order.title}, orderId: ${order.id}`);

    // 进入角色选择场景
    this.scene.start("CharacterSelectScene");
  }

  /**
   * 创建返回按钮（左上角统一样式）
   */
  private createBackButton(
    x: number, y: number, w: number, h: number,
    label: string, onClick: () => void
  ): Phaser.GameObjects.GameObject {
    const bg = this.add.graphics();
    bg.fillStyle(0x555555, 1);
    bg.fillRoundedRect(x, y, w, h, 6);
    const text = this.add.text(x + w / 2, y + h / 2, label, {
      fontSize: "14px",
      color: "#cccccc",
      fontFamily: "monospace",
    }).setOrigin(0.5);
    const hit = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x777777, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
    });
    hit.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x555555, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
    });
    hit.on("pointerdown", onClick);
    return hit;
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown-ESC");
    this.input.keyboard?.off("keydown-LEFT");
    this.input.keyboard?.off("keydown-RIGHT");
    if (this.tooltipManager) {
      this.tooltipManager.hide();
    }
  }
}
