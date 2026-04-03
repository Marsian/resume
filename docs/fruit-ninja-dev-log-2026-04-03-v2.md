# Fruit Ninja Web 开发记录（概要）

日期：2026-04-03  
版本：v2

## v2 目标（本轮）

- UI：页面壳层精简，只保留标题 + Back；HUD 进入画板内角落显示
- 失败规则：以 **miss** 为核心，**3 次 miss = Game Over**（不再使用 lives 圆点）
- 炸弹：命中炸弹只计 **1 次 miss**（不再一票否决）
- 手感：略降重力并同步下调抛射初速度，控制最高点，减少“飘”
- 背景：解决“上下两层木板”的观感；最终为 **单一木墙** + **纵向木纹（3–5 条大纹路）**
- 视觉：木纹竖线需要“笔直不歪”，相机改为 **调平（零俯仰）**

## 交互与状态（变化点）

- HUD（画板内）：
  - 左上：`score`（仅数字，无标签/无卡片）
  - 右上：miss 指示 `✕`（已失误为红色，未失误为浅色）
- 失败态（Game Over）：
  - 遮罩与弹窗 **限制在游戏面板内居中**（不占满全页面）
- Combo：
  - UI 从 React “常驻显示”改为 **短生命周期的 2D overlay 黄字**（更像街机提示）

## 物理与出怪调参（变化点）

- 重力：在 `physics/world.ts` 内略降
- 抛射：在 `game/spawn.ts` 下调 `upVelMin/upVelMax`，避免重力变化后最高点仍过高

## 背景与相机（变化点）

- 单一木墙：
  - `scene.background` 改为纯色（不再叠加木纹当 background）
  - 背景墙材质使用 `MeshBasicMaterial`（不受灯光影响，避免竖墙出现“上暗下亮”）
- 木纹：
  - 改为 **纵向木纹**，并限制为 **3–5 条大纹理**，辅以少量结疤/纤维细节
- 相机调平：
  - 相机视线水平（`lookAt` 的 y 与相机 y 相同），避免透视俯仰导致木纹竖线看起来“带角度”

## 关键实现文件（本轮涉及）

- `src/game-center/fruit-ninja/FruitNinjaView.tsx`
  - 页面壳层精简；HUD 进入画板；Game Over 弹窗面板内居中
- `src/game-center/fruit-ninja/fruitNinjaGame.ts`
  - miss 状态回传；炸弹命中按 1 miss 计；移除无用舞台调用
- `src/game-center/fruit-ninja/game/constants.ts`
  - `missLimit = 3`
- `src/game-center/fruit-ninja/game/spawn.ts`
  - 抛射速度区间下调
- `src/game-center/fruit-ninja/physics/world.ts`
  - 重力略降
- `src/game-center/fruit-ninja/three/engine.ts`
  - 单木墙背景、纵向木纹生成、相机调平
- `src/game-center/fruit-ninja/fx/comboOverlay2d.ts`
  - 新增：combo 黄字 2D overlay（短生命周期）

## 验证清单（本轮）

- `npx tsc -p tsconfig.json --noEmit`：PASS
- `npm run build`：PASS

