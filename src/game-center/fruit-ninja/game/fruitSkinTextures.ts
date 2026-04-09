import * as THREE from 'three'

/**
 * Watermelon: longitudinal stripes vary with mesh u (azimuth); v modulates width / warp toward poles.
 * FBM warps boundaries (wiki-style jagged edges). Luminance kept nearly flat; stripes carry value contrast.
 * Seamless in u for RepeatWrapping.
 */

function fract(x: number): number {
  return x - Math.floor(x)
}

function hash21(ix: number, iy: number): number {
  return fract(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123)
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const xf = x - x0
  const yf = y - y0
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const a = hash21(x0, y0)
  const b = hash21(x0 + 1, y0)
  const c = hash21(x0, y0 + 1)
  const d = hash21(x0 + 1, y0 + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

function fbm(x: number, y: number): number {
  let sum = 0
  let amp = 0.5
  let f = 1
  for (let i = 0; i < 5; i++) {
    sum += amp * valueNoise(x * f, y * f)
    f *= 2
    amp *= 0.5
  }
  return sum
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

let watermelonStripeTex: THREE.CanvasTexture | null = null
export function watermelonStripeTexture(): THREE.CanvasTexture {
  if (watermelonStripeTex) return watermelonStripeTex
  const s = 512
  const warp = new Float32Array(s * s)
  const mottle = new Float32Array(s * s)
  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1)
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1)
      const i = py * s + px
      warp[i] =
        fbm(tu * 9 + 2.7, tv * 11 + 1.3) * 2.15 +
        fbm(tu * 23 + 8.1, tv * 29 + 4.2) * 1.05 +
        fbm(tu * 47, tv * 53) * 0.48
      mottle[i] = fbm(tu * 38 + 11, tv * 42 + 7) * 0.55 + fbm(tu * 91, tv * 88) * 0.35
    }
  }

  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  const data = img.data

  /** ~10 dark bands around full equator (wiki: ~5–6 per visible hemisphere). */
  const stripePeriods = 10

  const br = 0x52
  const bg = 0xb8
  const bb = 0x5a
  const dr = 0x0c
  const dg = 0x38
  const db = 0x12

  /** Fake key light like wiki (upper-right on the fruit). */
  const lx = 0.5
  const ly = 0.72
  const lz = 0.48
  const llen = Math.hypot(lx, ly, lz)
  const Lx = lx / llen
  const Ly = ly / llen
  const Lz = lz / llen

  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1)
    const sinV = Math.sin(tv * Math.PI)
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1)
      const i = py * s + px
      const w = (warp[i]! - 1.65) * 1.05
      const phase = tu * stripePeriods * Math.PI * 2 + w + 0.35 * Math.sin(tv * Math.PI * 2 * stripePeriods)
      const edgeChaos = 0.22 * Math.sin(tu * Math.PI * 2 * 17 + tv * 49 * Math.PI)
      const cosB = Math.cos(phase + edgeChaos)
      /** Sharper dark/light split, still irregular from warp. */
      let t = smoothstep(0.42, -0.38, cosB)
      t = t * t * (3 - 2 * t)

      const phi = tv * Math.PI
      const th = tu * Math.PI * 2
      const nx = Math.sin(phi) * Math.cos(th)
      const ny = Math.cos(phi)
      const nz = Math.sin(phi) * Math.sin(th)
      let ndotl = nx * Lx + ny * Ly + nz * Lz
      ndotl = Math.max(0, ndotl)
      /** Flat, slightly subdued value (no strong lights). */
      const baked = 0.74 + 0.07 * Math.pow(ndotl, 0.55)
      const fill = 0.97 + 0.03 * ny
      const lighting = baked * fill

      let r = br * (1 - t) + dr * t
      let gg = bg * (1 - t) + dg * t
      let b = bb * (1 - t) + db * t

      r *= lighting
      gg *= lighting
      b *= lighting

      /** Mottle / speckle mostly in light bands (wiki light-green areas). */
      if (t < 0.55) {
        const m = mottle[i]!
        const speck = 0.92 + 0.12 * m + 0.06 * (hash21(px, py) - 0.5)
        r *= speck
        gg *= speck
        b *= speck
        const h = hash21(px + 31, py + 17)
        if (h < 0.045) {
          r *= 0.86
          gg *= 0.88
          b *= 0.86
        }
        if (h > 0.97) {
          r = Math.min(255, r + 8)
          gg = Math.min(255, gg + 10)
          b = Math.min(255, b + 6)
        }
      } else {
        /** Thin highlight flecks on dark stripes. */
        if (hash21(px * 2, py * 2) > 0.992) {
          r = Math.min(255, r * 1.02 + 2)
          gg = Math.min(255, gg * 1.02 + 2)
        }
      }

      const pole = 0.98 + 0.02 * sinV
      r *= pole
      gg *= pole
      b *= pole

      const idx = i * 4
      data[idx] = Math.round(Math.max(0, Math.min(255, r)))
      data[idx + 1] = Math.round(Math.max(0, Math.min(255, gg)))
      data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      data[idx + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.repeat.set(1, 1)
  tex.anisotropy = 8
  watermelonStripeTex = tex
  return tex
}

