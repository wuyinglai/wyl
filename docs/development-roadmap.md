# Ember Caravan 开发路线图

> 最后更新：2026-06-04

## 已完成阶段

### 阶段1-5：基础框架与核心系统

- Phaser 3 项目搭建
- 场景管理（MainMenu, RouteSelect, CharacterSelect, Map, Battle, Reward）
- 地图生成（BFS 路径验证、isGoal 节点、bossPosition）
- 战斗系统（BattleManager 同步流程、endTurn/enemyTurn）
- 订单系统（城市订单、requiredGoods、rewardSilver、rewardEmbers）
- 货物系统（cargo 状态管理、weight 计算）

### 阶段6-8：功能完善与测试覆盖

- 地图节点清理（isCleared）
- 奖励系统（RewardScene 选卡、returnToMap）
- 货物装载（CargoPrepScene 买货、清空、一键装载）
- 城市进度（cityContributions、订单交付）
- 远征结算（ExpeditionResultScene）
- 遗产系统（LegacySelectScene、activeLegacyRelicId）
- 撤退遗产闭环（撤退 → 结算 → 遗产选择 → 下一局生效）
- UI 修复（重叠、提示框、小屏适配）

### 阶段9：可试玩版本收尾归档 ✅

**状态：已收尾归档**

- 修复角色选择 UI 偏移 / 小屏重叠
- 修复 CargoPrep 买货真实点击无响应
- 修复按钮坐标映射 / hitArea / canvas 缩放问题
- 排查战斗卡住风险
- 修复订单交付 missing_order 混淆问题
- 修复交付成功后查看结算按钮不可点
- 修复 activeLegacyRelicId / lastExpeditionResult / selectedOrderId 跨局污染
- 统一测试统计口径（28 tests / 627 assertions）
- 归档废弃测试
- 详细归档文档：`docs/stage-9-playable-demo-archive.md`

## 后续路线图（不代表立即开发）

### 阶段10.1：订单附加条款 v1（建议）

- 订单增加附加条款（时间限制、特殊条件）
- 附加条款影响奖励倍率
- UI 展示条款信息

### 阶段11：昼夜与天气系统

- 昼夜循环影响移动和战斗
- 天气事件（沙暴、暴雨等）
- 营地休息机制

### 阶段12：地标修复与长期增益

- 地标修复系统
- 修复后提供长期增益
- 城市网络连接

### 阶段13：商队车厢与货物风险

- 车厢受损系统
- 货物损坏/丢失风险
- 车厢升级/修复

### 阶段14：商队排班与伪装

- 商队排班系统
- 伪装/包装策略
- 影响遭遇事件

### 阶段15：战前布阵与角色状态

- 战前布阵
- 角色状态系统（疲劳、士气）
- 补给品系统

### 阶段16：城市网络与长期目标

- 九城完整文明网络
- 城市升级树
- 长期胜利条件
- 圣所祝福系统
- 交易系统

## 当前版本信息

- 分支：main
- 基准 commit：fa76499
- 有效测试：28 个 / 627 条断言
- 构建状态：通过（tsc + vite build）
- 测试状态：28/28 通过
