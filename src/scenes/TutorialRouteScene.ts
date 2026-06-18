// C3f.1：N3.1 固定教学路线可见化壳层
// 只做 UI 壳 + 纯逻辑系统调用，不接 BattleScene，不做驿站 UI
// 场景 key: TutorialRouteScene

import Phaser from "phaser";
import { getGameState, setGameState } from "../systems/GameState";
import {
  startN31TutorialRoute,
  getCurrentTutorialRouteNode,
  completeTutorialNode,
  skipOptionalTutorialNode,
  advanceToNextTutorialNode,
  isTutorialNodeCompleted,
  isTutorialRouteCompleted,
} from "../systems/tutorialRouteSystem";
import {
  getN31TutorialRouteNodeById,
  TutorialRouteNode,
} from "../data/tutorialRouteN31";
import {
  canResolveTutorialEvent,
  resolveTutorialEventChoice,
  isTutorialEventResolved,
} from "../systems/tutorialEventSystem";
import {
  getTutorialEventByNodeId,
} from "../data/tutorialEventsN31";
import {
  canResolveTutorialBattle,
  resolveTutorialBattleVictory,
  isTutorialBattleResolved,
} from "../systems/tutorialBattleSystem";
import {
  getTutorialBattleByNodeId,
} from "../data/tutorialBattlesN31";
import {
  canResolveTutorialSpecialBattle,
  resolveTutorialSpecialBattleVictory,
  isTutorialSpecialBattleResolved,
} from "../systems/tutorialSpecialBattleSystem";
import {
  getTutorialSpecialBattleByNodeId,
} from "../data/tutorialSpecialBattlesN31";
import {
  canResolveTutorialEliteBattle,
  resolveTutorialEliteBattleVictory,
  resolveTutorialEliteBattleRescue,
  skipTutorialEliteBattle,
  isTutorialEliteBattleResolved,
} from "../systems/tutorialEliteBattleSystem";
import {
  getTutorialEliteBattleByNodeId,
} from "../data/tutorialEliteBattlesN31";