/**
 * TubeGeometry UV: u (texture x) = along curve stem→tip; v (texture y) = around circumference.
 * Bright cartoon yellow; stem green; blossom brown; sparse specks; mild hex ridges.
 */
let bananaSkinTex: THREE.CanvasTexture | null = null
export function bananaSkinTexture(): THREE.CanvasTexture {
  if (bananaSkinTex) return bananaSkinTex
  const s = 512
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  const data = img.data

  const br = 248
  const bg = 224
  const bb = 78
  const sr = 188
  const sg = 212
  const sb = 92
  const tr = 118
  const tg = 92
  const tb = 48

  const lx = 0.48
  const ly = 0.74
  const lz = 0.46
  const llen = Math.hypot(lx, ly, lz)
  const Lx = lx / llen
  const Ly = ly / llen
  const Lz = lz / llen

  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1)
    const nx = Math.cos(tv * Math.PI * 2)
    const nz = Math.sin(tv * Math.PI * 2)
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1)
      /** Mesh tube: uv.x=0 at curve start (blossom end), uv.x=1 at stem — match wiki stem green at top. */
      const stemTipU = 1 - tu
      const stemMix =
        smoothstep(0.22, 0.035, stemTipU) * (1 - smoothstep(0.8, 0.97, stemTipU))
      const tipMix = smoothstep(0.78, 0.97, stemTipU)

      let r = br
      let gg = bg
      let b = bb
      r = r * (1 - stemMix) + sr * stemMix
      gg = gg * (1 - stemMix) + sg * stemMix
      b = b * (1 - stemMix) + sb * stemMix
      r = r * (1 - tipMix) + tr * tipMix
      gg = gg * (1 - tipMix) + tg * tipMix
      b = b * (1 - tipMix) + tb * tipMix

      const ridge = 0.978 + 0.022 * Math.cos(tv * Math.PI * 2 * 6)
      const blot = (fbm(tu * 11 + 2.1, tv * 15 + 3.4) - 0.5) * 10
      r += blot
      gg += blot * 0.95
      b += blot * 0.35

      const h = hash21(px + 41, py + 19)
      if (h < 0.028) {
        r *= 0.9
        gg *= 0.91
        b *= 0.85
      }
      if (h > 0.985 && stemTipU > 0.12 && stemTipU < 0.9) {
        r = Math.min(255, r + 14)
        gg = Math.min(255, gg + 16)
        b = Math.min(255, b + 8)
      }

      const ny = 0.22
      let ndotl = nx * Lx + ny * Ly + nz * Lz
      ndotl = Math.max(0, ndotl)
      const lit = 0.86 + 0.05 * Math.pow(ndotl, 0.55)
      const fill = 0.99 + 0.01 * (0.5 - tv) * 0.5
      const lighting = lit * fill * ridge

      r *= lighting
      gg *= lighting
      b *= lighting

      const idx = (py * s + px) * 4
      data[idx] = Math.round(Math.max(0, Math.min(255, r)))
      data[idx + 1] = Math.round(Math.max(0, Math.min(255, gg)))
      data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      data[idx + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1.15, 1)
  tex.anisotropy = 8
  bananaSkinTex = tex
  return tex
}
