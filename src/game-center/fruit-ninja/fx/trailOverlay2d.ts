/**
 * Screen-space blade trail on a separate 2D canvas stacked above the WebGL layer.
 * Avoids depth tests, transparent sort, and scene fog that made the Line2 trail
 * disappear behind fruits after they spawned.
 */
const MAX_POINTS = 1200
/** Min move in CSS pixels before adding a sample */
const MIN_DIST_SQ = 2.5 * 2.5
const SPEED_NORM = 24
const BASE_WIDTH = 6.8
const TRAIL_LIFE_MS = 220
const RELEASE_FADE_MS = 180

export class BladeTrailOverlay2d {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private layoutRect: DOMRect | null = null
  private dpr = 1
  private readonly xs = new Float32Array(MAX_POINTS)
  private readonly ys = new Float32Array(MAX_POINTS)
  private readonly ts = new Float32Array(MAX_POINTS)
  private head = 0
  private count = 0
  private fading = false
  private fadeStart = 0
  private fadeEnd = 0
  private swingBoost = 0
  private persistTrail = false
  private frozenCanvas: HTMLCanvasElement | null = null
  private frozenCtx: CanvasRenderingContext2D | null = null

  constructor(parent: HTMLElement) {
    const c = document.createElement('canvas')
    c.className = 'absolute inset-0 h-full w-full pointer-events-none'
    c.style.zIndex = '2'
    c.setAttribute('aria-hidden', 'true')
    const ctx = c.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('2D trail: getContext("2d") failed')
    this.canvas = c
    this.ctx = ctx
    parent.appendChild(c)
  }

  setLayoutRect(rect: DOMRect | null) {
    this.layoutRect = rect
  }

  setPersistTrail(persist: boolean) {
    this.persistTrail = persist
    if (persist) this.ensureFrozenLayer()
    if (persist) {
      this.fading = false
      this.fadeStart = 0
      this.fadeEnd = 0
      if (this.count >= 2) this.paint(performance.now())
    }
  }

  beginStroke() {
    if (this.persistTrail && this.count >= 2) this.freezeCurrentStroke()
    this.head = 0
    this.count = 0
    this.fading = false
    this.fadeStart = 0
    this.fadeEnd = 0
    this.swingBoost = 0
    this.paint(performance.now())
  }

  resize(cssWidth: number, cssHeight: number) {
    this.dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const w = Math.max(1, Math.floor(cssWidth * this.dpr))
    const h = Math.max(1, Math.floor(cssHeight * this.dpr))
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    this.resizeFrozenLayer(w, h)
    if (this.count >= 2) this.paint(performance.now())
  }

  pushScreenPoint(clientX: number, clientY: number) {
    const now = performance.now()
    const r = this.layoutRect
    if (!r || r.width < 8 || r.height < 8) return
    const x = clientX - r.left
    const y = clientY - r.top
    if (this.count > 0) {
      const li = (this.head + this.count - 1) % MAX_POINTS
      const dx = x - this.xs[li]
      const dy = y - this.ys[li]
      if (dx * dx + dy * dy < MIN_DIST_SQ) return
      const speedWeight = Math.min(1, Math.hypot(dx, dy) / SPEED_NORM)
      this.swingBoost = Math.max(this.swingBoost * 0.8, speedWeight)
    }
    this.fading = false
    if (this.count < MAX_POINTS) {
      const w = (this.head + this.count) % MAX_POINTS
      this.xs[w] = x
      this.ys[w] = y
      this.ts[w] = now
      this.count++
    } else {
      if (this.persistTrail) {
        this.freezeCurrentStroke()
        this.head = 0
        this.count = 0
        this.xs[0] = x
        this.ys[0] = y
        this.ts[0] = now
        this.count = 1
        this.paint(now)
        return
      }
      this.head = (this.head + 1) % MAX_POINTS
      const w = (this.head + this.count - 1) % MAX_POINTS
      this.xs[w] = x
      this.ys[w] = y
      this.ts[w] = now
    }
    this.trimExpired(now)
    if (this.count >= 2) this.paint(now)
  }

