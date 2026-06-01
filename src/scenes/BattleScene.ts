import Phaser from "phaser";
import { BattleManager } from "../systems/BattleManager";
import { TooltipManager } from "../systems/tooltipSystem";
import {
  createCharacterState,
  getStartingDeck,
  CHARACTER_DEFS,
  generateRewardCards,
} from "../data/characters";
import {
  createEnemyState,
  ENEMY_DEFS,
  ENEMY_ACTIONS,
  getEnemyNextAction,
} from "../data/enemies";
import { CharacterState, EnemyState, CardDef } from "../data/types";
import {
  getGameState,
  setGameState,
  resetGameState,
  checkVictory,
  updateReachableCells,
  getAvailableCharacters,
  syncCharacterStatesFromBattle,
  checkExpeditionFailed,
} from "../systems/GameState";
import { CaravanPart, getRandomUnownedPart } from "../data/caravanParts";
import {
  generateBattleRewardCards,
  addRewardCardToDeck,
} from "../systems/rewardSystem";
import { isDevCheatEnabled } from "../systems/devConfig";

export class BattleScene extends Phaser.Scene {
  private battleManager!: BattleManager;

  // UI元素
  private characterPanels: Phaser.GameObjects.Container[] = [];
  private characterSkillTexts: Phaser.GameObjects.Text[] = [];
  private enemyPanels: Phaser.GameObjects.Container[] = [];
  private cardTexts: Phaser.GameObjects.Text[] = [];
  private actionPointText!: Phaser.GameObjects.Text;
  private turnText!: Phaser.GameObjects.Text;
  private caravanText!: Phaser.GameObjects.Text;
  private endTurnBtn!: Phaser.GameObjects.Text;
  private restartBtn!: Phaser.GameObjects.Text;

  // 状态
  private selectedCard: { charIndex: number; cardIndex: number } | null = null;
  private selectedEnemy: number | null = null;
  private battleEnded: boolean = false;

  // 键盘监听器引用（Bug 7: 用于 shutdown 清理）
  private rewardKeyHandler?: Function;
  private battleResultKeyHandler?: Function;

  // dev-only: 暴露奖励卡列表，供自动化测试直接调用 selectRewardCard
  private _rewardCards: CardDef[] = [];

  // 部件效果触发保护（阶段6.1）
  private battleEndPartsApplied: boolean = false;
  private partRewardClaimed: boolean = false;

  constructor() {
    super({ key: "BattleScene" });
  }

  /**
   * 场景关闭时清理所有全局键盘监听器（Bug 11）。
   * this.input.keyboard 是全局 InputManager，其 listener 不会随 scene 关闭而自动移除。
   */
  shutdown() {
    this.input.keyboard?.off("keydown-E");
    this.input.keyboard?.off("keydown-ENTER");
    this.input.keyboard?.off("keydown-F");
    // dev-only 键只在 dev 模式下移除
    if (isDevCheatEnabled()) {
      this.input.keyboard?.off("keydown-Q");
      this.input.keyboard?.off("keydown-J");
      this.input.keyboard?.off("keydown-R");
      this.input.keyboard?.off("keydown-T");
    }
    if (this.rewardKeyHandler) {
      this.input.keyboard?.off("keydown", this.rewardKeyHandler);
      this.rewardKeyHandler = undefined;
    }
    if (this.battleResultKeyHandler) {
      this.input.keyboard?.off("keydown-ENTER", this.battleResultKeyHandler);
      this.battleResultKeyHandler = undefined;
    }
  }

  create() {
    // 重置实例变量（Scene 可能被重用）
    this.tooltipManager = new TooltipManager(this, 500);
    this.characterPanels = [];
    this.characterSkillTexts = [];
    this.enemyPanels = [];
    this.cardTexts = [];
    this.selectedCard = null;
    this.selectedEnemy = null;
    this.battleEnded = false;
    this._rewardCards = [];
    this.skillTooltip = null;
    // 阶段6.1: 重置部件效果触发保护
    this.battleEndPartsApplied = false;
    this.partRewardClaimed = false;

    const w = this.scale.width;
    const h = this.scale.height;

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRect(0, 0, w, h);

    // 获取游戏状态
    const gameState = getGameState();

    // 创建队伍（从持久化角色状态加载，重伤/死亡角色不参与）
    let characters: CharacterState[];
    if (
      gameState.selectedCharacters.length === 3 &&
      Object.keys(gameState.characterStates).length > 0
    ) {
      // 从持久化状态加载可用角色
      const available = getAvailableCharacters();
      if (available.length === 0) {
        // 全队重伤/死亡，远征失败
        console.log("[战斗] 全队无法战斗，远征失败");
        this.showExpeditionFailed();
        return;
      }
      // 为每个可用角色创建战斗副本（保留HP和重伤状态，使用持久化牌组）
      characters = available.map((cs) => {
        const fresh = createCharacterState(cs.def.id);
        fresh.currentHp = cs.currentHp;
        fresh.graveWounds = cs.graveWounds;
        fresh.isWounded = cs.isWounded;
        fresh.restNodes = cs.restNodes;
        fresh.isDead = cs.isDead;
        // 使用持久化牌组（包含奖励卡），而非初始牌组
        fresh.deck = cs.deck.map((c) => ({
          ...c,
          effects: c.effects.map((e) => ({ ...e })),
        }));
        console.log(`[战斗] ${cs.def.name} 牌组: ${fresh.deck.length}张`);
        console.log(
          `[牌组] ${cs.def.name} deck=${fresh.deck.length}: ${fresh.deck.map((c) => c.name).join(", ")}`,
        );
        return fresh;
      });
      console.log(
        `[战斗] 可用角色: ${characters.map((c) => c.def.name).join(", ")}`,
      );
    } else {
      // 默认测试队伍（用于直接测试战斗场景）
      characters = [
        createCharacterState("guardian"),
        createCharacterState("sharpshooter"),
        createCharacterState("repairman"),
      ];
    }

    // 根据战斗类型创建敌人
    let enemies: EnemyState[];
    if (gameState.currentBattleType === "boss") {
      // Boss战：更强的敌人
      enemies = [createEnemyState("boss")];
    } else if (gameState.currentBattleType === "elite") {
      // 精英战斗：更强的敌人组合
      enemies = [
        createEnemyState("bandit"),
        createEnemyState("bandit"),
        createEnemyState("beast"),
      ];
    } else {
      // 普通战斗
      enemies = [createEnemyState("bandit"), createEnemyState("beast")];
    }

    // 同步商队耐久
    const caravanDurability = gameState.caravanHp;
    const caravanMaxDurability = gameState.caravanMaxHp;

    // 创建战斗管理器（传递商队部件用于战术旗帜等效果）
    this.battleManager = new BattleManager(
      characters,
      enemies,
      (victory) => {
        this.onBattleEnd(victory);
      },
      caravanDurability,
      caravanMaxDurability,
      gameState.caravanParts,
    );

    // 开始战斗
    this.battleManager.startBattle();

    // 创建UI
    this.createUI();

    // 键盘快捷键
    this.input.keyboard?.on("keydown-E", () => this.endTurn());
    this.input.keyboard?.on("keydown-ENTER", () => this.endTurn());

    // === dev-only 调试键：仅在开发/测试模式启用 ===
    if (isDevCheatEnabled()) {
      // Q 键：强制胜利（dev-only）
      // 必须走 onBattleEnd(true) 统一流程，确保重伤同步逻辑执行
      this.input.keyboard?.on("keydown-Q", () => {
        if (!this.battleEnded) {
          console.log("[战斗调试Q] 强制胜利，走统一战斗结束流程");
          // 直接杀死所有敌人
          this.battleManager.state.enemies.forEach((e) => (e.currentHp = 0));
          // 调用统一的战斗结束处理
          this.onBattleEnd(true);
        }
      });
      // J 键：让第一个角色 HP=0（dev-only）
      this.input.keyboard?.on("keydown-J", () => {
        if (this.battleEnded) return;
        const firstChar = this.battleManager.state.characters[0];
        if (firstChar) {
          firstChar.currentHp = 0;
          console.log(
            `[战斗调试J] ${firstChar.def.name} HP设为0，将在战斗结束时进入重伤`,
          );
        }
      });
      // R 键：直接打开卡牌奖励界面（dev-only）
      // 不需要打战斗就能测试奖励UI
      // Boss 战中禁用 R 键，避免误判
      this.input.keyboard?.on("keydown-R", () => {
        if (!this.battleEnded) {
          const gs = getGameState();
          if (gs.currentBattleType === "boss") {
            console.log("[战斗调试R] Boss战中禁用R键奖励调试");
            return;
          }
          this.battleEnded = true;
          // 同步商队耐久
          const gameState = getGameState();
          gameState.caravanHp = this.battleManager.state.caravanDurability;
          syncCharacterStatesFromBattle(this.battleManager.state.characters);
          // 标记当前战斗节点为已清理（使用统一函数）
          this.clearCurrentBattleNode(gameState);
          gameState.currentBattleType = null;
          setGameState(gameState);
          console.log("[战斗调试R] 直接打开卡牌奖励界面");
          this.showCardRewardScreen();
        }
      });
      // T 键：将升级卡注入第一个角色手牌（dev-only，用于测试升级卡出牌效果）
      this.input.keyboard?.on("keydown-T", () => {
        if (this.battleEnded) return;
        const char = this.battleManager.state.characters[0];
        if (!char || char.currentHp <= 0) {
          console.log("[战斗调试T] 第一个角色不可用");
          return;
        }
        // 优先查找举盾（guardian_shield_up），用于测试升级卡护甲效果
        const upgradable = char.deck.find(
          (c) =>
            c.id === "guardian_shield_up" ||
            c.id === "guardian_heavy_strike" ||
            c.id === "guardian_intercept" ||
            c.id === "guardian_shield_bash",
        );
        if (!upgradable) {
          console.log("[战斗调试T] 未找到可升级的护路人卡牌");
          return;
        }
        // 构造升级卡（模拟 upgradeCard 逻辑）
        const upgradedCard: CardDef = {
          ...upgradable,
          name: `${upgradable.name}+`,
          upgraded: true,
          effects: upgradable.effects.map((eff) => {
            if (
              eff.type === "damage" ||
              eff.type === "heal" ||
              eff.type === "armor" ||
              eff.type === "repair_caravan"
            ) {
              return { ...eff, value: eff.value + 3 };
            }
            return { ...eff };
          }),
        };
        char.hand.push(upgradedCard);
        console.log(
          `[战斗调试T] 注入升级卡【${upgradedCard.name}】到手牌，effects=${JSON.stringify(upgradedCard.effects)}`,
        );
        console.log(`[战斗调试T] 当前手牌: ${char.hand.map((c) => c.name).join(", ")}`);
        this.updateUI();
      });
    }

    console.log("[余烬商队] 战斗场景初始化完成");
    console.log("队伍:", characters.map((c) => c.def.name).join(", "));
    console.log("敌人:", enemies.map((e) => e.def.name).join(", "));

    // 如果是鼠标点击模拟测试或方向模拟测试触发的战斗，自动模拟点击操作
    if (gameState._isClickTesting || gameState._isDirectionalTesting) {
      console.log("[鼠标模拟测试-战斗] 检测到点击测试模式，自动模拟战斗操作");
      this.time.delayedCall(800, () => {
        this.clickSimAutoBattle();
      });
    }
  }

