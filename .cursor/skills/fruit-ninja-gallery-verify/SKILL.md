---
name: fruit-ninja-gallery-verify
description: >-
  Captures Fruit Ninja gallery WebGL renders for a single fruit, compares them to
  wiki reference PNGs via scripted pixel diff, and instructs a multimodal model to
  score fidelity and list material differences. Use when tuning fruit materials in
  fruit-ninja, verifying gallery vs assets/wiki references, or when the user asks
  for gallery/wiki comparison or material fidelity checks.
---

# Fruit Ninja Gallery vs Wiki 材质验证

面向 **Agent**：用本目录 `scripts/` 自动化截图与像素报告，再调用 **多模态** 做还原度判断与差异归纳。不要跳过脚本直接「凭感觉」看图。

## 前置

- 本地 dev 已启动：`npm run dev`（Vite 若占用端口会改用 5174、5175…），或设置 `FN_BASE_URL` 为终端里打印的 `Local` URL。
- `capture.ts` 已为 headless Chromium 加上常见 WebGL 参数；若仍无法创建 WebGL 上下文，可加 `--headed` 用有界面浏览器截图。
- Gallery 路由：`/games/fruit-ninja/gallery`。
- 单果静态截图 URL：`/games/fruit-ninja/gallery?fruit=<kind>&static=1`（`<kind>` 为 `FruitArchetype`，如 `apple`）。
- Wiki 参考图目录：[`src/game-center/fruit-ninja/assets/wiki/<kind>.png`](../../../src/game-center/fruit-ninja/assets/wiki)。

## 步骤 1：截图（Playwright）

在**仓库根目录**执行（路径按实际克隆位置调整）：

```bash
npx tsx .cursor/skills/fruit-ninja-gallery-verify/scripts/capture.ts \
  --fruit apple \
  --out /tmp/fn-gallery-apple.png
```

可选：`--base-url https://example.com` 或 `FN_BASE_URL`。

## 步骤 2：像素对比（Playwright + 浏览器 Canvas）

```bash
npx tsx .cursor/skills/fruit-ninja-gallery-verify/scripts/compare.ts \
  --render /tmp/fn-gallery-apple.png \
  --wiki src/game-center/fruit-ninja/assets/wiki/apple.png \
  --out-diff /tmp/fn-apple-diff.png \
  --out-report /tmp/fn-apple-report.json \
  --fruit apple
```

`compare.ts` 将两图缩放到 512×512 后按通道阈值统计不一致像素比例；**仅供参考**，不能单独代表「美术还原度」。

## 步骤 3：多模态评审（必须）

将以下 **一并** 提供给多模态模型（或具备视觉的会话）：

1. 渲染截图（步骤 1 的 PNG）
2. Wiki 参考 PNG
3. Diff 图（步骤 2）
4. `report.json` 全文或至少 `mismatchPercent` 与 `differingPixels`

请模型结合 **3D 光照、透视与 wiki 平面参考** 的差异，判断「像不像」而非仅像素数。

## 主 Agent 输出模板（结构化）

多模态评审后，向主会话返回如下结构（可复制到回复中）：

| 字段 | 说明 |
|------|------|
| `fruit` | 水果 `kind` |
| `implementationSummary` | 当前实现一两句概括 |
| `fidelity` | 还原度：低/中/高或 0–10，并简述依据 |
| `differencePoints` | 列表：`lighting` / `albedo` / `specular` / `shape_silhouette` / `surface_detail` / `background_context` 等 |
| `scriptMetrics` | 引用 `mismatchPercent` 等，标注为辅助信号 |
| `suggestedNextSteps` | 可选：建议改动的文件或着色方向 |

## 约定

- **不**修改仓库根 `package.json` 为本 skill 增加脚本或依赖；仅使用已有 `npx tsx` 与 `@playwright/test`。
- 像素 diff 逻辑在 `scripts/compare-browser.mjs`（避免 tsx 破坏 Playwright 序列化）；`compare.ts` 仅负责读文件与写报告。
- 像素 diff 阈值与 512 尺寸写死在 `compare-browser.mjs`；若要调整需改该文件。

## Claude / Cursor 发现路径

本技能位于 `.cursor/skills/fruit-ninja-gallery-verify/`。若使用 Claude Code 且需项目内 `.claude/skills`，请使用指向本目录的 **符号链接**（与 `.cursor` 下副本同一内容，勿重复维护两套）。
