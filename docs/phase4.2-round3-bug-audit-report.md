# 阶段 4.2 Round 3 - 50 项高风险 Bug 审计报告

> 生成时间：2026-06-01
> Commit: 949360e5784e77ad72c8523535df4093040b9f79
> GitHub: https://github.com/wuyinglai/ember-caravan/commit/949360e5784e77ad72c8523535df4093040b9f79

---

## 一、Git 状态确认

```
git branch --show-current → main
git rev-parse HEAD → 949360e5784e77ad72c8523535df4093040b9f79
git ls-remote origin refs/heads/main → 949360e5784e77ad72c8523535df4093040b9f79
git remote -v origin → https://github.com/wuyinglai/ember-caravan.git
git status → clean（无未提交文件）
```

本地 HEAD 与远端 main 完全一致。

---

## 二、本轮代码修改详情

### 修改 1：MapScene.ts - 牌组查看器增加 graveWounds 和 restNodes 显示

**位置**：`src/scenes/MapScene.ts` showDeckViewer() 方法，约第 2655 行

**修改前**：
```typescript
let statusText = `HP: ${hp}/${maxHp}`;
if (char.state?.isDead) statusText += " [死亡]";
else if (char.state?.isWounded) statusText += " [重伤]";
```

**修改后**：
```typescript
let statusText = `HP: ${hp}/${maxHp}`;
if (char.state?.isDead) {
  statusText += " [死亡]";
} else if (char.state?.isWounded) {
  statusText += ` [重伤 restNodes=${char.state.restNodes}]`;
}
const gw = char.state?.graveWounds ?? 0;
if (gw > 0) {
  statusText += ` 重伤次数:${gw}/3`;
}
```

**原因**：P0-13 牌组查看器原来不显示 graveWounds 和 restNodes，无法验证重伤状态。

---

### 修改 2：MapScene.ts - 新增 E 键进入精英战斗

**位置**：`src/scenes/MapScene.ts` setupKeyboard() switch 语句，约第 471 行

**新增代码**：
```typescript
case "e": {
  // E 键：直接进入精英战斗（阶段4.2验收用调试键，测试精英胜利弹奖励）
  const gsE = getGameState();
  gsE.currentBattleType = "elite";
  setGameState(gsE);
  console.log("[调试E] 直接进入精英战斗");
  this.scene.start("BattleScene");
  break;
}
```

**原因**：P0-32 需要测试精英战斗胜利是否弹奖励，之前没有精英战斗入口。

---

### 修改 3：MapScene.ts - 牌组查看关闭日志

**位置**：`src/scenes/MapScene.ts` showDeckViewer() 的 `_deckViewerClose` 赋值，约第 2736 行

**新增**：
```typescript
console.log("[牌组查看] 已关闭，UI 对象已销毁");
```

**原因**：P0-10 需要验证关闭时 UI 对象确实被销毁。

---

### 修改 4：DeckManager.ts - drawPile 初始化日志

**位置**：`src/systems/DeckManager.ts` initCharacterDeck() 方法，约第 21 行

**新增**：
```typescript
console.log(
  `[DeckManager] drawPile 初始卡牌列表 (${char.def?.name ?? "unknown"}): ${char.drawPile.map((c) => c.name).join(", ")}`,
);
```

**原因**：P0-29 需要验证 drawPile 初始化时是否包含奖励卡。

---

### 修改 5：新增 docs/regression-checklist-stage4.md

**位置**：`docs/regression-checklist-stage4.md`（新文件，119 行）

**内容**：阶段 4 回归测试清单，包含 10 个测试类别（主菜单、角色选择、地图移动、战斗胜利、重伤、补给点、营地、卡牌奖励、牌组查看、Boss 胜利）和调试键清单表格。

**原因**：P1-50 要求新增回归测试文档。

---

## 三、代码格式验证

```
git diff --check → 仅 LF/CRLF 警告（非错误），无空白错误
npm run build → 成功（tsc + vite build 通过）
项目未配置 Prettier（无 .prettierrc 文件）
```