export class TutorialRouteScene extends Phaser.Scene {
  private headerText: Phaser.GameObjects.Text | null = null;
  private nodeInfoText: Phaser.GameObjects.Text | null = null;
  private resourceText: Phaser.GameObjects.Text | null = null;
  private messageText: Phaser.GameObjects.Text | null = null;
  private buttonContainer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: "TutorialRouteScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // 背景
    this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, w, h);

    // 标题
    this.headerText = this.add.text(20, 15, "N3.1 教学路线", {
      fontSize: "28px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    });

    // 资源栏
    this.resourceText = this.add.text(20, 55, "", {
      fontSize: "16px",
      color: "#cccccc",
      fontFamily: "monospace",
    });

    // 节点信息
    this.nodeInfoText = this.add.text(20, 100, "", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "monospace",
      wordWrap: { width: w - 40 },
    });

    // 消息区
    this.messageText = this.add.text(20, h - 100, "", {
      fontSize: "16px",
      color: "#88ff88",
      fontFamily: "monospace",
      wordWrap: { width: w - 40 },
    });

    // 按钮容器
    this.buttonContainer = this.add.container(0, 0);

    // 确保 N3.1 路线激活
    const gs = getGameState();
    if (!gs.activeTutorialRouteId) {
      const newState = startN31TutorialRoute(gs);
      Object.assign(gs, newState);
      gs.day = 1;
      gs.food = Math.max(0, 22);
      gs.silver = 35;
      gs.morale = 6;
      gs.caravanHp = 100;
      gs.caravanMaxHp = 100;
      gs.spareParts = 3;
      gs.mainOrderDeadlineDays = 30;
      setGameState(gs);
      this.log("[TutorialRoute] 已启动 N3.1 教学路线，从第 1 天开始。");
    }

    // 刷新界面
    this.renderNode();

    console.log("[TutorialRouteScene] 已加载");
  }

  /**
   * 刷新当前节点的显示（资源栏 / 节点信息 / 按钮）
   */
  private renderNode() {
    const gs = getGameState();
    const node = getCurrentTutorialRouteNode(gs) ||
      (gs.currentTutorialNodeId ? getN31TutorialRouteNodeById(gs.currentTutorialNodeId) : null);

    // 标题：第 X 天
    this.headerText?.setText(`第 ${gs.day} 天 — N3.1 教学路线`);

    // 资源栏
    const hpPercent = gs.caravanMaxHp > 0 ? Math.round((gs.caravanHp / gs.caravanMaxHp) * 100) : 0;
    this.resourceText?.setText(
      `食物 ${gs.food}    零件 ${gs.spareParts}    银币 ${gs.silver}    士气 ${gs.morale}    货车 ${gs.caravanHp}/${gs.caravanMaxHp} (${hpPercent}%)    订单期限剩余 ${gs.mainOrderDeadlineDays} 天`,
    );

    if (!node) {
      // 没有当前节点——可能是路线完成了
      this.showCompletedView();
      return;
    }

    // 节点信息
    const typeMap: Record<string, string> = {
      start: "【启程】",
      peaceful_day: "【平静日】",
      small_event: "【小事件】",
      resource_event: "【资源事件】",
      normal_battle: "【普通战斗】",
      special_battle: "【特殊战斗】",
      optional_elite: "【可选精英战】",
      destination: "【终点】",
    };
    const typeLabel = typeMap[node.type] || "【其他】";
    this.nodeInfoText?.setText(
      `${typeLabel} ${node.title}\n\n${node.description}\n\n教学目标：${node.teachingGoal}`,
    );

    this.renderButtons(node);
  }

  /**
   * 显示节点的按钮。根据节点类型和状态生成不同按钮。
   */
  private renderButtons(node: TutorialRouteNode) {
    const gs = getGameState();

    this.buttonContainer?.removeAll(true);
    const container = this.buttonContainer!;

    const baseX = 20;
    let y = this.scale.height - 300;
    const btnH = 44;
    const btnW = Math.min(600, this.scale.width - 40);

    // 工具方法：创建按钮
    const addButton = (label: string, onClick: () => void, disabled = false, color = "#2a4a8a") => {
      const bg = this.add.graphics();
      bg.fillStyle(disabled ? 0x444444 : parseInt(color.replace("#", ""), 16), 1);
      bg.fillRect(baseX, y, btnW, btnH);
      bg.setInteractive(new Phaser.Geom.Rectangle(baseX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
      if (!disabled) {
        bg.on("pointerover", () => bg.fillStyle(0x3a6aca, 1).fillRect(baseX, y, btnW, btnH));
        bg.on("pointerout", () => bg.fillStyle(parseInt(color.replace("#", ""), 16), 1).fillRect(baseX, y, btnW, btnH));
        bg.on("pointerdown", onClick);
      } else {
        bg.disableInteractive();
      }
      const labelObj = this.add.text(baseX + 20, y + btnH / 2 - 10, label, {
        fontSize: "18px",
        color: disabled ? "#888888" : "#ffffff",
        fontFamily: "monospace",
      });
      container.add(bg);
      container.add(labelObj);
      y += btnH + 10;
    };

    // ========== 各节点类型的按钮 ==========
    if (node.type === "start") {
      if (!isTutorialNodeCompleted(gs, node.id)) {
        addButton("继续前进（离开灰桥镇，正式踏上旅程）", () => this.consumeDayAndAdvance(node));
      } else {
        this.messageText?.setText("已经启程了，路线将自动推进。");
        addButton("推进到下一天", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "peaceful_day") {
      if (!isTutorialNodeCompleted(gs, node.id)) {
        addButton("平静前进（消耗补给与推进期限）", () => this.consumeDayAndAdvance(node));
      } else {
        this.messageText?.setText("这一天已经平静地度过了。");
        addButton("推进到下一天", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "small_event" || node.type === "resource_event") {
      // 事件节点：显示每个选择按钮
      const event = getTutorialEventByNodeId(node.id);
      if (event && canResolveTutorialEvent(gs, event.id)) {
        for (const choice of event.choices) {
          // 检查条件：如果是 "用零件" 选项，需要 spareParts >= 1
          let disabled = false;
          let hint = "";
          if (choice.id === "reinforce_with_spare") {
            if (gs.spareParts < 1) {
              disabled = true;
              hint = "（需要 1 个零件）";
            }
          }
          if (choice.id === "share_supplies" && (typeof gs.food !== "number" || gs.food < 1)) {
            disabled = true;
            hint = "（需要 1 食物）";
          }
          if (choice.id === "give_coins" && (typeof gs.silver !== "number" || gs.silver < 5)) {
            disabled = true;
            hint = "（需要 5 银币）";
          }
          const fullLabel = `${choice.label}${hint}`;
          addButton(fullLabel, () => {
            this.handleEventChoice(node, event.id, choice.id);
          }, disabled);
        }
      } else if (isTutorialEventResolved(gs, event?.id ?? "")) {
        this.messageText?.setText("该事件已经处理过。");
        addButton("继续前进", () => this.consumeDayAndAdvance(node));
      } else {
        // 没有事件数据：提供自动处理
        addButton("自动前进（消耗补给）", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "normal_battle") {
      const battle = getTutorialBattleByNodeId(node.id);
      const enemySummary = battle ? `敌人：${battle.enemies.map((e) => e.name).join("、")}` : "";
      if (battle && canResolveTutorialBattle(gs, battle.id)) {
        this.messageText?.setText(`${node.description}\n${enemySummary}`);
        addButton("占位胜利（结算奖励）", () => {
          this.resolveBattleVictory(node, battle.id);
        });
      } else if (battle && isTutorialBattleResolved(gs, battle.id)) {
        this.messageText?.setText("该战斗已完成。");
        addButton("继续前进", () => this.consumeDayAndAdvance(node));
      } else {
        addButton("继续前进（无战斗数据）", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "special_battle") {
      const special = getTutorialSpecialBattleByNodeId(node.id);
      if (special && canResolveTutorialSpecialBattle(gs, special.id)) {
        this.messageText?.setText("劫匪抢货战。目标：保护货物，赶走劫匪。当前阶段使用占位胜利结算。");
        addButton("占位胜利（保护货物成功）", () => {
          this.resolveSpecialBattleVictory(node, special.id);
        });
      } else if (special && isTutorialSpecialBattleResolved(gs, special.id)) {
        this.messageText?.setText("该特殊战已完成。");
        addButton("继续前进", () => this.consumeDayAndAdvance(node));
      } else {
        addButton("继续前进（无特殊战数据）", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "optional_elite") {
      const elite = getTutorialEliteBattleByNodeId(node.id);
      if (elite && canResolveTutorialEliteBattle(gs, elite.id)) {
        this.messageText?.setText("可选精英战：灰烬母巢。可直接挑战，也可绕开。挑战失败会触发路过商队救援——损失资源但可到达驿站。");
        addButton("绕开母巢（不获得精英奖励）", () => this.handleSkipElite(node, elite.id), false, "#4a4a6a");
        addButton("挑战胜利（占位胜利结算）", () => this.resolveEliteBattleVictory(node, elite.id), false, "#8a4a2a");
        addButton("救援测试（模拟失败+救援）", () => this.resolveEliteBattleRescue(node, elite.id), false, "#6a2a4a");
      } else if (elite && isTutorialEliteBattleResolved(gs, elite.id)) {
        this.messageText?.setText("该精英战已处理。");
        addButton("继续前进到第一个驿站", () => this.consumeDayAndAdvance(node));
      } else {
        addButton("继续前进", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "destination") {
      this.messageText?.setText("你已到达第一个驿站。欢迎到达，商队平安！");
      // 终点自动完成
      const newState = completeTutorialNode(gs, node.id);
      Object.assign(gs, newState);
      setGameState(gs);
      addButton("回到主菜单", () => this.scene.start("MainMenuScene"), false, "#4a8a4a");
    } else {
      addButton("继续前进", () => this.consumeDayAndAdvance(node));
    }
  }

  /**
   * 每日消耗：day+1, food-1, mainOrderDeadlineDays-1
   * 之后把当前节点标记为已完成，并推进到下一个节点
   */
  private consumeDayAndAdvance(node: TutorialRouteNode) {
    const gs = getGameState();

    // 仅在当前节点尚未完成时执行日消耗
    if (!isTutorialNodeCompleted(gs, node.id)) {
      gs.day = (gs.day || 1) + 1;
      gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
      gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);
      // 标记当前节点已完成
      const newRouteState = completeTutorialNode(gs, node.id);
      Object.assign(gs, newRouteState);
    }

    // 若是 destination，直接显示完成
    if (node.type === "destination") {
      setGameState(gs);
      this.renderNode();
      return;
    }

    // 推进到下一个节点
    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    // 如果下一个节点仍是当前节点且当前节点未完成，则前进可能失败
    // 也可能到达终点
    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      this.showCompletedView();
      return;
    }

    // 更新当前节点字段到 GameState（如果字段存在）
    gs.currentTutorialNodeId = newNode.id;

    setGameState(gs);
    this.messageText?.setText(`前进到：${newNode.title}（第 ${gs.day} 天）`);
    this.renderNode();
  }

  /**
   * 处理事件选项。先调用 resolveTutorialEventChoice，然后消耗日，推进节点
   */
  private handleEventChoice(node: TutorialRouteNode, eventId: string, choiceId: string) {
    const gs = getGameState();

    // 事件数值变化仅由 tutorialEventSystem 负责
    const result = resolveTutorialEventChoice(gs, eventId, choiceId);
    Object.assign(gs, result);

    // 仅显示 UI 文本提示，不做数值重复加减
    const event = getTutorialEventByNodeId(node.id);
    const choice = event?.choices.find((c) => c.id === choiceId);
    let summary = `处理事件：${node.title} — 选择“${choice?.label ?? choiceId}”`;
    if (choice) {
      for (const eff of choice.effects) {
        if (eff.type === "hint" && eff.text) {
          summary += `\n提示：${eff.text}`;
        }
      }
      // N3.1 特殊补丁：spareParts 目前未进入 tutorialEventSystem 的 effects type
      // 由这里单独处理，且只有事件成功结算时才触发（resolveTutorialEventChoice 内部防重复）
      if (choice.id === "reinforce_with_spare") {
        if (typeof gs.spareParts === "number" && gs.spareParts >= 1) {
          gs.spareParts = gs.spareParts - 1;
        }
      }
      if (choice.id === "take_toolbox") {
        if (typeof gs.spareParts === "number") {
          gs.spareParts = gs.spareParts + 1;
        } else {
          gs.spareParts = 1;
        }
      }
    }

    // 日消耗 + 推进
    gs.day = (gs.day || 1) + 1;
    gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
    gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);

    const routeState = completeTutorialNode(gs, node.id);
    Object.assign(gs, routeState);

    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      setGameState(gs);
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);
    this.messageText?.setText(summary + `\n前进到：${newNode.title}（第 ${gs.day} 天）`);
    this.renderNode();
  }

  /**
   * 普通战斗胜利：调用 resolveTutorialBattleVictory，然后消耗日并推进
   */
  private resolveBattleVictory(node: TutorialRouteNode, battleId: string) {
    const gs = getGameState();
    if (!canResolveTutorialBattle(gs, battleId)) {
      this.messageText?.setText("该战斗已完成。");
      return;
    }
    const result = resolveTutorialBattleVictory(gs, battleId);
    Object.assign(gs, result);

    // 战斗日消耗
    gs.day = (gs.day || 1) + 1;
    gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
    gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);

    const routeState = completeTutorialNode(gs, node.id);
    Object.assign(gs, routeState);

    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      setGameState(gs);
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);
    this.messageText?.setText(`战斗胜利：${node.title}！\n已结算奖励并前进到：${newNode.title}（第 ${gs.day} 天）`);
    this.renderNode();
  }

  /**
   * 劫匪抢货战占位胜利
   */
  private resolveSpecialBattleVictory(node: TutorialRouteNode, specialBattleId: string) {
    const gs = getGameState();
    if (!canResolveTutorialSpecialBattle(gs, specialBattleId)) {
      this.messageText?.setText("该特殊战已完成。");
      return;
    }
    const result = resolveTutorialSpecialBattleVictory(gs, specialBattleId);
    Object.assign(gs, result);

    gs.day = (gs.day || 1) + 1;
    gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
    gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);

    const routeState = completeTutorialNode(gs, node.id);
    Object.assign(gs, routeState);

    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      setGameState(gs);
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);
    this.messageText?.setText(`劫匪抢货战胜利：货物安全！\n前进到：${newNode.title}（第 ${gs.day} 天）`);
    this.renderNode();
  }

  /**
   * 灰烬母巢绕开
   */
  private handleSkipElite(node: TutorialRouteNode, eliteBattleId: string) {
    const gs = getGameState();
    if (!canResolveTutorialEliteBattle(gs, eliteBattleId)) {
      this.messageText?.setText("该精英战已处理。");
      return;
    }
    const eliteState = skipTutorialEliteBattle(gs, eliteBattleId);
    Object.assign(gs, eliteState);

    // 日消耗
    gs.day = (gs.day || 1) + 1;
    gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
    gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);

    const routeState1 = skipOptionalTutorialNode(gs, node.id);
    Object.assign(gs, routeState1);
    const routeState2 = completeTutorialNode(gs, node.id);
    Object.assign(gs, routeState2);

    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      setGameState(gs);
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);
    this.messageText?.setText(`绕开了灰烬母巢。继续前进到：${newNode.title}（第 ${gs.day} 天）`);
    this.renderNode();
  }

  /**
   * 灰烬母巢挑战胜利
   */
  private resolveEliteBattleVictory(node: TutorialRouteNode, eliteBattleId: string) {
    const gs = getGameState();
    if (!canResolveTutorialEliteBattle(gs, eliteBattleId)) {
      this.messageText?.setText("该精英战已处理。");
      return;
    }
    const result = resolveTutorialEliteBattleVictory(gs, eliteBattleId);
    Object.assign(gs, result);

    gs.day = (gs.day || 1) + 1;
    gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
    gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);

    const routeState = completeTutorialNode(gs, node.id);
    Object.assign(gs, routeState);

    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      setGameState(gs);
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);
    this.messageText?.setText(`挑战灰烬母巢胜利！获得火种与古代记忆。\n前进到：${newNode.title}（第 ${gs.day} 天）`);
    this.renderNode();
  }

  /**
   * 灰烬母巢失败救援
   */
  private resolveEliteBattleRescue(node: TutorialRouteNode, eliteBattleId: string) {
    const gs = getGameState();
    if (!canResolveTutorialEliteBattle(gs, eliteBattleId)) {
      this.messageText?.setText("该精英战已处理。");
      return;
    }
    const result = resolveTutorialEliteBattleRescue(gs, eliteBattleId);
    Object.assign(gs, result);

    gs.day = (gs.day || 1) + 1;
    gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
    gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);

    const routeState = completeTutorialNode(gs, node.id);
    Object.assign(gs, routeState);

    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      setGameState(gs);
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);
    this.messageText?.setText(`挑战失败：路过商队救援了你的队伍。损失了资源，但可继续前进。\n前进到：${newNode.title}（第 ${gs.day} 天）`);
    this.renderNode();
  }

  private showCompletedView() {
    const gs = getGameState();
    // 终点后写入完成标记
    if (!gs.tutorialEliteBattleFlags.includes("n31_tutorial_route_completed")) {
      gs.tutorialEliteBattleFlags = [...(gs.tutorialEliteBattleFlags || []), "n31_tutorial_route_completed"];
    }
    setGameState(gs);

    this.nodeInfoText?.setText(
      `🎉 N3.1 教学路线完成！\n\n` +
      `第 ${gs.day} 天到达第一个驿站。\n\n` +
      `最终资源：\n` +
      `食物 ${gs.food}    零件 ${gs.spareParts}    银币 ${gs.silver}\n` +
      `士气 ${gs.morale}    货车 ${gs.caravanHp}/${gs.caravanMaxHp}\n` +
      `火种 ${gs.emberSeeds}    古代记忆碎片 ${gs.ancientMemoryFragments}    灰烬材料 ${gs.ashMaterials}`,
    );

    this.buttonContainer?.removeAll(true);
    const baseX = 20;
    let y = this.scale.height - 300;
    const btnW = Math.min(600, this.scale.width - 40);
    const btnH = 44;
    const bg = this.add.graphics();
    bg.fillStyle(0x4a8a4a, 1).fillRect(baseX, y, btnW, btnH);
    bg.setInteractive(new Phaser.Geom.Rectangle(baseX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
    bg.on("pointerover", () => bg.fillStyle(0x6aaa6a, 1).fillRect(baseX, y, btnW, btnH));
    bg.on("pointerout", () => bg.fillStyle(0x4a8a4a, 1).fillRect(baseX, y, btnW, btnH));
    bg.on("pointerdown", () => this.scene.start("MainMenuScene"));
    const label = this.add.text(baseX + 20, y + btnH / 2 - 10, "回到主菜单", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    this.buttonContainer?.add(bg);
    this.buttonContainer?.add(label);
  }

  private log(msg: string) {
    console.log("[TutorialRouteScene]", msg);
  }
}
