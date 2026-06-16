# 阶段 12 状态与规划

> 工具系统 v1 / 远征前工具携带闭环

## 基线

- 当前分支：`main`
- 功能开发完成 commit：`eeaa422`（`feat: complete stage 12 tool system loop`）
- `git status --short`：干净（写入本文时）

## 阶段 12 功能开发状态

**✅ 阶段 12 功能开发已完成，等待统一测试与人工试玩。**

### 已完成功能清单

1. **工具数据完整性**：✅
   - 工具有名称、描述、稀有度、价格、是否实装
   - 未实装工具（信号焰火）不可购买，显示"暂未开放"
   - 已拥有工具不可重复购买，显示"已拥有"
   - 已购买工具进入 ownedTools

2. **TownScene 工具商店**：✅
   - 工具商店显示清楚（仓库/工具面板）
   - 可以购买工具（真实点击）
   - 购买后刷新为已拥有
   - TownScene 不负责携带选择
   - TownScene 不修改 selectedToolId

3. **CargoPrepScene 工具携带**：✅
   - 只显示已拥有且已实装工具
   - 可选择一个工具
   - 可取消（点击已选工具取消）
   - 可切换（点击其他工具切换）
   - 当前携带文本正确
   - 开始远征后 selectedToolId 保留到 MapScene

4. **MapScene 工具显示**：✅
   - 显示"携带工具：未选择 / 工具名"
   - 显示工具效果摘要
   - 备用轮轴已接入撤退消耗折扣

5. **状态流**：✅
   - ownedTools 是长期拥有
   - selectedToolId 是本次远征携带
   - 再来一局 selectedToolId 重置为 null
   - ownedTools 不清空

6. **真实点击链路修复**：✅
   - CargoPrepScene "开始远征"真实点击已稳定触发 MapScene
   - TownScene 购买按钮真实点击已稳定
   - CargoPrepScene 工具选择按钮真实点击已稳定

7. **测试覆盖**：✅
   - smoke-test-tool-system-12-1.cjs：86 通过
   - smoke-test-town-tools-display-12-2.cjs：27 通过
   - smoke-test-cargo-prep-8-5.cjs：26 通过
   - smoke-test-tool-carry-12-3.cjs：28 通过

## 下一步

**进入阶段 12 统一测试与人工试玩。**

1. 用户人工试玩完整流程
2. 收集 P2/P3 非阻断问题
3. 集中 bugfix（如有）
4. 确认无 P0/P1 后进入阶段 13

## 已知 P2/P3 非阻断问题

> 这些问题不影响核心流程，可在后续阶段或统一测试时处理。

1. **UI 对齐**：工具卡片布局可能不够完美
2. **文案**：工具效果摘要可以更详细
3. **按钮颜色**：部分按钮颜色可以优化
4. **测试覆盖**：可以增加更多边界测试

## 阶段 12 执行规则回顾

1. 功能开发任务要提前规划，尽量少发，不能无限拆碎
2. bug 修改不计入数量上限
3. 阻断 bug 必须修到通过为止，不受任务数量限制
4. 12-FINAL bugfix 可以不限轮数，直到验收通过

## 历史记录

- `aa0ce75`：docs: record stage 12 status and plan
- `eeaa422`：feat: complete stage 12 tool system loop（功能开发完成）
