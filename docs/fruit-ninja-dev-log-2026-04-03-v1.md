# Fruit Ninja Web 开发记录（概要）

日期：2026-04-03  
版本：v1

## 游戏复刻定义（MVP）

- 游戏类型：Dojo 风格“切水果/Knife stroke”街机复刻（网页端、Three.js + Canvas）
- 目标体验：
  - 按住并拖拽屏幕产生刀光轨迹
  - 与水果相交后切割：普通水果得分，炸弹扣分并消耗生命
  - 连击（combo）：快速连续切割可提升得分倍数
  - 生命（lives）与失手（miss）：失手达到阈值判定失败
  - 暂停/重开：`P` 暂停（或 Resume），`R` 重新开始

## 操作与状态

- 操作（指针优先）：
  - `pointerdown + pointermove + pointerup`：拖拽切割
  - 支持鼠标与触控板（使用 `getCoalescedEvents()` 采样更密）
- 键盘：
  - `P`：暂停/恢复（暂停遮罩 + 文案）
  - `R`：重开
- 游戏状态（HUD）：
  - `score`：基础得分 + combo 乘区
  - `combo`：连击计数（窗口 `comboWindowMs`，超时重置）
  - `lives`：剩余生命数
  - `gameOver`：失败态遮罩与总分展示

## Web 技术栈选择（为何这样做）

- 渲染：
  - 主画面：`Three.js`（`requestAnimationFrame` + Three 渲染循环）
  - 刀光显示：使用独立的 2D overlay canvas（屏幕空间绘制），避免与 3D 深度/雾交互导致的“被遮挡/截断”
- 物理：
  - `cannon-es`：水果/炸弹用球体刚体，受重力抛射、碰撞反馈由 cannon-es 负责
- 切割与投影：
  - 屏幕输入 -> 游戏平面：稳定的“射线 vs 相机朝向平面”投影（`screenToCameraFacingPlane`）
  - 命中检测：把刀线近似为屏幕 2D 折线，计算点到线段距离（`distPointSegmentSq2`）并与水果屏幕半径阈值比较

## 接入站点（路由/注册）

- 路由入口：`/games/fruit-ninja`
- 路由组件：`src/game-center/fruit-ninja/FruitNinjaView.tsx`
- 游戏列表注册：`src/game-center/gameRegistry.ts`
- 路由声明：`src/routes/AppRouter.tsx`

## 实施路径（关键模块）

- `src/game-center/fruit-ninja/FruitNinjaView.tsx`
  - React 页面：创建/销毁 `FruitNinjaGame`
  - HUD：显示 score/combo/lives/gameOver，处理 `P`/`R`
- `src/game-center/fruit-ninja/fruitNinjaGame.ts`
  - 场景/相机/渲染器/物理世界初始化
  - 输入采样与切割判定（轨迹生成 + 命中检测 + slice 执行动作）
  - 维护实体列表（whole fruits/bombs 与半球 halves）
- `src/game-center/fruit-ninja/game/slice.ts`
  - `screenToCameraFacingPlane`：输入坐标稳定投影到玩法平面
  - `screenSliceHitSqThreshold`：命中阈值（与水果半径关联）
- `src/game-center/fruit-ninja/fx/trailOverlay2d.ts`
  - 独立 2D overlay canvas：保证刀光始终跟手显示
- `src/game-center/fruit-ninja/game/fruitHalfMesh.ts`
  - 切割模型：两瓣水果以“半球 + 圆形切面（flesh）”方式构建

## 里程碑（截至 v1）

1. 可玩性：
   - 刀光可跟手显示（2D overlay）
   - 普通水果切割计分，炸弹影响生命与分数
   - 连击窗口逻辑与 UI 同步
2. 物理与渲染：
   - 球体刚体抛射、出界回收（cull）
   - 切割生成上下两半并施加冲量
3. 工程可迭代：
   - TypeScript 类型检查通过
   - 构建通过（`vite build`）

## 验证清单（本轮）

- `npm run build`：PASS
- `npx tsc -p tsconfig.json --noEmit`：PASS

## 相关文件（快速定位）

- `src/game-center/fruit-ninja/FruitNinjaView.tsx`
- `src/game-center/fruit-ninja/fruitNinjaGame.ts`
- `src/game-center/fruit-ninja/game/slice.ts`
- `src/game-center/fruit-ninja/game/spawnPlane.ts`
- `src/game-center/fruit-ninja/fx/trailOverlay2d.ts`
- `src/game-center/fruit-ninja/game/fruitHalfMesh.ts`

## 下一步（可选增强）

- 加入 e2e（Playwright）用受控注入方式验证关键链路：开始/暂停/切割命中/炸弹扣命/重开一致性
- 调参增强“手感曲线”：连击窗口、刀线采样密度、命中阈值、抛射曲线与粒子强度
- 更进一步的切面表现（皮环、法线方向、轻微凹凸或颜色渐变）与果汁粒子节流策略

