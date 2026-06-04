# 阶段9 可试玩版本收尾归档

> 归档日期：2026-06-04
> 分支：main
> 基准 commit：fa76499 test: align smoke test inventory

## 1. 当前版本定位

当前版本已具备一个最小可试玩闭环，包含两条完整主循环：

### 成功远征闭环

```
MainMenuScene
  → RouteSelectScene（选择路线）
  → CharacterSelectScene（选择角色）
  → CargoPrepScene（装载货物）
  → MapScene（地图移动）
  → BattleScene（战斗）
  → 战斗奖励
  → 返回 MapScene
  → 到达目标点
  → 订单交付（成功）
  → 查看结算按钮（Container 点击跳转）
  → ExpeditionResultScene（成功结算）
  → 再来一局
```

### 撤退遗产闭环

```
MapScene
  → 撤退
  → ExpeditionResultScene（撤退结算）
  → 选择遗产 / 跳过遗产
  → LegacySelectScene
  → 下一局 RouteSelectScene
  → CargoPrepScene
  → 遗产生效
```

## 2. 阶段9已修复的关键问题

| # | 问题 | 修复阶段 | 修复方式 |
|---|------|---------|---------|
| 1 | 角色选择 UI 偏移 / 小屏重叠 | 9.1.1 | 修复 Container 坐标和 depth 层级 |
| 2 | CargoPrep 买货真实点击无响应 | 9.1.4→9.1.5 | 重建按钮为独立 Container，使用 canvas dispatchEvent |
| 3 | CargoPrep 按钮坐标映射 / hitArea / canvas 缩放问题 | 9.1.6 | 修复 pointer mapping，移除遮挡 Zone |
| 4 | 战斗卡住风险排查 | 9.1.1→9.1.3 | 确认同步战斗流程无死锁，endTurn/enemyTurn 正常 |
| 5 | 奖励后返回 MapScene | 9.1 | selectRewardCard → returnToMap 流程验证 |
| 6 | 订单交付 missing_order 混淆问题 | 9.2.2 | 区分缺货失败和成功交付，补强真实装载→真实交付测试 |
| 7 | 交付成功后查看结算按钮不可点 | 9.2.3 | 将按钮从 Rectangle+Text 改为 Container 包装，pointerdown 绑定在 Container |
| 8 | 撤退结算文案误导 | 9.2 | 确认 resultType="retreated" 正确显示 |
| 9 | activeLegacyRelicId / appliedLegacyRelicIdForRun 跨局污染 | 9.2 | MainMenuScene.resetGameStateForNewRun() + LegacySelectScene.skipRelic() 清理 |
| 10 | lastExpeditionResult 跨局污染 | 9.2 | ExpeditionResultScene.clearResultState() 清理 |
| 11 | selectedOrderId 清理与跨局污染 | 9.2 | clearResultState() 中清理 selectedOrderId |
| 12 | 测试统计口径不一致 | 9.2.4 | count-test-asserts 改为自动扫描，归档废弃测试 |
| 13 | 废弃测试归档 | 9.2.4 | old-smoke-test-stage4.cjs、old-smoke-test-cargo-prep-buy-real-click-9-1-4.cjs 移入 archive |

## 3. 当前有效测试清单

共 **28 个**有效测试文件，**627 条**断言，全部通过。

由 `scripts/count-test-asserts.cjs` 自动扫描统计，逐项验证相加正确。

### 测试文件列表