  private createUI(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // 顶部信息栏
    this.turnText = this.add
      .text(w / 2, 10, `第 ${this.battleManager.state.turn} 回合`, {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.actionPointText = this.add
      .text(
        w / 2,
        34,
        `⚡ 行动力: ${this.battleManager.state.actionPoints}/${this.battleManager.state.maxActionPoints}`,
        {
          fontSize: "16px",
          color: "#ffcc00",
          fontFamily: "monospace",
        },
      )
      .setOrigin(0.5, 0);

    // 商队状态（顶部中央下方）
    this.caravanText = this.add
      .text(
        w / 2,
        56,
        `🚗 商队耐久: ${this.battleManager.state.caravanDurability}/${this.battleManager.state.caravanMaxDurability}`,
        {
          fontSize: "14px",
          color: "#88cc88",
          fontFamily: "monospace",
        },
      )
      .setOrigin(0.5, 0);

    // 角色面板（左侧）
    this.createCharacterPanels();

    // 敌人面板（右侧）
    this.createEnemyPanels();

    // 手牌区域（底部）
    this.createHandArea();

    // 结束回合按钮（放在底部手牌区右侧）
    this.endTurnBtn = this.add
      .text(w - 10, h - 30, "结束回合(E)", {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#336633",
        padding: { x: 10, y: 4 },
        fontFamily: "monospace",
      })
      .setOrigin(1, 0)
      .setInteractive();

    this.endTurnBtn.on("pointerdown", () => this.endTurn());
    this.endTurnBtn.on("pointerover", () =>
      this.endTurnBtn.setStyle({ backgroundColor: "#447744" }),
    );
    this.endTurnBtn.on("pointerout", () =>
      this.endTurnBtn.setStyle({ backgroundColor: "#336633" }),
    );

    // 重新开始按钮
    this.restartBtn = this.add
      .text(w - 10, h - 55, "重新开始(R)", {
        fontSize: "12px",
        color: "#aaaaaa",
        backgroundColor: "#333333",
        padding: { x: 8, y: 3 },
        fontFamily: "monospace",
      })
      .setOrigin(1, 0)
      .setInteractive();

    this.restartBtn.on("pointerdown", () => this.restart());
    this.restartBtn.on("pointerover", () =>
      this.restartBtn.setStyle({ backgroundColor: "#444444" }),
    );
    this.restartBtn.on("pointerout", () =>
      this.restartBtn.setStyle({ backgroundColor: "#333333" }),
    );

    // 左下角日志和操作提示已移除

    this.updateUI();
  }

  private createCharacterPanels(): void {
    const chars = this.battleManager.state.characters;
    const startY = 80;
    const panelHeight = 65;
    const spacing = panelHeight + 70; // 大幅增加面板间距

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const panel = this.add.container(10, startY + i * spacing);

      // 背景框
      const bg = this.add.graphics();
      bg.fillStyle(char.def.color, 0.15);
      bg.fillRect(0, 0, 220, panelHeight);
      bg.lineStyle(2, char.def.color, 0.8);
      bg.strokeRect(0, 0, 220, panelHeight);
      panel.add(bg);

      // 角色名
      const nameText = this.add.text(
        8,
        6,
        `${char.def.icon} ${char.def.name}`,
        {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: "monospace",
          fontStyle: "bold",
        },
      );
      panel.add(nameText);

      // HP和护甲
      const hpColor =
        char.currentHp > char.def.maxHp * 0.5
          ? "#ff6666"
          : char.currentHp > 0
            ? "#ffaa44"
            : "#666666";
      const statsText = this.add.text(
        8,
        30,
        `❤️${char.currentHp}/${char.def.maxHp}  🛡️${char.armor}`,
        {
          fontSize: "14px",
          color: hpColor,
          fontFamily: "monospace",
        },
      );
      panel.add(statsText);

      // 状态
      if (char.currentHp <= 0) {
        const statusText = this.add.text(8, 48, "💀已倒下", {
          fontSize: "12px",
          color: "#ff4444",
          fontFamily: "monospace",
        });
        panel.add(statusText);
      }

      this.characterPanels.push(panel);

      // 技能图标（面板下方）
      this.createSkillIcons(char, i, startY + i * spacing + panelHeight + 5);
    }
  }

  private createSkillIcons(
    char: CharacterState,
    charIndex: number,
    startY: number,
  ): void {
    const deck = getStartingDeck(char.def.id);
    const skillColor = "#" + char.def.color.toString(16).padStart(6, "0");
    let iconX = 16;
    const radius = 18;
    const diameter = radius * 2;

    for (let i = 0; i < deck.length; i++) {
      const card = deck[i];
      const cx = iconX + radius;
      const cy = startY + radius;

      // 创建技能图标（圆形背景+文字）
      const iconBg = this.add.graphics();
      iconBg.fillStyle(char.def.color, 0.3);
      iconBg.fillCircle(cx, cy, radius);
      iconBg.lineStyle(1, char.def.color, 1);
      iconBg.strokeCircle(cx, cy, radius);

      // 技能名称（取第一个字）
      const skillIcon = this.add
        .text(cx, cy, card.name.charAt(0), {
          fontSize: "18px",
          color: skillColor,
          fontFamily: "monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      // 设置交互区域
      const hitArea = this.add
        .zone(cx, cy, diameter, diameter)
        .setInteractive();

      // 悬停显示技能介绍
      hitArea.on("pointerover", () => {
        iconBg.clear();
        iconBg.fillStyle(char.def.color, 0.6);
        iconBg.fillCircle(cx, cy, radius);
        iconBg.lineStyle(2, char.def.color, 1);
        iconBg.strokeCircle(cx, cy, radius);
        this.showSkillTooltip(card, cx, cy - radius - 5);
      });

      hitArea.on("pointerout", () => {
        iconBg.clear();
        iconBg.fillStyle(char.def.color, 0.3);
        iconBg.fillCircle(cx, cy, radius);
        iconBg.lineStyle(1, char.def.color, 1);
        iconBg.strokeCircle(cx, cy, radius);
        this.hideSkillTooltip();
      });

      iconX += diameter + 12; // 增大技能图标间距
    }
  }

  private skillTooltip: Phaser.GameObjects.Container | null = null;
  private tooltipManager: TooltipManager | null = null;

  private showSkillTooltip(card: CardDef, x: number, y: number): void {
    this.hideSkillTooltip();

    const tooltip = this.add.container(x, y);

    // 背景
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.lineStyle(1, 0x888888, 1);

    // 计算文本尺寸
    const nameText = this.add.text(0, 0, `${card.name} [${card.cost}]`, {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    const descText = this.add.text(0, 18, card.description, {
      fontSize: "10px",
      color: "#cccccc",
      fontFamily: "monospace",
      wordWrap: { width: 150 },
    });

    const width = Math.max(nameText.width, Math.min(descText.width, 150)) + 16;
    const height = 20 + descText.height + 8;

    bg.fillRoundedRect(-width / 2, -height - 5, width, height, 4);
    bg.strokeRoundedRect(-width / 2, -height - 5, width, height, 4);

    tooltip.add(bg);
    tooltip.add(nameText);
    tooltip.add(descText);

    nameText.setPosition(-width / 2 + 8, -height + 3);
    descText.setPosition(-width / 2 + 8, -height + 21);

    this.skillTooltip = tooltip;
  }

  private hideSkillTooltip(): void {
    if (this.skillTooltip) {
      this.skillTooltip.destroy();
      this.skillTooltip = null;
    }
  }

  private createEnemyPanels(): void {
    const enemies = this.battleManager.state.enemies;
    const w = this.scale.width;
    const startY = 80;
    const panelHeight = 70;
    const spacing = panelHeight + 70; // 大幅增加间距

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const panel = this.add.container(w - 230, startY + i * spacing);

      // 背景框
      const bg = this.add.graphics();
      bg.fillStyle(enemy.def.color, 0.15);
      bg.fillRect(0, 0, 220, panelHeight);
      bg.lineStyle(2, enemy.def.color, 0.8);
      bg.strokeRect(0, 0, 220, panelHeight);
      panel.add(bg);

      // 敌人名
      const nameText = this.add.text(
        8,
        6,
        `${enemy.def.icon} ${enemy.def.name}`,
        {
          fontSize: "16px",
          color: enemy.currentHp > 0 ? "#ffffff" : "#666666",
          fontFamily: "monospace",
          fontStyle: "bold",
        },
      );
      panel.add(nameText);

      // HP + 护甲 + 标记 合并一行
      const hpColor =
        enemy.currentHp > enemy.def.maxHp * 0.5
          ? "#ff6666"
          : enemy.currentHp > 0
            ? "#ffaa44"
            : "#666666";
      let statsStr = `❤️${enemy.currentHp}/${enemy.def.maxHp}  🛡️${enemy.armor}`;
      if (enemy.marks > 0) statsStr += `  👁️${enemy.marks}`;
      const statsText = this.add.text(8, 30, statsStr, {
        fontSize: "14px",
        color: hpColor,
        fontFamily: "monospace",
      });
      panel.add(statsText);

      // 意图
      if (enemy.nextAction && enemy.currentHp > 0) {
        const intentColor =
          enemy.nextAction.target === "caravan" ? "#88cc88" : "#ff8866";
        const intentText = this.add.text(8, 50, `👉 ${enemy.nextAction.name}`, {
          fontSize: "12px",
          color: intentColor,
          fontFamily: "monospace",
        });
        panel.add(intentText);
      }

      // 已死亡
      if (enemy.currentHp <= 0) {
        const deadText = this.add.text(8, 50, "💀已击败", {
          fontSize: "12px",
          color: "#666666",
          fontFamily: "monospace",
        });
        panel.add(deadText);
      }

      // 点击选择敌人
      if (enemy.currentHp > 0) {
        const hitArea = this.add
          .zone(110, panelHeight / 2, 220, panelHeight)
          .setInteractive();
        hitArea.on("pointerdown", () => this.onEnemyClick(i));
        panel.add(hitArea);
      }

      this.enemyPanels.push(panel);

      // 敌人技能图标（面板下方）
      this.createEnemySkillIcons(
        enemy,
        i,
        startY + i * spacing + panelHeight + 5,
      );
    }
  }

  private createEnemySkillIcons(
    enemy: EnemyState,
    enemyIndex: number,
    startY: number,
  ): void {
    // 收集该敌人的所有技能
    const enemySkills: { name: string; description: string }[] = [];
    const enemyId = enemy.def.id;

    // 遍历 ENEMY_ACTIONS 找到属于该敌人的技能
    const actionMap: Record<string, string[]> = {
      bandit: ["bandit_attack"],
      beast: ["beast_attack"],
      raider: ["raider_attack"],
      slinger: ["slinger_attack"],
      destroyer: ["destroyer_attack"],
      boss: [
        "boss_attack_char",
        "boss_attack_caravan",
        "boss_summon",
        "boss_buff",
      ],
    };

    const skillKeys = actionMap[enemyId] || [];
    for (const key of skillKeys) {
      const action = ENEMY_ACTIONS[key as keyof typeof ENEMY_ACTIONS];
      if (action) {
        enemySkills.push({
          name: action.name,
          description: action.description,
        });
      }
    }

    const skillColor = "#" + enemy.def.color.toString(16).padStart(6, "0");
    const w = this.scale.width;
    let iconX = w - 230 + 16;
    const radius = 18;
    const diameter = radius * 2;

    for (let i = 0; i < enemySkills.length; i++) {
      const skill = enemySkills[i];
      const cx = iconX + radius;
      const cy = startY + radius;

      // 创建技能图标（圆形背景+文字）
      const iconBg = this.add.graphics();
      iconBg.fillStyle(enemy.def.color, 0.3);
      iconBg.fillCircle(cx, cy, radius);
      iconBg.lineStyle(1, enemy.def.color, 1);
      iconBg.strokeCircle(cx, cy, radius);

      // 技能名称（取第一个字）
      const skillIcon = this.add
        .text(cx, cy, skill.name.charAt(0), {
          fontSize: "18px",
          color: skillColor,
          fontFamily: "monospace",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      // 设置交互区域
      const hitArea = this.add
        .zone(cx, cy, diameter, diameter)
        .setInteractive();

      // 悬停显示技能介绍
      hitArea.on("pointerover", () => {
        iconBg.clear();
        iconBg.fillStyle(enemy.def.color, 0.6);
        iconBg.fillCircle(cx, cy, radius);
        iconBg.lineStyle(2, enemy.def.color, 1);
        iconBg.strokeCircle(cx, cy, radius);
        this.showEnemySkillTooltip(skill, cx, cy - radius - 5);
      });

      hitArea.on("pointerout", () => {
        iconBg.clear();
        iconBg.fillStyle(enemy.def.color, 0.3);
        iconBg.fillCircle(cx, cy, radius);
        iconBg.lineStyle(1, enemy.def.color, 1);
        iconBg.strokeCircle(cx, cy, radius);
        this.hideSkillTooltip();
      });

      iconX += diameter + 12; // 增大敌人技能图标间距
    }
  }

  private showEnemySkillTooltip(
    skill: { name: string; description: string },
    x: number,
    y: number,
  ): void {
    this.hideSkillTooltip();

    const tooltip = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.lineStyle(1, 0x888888, 1);

    const nameText = this.add.text(0, 0, skill.name, {
      fontSize: "12px",
      color: "#ff8888",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    const descText = this.add.text(0, 18, skill.description, {
      fontSize: "10px",
      color: "#cccccc",
      fontFamily: "monospace",
      wordWrap: { width: 150 },
    });

    const width = Math.max(nameText.width, Math.min(descText.width, 150)) + 16;
    const height = 20 + descText.height + 8;

    bg.fillRoundedRect(-width / 2, -height - 5, width, height, 4);
    bg.strokeRoundedRect(-width / 2, -height - 5, width, height, 4);

    tooltip.add(bg);
    tooltip.add(nameText);
    tooltip.add(descText);

    nameText.setPosition(-width / 2 + 8, -height + 3);
    descText.setPosition(-width / 2 + 8, -height + 21);

    this.skillTooltip = tooltip;
  }

  private createHandArea(): void {
    this.updateHandDisplay();
  }

  private updateHandDisplay(): void {
    // 清除旧的手牌显示
    this.cardTexts.forEach((t) => t.destroy());
    this.cardTexts = [];

    const w = this.scale.width;
    const h = this.scale.height;
    const chars = this.battleManager.state.characters;

    // 手牌区域：充分利用底部空间
    const leftBound = 10;
    const rightBound = w - 10;
    const availableWidth = rightBound - leftBound;

    // 计算总卡牌数
    let totalCards = 0;
    for (const char of chars) {
      if (char.currentHp > 0) totalCards += char.hand.length;
    }

    // 充分利用底部空间，卡牌均匀分布不重叠
    const cardSpacing =
      totalCards > 1 ? (availableWidth - 20) / totalCards : availableWidth;
    const totalWidth = totalCards * cardSpacing;
    let cardX = leftBound + (availableWidth - totalWidth) / 2 + cardSpacing / 2;
    const cardY = h - 80;

    for (let charIndex = 0; charIndex < chars.length; charIndex++) {
      const char = chars[charIndex];
      if (char.currentHp <= 0) continue;

      for (let cardIndex = 0; cardIndex < char.hand.length; cardIndex++) {
        const card = char.hand[cardIndex];
        const isSelected =
          this.selectedCard?.charIndex === charIndex &&
          this.selectedCard?.cardIndex === cardIndex;

        const canPlay = card.cost <= this.battleManager.state.actionPoints;
        const cardText = this.createCardText(
          cardX,
          cardY,
          card,
          char.def.color,
          isSelected,
          canPlay,
          char.def.name,
        );

        // 点击事件
        cardText.setInteractive();
        cardText.on("pointerdown", () =>
          this.onCardClick(charIndex, cardIndex),
        );
        cardText.on("pointerover", () => {
          if (!isSelected && canPlay)
            cardText.setStyle({ backgroundColor: "#3a3a5a" });
          // 显示手牌 Tooltip
          if (this.tooltipManager) {
            const pointer = this.input.activePointer;
            this.tooltipManager.show(
              {
                title: card.name,
                lines: [
                  `费用：${card.cost}`,
                  `类型：${card.type}`,
                  `角色：${card.characterId || "通用"}`,
                  "",
                  card.description || "无描述",
                  card.effects ? `效果：${card.effects}` : "",
                ].filter((l) => l !== ""),
              },
              pointer.x,
              pointer.y,
            );
          }
        });
        cardText.on("pointerout", () => {
          if (!isSelected)
            cardText.setStyle({
              backgroundColor: canPlay ? "#2a2a4a" : "#1a1a2a",
            });
          // 隐藏手牌 Tooltip
          if (this.tooltipManager) this.tooltipManager.hide();
        });

        this.cardTexts.push(cardText);
        cardX += cardSpacing;
      }
    }
  }

  private createCardText(
    x: number,
    y: number,
    card: CardDef,
    charColor: number,
    isSelected: boolean,
    canPlay: boolean,
    charName: string,
  ): Phaser.GameObjects.Text {
    const bgColor = isSelected ? "#555588" : canPlay ? "#2a2a4a" : "#1a1a2a";
    const cardColorHex = "#" + charColor.toString(16).padStart(6, "0");
    const textColor = canPlay ? cardColorHex : "#444444";

    // 只显示费用和名字，不显示描述，避免重叠
    const text = this.add
      .text(x, y, `[${card.cost}] ${card.name}`, {
        fontSize: "18px",
        color: textColor,
        backgroundColor: bgColor,
        padding: { x: 14, y: 10 },
        align: "center",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    return text;
  }

  private onCardClick(charIndex: number, cardIndex: number): void {
    if (this.battleEnded) return;

    // 如果已经选了这张牌，尝试出牌
    if (
      this.selectedCard?.charIndex === charIndex &&
      this.selectedCard?.cardIndex === cardIndex
    ) {
      this.tryPlayCard();
      return;
    }

    // 选择这张牌
    if (this.battleManager.selectCard(charIndex, cardIndex)) {
      this.selectedCard = { charIndex, cardIndex };
      this.updateHandDisplay();
      console.log(
        `[选择] ${this.battleManager.state.characters[charIndex].def.name} 选择了【${this.battleManager.state.characters[charIndex].hand[cardIndex]?.name || "未知"}】`,
      );
    }
  }

  private onEnemyClick(enemyIndex: number): void {
    if (this.battleEnded) return;

    if (this.battleManager.selectEnemy(enemyIndex)) {
      this.selectedEnemy = enemyIndex;
      console.log(
        `[选择] 目标: ${this.battleManager.state.enemies[enemyIndex].def.name}`,
      );

      // 如果已经选了牌，尝试出牌
      if (this.selectedCard) {
        this.tryPlayCard();
      }
    }
  }

  private tryPlayCard(): void {
    if (this.battleManager.playCard()) {
      this.selectedCard = null;
      this.selectedEnemy = null;
      this.updateUI();
    }
  }

  private endTurn(): void {
    if (this.battleEnded) return;

    this.selectedCard = null;
    this.selectedEnemy = null;
    this.battleManager.endTurn();
    this.updateUI();
  }

  private restart(): void {
    this.scene.restart();
  }

  private updateUI(): void {
    // 更新回合和行动力
    this.turnText.setText(`第 ${this.battleManager.state.turn} 回合`);
    this.actionPointText.setText(
      `⚡ 行动力: ${this.battleManager.state.actionPoints}/${this.battleManager.state.maxActionPoints}`,
    );

    // 更新商队状态
    const dur = this.battleManager.state.caravanDurability;
    const maxDur = this.battleManager.state.caravanMaxDurability;
    const caravanColor =
      dur < maxDur * 0.3
        ? "#ff4444"
        : dur < maxDur * 0.6
          ? "#ffaa44"
          : "#88cc88";
    this.caravanText.setText(`🚗 商队耐久: ${dur}/${maxDur}`);
    this.caravanText.setStyle({ color: caravanColor });

    // 更新角色面板
    for (let i = 0; i < this.battleManager.state.characters.length; i++) {
      if (i < this.characterPanels.length) {
        this.updateCharacterPanel(i);
      }
    }

    // 更新敌人面板
    for (let i = 0; i < this.battleManager.state.enemies.length; i++) {
      if (i < this.enemyPanels.length) {
        this.updateEnemyPanel(i);
      }
    }

    // 更新手牌
    this.updateHandDisplay();
  }

  private updateCharacterPanel(index: number): void {
    const panel = this.characterPanels[index];
    const char = this.battleManager.state.characters[index];

    // 检查角色是否存在
    if (!char || !char.def) {
      console.warn(`[战斗] 角色 ${index} 不存在`);
      return;
    }

    // 清除旧文本
    panel.each((child) => {
      if (child instanceof Phaser.GameObjects.Text) {
        child.destroy();
      }
    });

    // 角色名
    const nameText = this.add.text(8, 6, `${char.def.icon} ${char.def.name}`, {
      fontSize: "16px",
      color: char.currentHp > 0 ? "#ffffff" : "#666666",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    panel.add(nameText);

    // HP + 护甲
    const hpColor =
      char.currentHp > char.def.maxHp * 0.5
        ? "#ff6666"
        : char.currentHp > 0
          ? "#ffaa44"
          : "#666666";
    const statsText = this.add.text(
      8,
      30,
      `❤️${char.currentHp}/${char.def.maxHp}  🛡️${char.armor}`,
      {
        fontSize: "14px",
        color: hpColor,
        fontFamily: "monospace",
      },
    );
    panel.add(statsText);

    // 状态
    if (char.currentHp <= 0) {
      const statusText = this.add.text(8, 48, "💀已倒下", {
        fontSize: "12px",
        color: "#ff4444",
        fontFamily: "monospace",
      });
      panel.add(statusText);
    }
  }

  private updateEnemyPanel(index: number): void {
    const panel = this.enemyPanels[index];
    const enemy = this.battleManager.state.enemies[index];

    // 检查敌人是否存在
    if (!enemy || !enemy.def) {
      console.warn(`[战斗] 敌人 ${index} 不存在`);
      return;
    }

    // 清除旧文本
    panel.each((child) => {
      if (child instanceof Phaser.GameObjects.Text) {
        child.destroy();
      }
    });

    // 敌人名
    const nameText = this.add.text(
      8,
      6,
      `${enemy.def.icon} ${enemy.def.name}`,
      {
        fontSize: "16px",
        color: enemy.currentHp > 0 ? "#ffffff" : "#666666",
        fontFamily: "monospace",
        fontStyle: "bold",
      },
    );
    panel.add(nameText);

    // HP + 护甲 + 标记 合并
    const hpColor =
      enemy.currentHp > enemy.def.maxHp * 0.5
        ? "#ff6666"
        : enemy.currentHp > 0
          ? "#ffaa44"
          : "#666666";
    let statsStr = `❤️${enemy.currentHp}/${enemy.def.maxHp}  🛡️${enemy.armor}`;
    if (enemy.marks > 0) statsStr += `  👁️${enemy.marks}`;
    const statsText = this.add.text(8, 30, statsStr, {
      fontSize: "14px",
      color: hpColor,
      fontFamily: "monospace",
    });
    panel.add(statsText);

    // 意图
    if (enemy.nextAction && enemy.currentHp > 0) {
      const intentColor =
        enemy.nextAction.target === "caravan" ? "#88cc88" : "#ff8866";
      const intentText = this.add.text(8, 50, `👉 ${enemy.nextAction.name}`, {
        fontSize: "12px",
        color: intentColor,
        fontFamily: "monospace",
      });
      panel.add(intentText);
    }

    // 已死亡
    if (enemy.currentHp <= 0) {
      const deadText = this.add.text(8, 50, "💀已击败", {
        fontSize: "12px",
        color: "#666666",
        fontFamily: "monospace",
      });
      panel.add(deadText);
    }
  }

  private onBattleEnd(victory: boolean): void {
    // Item 9/34 (P0): 防止重复触发
    if (this.battleEnded) {
      console.log("[战斗] onBattleEnd 已执行过，忽略重复调用");
      return;
    }
    this.battleEnded = true;

    // 更新游戏状态
    const gameState = getGameState();
    gameState.battleResult = victory ? "victory" : "defeat";

    // 同步商队耐久回游戏状态
    gameState.caravanHp = this.battleManager.state.caravanDurability;

    // 同步角色状态回游戏状态（处理重伤逻辑）
    syncCharacterStatesFromBattle(this.battleManager.state.characters);

    // 检查远征是否因全队重伤/死亡而失败
    if (checkExpeditionFailed()) {
      console.log("[战斗] 远征失败：全队重伤或死亡");
      gameState.currentBattleType = null;
      setGameState(gameState);
      this.showExpeditionFailed();
      return;
    }

    // 如果是Boss战且胜利，标记远征胜利
    if (victory && gameState.currentBattleType === "boss") {
      console.log("[战斗] Boss战胜利，进入远征胜利（不弹卡牌奖励）");
      gameState.battleResult = "victory";
      setGameState(gameState);
      this.showExpeditionVictory();
      return;
    }

    // 如果胜利，标记当前战斗节点为已清理（使用 currentBattleNodePosition）
    if (victory) {
      this.clearCurrentBattleNode(gameState);
    }

    // 保存战斗类型用于后续判断（精英战斗获得部件）
    const battleType = gameState.currentBattleType;

    // 重置战斗状态
    gameState.battleResult = victory ? "victory" : "defeat";
    gameState.currentBattleType = null;

    setGameState(gameState);

    if (victory) {
      // 医疗箱效果：战斗胜利时触发一次（阶段6.1修复）
      this.applyBattleEndPartEffects();

      // 非Boss胜利：精英战斗先显示部件奖励，再显示卡牌奖励
      if (battleType === "elite") {
        console.log("[战斗] 精英战斗胜利，先显示部件奖励");
        this.showCaravanPartRewardScreen();
      } else {
        console.log("[战斗] 胜利，进入卡牌奖励选择");
        this.showCardRewardScreen();
      }
    } else {
      // 失败：显示失败界面
      this.showBattleResultOverlay(false);
    }
  }

  /** 清理当前战斗节点（阶段6.6）：使用 currentBattleNodePosition 而非 currentPosition */
  private clearCurrentBattleNode(gameState: ReturnType<typeof getGameState>): void {
    // 优先使用 currentBattleNodePosition
    const battleNodePos = gameState.currentBattleNodePosition;
    let x: number, y: number;

    if (battleNodePos) {
      x = battleNodePos.x;
      y = battleNodePos.y;
      console.log(`[战斗] 使用 currentBattleNodePosition (${x}, ${y}) 清理节点`);
    } else {
      // Fallback 到 currentPosition（兼容旧逻辑）
      x = gameState.currentPosition.x;
      y = gameState.currentPosition.y;
      console.warn(
        `[战斗] currentBattleNodePosition 未设置，fallback 到 currentPosition (${x}, ${y})`,
      );
    }

    const cell = gameState.mapCells[y]?.[x];
    if (cell) {
      cell.isCleared = true;
      cell.isRevealed = true;
      console.log(
        `[战斗] 战斗节点 (${x}, ${y}) 已清理，battleType=${gameState.currentBattleType}`,
      );
    } else {
      console.error(`[战斗] 无法找到战斗节点 (${x}, ${y})`);
    }

    // 清空 currentBattleNodePosition
    gameState.currentBattleNodePosition = null;
  }

  /** 返回地图的统一入口 */
  private returnToMap(): void {
    const gameState = getGameState();
    updateReachableCells(gameState);
    setGameState(gameState);
    console.log("[战斗] 返回地图，已重新计算可移动格子");
    this.scene.start("MapScene");
  }

  /** 显示战斗结果遮罩（仅用于失败） */
  private showBattleResultOverlay(victory: boolean): void {
    const w = this.scale.width;
    const h = this.scale.height;

    const resultText = this.add
      .text(
        w / 2,
        h / 2 - 40,
        victory ? "🎉 战 斗 胜 利 🎉" : "💀 战 斗 失 败 💀",
        {
          fontSize: "36px",
          color: victory ? "#44ff44" : "#ff4444",
          fontStyle: "bold",
          fontFamily: "monospace",
        },
      )
      .setOrigin(0.5)
      .setDepth(100);

    const resultDesc = this.add
      .text(
        w / 2,
        h / 2 + 10,
        victory ? "所有敌人被击败！" : "队伍全灭或商队被摧毁！",
        {
          fontSize: "16px",
          color: "#aaaaaa",
          fontFamily: "monospace",
        },
      )
      .setOrigin(0.5)
      .setDepth(100);

    const btn = this.add
      .text(w / 2, h / 2 + 60, "【返回地图】", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#444466",
        padding: { x: 20, y: 10 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(100);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, w, h);
    overlay.setDepth(50);

    btn.on("pointerdown", () => {
      const gameState = getGameState();
      const isTestMode =
        gameState._isDirectionalTesting ||
        gameState._isAutoMoving ||
        gameState._isClickTesting;
      if (isTestMode) {
        // 测试模式失败不重置
        gameState._isDirectionalTesting = false;
        gameState._directionalTestStep = 0;
        gameState._directionalTestResumeStep = 0;
        gameState._isAutoMoving = false;
        gameState._autoMoveResumeStep = 0;
        gameState._autoMovePrevPos = null;
        gameState._isClickTesting = false;
        gameState._clickTestStep = 0;
        gameState._clickTestResumeStep = 0;
        this.returnToMap();
      } else {
        resetGameState();
        this.scene.start("MainMenuScene");
      }
    });
    btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#555577" }));
    btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#444466" }));

    // Bug 7: 存储监听器引用以便 shutdown 清理
    this.battleResultKeyHandler = () => {
      const gameState = getGameState();
      const isTestMode =
        gameState._isDirectionalTesting ||
        gameState._isAutoMoving ||
        gameState._isClickTesting;
      if (isTestMode) {
        this.returnToMap();
      } else {
        resetGameState();
        this.scene.start("MainMenuScene");
      }
    };
    this.input.keyboard?.on("keydown-ENTER", this.battleResultKeyHandler);
  }

  /** 显示卡牌奖励选择界面 */
  private showCardRewardScreen(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gameState = getGameState();

    // 重置 battleEnded 以允许奖励卡选择（onBattleEnd 会先设为 true）
    this.battleEnded = false;

    // 生成3张奖励卡（通过 rewardSystem）
    const rewardCards = generateBattleRewardCards(
      gameState.selectedCharacters,
      gameState.characterStates,
    );
    this._rewardCards = rewardCards; // dev-only: 暴露给自动化测试

    // 遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, w, h);
    overlay.setDepth(200);

    // 标题
    const title = this.add
      .text(w / 2, 30, "🎉 战斗胜利！选择一张卡牌奖励", {
        fontSize: "24px",
        color: "#ffcc44",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(210);

    // 卡牌类型颜色映射
    const typeColors: Record<string, string> = {
      attack: "#ff6644",
      defense: "#4488ff",
      skill: "#ffcc44",
      heal: "#44cc88",
      repair: "#cc88ff",
    };

    // 卡牌容器 - 自适应屏幕宽度
    const maxCardWidth = 320;
    const cardHeight = 200;
    const gap = 20;
    const availableWidth = Math.min(w - 40, rewardCards.length * maxCardWidth + (rewardCards.length - 1) * gap);
    const cardWidth = Math.min(maxCardWidth, (availableWidth - (rewardCards.length - 1) * gap) / rewardCards.length);
    const totalWidth =
      rewardCards.length * cardWidth + (rewardCards.length - 1) * gap;
    const startX = Math.max(10, (w - totalWidth) / 2);
    const cardY = 80;

    for (let i = 0; i < rewardCards.length; i++) {
      const card = rewardCards[i];
      const charDef = CHARACTER_DEFS[card.characterId];
      const cx = startX + i * (cardWidth + gap);

      // 卡牌背景
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x2a2a4a, 1);
      cardBg.fillRoundedRect(cx, cardY, cardWidth, cardHeight, 8);
      cardBg.lineStyle(2, charDef.color, 1);
      cardBg.strokeRoundedRect(cx, cardY, cardWidth, cardHeight, 8);
      cardBg.setDepth(210);

      // 卡牌编号
      const numText = this.add
        .text(cx + 10, cardY + 8, `${i + 1}`, {
          fontSize: "14px",
          color: "#888888",
          fontFamily: "monospace",
        })
        .setDepth(210);

      // 卡牌名称
      const nameText = this.add
        .text(cx + cardWidth / 2, cardY + 20, card.name, {
          fontSize: "20px",
          color: "#ffffff",
          fontStyle: "bold",
          fontFamily: "monospace",
        })
        .setOrigin(0.5, 0)
        .setDepth(210);

      // 所属角色 + 图标
      const charText = this.add
        .text(
          cx + cardWidth / 2,
          cardY + 48,
          `${charDef.icon} ${charDef.name}`,
          {
            fontSize: "14px",
            color: "#aaaaaa",
            fontFamily: "monospace",
          },
        )
        .setOrigin(0.5, 0)
        .setDepth(210);

      // 费用
      const costText = this.add
        .text(cx + 15, cardY + 70, `⚡${card.cost}`, {
          fontSize: "16px",
          color: "#ffcc44",
          fontStyle: "bold",
          fontFamily: "monospace",
        })
        .setDepth(210);

      // 类型
      const typeColor = typeColors[card.type] || "#ffffff";
      const typeNames: Record<string, string> = {
        attack: "攻击",
        defense: "防御",
        skill: "技能",
        heal: "治疗",
        repair: "修理",
      };
      const typeText = this.add
        .text(cx + 70, cardY + 70, typeNames[card.type] || card.type, {
          fontSize: "14px",
          color: typeColor,
          fontFamily: "monospace",
        })
        .setDepth(210);

      // 描述（自动换行）
      const descText = this.add
        .text(cx + 15, cardY + 95, card.description, {
          fontSize: "13px",
          color: "#cccccc",
          fontFamily: "monospace",
          wordWrap: { width: cardWidth - 30 },
        })
        .setDepth(210);

      // 效果简述
      const effectStr = card.effects
        .map((e) => {
          const names: Record<string, string> = {
            damage: "伤害",
            heal: "治疗",
            armor: "护甲",
            draw: "抽牌",
            mark: "标记",
            repair_caravan: "修商队",
            add_action: "行动力",
            morale: "士气",
            special: "特殊",
          };
          const targets: Record<string, string> = {
            enemy: "→敌",
            self: "→自己",
            ally: "→队友",
            all_allies: "→全队",
            all_enemies: "→全体敌",
            caravan: "→商队",
            none: "",
          };
          return `${names[e.type] || e.type}${e.value}${targets[e.target] || ""}`;
        })
        .join(", ");
      const effectText = this.add
        .text(cx + 15, cardY + 140, effectStr, {
          fontSize: "12px",
          color: "#888888",
          fontFamily: "monospace",
          wordWrap: { width: cardWidth - 30 },
        })
        .setDepth(210);

      // 点击区域（不可见，覆盖整个卡牌）
      const hitArea = this.add.rectangle(
        cx + cardWidth / 2,
        cardY + cardHeight / 2,
        cardWidth,
        cardHeight,
        0x000000,
        0,
      );
      hitArea.setInteractive({ useHandCursor: true }).setDepth(215);

      // 悬停效果 + Tooltip
      hitArea.on("pointerover", () => {
        cardBg.clear();
        cardBg.fillStyle(0x3a3a6a, 1);
        cardBg.fillRoundedRect(cx, cardY, cardWidth, cardHeight, 8);
        cardBg.lineStyle(3, 0xffcc44, 1);
        cardBg.strokeRoundedRect(cx, cardY, cardWidth, cardHeight, 8);
        // 显示奖励卡 Tooltip
        if (this.tooltipManager) {
          const pointer = this.input.activePointer;
          this.tooltipManager.show(
            {
              title: card.name,
              lines: [
                `费用：${card.cost}`,
                `类型：${card.type}`,
                `角色：${card.characterId || "通用"}`,
                "",
                card.description || "无描述",
                card.effects ? `效果：${card.effects}` : "",
              ].filter((l) => l !== ""),
            },
            pointer.x,
            pointer.y,
          );
        }
      });
      hitArea.on("pointerout", () => {
        cardBg.clear();
        cardBg.fillStyle(0x2a2a4a, 1);
        cardBg.fillRoundedRect(cx, cardY, cardWidth, cardHeight, 8);
        cardBg.lineStyle(2, charDef.color, 1);
        cardBg.strokeRoundedRect(cx, cardY, cardWidth, cardHeight, 8);
        // 隐藏奖励卡 Tooltip
        if (this.tooltipManager) this.tooltipManager.hide();
      });

      // 点击选择
      hitArea.on("pointerdown", () => {
        this.selectRewardCard(card);
      });
    }

    // 跳过奖励按钮
    const skipBtn = this.add
      .text(w / 2, cardY + cardHeight + 40, "【跳过奖励】", {
        fontSize: "18px",
        color: "#aaaaaa",
        backgroundColor: "#333344",
        padding: { x: 20, y: 10 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(210);

    skipBtn.on("pointerdown", () => {
      console.log("[奖励] 玩家跳过卡牌奖励");
      this.showSkipRewardToast();
    });
    skipBtn.on("pointerover", () =>
      skipBtn.setStyle({ backgroundColor: "#444466", color: "#ffffff" }),
    );
    skipBtn.on("pointerout", () =>
      skipBtn.setStyle({ backgroundColor: "#333344", color: "#aaaaaa" }),
    );

    // 数字键快捷选择（1-3选择卡牌，0/S跳过）
    // Bug 7: 存储监听器引用以便 shutdown 清理
    this.rewardKeyHandler = (event: KeyboardEvent) => {
      const key = event.key;
      if (key >= "1" && key <= "3") {
        const idx = parseInt(key) - 1;
        if (idx < rewardCards.length) {
          this.selectRewardCard(rewardCards[idx]);
        }
      } else if (key === "0" || key.toLowerCase() === "s") {
        console.log("[奖励] 玩家跳过卡牌奖励");
        this.showSkipRewardToast();
      }
    };
    this.input.keyboard?.on("keydown", this.rewardKeyHandler);

    // F 键：dev-only 快捷键，自动选择第1张奖励卡（用于自动化测试）
    this.input.keyboard?.on("keydown-F", () => {
      if (rewardCards.length > 0 && !this.battleEnded) {
        console.log("[奖励调试F] 自动选择第1张奖励卡:", rewardCards[0].name);
        this.selectRewardCard(rewardCards[0]);
      }
    });

    // 底部提示
    const hint = this.add
      .text(w / 2, h - 30, "按 1/2/3 选择卡牌 | 按 0 或 S 跳过", {
        fontSize: "14px",
        color: "#666666",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(210);
  }

  /** 选择奖励卡并加入角色牌组 */
  private selectRewardCard(card: CardDef): void {
    // Bug 9/30: 防止重复触发
    if (this.battleEnded) return;
    this.battleEnded = true;

    // 通过 rewardSystem 加入牌组
    const newCard = addRewardCardToDeck(card);
    if (!newCard) {
      this.returnToMap();
      return;
    }

    const charName = CHARACTER_DEFS[card.characterId].name;
    const gameState = getGameState();
    const deckCount = gameState.characterStates[card.characterId].deck.length;

    // 显示获得卡牌提示（阶段4.1）
    this.showRewardAcquiredToast(charName, card.name, deckCount);
  }

  /** 显示获得卡牌提示，延迟后返回地图（阶段4.1） */
  private showRewardAcquiredToast(
    charName: string,
    cardName: string,
    deckCount: number,
  ): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // 提示文本
    const toastText = this.add
      .text(
        w / 2,
        h / 2,
        `${charName} 获得卡牌《${cardName}》，当前牌组 ${deckCount} 张`,
        {
          fontSize: "20px",
          color: "#ffcc44",
          fontFamily: "monospace",
          fontStyle: "bold",
          backgroundColor: "#333333",
          padding: { x: 20, y: 10 },
        },
      )
      .setOrigin(0.5)
      .setDepth(300);

    // 1.5秒后返回地图
    this.time.delayedCall(1500, () => {
      toastText.destroy();
      this.returnToMap();
    });
  }

  /** 战斗结束时触发的部件效果（医疗箱等），只触发一次 */
  private applyBattleEndPartEffects(): void {
    if (this.battleEndPartsApplied) return;
    this.battleEndPartsApplied = true;

    const gameState = getGameState();
    const hasMedicalKit = gameState.caravanParts.some(
      (p) => p.id === "medical_kit",
    );
    if (!hasMedicalKit) return;

    // 获取未死亡的角色
    const aliveChars = gameState.selectedCharacters
      .map((id) => gameState.characterStates[id])
      .filter((cs) => cs && !cs.isDead && cs.currentHp > 0);

    if (aliveChars.length === 0) return;

    // 随机选择一名角色
    const targetChar =
      aliveChars[Math.floor(Math.random() * aliveChars.length)];
    const healAmount = 3;
    const oldHp = targetChar.currentHp;
    targetChar.currentHp = Math.min(
      targetChar.def.maxHp,
      targetChar.currentHp + healAmount,
    );
    setGameState(gameState);

    console.log(
      `[部件] 医疗箱: ${targetChar.def.name} 恢复 ${healAmount} HP (${oldHp} → ${targetChar.currentHp})`,
    );
  }

  /** 显示跳过奖励提示，延迟后返回地图（阶段4.1） */
  private showSkipRewardToast(): void {
    // Bug 9/30: 防止重复触发
    if (this.battleEnded) return;
    this.battleEnded = true;

    const w = this.scale.width;
    const h = this.scale.height;

    // 提示文本
    const toastText = this.add
      .text(w / 2, h / 2, "跳过奖励，牌组不变", {
        fontSize: "20px",
        color: "#aaaaaa",
        fontFamily: "monospace",
        fontStyle: "bold",
        backgroundColor: "#333333",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(300);

    // 1秒后返回地图
    this.time.delayedCall(1000, () => {
      toastText.destroy();
      this.returnToMap();
    });
  }

  /** 显示商队部件奖励界面（精英战斗专属） */
  private showCaravanPartRewardScreen(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gameState = getGameState();

    // 防重复领取保护（阶段6.1）
    this.partRewardClaimed = false;

    // 获取随机未拥有的部件
    const part = getRandomUnownedPart(gameState.caravanParts);

    // 遮罩
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, w, h);
    overlay.setDepth(200);

    // 标题
    const title = this.add
      .text(w / 2, 50, "🎉 精英战斗胜利！获得商队部件", {
        fontSize: "28px",
        color: "#ffcc44",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(210);

    if (!part) {
      // 没有新部件可获得
      const noPartText = this.add
        .text(w / 2, h / 2, "没有新的商队部件可获得", {
          fontSize: "20px",
          color: "#aaaaaa",
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setDepth(210);

      const continueBtn = this.add
        .text(w / 2, h / 2 + 80, "【继续】(Enter/Space/1)", {
          fontSize: "20px",
          color: "#ffffff",
          backgroundColor: "#444466",
          padding: { x: 30, y: 15 },
          fontFamily: "monospace",
        })
        .setOrigin(0.5)
        .setInteractive()
        .setDepth(210);

      // 防重复进入卡牌奖励（阶段6.1）
      let noPartClaimed = false;

      // 键盘继续：Enter / Space / 1（阶段6.1）
      const noPartKeyHandler = (event: KeyboardEvent) => {
        if (noPartClaimed) return;
        const key = event.key;
        if (key === "Enter" || key === " " || key === "1") {
          console.log("[部件] 无新部件，键盘继续");
          continueBtn.emit("pointerdown");
        }
      };
      this.input.keyboard?.on("keydown", noPartKeyHandler);

      continueBtn.on("pointerdown", () => {
        if (noPartClaimed) {
          console.log("[部件] 重复点击已忽略，已进入卡牌奖励");
          return;
        }
        noPartClaimed = true;
        overlay.destroy();
        title.destroy();
        noPartText.destroy();
        continueBtn.destroy();
        this.input.keyboard?.off("keydown", noPartKeyHandler);
        // 进入卡牌奖励
        this.showCardRewardScreen();
      });
      return;
    }

    // 部件图标区域
    const partBox = this.add.graphics();
    partBox.fillStyle(0x2a2a4a, 1);
    partBox.fillRoundedRect(w / 2 - 200, h / 2 - 100, 400, 200, 12);
    partBox.lineStyle(3, 0xffcc44, 1);
    partBox.strokeRoundedRect(w / 2 - 200, h / 2 - 100, 400, 200, 12);
    partBox.setDepth(210);

    // 部件名称
    const partName = this.add
      .text(w / 2, h / 2 - 60, `《${part.name}》`, {
        fontSize: "24px",
        color: "#ffcc44",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(220);

    // 部件描述
    const partDesc = this.add
      .text(w / 2, h / 2, part.description, {
        fontSize: "16px",
        color: "#cccccc",
        fontFamily: "monospace",
        wordWrap: { width: 360 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(220);

    // 触发类型标签
    const triggerNames: Record<string, string> = {
      passive: "被动",
      battle_start: "战斗开始",
      battle_end: "战斗结束",
      map_move: "地图移动",
      card_play: "卡牌打出",
      supply_repair: "补给修复",
    };
    const triggerText = this.add
      .text(w / 2, h / 2 + 50, `触发: ${triggerNames[part.trigger] || part.trigger}`, {
        fontSize: "14px",
        color: "#888888",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(220);

    // 继续按钮
    const continueBtn = this.add
      .text(w / 2, h / 2 + 140, "【继续】", {
        fontSize: "20px",
        color: "#ffffff",
        backgroundColor: "#444466",
        padding: { x: 30, y: 15 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(210);

    // 键盘继续：Enter / Space / 1（阶段6.1）
    const partKeyHandler = (event: KeyboardEvent) => {
      if (this.partRewardClaimed) return;
      const key = event.key;
      if (key === "Enter" || key === " " || key === "1") {
        console.log(`[部件] 键盘继续: ${key}`);
        continueBtn.emit("pointerdown");
      }
    };
    this.input.keyboard?.on("keydown", partKeyHandler);

    continueBtn.on("pointerdown", () => {
      // 防重复领取（阶段6.1）
      if (this.partRewardClaimed) {
        console.log("[部件] 重复点击已忽略，部件已领取");
        return;
      }
      this.partRewardClaimed = true;

      // 添加部件到商队（复制对象，不引用 PART_POOL）
      gameState.caravanParts.push({ ...part });
      setGameState(gameState);
      console.log(`[部件] 获得: ${part.name}`);

      // 处理被动效果（加固车厢）
      if (part.id === "reinforced_carriage") {
        gameState.caravanMaxHp += part.value || 10;
        gameState.caravanHp += part.value || 10;
        setGameState(gameState);
        console.log(`[部件] 加固车厢生效: 商队耐久 +${part.value || 10}`);
      }

      // 清理UI
      overlay.destroy();
      title.destroy();
      partBox.destroy();
      partName.destroy();
      partDesc.destroy();
      triggerText.destroy();
      continueBtn.destroy();
      this.input.keyboard?.off("keydown", partKeyHandler);

      // 进入卡牌奖励
      this.showCardRewardScreen();
    });

    continueBtn.on("pointerover", () =>
      continueBtn.setStyle({ backgroundColor: "#555577", color: "#ffffff" }),
    );
    continueBtn.on("pointerout", () =>
      continueBtn.setStyle({ backgroundColor: "#444466", color: "#ffffff" }),
    );
  }

  /** 显示远征胜利界面 */
  private showExpeditionVictory(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const gameState = getGameState();

    // 标题（先创建UI元素）
    const titleText = this.add
      .text(w / 2, h / 2 - 70, "🎉 远征胜利！", {
        fontSize: "36px",
        color: "#ffcc44",
        fontFamily: "monospace",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(100);

    // 消息
    const goalMsg =
      gameState.expeditionGoal === "boss"
        ? "你成功击败了首领，完成了远征！"
        : "你成功完成了远征目标！";
    const msgText = this.add
      .text(w / 2, h / 2 - 10, goalMsg, {
        fontSize: "20px",
        color: "#cccccc",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(100);

    // 返回主菜单按钮
    const btn = this.add
      .text(w / 2, h / 2 + 60, "【返回主菜单】", {
        fontSize: "20px",
        color: "#ffffff",
        backgroundColor: "#2a4a8a",
        padding: { x: 40, y: 12 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(100);

    // 弹窗背景
    const popupBg = this.add.graphics();
    popupBg.fillStyle(0x2a2a3e, 1);
    popupBg.fillRect(w / 2 - 250, h / 2 - 120, 500, 240);
    popupBg.lineStyle(3, 0xffcc44, 1);
    popupBg.strokeRect(w / 2 - 250, h / 2 - 120, 500, 240);
    popupBg.setDepth(90);

    // 遮罩（放在最底层）
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, w, h);
    overlay.setDepth(50);

    btn.on("pointerdown", () => {
      resetGameState();
      this.scene.start("MainMenuScene");
    });
    btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#3a6aca" }));
    btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#2a4a8a" }));
  }

  private showExpeditionFailed(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // 先创建UI元素（确保在上层）
    this.add
      .text(w / 2, h / 2 - 60, "💀 远征失败 💀", {
        fontSize: "36px",
        color: "#ff4444",
        fontStyle: "bold",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .text(w / 2, h / 2, "全队重伤或死亡，无法继续远征", {
        fontSize: "16px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setDepth(100);

    const btn = this.add
      .text(w / 2, h / 2 + 60, "【返回主菜单】", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#444466",
        padding: { x: 20, y: 10 },
        fontFamily: "monospace",
      })
      .setOrigin(0.5)
      .setInteractive()
      .setDepth(100);

    // 遮罩（放在底层）
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, w, h);
    overlay.setDepth(50);

    btn.on("pointerdown", () => {
      resetGameState();
      this.scene.start("MainMenuScene");
    });
    btn.on("pointerover", () => btn.setStyle({ backgroundColor: "#555577" }));
    btn.on("pointerout", () => btn.setStyle({ backgroundColor: "#444466" }));
  }

  // ==================== 鼠标点击模拟：自动战斗 ====================

  /**
   * 通过 Phaser Input Manager 发出真实的 pointerdown 事件，
   * 模拟人类在战斗中的点击操作：选卡→选敌人→出牌→结束回合。
   */
  private clickSimAutoBattle(): void {
    if (this.battleEnded) {
      console.log("[鼠标模拟测试-战斗] 战斗已结束，模拟点击返回按钮");
      this.clickSimReturnButton();
      return;
    }

    const state = this.battleManager.state;

    // 如果有行动力，尝试出牌
    if (state.actionPoints > 0) {
      // 找到一张可出的牌
      const cardInfo = this.findPlayableCard();
      if (cardInfo) {
        // 找到一个存活的敌人
        const enemyIdx = this.findAliveEnemy();
        if (enemyIdx >= 0) {
          console.log(
            `[鼠标模拟测试-战斗] 模拟出牌: ${state.characters[cardInfo.charIndex].def.name}` +
              ` 的【${state.characters[cardInfo.charIndex].hand[cardInfo.cardIndex]?.name || "?"}】` +
              ` → ${state.enemies[enemyIdx].def.name}`,
          );

          // 模拟点击卡牌（通过游戏对象 emit 触发 pointerdown 事件）
          if (this.cardTexts[cardInfo.globalIndex]) {
            this.cardTexts[cardInfo.globalIndex].emit("pointerdown");
          }

          // 延迟后模拟点击敌人
          this.time.delayedCall(300, () => {
            if (this.battleEnded) {
              this.clickSimReturnButton();
              return;
            }
            if (this.enemyPanels[enemyIdx]) {
              // 找到敌人面板中的 Zone（点击区域）
              let hitZone: Phaser.GameObjects.Zone | null = null;
              this.enemyPanels[enemyIdx].each((child) => {
                if (child instanceof Phaser.GameObjects.Zone) {
                  hitZone = child;
                }
              });
              if (hitZone) {
                hitZone.emit("pointerdown");
              }
            }

            // 延迟后继续下一轮
            this.time.delayedCall(500, () => {
              this.clickSimAutoBattle();
            });
          });
          return;
        }
      }
    }

    // 检查是否所有敌人都已死亡
    if (this.findAliveEnemy() < 0) {
      console.log("[鼠标模拟测试-战斗] 所有敌人已死亡，等待战斗结束...");
      this.time.delayedCall(500, () => {
        this.clickSimAutoBattle();
      });
      return;
    }

    // 没有可出的牌或没有行动力，结束回合
    console.log('[鼠标模拟测试-战斗] 模拟点击"结束回合"按钮');
    this.endTurnBtn.emit("pointerdown");

    // 延迟后继续下一轮
    this.time.delayedCall(800, () => {
      this.clickSimAutoBattle();
    });
  }

  /** 找到一张可以打出的牌 */
  /** 找到一张可出的牌，攻击优先（type=attack 的牌优先返回） */
  private findPlayableCard(): {
    charIndex: number;
    cardIndex: number;
    globalIndex: number;
  } | null {
    const state = this.battleManager.state;
    let globalIdx = 0;
    let attackCard: {
      charIndex: number;
      cardIndex: number;
      globalIndex: number;
    } | null = null;
    let anyCard: {
      charIndex: number;
      cardIndex: number;
      globalIndex: number;
    } | null = null;

    for (let ci = 0; ci < state.characters.length; ci++) {
      const char = state.characters[ci];
      if (char.currentHp <= 0) continue;
      for (let hi = 0; hi < char.hand.length; hi++) {
        const card = char.hand[hi];
        if (card && card.cost <= state.actionPoints) {
          const info = { charIndex: ci, cardIndex: hi, globalIndex: globalIdx };
          if (!attackCard && card.type === "attack") {
            attackCard = info;
          }
          if (!anyCard) {
            anyCard = info;
          }
        }
        globalIdx++;
      }
    }
    // 攻击优先，没有攻击牌才出其他牌
    return attackCard || anyCard;
  }

  /** 找到当前HP最低的存活敌人 */
  private findAliveEnemy(): number {
    const state = this.battleManager.state;
    let minHp = Infinity;
    let targetIdx = -1;
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i];
      if (e.currentHp > 0 && e.currentHp < minHp) {
        minHp = e.currentHp;
        targetIdx = i;
      }
    }
    return targetIdx;
  }

  /** 战斗结束后模拟点击返回按钮 */
  private clickSimReturnButton(): void {
    // 优先找"返回地图"按钮（战斗胜利后出现），排除"重新开始(R)"（这是重启战斗的按钮）
    let returnBtn: Phaser.GameObjects.Text | null = null;
    let restartBtn: Phaser.GameObjects.Text | null = null;
    this.children.each((child) => {
      if (child instanceof Phaser.GameObjects.Text && child.input?.enabled) {
        const text = child.text || "";
        if (text.includes("返回地图") || text.includes("返回主菜单")) {
          returnBtn = child;
        } else if (text.includes("重新开始") && !text.includes("R)")) {
          // 仅匹配战斗结束弹窗中的"重新开始"（不含快捷键提示的）
          restartBtn = child;
        }
      }
    });

    const gameState = getGameState();
    const isDirectional = gameState._isDirectionalTesting;

    if (returnBtn) {
      console.log(`[鼠标模拟测试-战斗] 模拟点击返回按钮: "${returnBtn.text}"`);
      returnBtn.emit("pointerdown");
    } else if (restartBtn && !isDirectional) {
      // 仅在T键随机测试时点击"重新开始"（游戏重置无所谓）
      console.log(
        `[鼠标模拟测试-战斗] 模拟点击重新开始按钮: "${restartBtn.text}"`,
      );
      restartBtn.emit("pointerdown");
    } else if (isDirectional) {
      // 方向模拟测试遇到战斗失败（没有"返回地图"按钮），停止测试
      console.log(
        "[方向模拟测试-战斗] 战斗失败，没有返回地图按钮，停止方向模拟测试",
      );
      gameState._isDirectionalTesting = false;
      gameState._directionalTestStep = 0;
      gameState._directionalTestResumeStep = 0;
      setGameState(gameState);
      // 尝试直接切换回MapScene（即使游戏状态可能已结束）
      updateReachableCells(gameState);
      this.scene.start("MapScene");
    } else {
      console.log("[鼠标模拟测试-战斗] 未找到返回按钮，尝试直接切换到MapScene");
      if (gameState._isClickTesting) {
        updateReachableCells(gameState);
        setGameState(gameState);
        this.scene.start("MapScene");
      }
    }
  }
}
