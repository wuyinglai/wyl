# 阶段10：撤退、订单时间与失败延续机制重构 - 归档文档

> 创建日期：2026-06-08
> 阶段状态：已完成

## 阶段10目标

阶段10旨在让游戏中的撤退和订单系统更加真实和有策略性：

- 让撤退不再免费（引入撤退成本）
- 让订单时间跨局延续（订单步数不因撤退重置）
- 让未完成订单可以继续（unfinishedOrderIds 机制）
- 清理不适合当前方向的遗产系统（legacy relic system）
- 给订单增加附加条款显示能力（specialTerms v1）

## 已完成机制

### 1. 撤退成本系统（阶段10.1）

**文件位置**：`src/systems/retreatSystem.ts`

**功能说明**：
- 撤退时消耗补给品（粮食）
- 撤退成本 = 距离 × 撤退难度
- 撤退结算弹窗显示消耗的补给数量

**规则**：
- 补给充足时可以直接撤退
- 补给不足时只能放弃远征
- 撤退后订单进入未完成订单列表

### 2. 订单时间跨局延续（阶段10.2）

**文件位置**：`src/systems/GameState.ts`（orderTimeStates 字段）

**功能说明**：
- 订单有步数限制（timeLimitSteps）
- 每次移动消耗步数（elapsedSteps）
- 撤退后已消耗步数不会重置

**规则**：
- `resetGameState`：完整重置所有状态，包括 orderTimeStates
- `resetGameStateForNewRun`：保留订单延续状态，清空其他状态
- 步数耗尽前必须完成订单

### 3. 未完成订单延续（阶段10.3）

**文件位置**：`src/systems/GameState.ts`（unfinishedOrderIds 字段）

**功能说明**：
- 撤退后的订单进入 unfinishedOrderIds
- 再来一局后可以选择继续未完成订单
- 成功交付后从 unfinishedOrderIds 移除

**规则**：
- 撤退时当前订单加入 unfinishedOrderIds
- 再次选择同一商路时自动恢复订单
- 真实交付后清理 unfinishedOrderIds

### 4. legacy 遗产系统删除（阶段10.4）

**删除的文件**：
- `src/data/legacyRelics.ts` - 遗产数据定义
- `src/systems/legacySystem.ts` - 遗产系统逻辑
- `src/scenes/LegacySelectScene.ts` - 遗产选择场景

**清理的引用**：
- `src/main.ts` - 移除 LegacySelectScene 注册
- `src/systems/GameState.ts` - 移除 legacy 相关字段
- `src/scenes/CargoPrepScene.ts` - 移除遗产提示
- `src/scenes/MapScene.ts` - 移除遗产摘要
- `src/scenes/MainMenuScene.ts` - 移除遗产重置逻辑
- `src/scenes/ExpeditionResultScene.ts` - 移除遗产按钮

### 5. 订单附加条款 v1（阶段10.5）

**文件位置**：
- `src/data/cityOrders.ts` - 新增 OrderSpecialTermType 和 OrderSpecialTerm 类型
- `src/scenes/CargoPrepScene.ts` - 显示附加条款标签
- `src/scenes/MapScene.ts` - 显示附加条款信息

**附加条款类型**：
- `confidential`：保密订单（进入村落或营地时可能暴露委托内容）
- `fragile`：易损订单（货物容易因车厢受损、袭击或恶劣路况损坏）

**当前实现**：第一版只显示风险提示，不触发真实随机效果。

## 当前规则说明

### 撤退相关

1. **撤退消耗补给**：撤退时根据距离消耗粮食
2. **撤退不完成订单**：撤退后订单进入 unfinishedOrderIds
3. **补给不足只能放弃**：补给 < 撤退成本时无法撤退

### 订单时间相关

1. **订单步数不重置**：撤退后已消耗步数保持
2. **步数跨局延续**：再来一局后继续计时
3. **完整重置**：`resetGameState` 会清空所有订单状态
4. **局部重置**：`resetGameStateForNewRun` 保留订单延续状态