| # | 文件名 | 断言数 | 覆盖范围 |
|---|--------|--------|---------|
| 1 | smoke-test-battle-not-stuck-9-1-1.cjs | 6 | 战斗不卡住基础验证 |
| 2 | smoke-test-battle-not-stuck-9-1-3.cjs | 19 | 战斗完整流程验证 |
| 3 | smoke-test-cargo-prep-8-5.cjs | 23 | 货物装载场景 |
| 4 | smoke-test-cargo-prep-buy-9-1-3.cjs | 12 | 买货功能验证 |
| 5 | smoke-test-cargo-prep-buy-real-click-9-1-5.cjs | 30 | 买货真实鼠标点击 |
| 6 | smoke-test-cargo-prep-pointer-mapping-9-1-6.cjs | 18 | 按钮坐标映射 |
| 7 | smoke-test-cargo-state-8-2.cjs | 26 | 货物状态管理 |
| 8 | smoke-test-character-select-ui-9-1-1.cjs | 9 | 角色选择 UI |
| 9 | smoke-test-character-select-ui-9-1-3.cjs | 12 | 角色选择完整流程 |
| 10 | smoke-test-city-order-7-2.cjs | 19 | 城市订单系统 |
| 11 | smoke-test-city-order-edge-7-2.cjs | 21 | 城市订单边界情况 |
| 12 | smoke-test-city-progress-8-6.cjs | 45 | 城市进度与交付 |
| 13 | smoke-test-expedition-result-8-7.cjs | 38 | 远征结算场景 |
| 14 | smoke-test-goods-8-1.cjs | 22 | 货物系统基础 |
| 15 | smoke-test-hidden-bugs-9-2.cjs | 53 | 隐藏 Bug 综合排查（含成功交付闭环、查看结算按钮、遗产选择） |
| 16 | smoke-test-legacy-relic-8-8.cjs | 30 | 遗产遗物系统 |
| 17 | smoke-test-map-node-clear-6-5.cjs | 13 | 地图节点清理 |
| 18 | smoke-test-order-cargo-8-3.cjs | 24 | 订单与货物关联 |
| 19 | smoke-test-order-delivery-8-4.cjs | 26 | 订单交付流程 |
| 20 | smoke-test-order-delivery-real-goal-8-4-1.cjs | 20 | 真实目标点交付 |
| 21 | smoke-test-retreat-legacy-8-9.cjs | 38 | 撤退遗产闭环 |
| 22 | smoke-test-reward-6-3.cjs | 12 | 战斗奖励 |
| 23 | smoke-test-reward-skip-6-4.cjs | 9 | 跳过奖励 |
| 24 | smoke-test-route-select-7-1.cjs | 13 | 路线选择 |
| 25 | smoke-test-route-select-edge-7-1.cjs | 13 | 路线选择边界情况 |
| 26 | smoke-test-ui-overlap-and-camp-8-hotfix.cjs | 15 | UI 重叠与营地修复 |
| 27 | smoke-test-ui-overlap-tooltip-hotfix.cjs | 23 | UI 提示框修复 |
| 28 | smoke-test-ui-overlap-tooltip-realflow.cjs | 38 | UI 提示框真实流程 |

### 归档旧测试（不计入有效测试）

| 文件名 | 归档原因 |
|--------|---------|
| old-smoke-test-stage4.cjs | 早期废弃测试，运行时报错 |
| old-smoke-test-cargo-prep-buy-real-click-9-1-4.cjs | 9.1.4 旧版买货点击测试，UI 结构已变更，被 9-1-5 取代 |

## 4. 当前已知可用功能

- 路线选择（RouteSelectScene）
- 角色选择（CharacterSelectScene）
- 货物购买（CargoPrepScene 买货 +/−）
- 一键装载订单需求（CargoPrepScene loadOrderRequirements）
- 地图移动（MapScene BFS 路径移动）
- 战斗进入（MapScene → BattleScene）
- 战斗胜利（BattleScene endTurn/enemyTurn 同步流程）
- 战斗奖励（RewardScene 选卡）
- 战斗后返回地图（returnToMap）
- 订单交付（MapScene handleOrderDelivery）
- 成功远征结算（ExpeditionResultScene success）
- 撤退结算（ExpeditionResultScene retreated）
- 遗产选择（LegacySelectScene）
- 遗产下一局生效（appliedLegacyRelicIdForRun）
- 城市状态变化（cityContributions）
- 货物状态显示（cargo weight/count）
- 订单状态显示（selectedOrderId）

## 5. 当前暂不做的系统

以下系统已进入后续路线图，但不在阶段9开发范围：

- 订单附加条款
- 昼夜系统
- 天气系统
- 商队车厢受损系统
- 补给品系统
- 圣所祝福
- 交易系统
- 城市升级树
- 九城完整文明网络

## 6. 进入阶段10前的条件

阶段10 开发前必须满足以下条件：

1. 阶段9归档完成（本文档）
2. 28 个有效测试全部通过（28/28，627 assertions）
3. 用户确认当前 Demo 可试玩
4. 不再存在已知阻断试玩的 bug
