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

// ---------------------------------------------------------------------------
// Apple skin: wiki-accurate cartoon apple texture.
// UV: u = azimuth around Y (0–1), v = colatitude/π (0=top pole/stem, 1=bottom).
//
// Visual zones (from wiki reference):
//   v ≈ 0.00–0.08 : stem cavity — dark brown/very dark red
//   v ≈ 0.08–0.20 : yellow-green blush zone near stem
//   v ≈ 0.20–0.75 : main red body with subtle vertical streaks + speckle
//   v ≈ 0.75–0.92 : lower body, slightly deeper red
//   v ≈ 0.92–1.00 : bottom indent — dark
//
// No baked lighting, no highlights — pure color/texture only.
// ---------------------------------------------------------------------------

let appleSkinTex: THREE.CanvasTexture | null = null
export function appleSkinTexture(): THREE.CanvasTexture {
  if (appleSkinTex) return appleSkinTex
  const s = 512
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  const data = img.data

  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1) // 0 = top (stem), 1 = bottom
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1) // 0–1 around azimuth

      // --- Zone determination based on v (latitude) ---
      // Cavities: tiny top/bottom zones are darker red-brown.
      // Keep the dark cavity extremely small so the yellow ring is visible.
      const inStemCavity = smoothstep(0.020, 0.004, tv)
      const inBottomCavity = smoothstep(1.0, 0.988, tv)

      // Top yellow-green area surrounding the stem cavity (wiki reference) — make it strong & visible.
      // Make the top ring large enough to be visible even on side views.
      const topHalo = smoothstep(0.02, 0.22, tv) * (1 - smoothstep(0.42, 0.55, tv))
      // Very small reddish-green tint only near the very top edge (subtle).
      const topBlushEdge = 0.070 + 0.015 * fbm(tu * 10 + 5.5, tv * 7 + 1.2)
      const inTopBlush = smoothstep(0.040, topBlushEdge, tv) * (1 - smoothstep(topBlushEdge, topBlushEdge + 0.025, tv))

      const bottomBlushEdge = 0.930 + 0.015 * fbm(tu * 9 + 8.2, tv * 8 + 4.7)
      const inBottomBlush =
        smoothstep(bottomBlushEdge, 1.0, tv) *
        (1 - smoothstep(0.970, 1.0, tv))

      const inLower = smoothstep(0.86, 0.92, tv) * (1 - smoothstep(0.97, 1.0, tv))

      // --- FBM noise for organic variation ---
      const n1 = fbm(tu * 8 + 2.1, tv * 10 + 3.4)
      const n2 = fbm(tu * 20 + 7.3, tv * 24 + 5.8)

      // --- Vertical streaks (apple skin fiber direction, following meridians) ---
      const streakNoise = fbm(tu * 50 + 1.5, tv * 2 + 2.0)

      // --- Speckle ---
      const speck = hash21(px + 53, py + 29)
      const speckMul = speck < 0.035 ? 0.88 : speck > 0.975 ? 1.06 : 1.0

      let r: number, gg: number, b: number

      if (inStemCavity > 0.5) {
        // Stem cavity: dark red-brown (avoid green cast)
        r = 62 + 14 * n1
        gg = 28 + 10 * n1
        b = 22 + 8 * n1
      } else if (inBottomCavity > 0.5) {
        // Bottom indent: dark red-brown (avoid green cast)
        r = 58 + 14 * n1
        gg = 26 + 10 * n1
        b = 22 + 8 * n1
      } else {
        // --- Wiki-like painted apple body ---
        // Palette sampled directly from `wiki-apple-reference.png` pixels (ffmpeg crop 1×1):
        // - deep red body:   #760000
        // - mid red body:    #860400
        // - orange paint:    #e16b1c / #d86c19
        // - top yellow:      #e7d134
        // - top yellow-green:#e7b22f / #d8ce2d
        // - cavity dark:     #ca4411
        const deepR = 0x76, deepG = 0x00, deepB = 0x00
        // Brighter base red sampled near the stem edge (#c83610) so the apple reads red at thumbnail scale.
        const baseR = 0xc8, baseG = 0x36, baseB = 0x10
        const midR = 0xe1, midG = 0x6b, midB = 0x1c
        const hiR = 0xd8, hiG = 0x6c, hiB = 0x19
        const topY0R = 0xe7, topY0G = 0xd1, topY0B = 0x34
        const topY1R = 0xe7, topY1G = 0xb2, topY1B = 0x2f
        const blushR = 0xd8, blushG = 0xce, blushB = 0x2d
        const btmBlushR = 0xca, btmBlushG = 0x44, btmBlushB = 0x11

        // Patch fields (broad shapes like the reference)
        const p0 = fbm(tu * 3.3 + 1.1, tv * 3.8 + 2.4)
        const p1 = fbm(tu * 6.5 + 7.9, tv * 5.2 + 1.7)
        const patch = 0.55 * p0 + 0.45 * p1

        // Base mix between deep and main red using patch field.
        const deepMix = smoothstep(0.32, 0.60, patch) * (0.70 + 0.30 * n1)
        r = deepR * deepMix + baseR * (1 - deepMix)
        gg = deepG * deepMix + baseG * (1 - deepMix)
        b = deepB * deepMix + baseB * (1 - deepMix)

        // Orange paint patches concentrated more near the top half.
        const topBias = 1 - smoothstep(0.45, 0.78, tv)
        const orangeMask = smoothstep(0.52, 0.70, patch + 0.12 * topBias + 0.06 * (streakNoise - 0.5))
        r = r * (1 - orangeMask) + midR * orangeMask
        gg = gg * (1 - orangeMask) + midG * orangeMask
        b = b * (1 - orangeMask) + midB * orangeMask

        // Lighter yellow/orange "drips" near the top (stylized like the reference).
        const drip = smoothstep(0.68, 0.86, fbm(tu * 2.2 + 4.7, tv * 7.5 + 9.1) + 0.18 * topBias)
        const hiMask = drip * (0.65 + 0.35 * topBias)
        r = r * (1 - hiMask) + hiR * hiMask
        gg = gg * (1 - hiMask) + hiG * hiMask
        b = b * (1 - hiMask) + hiB * hiMask

        // Top yellow-green halo around the stem cavity.
        const haloN = fbm(tu * 8 + 1.7, tv * 12 + 3.1)
        const haloMix = Math.min(1, topHalo * (1.15 + 0.25 * haloN))
        const topR = topY0R * (1 - haloN) + topY1R * haloN
        const topG = topY0G * (1 - haloN) + topY1G * haloN
        const topB = topY0B * (1 - haloN) + topY1B * haloN
        r = r * (1 - haloMix) + topR * haloMix
        gg = gg * (1 - haloMix) + topG * haloMix
        b = b * (1 - haloMix) + topB * haloMix

        // Hard-guarantee a visible top yellow/green band in thumbnails.
        const topBand = smoothstep(0.02, 0.14, tv) * (1 - smoothstep(0.38, 0.50, tv))
        r = r * (1 - topBand) + topR * topBand
        gg = gg * (1 - topBand) + topG * topBand
        b = b * (1 - topBand) + topB * topBand

        // Tiny olive tint at extreme top edge only.
        r = r * (1 - inTopBlush) + blushR * inTopBlush
        gg = gg * (1 - inTopBlush) + blushG * inTopBlush
        b = b * (1 - inTopBlush) + blushB * inTopBlush

        // Bottom orange/red band near the bottom indent (make it clearly visible).
        const bottomBand = smoothstep(0.72, 0.88, tv) * (1 - smoothstep(0.97, 1.0, tv))
        const bottomMix = Math.min(1, Math.max(inBottomBlush, bottomBand) * 0.95)
        r = r * (1 - bottomMix) + btmBlushR * bottomMix
        gg = gg * (1 - bottomMix) + btmBlushG * bottomMix
        b = b * (1 - bottomMix) + btmBlushB * bottomMix

        // Slightly deeper red toward the bottom like the reference.
        const lowerR = 170, lowerG = 12, lowerB = 12
        r = r * (1 - inLower) + lowerR * inLower
        gg = gg * (1 - inLower) + lowerG * inLower
        b = b * (1 - inLower) + lowerB * inLower

        // Vertical streaks (subtle)
        const stk = 0.92 + 0.10 * streakNoise
        r *= stk
        gg *= stk
        b *= stk

        // Speckle
        r *= speckMul
        gg *= speckMul
        b *= speckMul

        // Transition smoothing near stem cavity edge (very narrow)
        const cavityFade = smoothstep(0.02, 0.06, tv)
        r = r * cavityFade + (62 + 14 * n1) * (1 - cavityFade)
        gg = gg * cavityFade + (28 + 10 * n1) * (1 - cavityFade)
        b = b * cavityFade + (22 + 8 * n1) * (1 - cavityFade)

        // Transition smoothing near bottom cavity edge (very narrow)
        const bottomFade = 1 - smoothstep(0.965, 0.99, tv)
        r = r * bottomFade + (58 + 14 * n1) * (1 - bottomFade)
        gg = gg * bottomFade + (26 + 10 * n1) * (1 - bottomFade)
        b = b * bottomFade + (22 + 8 * n1) * (1 - bottomFade)
      }

      // Very gentle pole smoothing
      const sinV = Math.sin(tv * Math.PI)
      const poleFactor = 0.97 + 0.03 * sinV
      r *= poleFactor
      gg *= poleFactor
      b *= poleFactor

      // Apple uses `toneMapped: false` — boost slightly for visibility in thumbnails.
      const gain = 1.9
      r *= gain
      gg *= gain
      b *= gain

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
  tex.wrapT = THREE.ClampToEdgeWrapping
  // Keep small color zones (top yellow ring) visible in thumbnails:
  // mipmaps would average yellow+red into brown at small screen sizes.
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 2
  tex.needsUpdate = true
  appleSkinTex = tex
  return tex
}
