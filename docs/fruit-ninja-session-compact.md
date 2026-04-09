# Fruit Ninja 美术迭代 · 会话经验（精简）

面向：**wiki 2D 对齐**、**卡通低对比**、**可复现验证**。

---

## 1. 贴图与材质

| 要点 | 做法 |
|------|------|
| 条纹走向 | 西瓜：条纹在 **mesh u（方位角）** 上周期变化，不是主要在 v 上。 |
| 明暗 | 程序贴图里用 **弱烘焙**（`N·L` 窄范围）；成品用 **`MeshBasicMaterial`**，避免再乘场景光导致发灰/双重阴影。 |
| 饱和度 | 卡通：**底色提亮** + 材质 `color` 与白色 **lerp**；西瓜曾整体压暗时用统一乘子。 |
| 缓存 | `CanvasTexture` 单例：**整页刷新**才见新图；大改可临时 bump 版本或清缓存。 |

---

## 2. 西瓜几何

- **自适应 lat–long**：两极环密、腰部稀；`u` 绕长轴、`v` 余纬。  
- 与 **条纹方向**、**RepeatWrapping** 一致时再调 `map.repeat`。

---

## 3. 香蕉几何

| 要点 | 做法 |
|------|------|
| 身长 | 只改 **`createBananaSpineCurve` 控制点 Y**（如乘 `ly`），其它参数不动。 |
| 轮廓 | **centripetal** CatmullRom；wiki：**长、近直、微弯** → 控制点沿主轴拉开，横向偏移小。 |
| 粗细 | **`sin(πt)` 型 girth**：两头尖、中间鼓；`applyTubeRadiusProfile` 按环缩放半径。 |
| 封闭 | `TubeGeometry` 两端开口 → **同皮肤材质的球冠**沿切向埋入管内封口；蒂点用小 **深褐球** 即可。 |
| 端点位置 | 封口/蒂用 **`getPointAt` + `getTangentAt`**，与管体弧长一致。 |

---

## 4. 场景光（卡通）

- **半球光略强** + **主光略弱** + **轮廓光补暗侧**；`PCFSoftShadowMap` 略柔化投影。  
- 与 **MeshBasic** 水果体解耦：体上明暗主要来自贴图。

---

## 5. 截图验收

- **Playwright 默认 Chromium** 常无 WebGL → 白屏；用 **`channel: 'chrome'`** 或本机 Chrome。  
- 脚本：`scripts/capture-banana-gallery-verify.mjs`，环境变量 **`VITE_GALLERY_URL`** 指向实际 dev 端口。  
- 对比图放 **`src/game-center/fruit-ninja/assets/verify/`**（已 **gitignore**，避免大图进库）。

---

## 6. 常见坑

- **Gallery**：`Suspense` + `lazy` 需等 chunk；`data-testid` 在 `useEffect` 里挂上 canvas 后再截。  
- **类型**：香蕉 `MeshBasic` 与 `MeshStandard` 混用时，`getSkinMatForFruit` 返回类型要 **联合类型**。  
- **Tube 端**：仅小球贴端点易露管口；需 **封口几何**。

---

*会话主题：西瓜条纹/明暗/西瓜网格；香蕉脊柱、锥度、封口、明快色；引擎光；本地截图脚本。*