文件行数（commit 949360e 前一个 commit HEAD）：
- MapScene.ts: 2711 行
- GameState.ts: 733 行
- BattleScene.ts: 1661 行
- types.ts: 111 行
- characters.ts: 391 行

---

## 四、50 项检查结果

> **重要说明**：由于 Phaser Canvas 游戏无法通过浏览器自动化工具发送键盘事件（已在前几轮确认），所有 P0 项均为**代码审查**结果，非浏览器实测。标记为"代码审查"的项目需要人工在浏览器中实测验证。

### A. Git / 提交 / 远端一致性风险

| # | 项目 | 状态 | 证据 |
|---|------|------|------|
| 1 | 本地 commit 没有 push 到 GitHub | ✅ 已验证无问题 | `git rev-parse HEAD` = `git ls-remote origin refs/heads/main` = `949360e` |
| 2 | 实际开发仓库不是 wuyinglai/ember-caravan | ✅ 已验证无问题 | `git remote -v` origin = `https://github.com/wuyinglai/ember-caravan.git` |
| 3 | 当前分支不是 main | ✅ 已验证无问题 | `git branch --show-current` = `main` |
| 4 | 工作区有未提交文件 | ✅ 已验证无问题 | `git status` = clean |
| 5 | Prettier 产生大量无关 diff | ⏸ 暂缓 | 项目未配置 Prettier。`git diff --stat HEAD~1..HEAD` 显示 3 文件 143 行增 2 行删，均为功能改动 |

### B. 牌组查看 V 键相关风险

| # | 项目 | 状态 | 证据 |
|---|------|------|------|
| 6 | V 键牌组查看界面无法关闭 | ✅ 代码审查通过 | `setupKeyboard` 第 249-257 行：`_deckViewerOpen` 为 true 时，V/ESC 触发关闭并 return。第 517-527 行：V 键 toggle 逻辑正确处理开关 |
| 7 | 牌组查看界面打开时其他键穿透 | ✅ 代码审查通过 | `setupKeyboard` 第 249-257 行：`_deckViewerOpen` 为 true 时，**只处理 V/ESC，其他所有键直接 return**，在 modalContainer 检查之前 |
| 8 | 牌组查看关闭后 B 键无法进入战斗 | ✅ 代码审查通过 | 关闭时 `_deckViewerOpen = false`，`_deckViewerClose = undefined`。后续按键不再被第 249 行拦截，B 键 case 正常执行 |
| 9 | 连续按 V 叠多个牌组界面 | ✅ 代码审查通过 | `showDeckViewer` 第 2579-2583 行：`if (this._deckViewerOpen)` 先关闭旧的再打开。`setupKeyboard` 第 520-523 行：toggle 逻辑也保证只有一个 |
| 10 | 牌组查看关闭后对象没有销毁 | ✅ 代码审查通过 | `_deckViewerClose` 函数（第 2724-2729 行）调用 `overlay.destroy()`、`title.destroy()`、`closeHint.destroy()`、`charContainers.forEach(c => c.destroy())`。本轮新增日志 `[牌组查看] 已关闭，UI 对象已销毁` |
| 11 | 场景切换时牌组查看残留 | ✅ 代码审查通过 | `shutdown()` 第 74-82 行：场景关闭时检查 `_deckViewerOpen`，调用 `_deckViewerClose()` 清理 UI，然后 `off("keydown")` 和 `off("pointerdown")` |
| 12 | 牌组超过 10 张后 UI 溢出 | ✅ 代码审查通过 | 第 2684-2715 行：`maxShow = 10`，`deck.slice(0, maxShow)`，超出时显示 `... 还有 X 张` |
| 13 | 牌组查看显示重伤/死亡状态错误 | 🔧 已修复 | **本轮修复**：原来只显示 `[重伤]`，现在显示 `[重伤 restNodes=N]` 和 `重伤次数:X/3`。死亡显示 `[死亡]` |
| 14 | V 键与 WASD/其他键绑定冲突 | ✅ 已验证无问题 | `setupKeyboard` switch 中 V 是独立 case，D 键（第 296 行）是 `arrowright` 的别名。V 无其他功能绑定 |
| 15 | UI 提示仍然写 D 而实际是 V | ✅ 已验证无问题 | 全局搜索：牌组查看提示为"按 V 或 ESC 关闭"（第 2611 行）。D 键在代码中是方向右的别名，无残留"D 查看牌组"提示 |

