# Fruit Ninja Web 开发记录（概要）

日期：2026-04-07  
版本：v3

## v3 目标（本轮）

- 首页：Classic 菜单风格（两圈 + 装饰水果），**切开水果开局**
- Game Over：Classic 风格卷轴分数面板 + 两个操作圈（再玩一次 / 返回首页），并支持 **切开道具选中**
- 响应式：以 **玩法区（playfield）尺寸**为唯一依据，保证在 500px 附近以及更宽屏幕下圈/面板不溢出、不重叠；3D 道具与 UI 圈严格对齐
- 资源与视觉：补齐更多 Normal 水果、菜单水果更亮更清晰

---

## 核心改动摘要（What changed）

### 1) 统一布局：只依赖 playfield 尺寸（避免 vw / sm 与嵌入宽度不一致）

- 新增统一布局函数：`src/game-center/fruit-ninja/homeMenuLayout.ts`
  - `computeHomeRingLayout(playfieldW, playfieldH)`
  - `computeGameOverLayout(playfieldW, playfieldH)`（包含分数面板与操作圈尺寸）
- `FruitNinjaView.tsx` 通过 `ResizeObserver` 读取 **playfield 实际像素宽高**，把 layout 传给 `HomeOverlay` / `GameOverOverlay`
- `fruitNinjaGame.ts` 在生成菜单/结算 3D 道具时使用 **同一套** layout（保证 3D 道具锚点与 SVG 圈一致）

### 2) 首页：切开任意展示水果即可开局（并清空两颗）

- `phase: 'home' | 'playing'` 状态机
- Home 期间不显示 HUD；切开 home 水果 → 清空两颗装饰水果 → 进入 `playing`

### 3) Game Over：分数面板缩小、移除 “NEW BEST!”

- Game Over 卷轴面板由 `computeGameOverLayout` 计算字号/留白，保证不会与底部两个操作圈重叠
- 移除 “NEW BEST!” 文案行

### 4) Game Over：圈内道具 + 切开选中（带切开/爆炸动画）

- Game Over 时清理局内实体并生成 3D 道具：
  - 再玩一次：西瓜（小于圈内径、慢旋转、倾斜）
  - 返回首页：炸弹（同上）
- 交互改为 **切开道具本体**触发（不是点击圈）：
  - 切开西瓜：生成半块 + 果汁，然后延迟执行 `restart()`
  - 切开炸弹：爆炸果汁 + 音效，然后延迟执行 `goToHomeScreen()`

### 5) 切开判定：三页面同一套 “真实切开” 命中

- 提取统一命中函数：`collectHitsForStrokeSegment(a, b)`
  - 将屏幕划刀段投影到 camera-facing play plane
  - 用 “线段到实体球心距离 ≤ 实体半径” 判定命中
- `home / playing / gameOver` 全部复用该命中结果；三页面的“是否命中/切开”判定保持一致

---

## 自动化与验证（How verified）

- 类型检查：`npx tsc -p tsconfig.json --noEmit`：PASS
- 响应式扫宽截图脚本：`scripts/fn-home-layout-sweep.ts`
  - 视口宽度：500 → 1900（步长 100）
  - 输出：`test-results/fn-sweep/`（已在 `.gitignore` 忽略）
  - 校验：圈不溢出、不重叠；Game Over 卷轴不与操作圈重叠

> 备注：Playwright headless 环境可能无 WebGL，上述脚本用于 UI 盒模型与布局断言；交互与 3D 视觉以本机浏览器实测为准。

---

## 关键实现文件（本轮涉及）

- `src/game-center/fruit-ninja/FruitNinjaView.tsx`
  - Home/GameOver 覆盖层；playfield `ResizeObserver`；禁用 GameOver overlay 指针事件以支持切开选中
- `src/game-center/fruit-ninja/homeMenuLayout.ts`
  - 首页与 GameOver 的统一布局算法（只依赖 playfield 宽高）
- `src/game-center/fruit-ninja/fruitNinjaGame.ts`
  - `phase` 状态机；Home 装饰水果；GameOver 装饰道具；统一切开命中判定；GameOver 切开选中流程（含动画与延迟动作）
- `scripts/fn-home-layout-sweep.ts`
  - 扫宽截图与布局断言脚本

---

## 已知问题 / 后续计划（Plan）

- **交互精度**：若仍出现“擦边触发”，可进一步基于 play plane 的切割线与球体的交点数量/切割角度收紧判定（保持与三页面一致）
- **视觉还原**：继续对齐附件参考图的木板透视、卷轴细节、字体描边与环内装饰物比例
- **自动化**：补充 headed 模式的 e2e（需要 WebGL 可用环境）以覆盖 GameOver 切开选中

