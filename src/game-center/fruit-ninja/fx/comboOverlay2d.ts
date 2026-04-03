/**
 * Short-lived combo labels in screen space (container-relative), above the blade trail.
 */
const MAX_POPUPS = 12
const DEFAULT_LIFE_MS = 520
const RISE_PX_PER_MS = 0.045

export type ComboPopup = {
  x: number
  y: number
  text: string
  born: number
  lifeMs: number
}

export class ComboOverlay2d {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private layoutRect: DOMRect | null = null
  private dpr = 1
  private readonly items: ComboPopup[] = []

  constructor(parent: HTMLElement) {
    const c = document.createElement('canvas')
    c.className = 'absolute inset-0 h-full w-full pointer-events-none'
    c.style.zIndex = '3'
    c.setAttribute('aria-hidden', 'true')
    const ctx = c.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('Combo overlay: getContext("2d") failed')
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
    this.paint(performance.now())
  }

  /** Screen-space coords relative to layout rect (same as trail overlay). */
  pushCombo(x: number, y: number, combo: number, now = performance.now()) {
    if (combo < 2) return
    const text = `×${combo} COMBO`
    if (this.items.length >= MAX_POPUPS) this.items.shift()
    this.items.push({ x, y, text, born: now, lifeMs: DEFAULT_LIFE_MS })
    this.paint(now)
  }

  tick(now: number) {
    if (this.items.length === 0) return
    let changed = false
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (now - this.items[i]!.born >= this.items[i]!.lifeMs) {
        this.items.splice(i, 1)
        changed = true
      }
    }
    if (changed || this.items.length > 0) this.paint(now)
  }

  private paint(now: number) {
    const ctx = this.ctx
    const W = this.canvas.width
    const H = this.canvas.height
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    if (this.items.length === 0) return
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.font = 'bold 22px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const it of this.items) {
      const t = (now - it.born) / it.lifeMs
      const alpha = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.25) / 0.75)
      const dy = (now - it.born) * RISE_PX_PER_MS
      const x = it.x
      const y = it.y - dy
      ctx.strokeStyle = `rgba(0,0,0,${0.55 * alpha})`
      ctx.lineWidth = 4
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeText(it.text, x, y)
      ctx.fillStyle = `rgba(255, 235, 80, ${alpha})`
      ctx.fillText(it.text, x, y)
    }
  }

  dispose() {
    this.canvas.remove()
  }
}