  clear() {
    this.head = 0
    this.count = 0
    this.fading = false
    this.fadeStart = 0
    this.fadeEnd = 0
    this.swingBoost = 0
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.frozenCtx && this.frozenCanvas) {
      this.frozenCtx.setTransform(1, 0, 0, 1, 0, 0)
      this.frozenCtx.clearRect(0, 0, this.frozenCanvas.width, this.frozenCanvas.height)
    }
  }

  fade() {
    if (this.persistTrail) return
    if (this.count < 2) {
      this.clear()
      return
    }
    const now = performance.now()
    this.fading = true
    this.fadeStart = now
    this.fadeEnd = now + RELEASE_FADE_MS
    this.paint(now)
  }

  /** Kept for API parity with the old Three.js trail; 2D path repaints in pushScreenPoint. */
  tick(now = performance.now()) {
    this.swingBoost *= 0.9
    this.trimExpired(now)
    if (this.count < 2) {
      if (!this.fading) return
      this.clear()
      return
    }
    if (this.fading && now >= this.fadeEnd) {
      this.clear()
      return
    }
    this.paint(now)
  }

  private trimExpired(now: number) {
    if (this.persistTrail) return
    while (this.count > 0 && now - this.ts[this.head]! > TRAIL_LIFE_MS) {
      this.head = (this.head + 1) % MAX_POINTS
      this.count--
    }
  }

  private paint(now: number) {
    const ctx = this.ctx
    const W = this.canvas.width
    const H = this.canvas.height
    const fadeAlpha = this.fading
      ? Math.max(0, 1 - (now - this.fadeStart) / Math.max(1, this.fadeEnd - this.fadeStart))
      : 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    if (this.persistTrail && this.frozenCanvas) ctx.drawImage(this.frozenCanvas, 0, 0)
    this.renderActiveStroke(ctx, now, fadeAlpha)
  }

  private ensureFrozenLayer() {
    if (this.frozenCanvas && this.frozenCtx) return
    this.frozenCanvas = document.createElement('canvas')
    this.frozenCtx = this.frozenCanvas.getContext('2d', { alpha: true })
    this.resizeFrozenLayer(this.canvas.width, this.canvas.height)
  }

  private resizeFrozenLayer(width: number, height: number) {
    if (!this.frozenCanvas || !this.frozenCtx) return
    if (this.frozenCanvas.width === width && this.frozenCanvas.height === height) return
    const old = this.frozenCanvas
    const next = document.createElement('canvas')
    next.width = width
    next.height = height
    const nctx = next.getContext('2d', { alpha: true })
    if (!nctx) return
    nctx.drawImage(old, 0, 0, width, height)
    this.frozenCanvas = next
    this.frozenCtx = nctx
  }

  private freezeCurrentStroke() {
    this.ensureFrozenLayer()
    if (!this.frozenCtx || !this.frozenCanvas) return
    this.renderActiveStroke(this.frozenCtx, performance.now(), 1)
  }

  private renderActiveStroke(ctx: CanvasRenderingContext2D, now: number, fadeAlpha: number) {
    if (this.count < 2) return
    const life = this.computeLife(now)
    const speed = this.computeSpeedWeight()
    const pulse = this.persistTrail ? 1 : 0.9 + 0.1 * Math.sin(now * 0.028)
    const motion = (0.76 + speed * 0.7 + this.swingBoost * 0.3) * pulse
    const opacityMul = Math.min(1, life * fadeAlpha)

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'

    // Continuous smooth path to avoid bead-like white dots from per-segment round caps.
    const glowW = BASE_WIDTH * (2.05 + motion * 0.64)
    const coreW = BASE_WIDTH * (0.78 + motion * 0.28)
    const edgeW = BASE_WIDTH * (0.42 + motion * 0.18)
    ctx.lineWidth = glowW
    ctx.strokeStyle = `rgba(154, 195, 255, ${Math.min(0.46, (0.14 + speed * 0.14) * opacityMul)})`
    if (this.traceSmoothPath(ctx, 0, this.count - 1)) ctx.stroke()

    // Subtle side transition so the blade edge is not too harsh.
    ctx.lineWidth = coreW
    ctx.strokeStyle = `rgba(236, 242, 255, ${Math.min(0.98, (0.56 + speed * 0.3) * opacityMul)})`
    if (this.traceSmoothPath(ctx, 0, this.count - 1)) ctx.stroke()

    const tipStart = Math.max(0, this.count - 18)
    ctx.lineWidth = edgeW
    ctx.strokeStyle = `rgba(245, 250, 255, ${Math.min(0.98, (0.68 + this.swingBoost * 0.2) * opacityMul)})`
    if (this.traceSmoothPath(ctx, tipStart, this.count - 1)) ctx.stroke()
    this.drawSharpEnds(ctx, glowW, `rgba(154, 195, 255, ${Math.min(0.34, (0.1 + speed * 0.12) * opacityMul)})`)
    this.drawSharpEnds(ctx, coreW, `rgba(236, 242, 255, ${Math.min(0.95, (0.5 + speed * 0.26) * opacityMul)})`)
    this.drawSharpEnds(ctx, edgeW, `rgba(248, 252, 255, ${Math.min(0.98, (0.62 + speed * 0.2) * opacityMul)})`)
  }

  private drawSharpEnds(ctx: CanvasRenderingContext2D, width: number, fillStyle: string) {
    if (this.count < 2) return
    const i0 = this.head
    const i1 = (this.head + 1) % MAX_POINTS
    const iN = (this.head + this.count - 1) % MAX_POINTS
    const iP = (this.head + this.count - 2) % MAX_POINTS

    const x0 = this.xs[i0]
    const y0 = this.ys[i0]
    const x1 = this.xs[i1]
    const y1 = this.ys[i1]
    const xP = this.xs[iP]
    const yP = this.ys[iP]
    const xN = this.xs[iN]
    const yN = this.ys[iN]

    const sx = x1 - x0
    const sy = y1 - y0
    const sLen = Math.hypot(sx, sy)
    const ex = xN - xP
    const ey = yN - yP
    const eLen = Math.hypot(ex, ey)
    if (sLen < 1e-3 || eLen < 1e-3) return

    const snx = sx / sLen
    const sny = sy / sLen
    const enx = ex / eLen
    const eny = ey / eLen
    const half = width * 0.5
    const tailLen = Math.max(2.5, width * 1.35)
    const tipLen = Math.max(3, width * 1.8)

    const spx = -sny
    const spy = snx
    const epx = -eny
    const epy = enx

    const tailApexX = x0 - snx * tailLen
    const tailApexY = y0 - sny * tailLen
    const tailLx = x0 + spx * half
    const tailLy = y0 + spy * half
    const tailRx = x0 - spx * half
    const tailRy = y0 - spy * half

    const tipApexX = xN + enx * tipLen
    const tipApexY = yN + eny * tipLen
    const tipLx = xN + epx * half
    const tipLy = yN + epy * half
    const tipRx = xN - epx * half
    const tipRy = yN - epy * half

    ctx.fillStyle = fillStyle
    ctx.beginPath()
    ctx.moveTo(tailApexX, tailApexY)
    ctx.lineTo(tailLx, tailLy)
    ctx.lineTo(tailRx, tailRy)
    ctx.closePath()
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(tipApexX, tipApexY)
    ctx.lineTo(tipLx, tipLy)
    ctx.lineTo(tipRx, tipRy)
    ctx.closePath()
    ctx.fill()
  }

  private traceSmoothPath(ctx: CanvasRenderingContext2D, startOffset: number, endOffset: number) {
    const span = endOffset - startOffset + 1
    if (span < 2) return false

    const idx = (off: number) => (this.head + off) % MAX_POINTS
    const first = idx(startOffset)
    const last = idx(endOffset)
    ctx.beginPath()
    ctx.moveTo(this.xs[first], this.ys[first])
    if (span === 2) {
      ctx.lineTo(this.xs[last], this.ys[last])
      return true
    }
    for (let off = startOffset + 1; off < endOffset; off++) {
      const cur = idx(off)
      const next = idx(off + 1)
      const cx = this.xs[cur]
      const cy = this.ys[cur]
      const mx = (cx + this.xs[next]) * 0.5
      const my = (cy + this.ys[next]) * 0.5
      ctx.quadraticCurveTo(cx, cy, mx, my)
    }
    ctx.lineTo(this.xs[last], this.ys[last])
    return true
  }

  private computeSpeedWeight() {
    if (this.count < 2) return 0
    let total = 0
    for (let k = 1; k < this.count; k++) {
      const i0 = (this.head + k - 1) % MAX_POINTS
      const i1 = (this.head + k) % MAX_POINTS
      total += Math.hypot(this.xs[i1] - this.xs[i0], this.ys[i1] - this.ys[i0])
    }
    const avg = total / Math.max(1, this.count - 1)
    return Math.min(1, avg / SPEED_NORM)
  }

  private computeLife(now: number) {
    if (this.persistTrail) return 1
    if (this.count < 2) return 0
    const first = this.head
    const last = (this.head + this.count - 1) % MAX_POINTS
    const firstLife = Math.max(0, 1 - (now - this.ts[first]) / TRAIL_LIFE_MS)
    const lastLife = Math.max(0, 1 - (now - this.ts[last]) / TRAIL_LIFE_MS)
    return Math.max(0, Math.min(1, firstLife * 0.35 + lastLife * 0.65))
  }

  dispose() {
    this.canvas.remove()
  }
}
