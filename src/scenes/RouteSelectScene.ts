import { Scene } from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import { CityRoute, getUnlockedRoutes } from "../data/cityRoutes";
import { CityOrder, getDefaultOrderForRoute, getUnlockedOrdersForRoute, formatRequiredGoods } from "../data/cityOrders";

/**
 * 商路与目标城市选择场景（阶段7.1）
 * 玩家开始远征前选择要支援的城市与商路
 */
export class RouteSelectScene extends Scene {
  private selectedRouteId: string | null = null;
  private routeCards: Phaser.GameObjects.Container[] = [];
  private isSelecting = false; // 防重复点击

  constructor() {
    super({ key: "RouteSelectScene" });
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

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
    const routes = getUnlockedRoutes();

    // 无可用商路兜底
    if (routes.length === 0) {
      this.showNoRoutesFallback(w, h);
    } else {
      // 显示商路卡片
      const cardWidth = 360;
      const cardHeight = 420;
      const gap = 30;
      const totalWidth = routes.length * cardWidth + (routes.length - 1) * gap;
      const startX = (w - totalWidth) / 2 + cardWidth / 2;
      const cardY = h / 2 + 20;

      routes.forEach((route, index) => {
        const cx = startX + index * (cardWidth + gap);
        const card = this.createRouteCard(cx, cardY, cardWidth, cardHeight, route);
        this.routeCards.push(card);
      });

      // 底部提示
      this.add
        .text(w / 2, h - 30, "点击商路卡片选择 | 按 ESC 返回主菜单", {
          fontSize: "14px",
          color: "#666666",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);
    }

    // ESC 返回主菜单
    this.input.keyboard?.on("keydown-ESC", () => {
      this.scene.start("MainMenuScene");
    });

    console.log("[商路选择] 场景初始化完成，显示", routes.length, "条商路");
  }

  /**
   * 无可用商路时显示兜底UI
   */
  private showNoRoutesFallback(w: number, h: number): void {
    // 提示文本
    this.add
      .text(w / 2, h / 2 - 30, "暂无可用商路", {
        fontSize: "24px",
        color: "#ff4444",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 说明
    this.add
      .text(w / 2, h / 2 + 20, "当前没有解锁的商路，请稍后再试", {
        fontSize: "14px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    // 返回提示
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
   * 创建单条商路卡片
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
    currentY += 30;

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
    currentY += 35;

    // 分隔线
    const line = this.add.graphics();
    line.lineStyle(1, 0x444466, 1);
    line.lineBetween(-width / 2 + 20, currentY, width / 2 - 20, currentY);
    container.add(line);
    currentY += 15;

    // 等级信息
    const levels = [
      { label: "风险", value: route.riskLevel, color: this.getRiskColor(route.riskLevel) },
      { label: "收益", value: route.profitLevel, color: this.getProfitColor(route.profitLevel) },
      { label: "补给", value: route.supplyLevel, color: "#ffffff" },
      { label: "战斗", value: route.combatLevel, color: "#ffffff" },
      { label: "贸易", value: route.tradeLevel, color: "#ffffff" },
    ];

    levels.forEach((level, idx) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      const lx = -width / 2 + 50 + col * 110;
      const ly = currentY + row * 25;

      const labelText = this.add
        .text(lx, ly, level.label + ":", {
          fontSize: "12px",
          color: "#888888",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0);
      container.add(labelText);

      const valueText = this.add
        .text(lx + 35, ly, level.value, {
          fontSize: "12px",
          color: level.color,
          fontFamily: "monospace",
        })
        .setOrigin(0, 0);
      container.add(valueText);
    });
    currentY += 60;

    // 推荐货物
    const goodsLabel = this.add
      .text(-width / 2 + 20, currentY, "推荐货物:", {
        fontSize: "12px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0);
    container.add(goodsLabel);
    currentY += 20;

    const goodsText = this.add
      .text(-width / 2 + 20, currentY, route.recommendedGoods.join("、"), {
        fontSize: "12px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0);
    container.add(goodsText);
    currentY += 30;

    // 推荐角色
    const charsLabel = this.add
      .text(-width / 2 + 20, currentY, "推荐角色:", {
        fontSize: "12px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0);
    container.add(charsLabel);
    currentY += 20;

    const charsText = this.add
      .text(-width / 2 + 20, currentY, route.recommendedCharacters.join("、"), {
        fontSize: "12px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0);
    container.add(charsText);
    currentY += 35;

    // 分隔线
    const line2 = this.add.graphics();
    line2.lineStyle(1, 0x444466, 1);
    line2.lineBetween(-width / 2 + 20, currentY, width / 2 - 20, currentY);
    container.add(line2);
    currentY += 12;

    // 订单信息（阶段7.2）
    const order = getDefaultOrderForRoute(route.id);
    if (order) {
      // 订单标题
      const orderTitle = this.add
        .text(0, currentY, `订单：${order.title}`, {
          fontSize: "13px",
          color: "#ffaa44",
          fontStyle: "bold",
          fontFamily: "monospace",
        })
        .setOrigin(0.5, 0);
      container.add(orderTitle);
      currentY += 22;

      // 需求物资
      const orderGoods = this.add
        .text(0, currentY, `需求：${formatRequiredGoods(order.requiredGoods)}`, {
          fontSize: "11px",
          color: "#cccccc",
          fontFamily: "monospace",
        })
        .setOrigin(0.5, 0);
      container.add(orderGoods);
      currentY += 18;

      // 奖励
      const orderReward = this.add
        .text(0, currentY, `奖励：银币 +${order.rewardSilver}，火种 +${order.rewardEmbers}，贡献 +${order.cityContribution}`, {
          fontSize: "11px",
          color: "#44cc88",
          fontFamily: "monospace",
        })
        .setOrigin(0.5, 0);
      container.add(orderReward);
      currentY += 20;

      // 难度
      const orderDifficulty = this.add
        .text(0, currentY, `难度：${order.difficulty}`, {
          fontSize: "11px",
          color: "#888888",
          fontFamily: "monospace",
        })
        .setOrigin(0.5, 0);
      container.add(orderDifficulty);
      currentY += 25;
    } else {
      // 无可用订单提示
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

    // 说明
    const descText = this.add
      .text(0, currentY, route.description, {
        fontSize: "11px",
        color: "#999999",
        fontFamily: "monospace",
        wordWrap: { width: width - 40 },
        align: "center",
      })
      .setOrigin(0.5, 0);
    container.add(descText);

    // 点击区域
    const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    // 悬停效果
    hitArea.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x2a2a4a, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
      bg.lineStyle(3, 0xffcc44, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
    });

    hitArea.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x1a1a2e, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
      bg.lineStyle(2, 0x333355, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
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
}