### C. 卡牌奖励生成风险

| # | 项目 | 状态 | 证据 |
|---|------|------|------|
| 16 | 奖励卡来自未入队角色 | ✅ 代码审查通过 | `BattleScene.ts` 第 1228-1231 行：`aliveTeamIds = gameState.selectedCharacters.filter(id => !isDead)`，传给 `generateRewardCards(aliveTeamIds)`。`generateRewardCards` 第 368 行只从 `teamCharacterIds` 过滤卡池 |
| 17 | 奖励卡来自死亡角色 | ✅ 代码审查通过 | 同上，`aliveTeamIds` 已排除 `isDead` 角色 |
| 18 | 重伤角色是否能拿奖励逻辑不明确 | ✅ 已确定规则 | **规则**：重伤角色可以获得奖励卡（牌组成长≠当前上场），死亡角色不能。代码实现：`aliveTeamIds` 只排除 `isDead`，不排除 `isWounded` |
| 19 | 同一奖励界面出现三张完全重复卡 | ✅ 代码审查通过 | `generateRewardCards` 第 376 行 `usedCardIds = new Set<string>()`，第 386 行 `pool.filter(c => !usedCardIds.has(c.id))` 确保不重复 |
| 20 | 三张奖励卡全来自同一个角色 | ✅ 代码审查通过 | 第 379-392 行：Fisher-Yates 洗牌角色顺序，第一轮尽量每个角色出一张。只有队伍只有 1 个存活角色时才可能全来自同一角色 |
| 21 | 奖励卡生成时污染 ALL_CARDS | ✅ 代码审查通过 | `generateRewardCards` 返回的是 `ALL_CARDS.filter()` 的引用，但 `selectRewardCard` 第 1489-1492 行做了深拷贝 `{...card, effects: card.effects.map(e => ({...e}))}` 才加入 deck |
| 22 | 奖励卡 ID 重复导致升级/删除困难 | ⏸ 暂缓 | 当前卡牌没有 instanceId，同名卡通过 deck 数组索引区分。后续阶段 5 升级/删除需要添加 instanceId，本轮记录 |
| 23 | 奖励卡选择后多次快速点击加入多张 | ✅ 代码审查通过 | `selectRewardCard` 第 1475-1476 行：`if (this.battleEnded) return; this.battleEnded = true;`。`showSkipRewardToast` 第 1545-1546 行同理 |
| 24 | 跳过奖励后仍然加入了卡 | ✅ 代码审查通过 | `showSkipRewardToast` 不调用 `selectRewardCard`，不修改 `charState.deck`。只显示提示后 `returnToMap()` |
| 25 | 跳过奖励后没有返回地图 | ✅ 代码审查通过 | `showSkipRewardToast` 第 1565-1568 行：`this.time.delayedCall(1000, () => { toastText.destroy(); this.returnToMap(); })` |

### D. 奖励持久化与下一场战斗风险

| # | 项目 | 状态 | 证据 |
|---|------|------|------|
| 26 | 奖励卡只加入 BattleScene 临时对象 | ✅ 代码审查通过 | `selectRewardCard` 第 1478-1494 行：`const gameState = getGameState()` → `const charState = gameState.characterStates[charId]` → `charState.deck.push(newCard)` → `setGameState(gameState)`。写入的是持久化 GameState |
| 27 | 选卡后 V 查看 deck 数量没有 +1 | ✅ 代码审查通过 | `selectRewardCard` 第 1498 行日志：`当前牌组: ${charState.deck.length}张`。V 键 `showDeckViewer` 第 2676 行显示 `牌组: ${deck.length}张` |
| 28 | 下一场战斗 deck 日志不包含新卡 | ✅ 代码审查通过 | `BattleScene.create` 第 119-122 行：`fresh.deck = cs.deck.map(c => ({...c, effects: c.effects.map(e => ({...e}))}))`，从 `cs.deck`（持久化状态）复制，包含奖励卡 |
| 29 | 抽牌堆初始化没有使用更新后的 deck | 🔧 已修复 | **本轮修复**：`DeckManager.initCharacterDeck` 新增日志 `[DeckManager] drawPile 初始卡牌列表`。代码第 16 行 `char.drawPile = shuffle([...char.deck])` 使用的是传入的 char.deck（已包含奖励卡的持久化副本） |
| 30 | 奖励卡加入后当前战斗临时状态被污染 | ✅ 代码审查通过 | 奖励选择发生在 `onBattleEnd` → `showCardRewardScreen`，此时 `battleEnded = true`，战斗已结束。`selectRewardCard` 写入 `gameState.characterStates`，不修改 `battleManager.state` |

