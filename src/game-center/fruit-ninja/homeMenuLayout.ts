/**
 * Home menu ring layout derived only from the **playfield** CSS size (canvas / overlay parent).
 * Keeps SVG rings and 3D decor anchors in sync and avoids vw / viewport breakpoints mismatching
 * the actual embedded game width.
 */
export type HomeRingLayout = {
  uStart: number
  uSettings: number
  vStart: number
  vSettings: number
  startRingPx: number
  settingsRingPx: number
}

export type GameOverButtonLayout = {
  uRetry: number
  uQuit: number
  vButtons: number
  buttonPx: number
  ringPx: number
}

/** Full game-over overlay: action rings + compact score panel (fits above buttons). */
export type GameOverLayout = GameOverButtonLayout & {
  scoreBoardWidthPct: number
  scoreBoardTopPx: number
  scoreTitlePx: number
  scoreNumberPx: number
  scoreBoardPaddingY: number
  scoreStrokeTitle: number
  scoreStrokeNumber: number
}

const V_START = 0.6
const V_SETTINGS = 0.46
const V_GAME_OVER_BUTTONS = 0.78

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/**
 * Place the settings ring flush to the right inset, then the start ring to its left with a gap.
 * Shrinks both rings until margins + gap constraints hold.
 */
export function computeHomeRingLayout(playfieldCssW: number, _playfieldCssH: number): HomeRingLayout {
  const W = Math.max(160, playfieldCssW)
  const margin = clamp(W * 0.024, 6, 18)
  let gap = clamp(W * 0.026, 10, 32)

  let dStart = clamp(W * 0.34, 118, 248)
  let dSet = clamp(W * 0.22, 72, 188)

  for (let i = 0; i < 60; i++) {
    const cxSettings = W - margin - dSet / 2
    const cxStart = cxSettings - dSet / 2 - gap - dStart / 2
    const leftStart = cxStart - dStart / 2
    const rightSettings = cxSettings + dSet / 2
    if (leftStart >= margin - 0.25 && rightSettings <= W - margin + 0.25) {
      return {
        uStart: cxStart / W,
        uSettings: cxSettings / W,
        vStart: V_START,
        vSettings: V_SETTINGS,
        startRingPx: dStart,
        settingsRingPx: dSet,
      }
    }
    dStart *= 0.93
    dSet *= 0.93
    gap = Math.max(6, gap * 0.95)
  }

  // Last resort: minimal rings, still right-aligned settings.
  dStart = 104
  dSet = 72
  gap = 6
  const cxSettings = W - margin - dSet / 2
  const cxStart = Math.max(margin + dStart / 2, cxSettings - dSet / 2 - gap - dStart / 2)
  return {
    uStart: cxStart / W,
    uSettings: cxSettings / W,
    vStart: V_START,
    vSettings: V_SETTINGS,
    startRingPx: dStart,
    settingsRingPx: dSet,
  }
}

/**
 * Game-over actions: two same-size round buttons, centered as a pair near the bottom.
 * Ensures they stay within the playfield and never overlap across widths.
 */
export function computeGameOverButtonLayout(playfieldCssW: number, _playfieldCssH: number): GameOverButtonLayout {
  const W = Math.max(160, playfieldCssW)
  const margin = clamp(W * 0.032, 10, 22)
  let gap = clamp(W * 0.04, 16, 56)

  // Buttons were 140px and rings 170px; keep proportions but scale with playfield width.
  let ringPx = clamp(W * 0.22, 132, 182)
  let buttonPx = clamp(ringPx * (140 / 170), 108, 150)

  for (let i = 0; i < 60; i++) {
    const pairW = ringPx * 2 + gap
    if (pairW <= W - margin * 2 + 0.25) {
      const cx = W / 2
      const cxRetry = cx - (gap / 2 + ringPx / 2)
      const cxQuit = cx + (gap / 2 + ringPx / 2)
      return {
        uRetry: cxRetry / W,
        uQuit: cxQuit / W,
        vButtons: V_GAME_OVER_BUTTONS,
        buttonPx,
        ringPx,
      }
    }
    ringPx *= 0.94
    buttonPx = Math.max(96, buttonPx * 0.94)
    gap = Math.max(10, gap * 0.95)
  }

  // Last resort: small buttons with small gap.
  ringPx = 120
  buttonPx = 96
  gap = 10
  const cx = W / 2
  return {
    uRetry: (cx - (gap / 2 + ringPx / 2)) / W,
    uQuit: (cx + (gap / 2 + ringPx / 2)) / W,
    vButtons: V_GAME_OVER_BUTTONS,
    buttonPx,
    ringPx,
  }
}

/**
 * Buttons + score parchment sized so the panel never overlaps the two action rings vertically.
 */
export function computeGameOverLayout(playfieldCssW: number, playfieldCssH: number): GameOverLayout {
  const W = Math.max(160, playfieldCssW)
  const H = Math.max(120, playfieldCssH)
  const buttons = computeGameOverButtonLayout(W, H)
  const { ringPx, vButtons } = buttons

  const buttonRingTopY = H * vButtons - ringPx / 2
  const topPad = clamp(H * 0.04, 12, 36)
  const gapBelowPanel = clamp(H * 0.028, 10, 26)
  const maxPanelBottom = buttonRingTopY - gapBelowPanel
  const availableForContent = Math.max(56, maxPanelBottom - topPad)

  let scoreNumberPx = clamp(W * 0.11, 42, 108)
  let scoreTitlePx = clamp(W * 0.034, 14, 36)
  let py = clamp(H * 0.038, 6, 20)
  let contentH = scoreTitlePx + scoreNumberPx + py * 2
  while (contentH > availableForContent && scoreNumberPx > 34) {
    scoreNumberPx -= 3
    scoreTitlePx = Math.max(12, scoreTitlePx - 1)
    py = Math.max(5, py - 1)
    contentH = scoreTitlePx + scoreNumberPx + py * 2
  }

  const scoreStrokeTitle = clamp(scoreTitlePx * 0.17, 3, 8)
  const scoreStrokeNumber = clamp(scoreNumberPx * 0.086, 5, 12)
  const scoreBoardWidthPct = clamp(82 - (W < 520 ? 6 : 0), 68, 86)

  return {
    ...buttons,
    scoreBoardWidthPct,
    scoreBoardTopPx: topPad,
    scoreTitlePx,
    scoreNumberPx,
    scoreBoardPaddingY: py,
    scoreStrokeTitle,
    scoreStrokeNumber,
  }
}
