// C3f.1 + C3f.2：N3.1 固定教学路线可见化壳层
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
  private isResolving = false;

  constructor() {
    super({ key: "TutorialRouteScene" });
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.graphics().fillStyle(0x1a1a2e, 1).fillRect(0, 0, w, h);

    this.headerText = this.add.text(20, 15, "N3.1 教学路线", {
      fontSize: "28px",
      color: "#ffcc44",
      fontFamily: "monospace",
      fontStyle: "bold",
    });

    this.resourceText = this.add.text(20, 55, "", {
      fontSize: "16px",
      color: "#cccccc",
      fontFamily: "monospace",
    });

    this.nodeInfoText = this.add.text(20, 100, "", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "monospace",
      wordWrap: { width: w - 40 },
    });

    this.messageText = this.add.text(20, h - 120, "", {
      fontSize: "16px",
      color: "#88ff88",
      fontFamily: "monospace",
      wordWrap: { width: w - 40 },
    });

    this.buttonContainer = this.add.container(0, 0);

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

    this.renderNode();
    console.log("[TutorialRouteScene] 已加载");
  }

  private renderNode() {
    const gs = getGameState();
    const node = getCurrentTutorialRouteNode(gs) ||
      (gs.currentTutorialNodeId ? getN31TutorialRouteNodeById(gs.currentTutorialNodeId) : null);

    this.headerText?.setText(`第 ${gs.day} 天 — N3.1 教学路线`);

    const hpPercent = gs.caravanMaxHp > 0 ? Math.round((gs.caravanHp / gs.caravanMaxHp) * 100) : 0;
    this.resourceText?.setText(
      `补给：${gs.food}    备用零件：${gs.spareParts}    银币：${gs.silver}    士气：${gs.morale}/10    货车耐久：${gs.caravanHp}/${gs.caravanMaxHp} (${hpPercent}%)    主线期限：${gs.mainOrderDeadlineDays} 天`,
    );

    if (!node) {
      this.showCompletedView();
      return;
    }

    const typeMap: Record<string, string> = {
      start: "启程",
      peaceful_day: "平静日",
      small_event: "小事件",
      resource_event: "资源事件",
      normal_battle: "普通战斗",
      special_battle: "特殊战斗",
      optional_elite: "可选精英",
      destination: "灰灯驿站",
    };
    const typeLabel = typeMap[node.type] || "其他";
    this.nodeInfoText?.setText(
      `【${typeLabel}】${node.title}\n\n${node.description}\n\n教学目的：${node.teachingGoal}`,
    );

    this.renderButtons(node);
  }

  private renderButtons(node: TutorialRouteNode) {
    const gs = getGameState();

    this.buttonContainer?.removeAll(true);
    const container = this.buttonContainer!;

    const baseX = 20;
    let y = this.scale.height - 320;
    const btnH = 44;
    const btnW = Math.min(600, this.scale.width - 40);

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

    if (node.type === "start") {
      if (!isTutorialNodeCompleted(gs, node.id)) {
        addButton("继续前进（离开灰桥镇，正式踏上旅程）", () => this.consumeDayAndAdvance(node));
      } else {
        this.messageText?.setText("已经启程了，路线将自动推进。");
        addButton("推进到下一天", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "peaceful_day") {
      if (!isTutorialNodeCompleted(gs, node.id)) {
        addButton("平静前进（消耗 1 补给，推进 1 天）", () => this.consumeDayAndAdvance(node));
      } else {
        this.messageText?.setText("这一天已经平静地度过了。");
        addButton("推进到下一天", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "small_event" || node.type === "resource_event") {
      const event = getTutorialEventByNodeId(node.id);
      if (event && canResolveTutorialEvent(gs, event.id)) {
        for (const choice of event.choices) {
          let disabled = false;
          let hint = "";
          if (choice.id === "reinforce_with_spare") {
            if (gs.spareParts < 1) {
              disabled = true;
              hint = "（需要 1 个备用零件）";
            }
          }
          if (choice.id === "share_supplies" && (typeof gs.food !== "number" || gs.food < 1)) {
            disabled = true;
            hint = "（需要 1 补给）";
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
        addButton("自动前进（消耗补给）", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "normal_battle") {
      const battle = getTutorialBattleByNodeId(node.id);
      if (battle && canResolveTutorialBattle(gs, battle.id)) {
        const enemyNames = battle.enemies.map((e) => e.name).join("、");
        const rewards = battle.reward;
        const rewardText = rewards ? `奖励：${rewards.silver > 0 ? `银币 +${rewards.silver}` : ""}${rewards.food > 0 ? (rewards.silver > 0 ? "，" : "") + `补给 +${rewards.food}` : ""}` : "";
        this.messageText?.setText(`当前版本暂未接入真实 BattleScene。\n敌人：${enemyNames}\n${rewardText}\n点击「占位胜利」直接结算本场战斗奖励。`);
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
        this.messageText?.setText("特殊战斗：劫匪抢货战\n目标：保护货物完整度\n当前版本暂未接入真实特殊战 UI。\n点击「占位胜利」会按保护货物成功结算。");
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
        this.messageText?.setText("可选精英：灰烬母巢\n\n你可以绕开它，安全前往灰灯驿站；\n也可以挑战它，获得火种和古代记忆；\n如果挑战失败，会触发路过商队救援，损失银币、士气和货车耐久，但不会死档。");
        addButton("绕开母巢：安全前往灰灯驿站，无奖励", () => this.handleSkipElite(node, elite.id), false, "#4a4a6a");
        addButton("挑战胜利：测试用，直接获得精英奖励", () => this.resolveEliteBattleVictory(node, elite.id), false, "#8a4a2a");
        addButton("救援测试：模拟挑战失败，由路过商队救援", () => this.resolveEliteBattleRescue(node, elite.id), false, "#6a2a4a");
      } else if (elite && isTutorialEliteBattleResolved(gs, elite.id)) {
        this.messageText?.setText("该精英战已处理。");
        addButton("继续前进到第一个驿站", () => this.consumeDayAndAdvance(node));
      } else {
        addButton("继续前进", () => this.consumeDayAndAdvance(node));
      }
    } else if (node.type === "destination") {
      this.showCompletedView();
      return;
    } else {
      addButton("继续前进", () => this.consumeDayAndAdvance(node));
    }
  }

  private consumeDayAndAdvance(node: TutorialRouteNode) {
    if (this.isResolving) return;
    this.isResolving = true;

    const gs = getGameState();
    const beforeFood = gs.food;
    const beforeDay = gs.day;

    if (!isTutorialNodeCompleted(gs, node.id)) {
      gs.day = (gs.day || 1) + 1;
      gs.food = Math.max(0, (typeof gs.food === "number" ? gs.food : 0) - 1);
      gs.mainOrderDeadlineDays = Math.max(0, (typeof gs.mainOrderDeadlineDays === "number" ? gs.mainOrderDeadlineDays : 30) - 1);
      const newRouteState = completeTutorialNode(gs, node.id);
      Object.assign(gs, newRouteState);
    }

    if (node.type === "destination") {
      setGameState(gs);
      this.isResolving = false;
      this.renderNode();
      return;
    }

    const nextState = advanceToNextTutorialNode(gs);
    Object.assign(gs, nextState);

    const newNode = getCurrentTutorialRouteNode(gs);
    if (!newNode) {
      setGameState(gs);
      this.isResolving = false;
      this.showCompletedView();
      return;
    }

    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);

    const foodDelta = gs.food - beforeFood;
    const dayDelta = gs.day - beforeDay;
    let msg = `前进到：${newNode.title}`;
    if (dayDelta > 0) msg += `（第 ${gs.day} 天）`;
    if (foodDelta !== 0) msg += `\n补给变化：${beforeFood} → ${gs.food}`;
    this.messageText?.setText(msg);

    this.isResolving = false;
    this.renderNode();
  }

  private handleEventChoice(node: TutorialRouteNode, eventId: string, choiceId: string) {
    if (this.isResolving) return;
    this.isResolving = true;

    const gs = getGameState();
    const beforeState = this.saveCurrentState();

    const result = resolveTutorialEventChoice(gs, eventId, choiceId);
    Object.assign(gs, result);

    const event = getTutorialEventByNodeId(node.id);
    const choice = event?.choices.find((c) => c.id === choiceId);
    let summary = `你选择了：${choice?.label ?? choiceId}`;

    if (choice) {
      for (const eff of choice.effects) {
        if (eff.type === "hint" && eff.text) {
          summary += `\n${eff.text}`;
        }
      }
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
      summary += "\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs));
      this.messageText?.setText(summary);
      this.isResolving = false;
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);

    summary += "\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs));
    summary += `\n已进入第 ${gs.day} 天：${newNode.title}`;
    this.messageText?.setText(summary);

    this.isResolving = false;
    this.renderNode();
  }

  private saveCurrentState() {
    const gs = getGameState();
    return {
      food: gs.food,
      spareParts: gs.spareParts,
      silver: gs.silver,
      morale: gs.morale,
      caravanHp: gs.caravanHp,
      emberSeeds: gs.emberSeeds,
      ancientMemoryFragments: gs.ancientMemoryFragments,
      ashMaterials: gs.ashMaterials,
    };
  }

  private formatStateDiff(before: Record<string, number | undefined>, after: Record<string, number | undefined>) {
    const diffs: string[] = [];
    const labels: Record<string, string> = {
      food: "补给",
      spareParts: "备用零件",
      silver: "银币",
      morale: "士气",
      caravanHp: "货车耐久",
      emberSeeds: "火种",
      ancientMemoryFragments: "古代记忆",
      ashMaterials: "灰烬材料",
    };
    for (const key of Object.keys(labels)) {
      const b = before[key] ?? 0;
      const a = after[key] ?? 0;
      if (b !== a) {
        const delta = a - b;
        const sign = delta > 0 ? "+" : "";
        diffs.push(`${labels[key]}：${b} → ${a} (${sign}${delta})`);
      }
    }
    return diffs.length > 0 ? "结果：\n" + diffs.join("\n") : "（无资源变化）";
  }

  private getStateSnapshot(gs: ReturnType<typeof getGameState>): Record<string, number | undefined> {
    return {
      food: gs.food,
      spareParts: gs.spareParts,
      silver: gs.silver,
      morale: gs.morale,
      caravanHp: gs.caravanHp,
      emberSeeds: gs.emberSeeds,
      ancientMemoryFragments: gs.ancientMemoryFragments,
      ashMaterials: gs.ashMaterials,
    };
  }

  private resolveBattleVictory(node: TutorialRouteNode, battleId: string) {
    if (this.isResolving) return;
    this.isResolving = true;

    const gs = getGameState();
    if (!canResolveTutorialBattle(gs, battleId)) {
      this.messageText?.setText("该战斗已完成。");
      this.isResolving = false;
      return;
    }
    const beforeState = this.saveCurrentState();

    const result = resolveTutorialBattleVictory(gs, battleId);
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
      this.messageText?.setText(`战斗胜利：${node.title}！\n` + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)));
      this.isResolving = false;
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);

    this.messageText?.setText(`战斗胜利：${node.title}！\n` + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)) + `\n前进到：${newNode.title}（第 ${gs.day} 天）`);

    this.isResolving = false;
    this.renderNode();
  }

  private resolveSpecialBattleVictory(node: TutorialRouteNode, specialBattleId: string) {
    if (this.isResolving) return;
    this.isResolving = true;

    const gs = getGameState();
    if (!canResolveTutorialSpecialBattle(gs, specialBattleId)) {
      this.messageText?.setText("该特殊战已完成。");
      this.isResolving = false;
      return;
    }
    const beforeState = this.saveCurrentState();

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
      this.messageText?.setText("劫匪抢货战胜利：货物安全！\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)));
      this.isResolving = false;
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);

    this.messageText?.setText("劫匪抢货战胜利：货物安全！\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)) + `\n前进到：${newNode.title}（第 ${gs.day} 天）`);

    this.isResolving = false;
    this.renderNode();
  }

  private handleSkipElite(node: TutorialRouteNode, eliteBattleId: string) {
    if (this.isResolving) return;
    this.isResolving = true;

    const gs = getGameState();
    if (!canResolveTutorialEliteBattle(gs, eliteBattleId)) {
      this.messageText?.setText("该精英战已处理。");
      this.isResolving = false;
      return;
    }
    const beforeState = this.saveCurrentState();

    const eliteState = skipTutorialEliteBattle(gs, eliteBattleId);
    Object.assign(gs, eliteState);

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
      this.messageText?.setText("绕开了灰烬母巢，安全继续前进。\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)));
      this.isResolving = false;
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);

    this.messageText?.setText("绕开了灰烬母巢，安全继续前进。\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)) + `\n前进到：${newNode.title}（第 ${gs.day} 天）`);

    this.isResolving = false;
    this.renderNode();
  }

  private resolveEliteBattleVictory(node: TutorialRouteNode, eliteBattleId: string) {
    if (this.isResolving) return;
    this.isResolving = true;

    const gs = getGameState();
    if (!canResolveTutorialEliteBattle(gs, eliteBattleId)) {
      this.messageText?.setText("该精英战已处理。");
      this.isResolving = false;
      return;
    }
    const beforeState = this.saveCurrentState();

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
      this.messageText?.setText("挑战灰烬母巢胜利！\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)));
      this.isResolving = false;
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);

    this.messageText?.setText("挑战灰烬母巢胜利！\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)) + `\n前进到：${newNode.title}（第 ${gs.day} 天）`);

    this.isResolving = false;
    this.renderNode();
  }

  private resolveEliteBattleRescue(node: TutorialRouteNode, eliteBattleId: string) {
    if (this.isResolving) return;
    this.isResolving = true;

    const gs = getGameState();
    if (!canResolveTutorialEliteBattle(gs, eliteBattleId)) {
      this.messageText?.setText("该精英战已处理。");
      this.isResolving = false;
      return;
    }
    const beforeState = this.saveCurrentState();

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
      this.messageText?.setText("挑战失败：路过商队救援了你的队伍。\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)));
      this.isResolving = false;
      this.showCompletedView();
      return;
    }
    gs.currentTutorialNodeId = newNode.id;
    setGameState(gs);

    this.messageText?.setText("挑战失败：路过商队救援了你的队伍。\n" + this.formatStateDiff(beforeState, this.getStateSnapshot(gs)) + `\n前进到：${newNode.title}（第 ${gs.day} 天）`);

    this.isResolving = false;
    this.renderNode();
  }

  private showCompletedView() {
    const gs = getGameState();
    if (!gs.tutorialEliteBattleFlags.includes("n31_tutorial_route_completed")) {
      gs.tutorialEliteBattleFlags = [...(gs.tutorialEliteBattleFlags || []), "n31_tutorial_route_completed"];
    }
    if (!gs.tutorialEliteBattleFlags.includes("arrived_first_outpost")) {
      gs.tutorialEliteBattleFlags = [...(gs.tutorialEliteBattleFlags || []), "arrived_first_outpost"];
    }
    setGameState(gs);

    this.nodeInfoText?.setText(
      `🎉 你抵达了灰灯驿站！\n\n` +
      `N3.1 第一章固定教学路线完成！\n\n` +
      `最终天数：第 ${gs.day} 天\n\n` +
      `最终资源：\n` +
      `补给：${gs.food}\n` +
      `备用零件：${gs.spareParts}\n` +
      `银币：${gs.silver}\n` +
      `士气：${gs.morale}/10\n` +
      `货车耐久：${gs.caravanHp}/${gs.caravanMaxHp}\n\n` +
      `精英奖励：\n` +
      `火种：${gs.emberSeeds}（挑战灰烬母巢胜利获得）\n` +
      `古代记忆碎片：${gs.ancientMemoryFragments}（挑战灰烬母巢胜利获得）\n` +
      `灰烬材料：${gs.ashMaterials}（挑战灰烬母巢胜利获得）`,
    );

    this.buttonContainer?.removeAll(true);
    const baseX = 20;
    let y = this.scale.height - 320;
    const btnW = Math.min(600, this.scale.width - 40);
    const btnH = 44;

    const bg1 = this.add.graphics();
    bg1.fillStyle(0x4a8a4a, 1).fillRect(baseX, y, btnW, btnH);
    bg1.setInteractive(new Phaser.Geom.Rectangle(baseX, y, btnW, btnH), Phaser.Geom.Rectangle.Contains);
    bg1.on("pointerover", () => bg1.fillStyle(0x6aaa6a, 1).fillRect(baseX, y, btnW, btnH));
    bg1.on("pointerout", () => bg1.fillStyle(0x4a8a4a, 1).fillRect(baseX, y, btnW, btnH));
    bg1.on("pointerdown", () => this.scene.start("MainMenuScene"));
    const label1 = this.add.text(baseX + 20, y + btnH / 2 - 10, "回到主菜单", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    this.buttonContainer?.add(bg1);
    this.buttonContainer?.add(label1);
  }

  private log(msg: string) {
    console.log("[TutorialRouteScene]", msg);
  }
}