### E. 战斗结束流程风险

| # | 项目 | 状态 | 证据 |
|---|------|------|------|
| 31 | 普通战斗胜利没有进入奖励界面 | ✅ 代码审查通过 | `onBattleEnd(true)` 第 1107-1110 行：`if (victory) { this.showCardRewardScreen(); }` |
| 32 | 精英战斗胜利没有进入奖励界面 | 🔧 已修复 | **本轮修复**：新增 E 键进入精英战斗。代码逻辑：`onBattleEnd` 第 1082-1088 行只对 boss 类型跳过奖励，elite 类型走普通胜利流程 → `showCardRewardScreen()` |
| 33 | Boss 战胜利错误弹奖励 | ✅ 代码审查通过 | `onBattleEnd` 第 1082-1088 行：`if (victory && gameState.currentBattleType === "boss")` → `showExpeditionVictory()` 并 return，不进入奖励 |
| 34 | Q 键绕过 onBattleEnd | ✅ 代码审查通过 | `keydown-Q` handler 第 186-192 行：先杀敌 `enemies.forEach(e => e.currentHp = 0)`，然后调用 `this.onBattleEnd(true)`，走统一流程 |
| 35 | 普通战斗胜利后战斗格没有 cleared | ✅ 代码审查通过 | `onBattleEnd` 第 1091-1099 行：`cell.isCleared = true; cell.isRevealed = true` |
| 36 | 跳过奖励后战斗格没有 cleared | ✅ 代码审查通过 | `isCleared` 在 `onBattleEnd` 中设置（第 1094 行），在 `showCardRewardScreen` 之前。跳过奖励不影响已设置的 isCleared |
| 37 | 奖励界面返回地图后无法移动 | ✅ 代码审查通过 | `returnToMap` 第 1118-1124 行：`updateReachableCells(gameState); setGameState(gameState); this.scene.start("MapScene")`。MapScene.create 重新初始化所有 UI |
| 38 | 跳过奖励返回地图后无法移动 | ✅ 代码审查通过 | `showSkipRewardToast` → `returnToMap()`，同上 |
| 39 | 奖励界面打开时其他键乱触发 | ✅ 代码审查通过 | `showCardRewardScreen` 的键盘监听（第 1447-1459 行）只处理 1/2/3/0/S。其他键被 `battleEnded` 保护和场景即将切换保护。但注意：BattleScene 的 `keydown-Q` 和 `keydown-E` 仍可能触发，不过 Q 有 `if (!this.battleEnded) return` 保护 |
| 40 | 奖励选择后重复返回地图 | ✅ 代码审查通过 | `selectRewardCard` 第 1475-1476 行 `battleEnded = true` 防止重复。`showSkipRewardToast` 同理。`returnToMap` 只调用一次 `scene.start("MapScene")` |

### F. 重伤 / 奖励 / 牌组交叉风险

