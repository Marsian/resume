/**
 * Screen-space blade trail on a separate 2D canvas stacked above the WebGL layer.
 * Avoids depth tests, transparent sort, and scene fog that made the Line2 trail
 * disappear behind fruits after they spawned.
 */
const MAX_POINTS = 180
/** Min move in CSS pixels before adding a sample */
const MIN_DIST_SQ = 2.5 * 2.5

export class BladeTrailOverlay2d {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private layoutRect: DOMRect | null = null
  private dpr = 1
  private readonly xs = new Float32Array(MAX_POINTS)
  private readonly ys = new Float32Array(MAX_POINTS)
  private head = 0
  private count = 0

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

  resize(cssWidth: number, cssHeight: number) {
    this.dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const w = Math.max(1, Math.floor(cssWidth * this.dpr))
    const h = Math.max(1, Math.floor(cssHeight * this.dpr))
    this.canvas.width = w
    this.canvas.height = h
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    if (this.count >= 2) this.paint()
  }

  pushScreenPoint(clientX: number, clientY: number) {
    const r = this.layoutRect
    if (!r || r.width < 8 || r.height < 8) return
    const x = clientX - r.left
    const y = clientY - r.top
    if (this.count > 0) {
      const li = (this.head + this.count - 1) % MAX_POINTS
      const dx = x - this.xs[li]
      const dy = y - this.ys[li]
      if (dx * dx + dy * dy < MIN_DIST_SQ) return
    }
    if (this.count < MAX_POINTS) {
      const w = (this.head + this.count) % MAX_POINTS
      this.xs[w] = x
      this.ys[w] = y
      this.count++
    } else {
      this.head = (this.head + 1) % MAX_POINTS
      const w = (this.head + this.count - 1) % MAX_POINTS
      this.xs[w] = x
      this.ys[w] = y
    }
    if (this.count >= 2) this.paint()
  }

  clear() {
    this.head = 0
    this.count = 0
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  fade() {
    this.head = 0
    this.count = 0
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /** Kept for API parity with the old Three.js trail; 2D path repaints in pushScreenPoint. */
  tick() {}

  private paint() {
    if (this.count < 2) return
    const ctx = this.ctx
    const W = this.canvas.width
    const H = this.canvas.height
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 4.2
    ctx.strokeStyle = 'rgba(255, 246, 204, 0.94)'
    ctx.shadowColor = 'rgba(255, 210, 120, 0.5)'
    ctx.shadowBlur = 12
    ctx.beginPath()
    const i0 = this.head
    ctx.moveTo(this.xs[i0], this.ys[i0])
    for (let k = 1; k < this.count; k++) {
      const i = (this.head + k) % MAX_POINTS
      ctx.lineTo(this.xs[i], this.ys[i])
    }
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  dispose() {
    this.canvas.remove()
  }
}