### 未完成订单相关

1. **撤退后进入未完成列表**：当前订单自动加入 unfinishedOrderIds
2. **再来一局可继续**：选择同一商路时自动恢复订单
3. **交付后清理**：成功交付订单后从 unfinishedOrderIds 移除
4. **多订单支持**：可以同时有多个未完成订单

### 附加条款相关（第一版）

1. **仅显示风险提示**：不触发真实随机效果
2. **UI 明确提示**：CargoPrepScene 和 MapScene 都显示条款信息
3. **不影响游戏逻辑**：第一版作为信息展示

## 当前不做的内容

以下内容已在阶段10规划中明确排除，不会在短期内实现：

- ❌ 订单过期惩罚（步数耗尽后有负面效果）
- ❌ 城市恶化（订单超时导致城市状态下降）
- ❌ 随机保密暴露（进入村落时概率暴露保密订单）
- ❌ 真实易损货物损坏（战斗/移动中随机损坏易损货物）
- ❌ 车厢受损系统（车厢损坏影响载重）
- ❌ 路线记忆（记住上次移动路线）
- ❌ 恢复遗产系统

## 测试覆盖清单

| 测试名称 | 阶段 | 覆盖内容 |
|---------|------|---------|
| smoke-test-retreat-cost-10-1.cjs | 10.1 | 撤退成本计算、弹窗显示 |
| smoke-test-order-time-persist-10-2.cjs | 10.2 | 订单时间跨局延续 |
| smoke-test-unfinished-order-10-3.cjs | 10.3 | 未完成订单延续、真实交付清理 |
| smoke-test-legacy-relic-8-8.cjs | 10.4 | 遗产系统已删除 |
| smoke-test-order-special-terms-10-5.cjs | 10.5 | 附加条款显示 |
| smoke-test-production-api-guard-9-3-2.cjs | - | 生产环境 API 保护 |

**全量测试统计**：34 tests / 670 assertions

## 阶段11候选方向

基于阶段10打下的基础，以下是阶段11的候选方向：

### 1. 车队受损 / 车厢系统 v1
- 车厢可以受损，影响载重
- 需要维修车厢才能恢复正常载重

### 2. 货物损坏 v1
- 易损订单货物在战斗后有概率损坏
- 需要赔偿或重新装载

### 3. 保密订单暴露判定 v1
- 进入村落时触发保密暴露判定
- 暴露后订单奖励降低或失败

### 4. 天气 / 昼夜系统 v1
- 添加天气效果影响移动和战斗
- 添加昼夜变化增加策略深度

### 5. 订单附加条款真实效果 v2
- 实现保密订单真实暴露机制
- 实现易损订单真实货物损坏机制

## 相关文件索引

### 核心系统文件

| 文件路径 | 说明 |
|---------|------|
| `src/systems/GameState.ts` | 游戏状态管理（包含 orderTimeStates、unfinishedOrderIds） |
| `src/systems/retreatSystem.ts` | 撤退成本计算 |
| `src/data/cityOrders.ts` | 订单数据（含 specialTerms） |

### 场景文件

| 文件路径 | 说明 |
|---------|------|
| `src/scenes/CargoPrepScene.ts` | 货物准备（显示附加条款） |
| `src/scenes/MapScene.ts` | 地图场景（显示订单状态和附加条款） |
| `src/scenes/ExpeditionResultScene.ts` | 远征结算 |

### 已删除文件

| 文件路径 | 说明 |
|---------|------|
| `src/data/legacyRelics.ts` | ❌ 已删除 |
| `src/systems/legacySystem.ts` | ❌ 已删除 |
| `src/scenes/LegacySelectScene.ts` | ❌ 已删除 |

---

*本文档为阶段10归档文档，后续维护请参考 docs/development-roadmap.md*