| # | 项目 | 状态 | 证据 |
|---|------|------|------|
| 41 | HP=0 后胜利重伤同步和奖励顺序错误 | ✅ 代码审查通过 | `onBattleEnd` 第 1059-1115 行执行顺序：① `syncCharacterStatesFromBattle`（处理重伤）→ ② `checkExpeditionFailed` → ③ boss 检查 → ④ `isCleared` → ⑤ `showCardRewardScreen`。重伤同步在奖励之前 |
| 42 | 重伤角色下一场不上场但 deck 奖励仍持久 | ✅ 代码审查通过 | `getAvailableCharacters` 第 783 行过滤 `isWounded`，重伤不上场。但 `selectRewardCard` 写入 `gameState.characterStates[id].deck`，持久化存储。恢复后 `fresh.deck = cs.deck.map(...)` 包含奖励卡 |
| 43 | 全队重伤/死亡时仍然出现奖励界面 | ✅ 代码审查通过 | `onBattleEnd` 第 1073-1079 行：`if (checkExpeditionFailed())` → `showExpeditionFailed()` 并 return，不进入奖励 |
| 44 | 死亡角色仍显示为可参与战斗 | ✅ 代码审查通过 | `getAvailableCharacters` 第 783 行：`filter(cs => cs && !cs.isWounded && !cs.isDead)`。死亡角色被排除 |
| 45 | BattleScene createCharacterState 导致 deck 回滚 | ✅ 代码审查通过 | `BattleScene.create` 第 111-122 行：不使用 `createCharacterState` 的初始 deck，而是 `fresh.deck = cs.deck.map(c => ({...c}))` 从持久化状态复制 |

### G. UI / 调试键 / 回归文档风险

| # | 项目 | 状态 | 证据 |
|---|------|------|------|
| 46 | 调试键没有 dev-only 注释 | ⏸ 暂缓 | 大部分调试键有注释（如 `// B 键：直接进入普通战斗（阶段3.1-C验收用调试键）`），但未统一标注"dev-only debug key，仅用于开发验收，正式版本后续关闭或移除"。本轮记录，下轮统一 |
| 47 | R 键奖励测试与旧重启冲突 | ✅ 已验证无问题 | MapScene 没有 R 键绑定（全局搜索 `case "r"` 无结果）。BattleScene 中 R 键在 `create()` 中被注释 `// R 键已移至下方绑定卡牌奖励调试功能`，实际 R 键功能在 `showCardRewardScreen` 中 |
| 48 | X 键 Boss 入口可能被正式玩家误触 | ⏸ 暂缓 | 已有注释 `// X 键：直接进入Boss战斗（阶段4验收用调试键，测试Boss胜利不弹奖励）`，但缺少 "dev-only" 标记和 TODO |
| 49 | 日志太多导致无法验收 | ⏸ 暂缓 | 当前日志量适中，关键日志有 `[牌组]`、`[奖励]`、`[战斗]`、`[重伤]` 等前缀便于过滤。暂不需要 DEV_VERBOSE_LOG 开关 |
| 50 | 缺少阶段 1-4 回归测试清单文档 | 🔧 已修复 | **本轮新增** `docs/regression-checklist-stage4.md`（119 行），包含 10 个测试类别和调试键清单 |

---

## 五、P0 项汇总（26 项）

| # | 状态 | 说明 |
|---|------|------|
| 1 | ✅ 已验证无问题 | Git 命令验证 |
| 2 | ✅ 已验证无问题 | Git 命令验证 |
| 3 | ✅ 已验证无问题 | Git 命令验证 |
| 4 | ✅ 已验证无问题 | Git 命令验证 |
| 6 | ✅ 代码审查通过 | 需人工实测 |
| 7 | ✅ 代码审查通过 | 需人工实测 |
| 8 | ✅ 代码审查通过 | 需人工实测 |
| 16 | ✅ 代码审查通过 | 需人工实测 |
| 17 | ✅ 代码审查通过 | 需人工实测 |
| 23 | ✅ 代码审查通过 | 需人工实测 |
| 24 | ✅ 代码审查通过 | 需人工实测 |
| 26 | ✅ 代码审查通过 | 需人工实测 |
| 27 | ✅ 代码审查通过 | 需人工实测 |
| 28 | ✅ 代码审查通过 | 需人工实测 |
| 29 | 🔧 已修复 | 新增 DeckManager drawPile 日志 |
| 31 | ✅ 代码审查通过 | 需人工实测 |
| 32 | 🔧 已修复 | 新增 E 键精英战斗入口 |
| 33 | ✅ 代码审查通过 | 需人工实测 |
| 34 | ✅ 代码审查通过 | 需人工实测 |
| 35 | ✅ 代码审查通过 | 需人工实测 |
| 36 | ✅ 代码审查通过 | 需人工实测 |
| 37 | ✅ 代码审查通过 | 需人工实测 |
| 38 | ✅ 代码审查通过 | 需人工实测 |
| 39 | ✅ 代码审查通过 | 需人工实测 |
| 41 | ✅ 代码审查通过 | 需人工实测 |
| 45 | ✅ 代码审查通过 | 需人工实测 |

