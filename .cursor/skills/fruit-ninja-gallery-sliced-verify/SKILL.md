---
name: fruit-ninja-gallery-sliced-verify
description: >-
  Captures Fruit Ninja gallery-sliced WebGL renders for a single fruit/bomb,
  compares them to the whole-fruit gallery renders via scripted pixel diff,
  and instructs a multimodal model to score skin consistency, flesh quality,
  and geometry fidelity of the sliced halves.
---

# Fruit Ninja Gallery-Sliced vs Gallery 切面验证

面向 **Agent**：用本目录 `scripts/` 自动化截图与像素报告，再调用 **多模态** 做切面还原度判断与差异归纳。

## 前置

- 本地 dev 已启动：`npm run dev`（Vite 若占用端口会改用 5174、5175…），或设置 `FN_BASE_URL`。
- Sliced gallery 路由：`/games/fruit-ninja/gallery-sliced`。
- Whole gallery 路由：`/games/fruit-ninja/gallery`。
- 单果静态截图 URL：`/games/fruit-ninja/gallery-sliced?fruit=<kind>&static=1`。

## 步骤 1：截图（Playwright）

截取 **切面** 和 **整体** 两张图：

```bash
# 切面截图
npx tsx .cursor/skills/fruit-ninja-gallery-sliced-verify/scripts/capture.ts \
  --fruit apple \
  --out /tmp/fn-sliced-apple.png

# 整体截图（用原有 skill）
npx tsx .cursor/skills/fruit-ninja-gallery-verify/scripts/capture.ts \
  --fruit apple \
  --out /tmp/fn-whole-apple.png
```

可选：`--base-url https://example.com` 或 `FN_BASE_URL`。

## 步骤 2：像素对比（可选）

```bash
npx tsx .cursor/skills/fruit-ninja-gallery-sliced-verify/scripts/compare.ts \
  --render /tmp/fn-sliced-apple.png \
  --wiki /tmp/fn-whole-apple.png \
  --out-diff /tmp/fn-sliced-apple-diff.png \
  --out-report /tmp/fn-sliced-apple-report.json \
  --fruit apple
```

## 步骤 3：多模态评审（必须）

将以下 **一并** 提供给多模态模型：

1. 切面截图（步骤 1 的 PNG）
2. 整体截图（步骤 1 的 PNG）
3. Diff 图（可选，步骤 2）
4. `report.json`（可选）

请模型评估切面的以下维度：

## 主 Agent 输出模板（结构化）

| 字段 | 说明 |
|------|------|
| `fruit` | 水果 `kind` |
| `skinConsistency` | 切面外壳的皮肤纹理是否与整体一致：高/中/低 |
| `fleshQuality` | 切面内部果肉纹理质量：高/中/低，并简述（种子/纤维/分段等细节） |
| `geometry` | 切面形状是否匹配整体轮廓（自定义 poly vs 通用半球）：匹配/不匹配 |
| `differencePoints` | 列表：`skin_mismatch` / `flesh_missing_detail` / `geometry_generic_hemisphere` / `cap_scaling` 等 |
| `suggestedFixes` | 可选：建议改动的文件或方向 |