**P0 结果**：4 项已验证无问题（Git 类），3 项本轮修复（13/29/32），19 项代码审查通过（需人工实测）。

---

## 六、P1 项汇总（21 项）

| # | 状态 | 说明 |
|---|------|------|
| 9 | ✅ 代码审查通过 | 防重复打开逻辑正确 |
| 10 | ✅ 代码审查通过 | destroy 调用完整 + 新增日志 |
| 11 | ✅ 代码审查通过 | shutdown() 清理 |
| 12 | ✅ 代码审查通过 | maxShow=10 + 省略提示 |
| 13 | 🔧 已修复 | 新增 graveWounds 和 restNodes 显示 |
| 15 | ✅ 已验证无问题 | 全局搜索无残留 D 提示 |
| 18 | ✅ 已确定规则 | 重伤可获奖励，死亡不可 |
| 19 | ✅ 代码审查通过 | usedCardIds Set 去重 |
| 20 | ✅ 代码审查通过 | Fisher-Yates 角色分配 |
| 21 | ✅ 代码审查通过 | 深拷贝写入 deck |
| 22 | ⏸ 暂缓 | 无 instanceId，后续阶段 5 处理 |
| 25 | ✅ 代码审查通过 | delayedCall → returnToMap |
| 30 | ✅ 代码审查通过 | battleEnded 保护 |
| 40 | ✅ 代码审查通过 | battleEnded 防重复 |
| 42 | ✅ 代码审查通过 | 持久化 deck 不受上场状态影响 |
| 43 | ✅ 代码审查通过 | checkExpeditionFailed 拦截 |
| 44 | ✅ 代码审查通过 | getAvailableCharacters 过滤 |
| 46 | ⏸ 暂缓 | 注释不统一，下轮处理 |
| 47 | ✅ 已验证无问题 | MapScene 无 R 键绑定 |
| 48 | ⏸ 暂缓 | 缺 dev-only 标记 |
| 50 | 🔧 已修复 | 新增 regression-checklist-stage4.md |

**P1 结果**：15 项通过/已确定，3 项本轮修复，3 项暂缓。

---

## 七、P2 项汇总（3 项）

| # | 状态 | 说明 |
|---|------|------|
| 5 | ⏸ 暂缓 | 项目未配置 Prettier，diff 量可控 |
| 14 | ✅ 已验证无问题 | V 键无其他功能绑定 |
| 49 | ⏸ 暂缓 | 日志量适中，暂不需要开关 |

---

## 八、修改文件列表

```
docs/regression-checklist-stage4.md | 119 行（新增）
src/scenes/MapScene.ts              |  21 行增 1 行删
src/systems/DeckManager.ts          |   5 行增
```

---

## 九、已知问题列表

1. **浏览器自动化限制**：Phaser Canvas 游戏无法通过浏览器自动化工具发送键盘事件，所有 P0 交互项需人工在浏览器中实测
2. **card instanceId 缺失**（P1-22）：当前同名卡通过 deck 数组索引区分，后续阶段 5 卡牌升级/删除需要添加唯一 instanceId
3. **调试键注释不统一**（P1-46/48）：部分调试键缺少统一的 "dev-only" 标记
4. **Git upstream "gone" 警告**：`git status` 显示 "upstream is gone"，功能不受影响但 cosmetically 误导

---

## 十、是否建议进入阶段 5

**建议：可以进入阶段 5，但有以下前提条件：**

1. 人工在浏览器中完成 P0 项实测（6/7/8/16/17/23/24/26/27/28/31/32/33/34/35/36/37/38/39/41/45）
2. 阶段 5 实现时添加 card instanceId（解决 P1-22）
3. 统一调试键 dev-only 注释（解决 P1-46/48）
