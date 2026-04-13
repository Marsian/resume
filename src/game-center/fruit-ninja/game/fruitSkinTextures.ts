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

/** Call after editing apple skin generation so the next `appleSkinTexture()` rebuilds the canvas. */
export function resetAppleSkinTextureCache(): void {
  appleSkinTex = null
}

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
      // Cavity starts at h > 0.80, UV zone is tv < ~0.20.
      const inStemCavity = smoothstep(0.015, 0.003, tv)
      const inBottomCavity = smoothstep(0.990, 1.0, tv)

      // Top yellow-green area — tiny zone near stem (wiki: ~5% of visible surface).
      const topHalo = smoothstep(0.04, 0.06, tv) * (1 - smoothstep(0.08, 0.11, tv))
      // Very small reddish-green tint at the cavity edge.
      const topBlushEdge = 0.035 + 0.010 * fbm(tu * 10 + 5.5, tv * 7 + 1.2)
      const inTopBlush = smoothstep(0.025, topBlushEdge, tv) * (1 - smoothstep(topBlushEdge, topBlushEdge + 0.015, tv))

      const bottomBlushEdge = 0.940 + 0.015 * fbm(tu * 9 + 8.2, tv * 8 + 4.7)
      const inBottomBlush =
        smoothstep(bottomBlushEdge, 1.0, tv) *
        (1 - smoothstep(0.975, 1.0, tv))

      const inLower = smoothstep(0.88, 0.94, tv) * (1 - smoothstep(0.98, 1.0, tv))

      // --- FBM noise for organic variation ---
      const n1 = fbm(tu * 8 + 2.1, tv * 10 + 3.4)
      const n2 = fbm(tu * 20 + 7.3, tv * 24 + 5.8)

      // --- Vertical streaks (apple skin fiber direction, following meridians) ---
      const streakNoise = fbm(tu * 50 + 1.5, tv * 2 + 2.0)

      // --- Speckle ---
      const speck = hash21(px + 53, py + 29)
      const speckMul = speck < 0.035 ? 0.88 : speck > 0.975 ? 1.06 : 1.0

      // Wiki-style lighting: top-front light source (matches reference).
      const phi = tv * Math.PI
      const th = tu * Math.PI * 2
      const nx = Math.sin(phi) * Math.cos(th)
      const ny = Math.cos(phi)
      const nz = Math.sin(phi) * Math.sin(th)
      const Lx = 0.15
      const Ly = 0.85
      const Lz = 0.50
      const llen = Math.hypot(Lx, Ly, Lz)
      let ndotl = nx * (Lx / llen) + ny * (Ly / llen) + nz * (Lz / llen)
      ndotl = Math.max(0, ndotl)
      // Broad diffuse fill + tighter specular highlight near top-front.
      const diffBoost = Math.pow(ndotl, 1.0) * 0.40
      // Tight specular: white highlight spot (wiki: small bright spot, not yellow wash).
      const specRaw = Math.pow(ndotl, 4) * 0.30 + Math.pow(ndotl, 12) * 0.20
      // Concentrate specular in a small region near top-front only.
      const specFalloff = smoothstep(0.30, 0.08, tv)
      const specBoost = specRaw * specFalloff
      const wedge = 0.5 + 0.5 * Math.sin(th * 3 + fbm(tu * 4 + 1.2, tv * 5.2) * 1.4)

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
        // Wiki apple palette (bright saturated crimson, NOT maroon):
        // - deep body:    #AA0808 (bottom/side shadow)
        // - bright body:  #E82018 (main visible crimson)
        // - top yellow:   #FFE064 (pale yellow highlight)
        // - top yellow-g: #E7B22F (yellow-green transition)
        const deepR = 0xaa, deepG = 0x08, deepB = 0x06
        const baseR = 0xe8, baseG = 0x1c, baseB = 0x14
        const topY0R = 0xff, topY0G = 0xe0, topY0B = 0x64
        const topY1R = 0xe7, topY1G = 0xb2, topY1B = 0x2f
        const blushR = 0xd8, blushG = 0xce, blushB = 0x2d

        // --- Latitude gradient: deep red at bottom → bright crimson at top ---
        // smoothstep covers the full body range for a clear visible gradient.
        const latFactor = smoothstep(0.78, 0.18, tv)
        r = deepR + (baseR - deepR) * latFactor
        gg = deepG + (baseG - deepG) * latFactor
        b = deepB + (baseB - deepB) * latFactor

        // Subtle FBM noise variation — small, keeps body uniformly crimson.
        r += 10 * (n1 - 0.5)
        gg += 3 * (n1 - 0.5)
        b += 2 * (n1 - 0.5)

        // Apply baked diffuse lighting (was computed but never used!).
        const lighting = 1.0 + diffBoost
        r *= lighting
        gg *= lighting
        b *= lighting

        // Slightly deeper red toward the very bottom.
        r = r * (1 - inLower) + 110 * inLower

        // Top yellow-green halo (wiki: ~5% of visible surface near stem).
        const haloN = fbm(tu * 8 + 1.7, tv * 12 + 3.1)
        const haloMix = Math.min(1, topHalo * (1.2 + 0.30 * haloN))
        const topR = topY0R * (1 - haloN) + topY1R * haloN
        const topG = topY0G * (1 - haloN) + topY1G * haloN
        const topB = topY0B * (1 - haloN) + topY1B * haloN
        r = r * (1 - haloMix) + topR * haloMix
        gg = gg * (1 - haloMix) + topG * haloMix
        b = b * (1 - haloMix) + topB * haloMix

        // Hard-guarantee tiny top yellow band (wiki: ~5% near stem).
        const topBand = smoothstep(0.04, 0.06, tv) * (1 - smoothstep(0.09, 0.12, tv))
        r = r * (1 - topBand) + topR * topBand
        gg = gg * (1 - topBand) + topG * topBand
        b = b * (1 - topBand) + topB * topBand

        // Continuous yellow→red gradient near stem — smooth, no bands.
        // t=0 at stem (yellow), t=1 at body (red), with noise for organic edge.
        const gradNoise = fbm(tu * 5 + 2.1, tv * 7 + 1.3) * 0.04
        const gradT = Math.min(1, Math.max(0, smoothstep(0.04, 0.22, tv + gradNoise)))
        // Interpolate R/G/B continuously: yellow (#FFE064) → orange (#E87020) → red (#E81C14)
        // R stays high throughout; G and B fade from yellow-green to near-zero.
        const gradR = 0xff - (0xff - 0xe8) * gradT
        const gradG = 0xe0 * (1 - gradT) + 0x1c * gradT
        const gradB = 0x64 * (1 - gradT) + 0x14 * gradT
        // Blend on top of existing body colour; stronger near stem, fades to 0.
        const gradMask = smoothstep(0.22, 0.04, tv) * (0.95 + 0.15 * fbm(tu * 7 + 4.1, tv * 9 + 2.7))
        const gm = Math.min(1, gradMask)
        r = r * (1 - gm) + gradR * gm
        gg = gg * (1 - gm) + gradG * gm
        b = b * (1 - gm) + gradB * gm

        // Tiny olive tint at extreme top edge only.
        r = r * (1 - inTopBlush) + blushR * inTopBlush
        gg = gg * (1 - inTopBlush) + blushG * inTopBlush
        b = b * (1 - inTopBlush) + blushB * inTopBlush

        // Subtle vertical streaks (keep hue neutral — don't add green).
        const stk = 0.97 + 0.04 * streakNoise
        r *= stk
        gg *= stk
        b *= stk

        // Speckle
        r *= speckMul
        gg *= speckMul
        b *= speckMul

        // Specular: white highlight spot near top-front.
        r += 255 * specBoost * 0.50
        gg += 255 * specBoost * 0.50
        b += 255 * specBoost * 0.45

        // Stem pole: narrow ring blends toward cavity dark.
        const topPoleMix = (1 - smoothstep(0.026, 0.045, tv)) * smoothstep(0, 0.018, tv)
        const cavityColR = 62 + 14 * n1
        const cavityColG = 28 + 10 * n1
        const cavityColB = 22 + 8 * n1
        const mTop = Math.min(1, topPoleMix * 0.92)
        r = r * (1 - mTop) + cavityColR * mTop
        gg = gg * (1 - mTop) + cavityColG * mTop
        b = b * (1 - mTop) + cavityColB * mTop

        // Bottom cavity rim (narrow)
        const botPoleMix = (1 - smoothstep(0.972, 0.995, tv)) * smoothstep(0.956, 0.978, tv)
        const mBot = Math.min(1, botPoleMix * 0.88)
        r = r * (1 - mBot) + (58 + 14 * n1) * mBot
        gg = gg * (1 - mBot) + (26 + 10 * n1) * mBot
        b = b * (1 - mBot) + (22 + 8 * n1) * mBot
      }

      // Very gentle pole smoothing
      const sinV = Math.sin(tv * Math.PI)
      const poleFactor = 0.985 + 0.015 * sinV
      r *= poleFactor
      gg *= poleFactor
      b *= poleFactor

      // Apple uses `toneMapped: false` — no gain needed; base colors are already calibrated.
      // Any gain clips the red channel to 255, destroying the top-bottom gradient.
      const gain = 1.0
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
  tex.flipY = false // canvas row 0 (tv=0, stem) must map to UV v=0 → mesh top pole
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

// ---------------------------------------------------------------------------
// Lemon skin: wiki-accurate bumpy yellow lemon texture.
// UV: u = azimuth around Y (0–1), v = colatitude/π (0=top pole/nub, 1=bottom).
//
// Visual zones (from wiki reference):
//   v ≈ 0.00–0.08 : top nub — olive-green tip
//   v ≈ 0.08–0.18 : top transition — green-yellow blend with noise edge
//   v ≈ 0.18–0.82 : main body — warm bright yellow with subtle bumpy texture
//   v ≈ 0.82–0.92 : bottom transition — green-yellow blend with noise edge
//   v ≈ 0.92–1.00 : bottom nub — olive-green tip
//
// Key features: subtle bumpy skin texture, green tint at both tips,
// smooth cartoon-like appearance, organic color variation via FBM.
// ---------------------------------------------------------------------------

let lemonSkinTex: THREE.CanvasTexture | null = null

/** Call after editing lemon skin generation so the next `lemonSkinTexture()` rebuilds the canvas. */
export function resetLemonSkinTextureCache(): void {
  lemonSkinTex = null
}

export function lemonSkinTexture(): THREE.CanvasTexture {
  if (lemonSkinTex) return lemonSkinTex
  const s = 512
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  const data = img.data

  // Palette sampled from wiki lemon reference:
  // - bright yellow body:  #F8E850 (lemon yellow)
  // - warm yellow highlight: #FFF090
  // - deeper yellow shadow: #CCAA20
  // - nub tip (both ends): deep orange-yellow #D89020
  // - transition zone:     warm orange #E8B838
  const bodyR = 0xf8, bodyG = 0xe8, bodyB = 0x50
  const warmR = 0xff, warmG = 0xf0, warmB = 0x90
  const deepR = 0xcc, deepG = 0xaa, deepB = 0x20
  const nubR = 0xd8, nubG = 0x90, nubB = 0x20
  const transR = 0xe8, transG = 0xb8, transB = 0x38

  // Wiki-style lighting: top-front light source
  const lx = 0.15, ly = 0.85, lz = 0.50
  const llen = Math.hypot(lx, ly, lz)
  const Lx = lx / llen, Ly = ly / llen, Lz = lz / llen

  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1) // 0 = top (nub), 1 = bottom
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1) // 0–1 around azimuth

      // --- FBM noise for organic variation ---
      const n1 = fbm(tu * 8 + 2.1, tv * 10 + 3.4)
      const n2 = fbm(tu * 16 + 7.3, tv * 18 + 5.8)

      // --- Bumpy skin texture (subtle lemon peel) ---
      const bumpNoise = fbm(tu * 40 + 3.7, tv * 45 + 5.2)

      // --- Longitudinal ridges (subtle ridges along lemon length) ---
      const ridge = 0.98 + 0.02 * Math.cos(tu * Math.PI * 2 * 10 + n1 * 1.8)

      // --- Continuous tip-to-body gradient (no hard cuts) ---
      // Top: 0=deepest orange, smooth blend to body yellow by ~0.30
      // Bottom: 1=deepest orange, smooth blend to body yellow by ~0.70
      const topTipMix = smoothstep(0.28, 0.02, tv) // 1 at tip, 0 at v=0.28
      const bottomTipMix = smoothstep(0.72, 0.98, tv) // 1 at bottom tip, 0 at v=0.72
      // Add noise to the edge for organic feel
      const topEdgeNoise = fbm(tu * 6 + 1.2, tv * 8 + 2.5) * 0.06
      const botEdgeNoise = fbm(tu * 5 + 3.7, tv * 7 + 4.2) * 0.06
      const topBlend = Math.min(1, Math.max(0, topTipMix + topEdgeNoise))
      const bottomBlend = Math.min(1, Math.max(0, bottomTipMix + botEdgeNoise))

      // --- Latitude color gradient for body ---
      const latFactor = smoothstep(0.80, 0.20, tv)

      // --- Start with body yellow ---
      let r = deepR + (bodyR - deepR) * latFactor
      let gg = deepG + (bodyG - deepG) * latFactor
      let b = deepB + (bodyB - deepB) * latFactor

      // FBM noise variation
      r += 8 * (n1 - 0.5)
      gg += 7 * (n1 - 0.5)
      b += 4 * (n1 - 0.5)

      r += 4 * (n2 - 0.5)
      gg += 3 * (n2 - 0.5)

      // Bumpy texture
      const bumpMul = 0.96 + 0.05 * bumpNoise
      r *= bumpMul
      gg *= bumpMul
      b *= bumpMul * 0.97

      // Longitudinal ridges
      r *= ridge
      gg *= ridge
      b *= ridge

      // Speckle
      const speck = hash21(px + 53, py + 29)
      if (speck < 0.02) {
        r *= 0.94
        gg *= 0.95
        b *= 0.92
      }
      if (speck > 0.985) {
        r = Math.min(255, r + 8)
        gg = Math.min(255, gg + 8)
        b = Math.min(255, b + 3)
      }

      // --- Smooth orange tip blending (replaces hard nub zones) ---
      // Tip color = deep orange-yellow; transition color = warm orange
      const tipR = nubR + 12 * (n1 - 0.5)
      const tipG = nubG + 8 * (n1 - 0.5)
      const tipB = nubB + 6 * (n1 - 0.5)
      const midR = transR + 8 * (n1 - 0.5)
      const midG = transG + 6 * (n1 - 0.5)
      const midB = transB + 4 * (n1 - 0.5)

      // Top blend: body → mid orange → tip orange
      const topMid = smoothstep(0.28, 0.15, tv) // mid transition band
      const topCore = smoothstep(0.15, 0.02, tv) // core tip band
      r = r * (1 - topMid) + midR * topMid
      gg = gg * (1 - topMid) + midG * topMid
      b = b * (1 - topMid) + midB * topMid
      r = r * (1 - topCore) + tipR * topCore
      gg = gg * (1 - topCore) + tipG * topCore
      b = b * (1 - topCore) + tipB * topCore

      // Bottom blend: body → mid orange → tip orange
      const botMid = smoothstep(0.72, 0.85, tv)
      const botCore = smoothstep(0.85, 0.98, tv)
      r = r * (1 - botMid) + midR * botMid
      gg = gg * (1 - botMid) + midG * botMid
      b = b * (1 - botMid) + midB * botMid
      r = r * (1 - botCore) + tipR * botCore
      gg = gg * (1 - botCore) + tipG * botCore
      b = b * (1 - botCore) + tipB * botCore

      // --- Baked lighting (wiki-style: top-front light) ---
      const phi = tv * Math.PI
      const th = tu * Math.PI * 2
      const nx = Math.sin(phi) * Math.cos(th)
      const ny = Math.cos(phi)
      const nz = Math.sin(phi) * Math.sin(th)
      let ndotl = nx * Lx + ny * Ly + nz * Lz
      ndotl = Math.max(0, ndotl)

      // Broad diffuse fill
      const diffBoost = Math.pow(ndotl, 1.0) * 0.32
      // Tight specular highlight near top-front
      const specRaw = Math.pow(ndotl, 5) * 0.26 + Math.pow(ndotl, 14) * 0.14
      const specFalloff = smoothstep(0.38, 0.10, tv)
      const specBoost = specRaw * specFalloff

      const lighting = 1.0 + diffBoost
      r *= lighting
      gg *= lighting
      b *= lighting

      // Specular: warm white highlight
      r += 255 * specBoost * 0.40
      gg += 255 * specBoost * 0.42
      b += 255 * specBoost * 0.25

      // Pole smoothing
      const sinV = Math.sin(tv * Math.PI)
      const poleFactor = 0.988 + 0.012 * sinV
      r *= poleFactor
      gg *= poleFactor
      b *= poleFactor

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
  tex.flipY = false
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 2
  tex.needsUpdate = true
  lemonSkinTex = tex
  return tex
}

// ---------------------------------------------------------------------------
// Lime skin: wiki-accurate bright green lime texture.
// UV: u = azimuth around Y (0–1), v = colatitude/π (0=top pole/nub, 1=bottom).
//
// Visual zones (from wiki reference):
//   v ≈ 0.00–0.06 : top nub — dark green tip
//   v ≈ 0.06–0.16 : top transition — darker green blend with noise edge
//   v ≈ 0.16–0.84 : main body — bright lime green with subtle bumpy texture
//   v ≈ 0.84–0.94 : bottom transition — darker green blend with noise edge
//   v ≈ 0.94–1.00 : bottom nub — dark green tip
//
// Key features: bright lime-green body, darker green tips, subtle bumpy peel
// texture similar to lemon but greener, smooth cartoon-like appearance.
// ---------------------------------------------------------------------------

let limeSkinTex: THREE.CanvasTexture | null = null

/** Call after editing lime skin generation so the next `limeSkinTexture()` rebuilds the canvas. */
export function resetLimeSkinTextureCache(): void {
  limeSkinTex = null
}

export function limeSkinTexture(): THREE.CanvasTexture {
  if (limeSkinTex) return limeSkinTex
  const s = 512
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  const data = img.data

  // Palette sampled from wiki lime reference — deep, dark green:
  // - deep lime green body: #388820
  // - warm green highlight: #58A838
  // - deeper green shadow: #1E6810
  // - nub tip (both ends): dark green #184808
  // - transition zone:     medium green #287818
  const bodyR = 0x38, bodyG = 0x88, bodyB = 0x20
  const warmR = 0x58, warmG = 0xa8, warmB = 0x38
  const deepR = 0x1e, deepG = 0x68, deepB = 0x10
  const nubR = 0x18, nubG = 0x48, nubB = 0x08
  const transR = 0x28, transG = 0x78, transB = 0x18

  // Wiki-style lighting: top-front light source
  const lx = 0.15, ly = 0.85, lz = 0.50
  const llen = Math.hypot(lx, ly, lz)
  const Lx = lx / llen, Ly = ly / llen, Lz = lz / llen

  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1) // 0 = top (nub), 1 = bottom
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1) // 0–1 around azimuth

      // --- FBM noise for organic variation ---
      const n1 = fbm(tu * 8 + 2.1, tv * 10 + 3.4)
      const n2 = fbm(tu * 16 + 7.3, tv * 18 + 5.8)

      // --- Bumpy skin texture (subtle lime peel) ---
      const bumpNoise = fbm(tu * 40 + 3.7, tv * 45 + 5.2)

      // --- Longitudinal ridges (subtle ridges along lime length) ---
      const ridge = 0.98 + 0.02 * Math.cos(tu * Math.PI * 2 * 10 + n1 * 1.8)

      // --- Continuous tip-to-body gradient (no hard cuts) ---
      const topTipMix = smoothstep(0.24, 0.02, tv)
      const bottomTipMix = smoothstep(0.76, 0.98, tv)
      // Add noise for organic edge
      const topEdgeNoise = fbm(tu * 6 + 1.2, tv * 8 + 2.5) * 0.06
      const botEdgeNoise = fbm(tu * 5 + 3.7, tv * 7 + 4.2) * 0.06
      const topBlend = Math.min(1, Math.max(0, topTipMix + topEdgeNoise))
      const bottomBlend = Math.min(1, Math.max(0, bottomTipMix + botEdgeNoise))

      // --- Latitude color gradient for body ---
      const latFactor = smoothstep(0.80, 0.20, tv)

      // --- Start with body green ---
      let r = deepR + (bodyR - deepR) * latFactor
      let gg = deepG + (bodyG - deepG) * latFactor
      let b = deepB + (bodyB - deepB) * latFactor

      // FBM noise variation
      r += 8 * (n1 - 0.5)
      gg += 7 * (n1 - 0.5)
      b += 4 * (n1 - 0.5)

      r += 4 * (n2 - 0.5)
      gg += 3 * (n2 - 0.5)

      // Bumpy texture — subtle for wiki's smooth cartoon look
      const bumpMul = 0.98 + 0.025 * bumpNoise
      r *= bumpMul
      gg *= bumpMul
      b *= bumpMul * 0.98

      // Longitudinal ridges
      r *= ridge
      gg *= ridge
      b *= ridge

      // Speckle
      const speck = hash21(px + 53, py + 29)
      if (speck < 0.02) {
        r *= 0.94
        gg *= 0.95
        b *= 0.92
      }
      if (speck > 0.985) {
        r = Math.min(255, r + 6)
        gg = Math.min(255, gg + 8)
        b = Math.min(255, b + 2)
      }

      // --- Smooth dark-green tip blending ---
      const tipR = nubR + 10 * (n1 - 0.5)
      const tipG = nubG + 8 * (n1 - 0.5)
      const tipB = nubB + 6 * (n1 - 0.5)
      const midR = transR + 8 * (n1 - 0.5)
      const midG = transG + 6 * (n1 - 0.5)
      const midB = transB + 4 * (n1 - 0.5)

      // Top blend: body → mid green → tip green
      const topMid = smoothstep(0.24, 0.12, tv)
      const topCore = smoothstep(0.12, 0.02, tv)
      r = r * (1 - topMid) + midR * topMid
      gg = gg * (1 - topMid) + midG * topMid
      b = b * (1 - topMid) + midB * topMid
      r = r * (1 - topCore) + tipR * topCore
      gg = gg * (1 - topCore) + tipG * topCore
      b = b * (1 - topCore) + tipB * topCore

      // Bottom blend: body → mid green → tip green
      const botMid = smoothstep(0.76, 0.88, tv)
      const botCore = smoothstep(0.88, 0.98, tv)
      r = r * (1 - botMid) + midR * botMid
      gg = gg * (1 - botMid) + midG * botMid
      b = b * (1 - botMid) + midB * botMid
      r = r * (1 - botCore) + tipR * botCore
      gg = gg * (1 - botCore) + tipG * botCore
      b = b * (1 - botCore) + tipB * botCore

      // --- Baked lighting (wiki-style: top-front light) ---
      const phi = tv * Math.PI
      const th = tu * Math.PI * 2
      const nx = Math.sin(phi) * Math.cos(th)
      const ny = Math.cos(phi)
      const nz = Math.sin(phi) * Math.sin(th)
      let ndotl = nx * Lx + ny * Ly + nz * Lz
      ndotl = Math.max(0, ndotl)

      // Broad diffuse fill
      const diffBoost = Math.pow(ndotl, 1.0) * 0.32
      // Tight specular highlight near top-front
      const specRaw = Math.pow(ndotl, 5) * 0.26 + Math.pow(ndotl, 14) * 0.14
      const specFalloff = smoothstep(0.38, 0.10, tv)
      const specBoost = specRaw * specFalloff

      const lighting = 1.0 + diffBoost
      r *= lighting
      gg *= lighting
      b *= lighting

      // Specular: brighter white highlight
      r += 255 * specBoost * 0.40
      gg += 255 * specBoost * 0.42
      b += 255 * specBoost * 0.30

      // Pole smoothing
      const sinV = Math.sin(tv * Math.PI)
      const poleFactor = 0.988 + 0.012 * sinV
      r *= poleFactor
      gg *= poleFactor
      b *= poleFactor

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
  tex.flipY = false
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 2
  tex.needsUpdate = true
  limeSkinTex = tex
  return tex
}

// ---------------------------------------------------------------------------
// Mango skin: wiki-accurate yellow-to-orange mango texture.
// UV: u = azimuth around Y (0–1), v = colatitude/π (0=top pole/stem, 1=bottom tip).
//
// Visual zones (from wiki reference — lime.png is the truth source for style):
//   v ≈ 0.00–0.06 : top pole — greenish-yellow (stem area)
//   v ≈ 0.06–0.18 : top transition — yellow blending into body
//   v ≈ 0.18–0.78 : main body — golden-orange
//   v ≈ 0.78–0.90 : bottom transition — deeper orange
//   v ≈ 0.90–1.00 : bottom tip — dark orange-brown point
//
// Key features: golden-yellow to orange gradient, smooth waxy peel,
// subtle bumpy texture, uniform azimuthal color (no blush — avoids seam).
// ---------------------------------------------------------------------------

let mangoSkinTex: THREE.CanvasTexture | null = null

/** Call after editing mango skin generation so the next `mangoSkinTexture()` rebuilds the canvas. */
export function resetMangoSkinTextureCache(): void {
  mangoSkinTex = null
}

export function mangoSkinTexture(): THREE.CanvasTexture {
  if (mangoSkinTex) return mangoSkinTex
  const s = 512
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  const data = img.data

  // Palette sampled from wiki mango reference:
  // - golden orange body:   #F09818 (warm golden-orange)
  // - deep orange shadow:   #B85810
  // - stem area (top):      #708028 (greenish-yellow)
  // - tip (bottom):         #683008 (dark orange-brown)
  const bodyR = 0xf0, bodyG = 0x98, bodyB = 0x18
  const deepR = 0xb8, deepG = 0x58, deepB = 0x10
  const stemR = 0x70, stemG = 0x80, stemB = 0x28
  const tipR = 0x68, tipG = 0x30, tipB = 0x08

  // Wiki-style lighting: top-front light source
  const lx = 0.15, ly = 0.85, lz = 0.50
  const llen = Math.hypot(lx, ly, lz)
  const Lx = lx / llen, Ly = ly / llen, Lz = lz / llen

  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1) // 0 = top (stem), 1 = bottom (tip)
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1) // 0–1 around azimuth

      // --- FBM noise for organic variation ---
      const n1 = fbm(tu * 8 + 2.1, tv * 10 + 3.4)
      const n2 = fbm(tu * 16 + 7.3, tv * 18 + 5.8)

      // --- Bumpy skin texture (subtle mango peel) ---
      const bumpNoise = fbm(tu * 40 + 3.7, tv * 45 + 5.2)

      // --- Longitudinal ridges (subtle, mango has faint lines) ---
      const ridge = 0.99 + 0.01 * Math.cos(tu * Math.PI * 2 * 8 + n1 * 1.5)

      // --- Latitude color gradient for body ---
      // Upper body: more golden-yellow; lower body: more orange
      const latFactor = smoothstep(0.80, 0.20, tv)

      // --- Start with base yellow-orange ---
      let r = deepR + (bodyR - deepR) * latFactor
      let gg = deepG + (bodyG - deepG) * latFactor
      let b = deepB + (bodyB - deepB) * latFactor

      // FBM noise variation
      r += 10 * (n1 - 0.5)
      gg += 6 * (n1 - 0.5)
      b += 4 * (n1 - 0.5)

      r += 5 * (n2 - 0.5)
      gg += 3 * (n2 - 0.5)

      // Bumpy texture — subtle waxy peel
      const bumpMul = 0.97 + 0.035 * bumpNoise
      r *= bumpMul
      gg *= bumpMul
      b *= bumpMul * 0.98

      // Longitudinal ridges
      r *= ridge
      gg *= ridge
      b *= ridge

      // Speckle (tiny dots on mango skin)
      const speck = hash21(px + 53, py + 29)
      if (speck < 0.015) {
        r *= 0.96
        gg *= 0.97
        b *= 0.94
      }
      if (speck > 0.988) {
        r = Math.min(255, r + 6)
        gg = Math.min(255, gg + 5)
        b = Math.min(255, b + 2)
      }

      // --- Smooth tip blending (bottom: orange → dark tip) ---
      const bottomTipMix = smoothstep(0.88, 0.98, tv)
      const bottomEdgeNoise = fbm(tu * 5 + 3.7, tv * 7 + 4.2) * 0.06
      const bottomBlend = Math.min(1, Math.max(0, bottomTipMix + bottomEdgeNoise))

      // Transition zone color (deeper orange)
      const transR = deepR + 8 * (n1 - 0.5)
      const transG = deepG + 5 * (n1 - 0.5)
      const transB = deepB + 4 * (n1 - 0.5)

      const botMid = smoothstep(0.78, 0.88, tv)
      r = r * (1 - botMid) + transR * botMid
      gg = gg * (1 - botMid) + transG * botMid
      b = b * (1 - botMid) + transB * botMid

      const tipColorR = tipR + 10 * (n1 - 0.5)
      const tipColorG = tipG + 6 * (n1 - 0.5)
      const tipColorB = tipB + 5 * (n1 - 0.5)
      r = r * (1 - bottomBlend) + tipColorR * bottomBlend
      gg = gg * (1 - bottomBlend) + tipColorG * bottomBlend
      b = b * (1 - bottomBlend) + tipColorB * bottomBlend

      // --- Smooth stem area blending (top: greenish-yellow) ---
      const topStemMix = smoothstep(0.18, 0.04, tv)
      const topEdgeNoise = fbm(tu * 6 + 1.2, tv * 8 + 2.5) * 0.06
      const topBlend = Math.min(1, Math.max(0, topStemMix + topEdgeNoise))

      const stemTransR = bodyR * 0.85 + stemR * 0.15 + 8 * (n1 - 0.5)
      const stemTransG = bodyG * 0.80 + stemG * 0.20 + 6 * (n1 - 0.5)
      const stemTransB = bodyB * 0.70 + stemB * 0.30 + 4 * (n1 - 0.5)

      const topMid = smoothstep(0.22, 0.12, tv)
      r = r * (1 - topMid) + stemTransR * topMid
      gg = gg * (1 - topMid) + stemTransG * topMid
      b = b * (1 - topMid) + stemTransB * topMid

      const stemColorR = stemR + 8 * (n1 - 0.5)
      const stemColorG = stemG + 6 * (n1 - 0.5)
      const stemColorB = stemB + 5 * (n1 - 0.5)
      r = r * (1 - topBlend) + stemColorR * topBlend
      gg = gg * (1 - topBlend) + stemColorG * topBlend
      b = b * (1 - topBlend) + stemColorB * topBlend

      // --- Baked lighting (wiki-style: top-front light) ---
      // Use azimuthal angle phi directly so lighting wraps seamlessly at u=0/1 seam
      const phi = tv * Math.PI
      const theta = tu * Math.PI * 2
      const nlx = Math.sin(phi) * Math.cos(theta)
      const nly = Math.cos(phi)
      const nlz = Math.sin(phi) * Math.sin(theta)
      let ndotl = nlx * Lx + nly * Ly + nlz * Lz
      ndotl = Math.max(0, ndotl)

      // Broad diffuse fill
      const diffBoost = Math.pow(ndotl, 1.0) * 0.30
      // Tight specular highlight near top-front
      const specRaw = Math.pow(ndotl, 5) * 0.24 + Math.pow(ndotl, 14) * 0.12
      const specFalloff = smoothstep(0.38, 0.10, tv)
      const specBoost = specRaw * specFalloff

      const lighting = 1.0 + diffBoost
      r *= lighting
      gg *= lighting
      b *= lighting

      // Specular: warm white highlight (mango is slightly glossy)
      r += 255 * specBoost * 0.42
      gg += 255 * specBoost * 0.40
      b += 255 * specBoost * 0.28

      // Pole smoothing
      const sinV = Math.sin(tv * Math.PI)
      const poleFactor = 0.988 + 0.012 * sinV
      r *= poleFactor
      gg *= poleFactor
      b *= poleFactor

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
  tex.flipY = false
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 2
  tex.needsUpdate = true
  mangoSkinTex = tex
  return tex
}

let coconutSkinTex: THREE.CanvasTexture | null = null

/** Call after editing coconut skin generation so the next `coconutSkinTexture()` rebuilds the canvas. */
export function resetCoconutSkinTextureCache(): void {
  coconutSkinTex = null
}

export function coconutSkinTexture(): THREE.CanvasTexture {
  if (coconutSkinTex) return coconutSkinTex
  const s = 512
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  const img = g.createImageData(s, s)
  const data = img.data

  // Palette sampled from wiki coconut reference:
  // - deep brown husk body:    #523824 (warm dark brown — wiki coconut has warm reddish undertone)
  // - very dark fiber shadow:  #281608 (deep brown-black)
  // - lighter fiber highlight: #705438 (warm tan, for fiber highlights)
  // - top eye area:            #361E10 (darker near eyes)
  // - bottom area:             #604228 (slightly warmer)
  const bodyR = 0x52, bodyG = 0x38, bodyB = 0x24
  const darkR = 0x28, darkG = 0x16, darkB = 0x08
  const lightR = 0x70, lightG = 0x54, lightB = 0x38
  const topR = 0x36, topG = 0x1E, topB = 0x10
  const bottomR = 0x60, bottomG = 0x42, bottomB = 0x28

  // Wiki-style lighting: top-front light source
  const lx = 0.15, ly = 0.85, lz = 0.50
  const llen = Math.hypot(lx, ly, lz)
  const Lx = lx / llen, Ly = ly / llen, Lz = lz / llen

  for (let py = 0; py < s; py++) {
    const tv = py / (s - 1) // 0 = top (eyes), 1 = bottom
    for (let px = 0; px < s; px++) {
      const tu = px / (s - 1) // 0–1 around azimuth

      // --- FBM noise for organic fiber variation ---
      const n1 = fbm(tu * 8 + 1.7, tv * 10 + 2.4)
      const n2 = fbm(tu * 16 + 5.3, tv * 18 + 7.8)
      const n3 = fbm(tu * 24 + 9.1, tv * 28 + 11.6)

      // --- Fiber texture: coconuts have prominent longitudinal fibers ---
      // Primary fiber ridges — visible but not too strong (wiki is smoother)
      const fiberRidge = 0.94 + 0.06 * Math.cos(tu * Math.PI * 2 * 10 + n1 * 2.5)

      // Cross-fiber mesh (intersecting diagonal fibers in real husk)
      const crossFiber1 = 0.96 + 0.04 * Math.cos(tu * Math.PI * 2 * 6 + tv * Math.PI * 22 + n1 * 1.8)
      const crossFiber2 = 0.97 + 0.03 * Math.cos(tu * Math.PI * 2 * 4 - tv * Math.PI * 18 + n2 * 1.5)

      // Fine fiber detail — very subtle
      const fineFiber = 0.98 + 0.02 * Math.cos(tu * Math.PI * 2 * 20 + tv * Math.PI * 40 + n3 * 3.0)

      // --- Bumpy husk texture (coconut surface is rough and fibrous) ---
      const bumpNoise = fbm(tu * 35 + 4.7, tv * 40 + 6.2)

      // --- Latitude color gradient ---
      // Body is deep brown, slightly warmer in the middle, darker at top (eyes area)
      const topMix = smoothstep(0.25, 0.06, tv)
      const bottomMix = smoothstep(0.85, 0.98, tv)

      // Start with base deep brown
      let r = bodyR + 14 * (n1 - 0.5)
      let gg = bodyG + 10 * (n1 - 0.5)
      let b = bodyB + 7 * (n1 - 0.5)

      // FBM noise variation — more pronounced for fibrous look
      r += 8 * (n2 - 0.5)
      gg += 6 * (n2 - 0.5)
      b += 4 * (n2 - 0.5)

      // Extra fine noise for fiber detail
      r += 4 * (n3 - 0.5)
      gg += 3 * (n3 - 0.5)
      b += 2 * (n3 - 0.5)

      // Bumpy texture — subtle husk roughness (wiki coconut has smoother look)
      const bumpMul = 0.92 + 0.08 * bumpNoise
      r *= bumpMul
      gg *= bumpMul
      b *= bumpMul * 0.97

      // Apply fiber ridges (stronger effect)
      r *= fiberRidge * crossFiber1 * crossFiber2 * fineFiber
      gg *= fiberRidge * crossFiber1 * crossFiber2 * fineFiber
      b *= fiberRidge * crossFiber1 * crossFiber2 * fineFiber

      // --- Three "eyes" at the top ---
      // Wiki coconut: three visible dark spots arranged in a triangle at the top
      // They are clearly visible but natural-looking — darker circular depressions
      const eyeAngles = [Math.PI / 2, Math.PI * 7 / 6, Math.PI * 11 / 6]
      const eyeRadial = 0.07   // distance from center
      const eyeSize = 0.022    // radius of each eye
      let eyeDarkness = 0.0

      for (const angle of eyeAngles) {
        const ecx = 0.5 + Math.cos(angle) * eyeRadial
        const ecy = 0.058 + Math.sin(angle) * eyeRadial * 0.45
        const dx = tu - ecx
        const dy = tv - ecy
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < eyeSize * 3.0) {
          // Clear but natural darkening
          const eyeFactor = smoothstep(eyeSize * 2.0, eyeSize * 0.3, dist)
          eyeDarkness = Math.max(eyeDarkness, eyeFactor * 0.75)
        }
      }

      // Apply eye darkening (visible dark spots — darker than husk)
      if (eyeDarkness > 0) {
        const eyeR = darkR + 10
        const eyeG = darkG + 5
        const eyeB2 = darkB + 3
        r = r * (1 - eyeDarkness) + eyeR * eyeDarkness
        gg = gg * (1 - eyeDarkness) + eyeG * eyeDarkness
        b = b * (1 - eyeDarkness) + eyeB2 * eyeDarkness
      }

      // --- Top area blending (darker near eyes) ---
      const topEdgeNoise = fbm(tu * 6 + 1.2, tv * 8 + 2.5) * 0.06
      const topBlend = Math.min(1, Math.max(0, topMix + topEdgeNoise))

      const topTransR = bodyR * 0.65 + topR * 0.35 + 8 * (n1 - 0.5)
      const topTransG = bodyG * 0.65 + topG * 0.35 + 6 * (n1 - 0.5)
      const topTransB = bodyB * 0.65 + topB * 0.35 + 4 * (n1 - 0.5)

      const topMid = smoothstep(0.30, 0.18, tv)
      r = r * (1 - topMid) + topTransR * topMid
      gg = gg * (1 - topMid) + topTransG * topMid
      b = b * (1 - topMid) + topTransB * topMid

      const topColorR = topR + 10 * (n1 - 0.5)
      const topColorG = topG + 6 * (n1 - 0.5)
      const topColorB = topB + 5 * (n1 - 0.5)
      r = r * (1 - topBlend) + topColorR * topBlend
      gg = gg * (1 - topBlend) + topColorG * topBlend
      b = b * (1 - topBlend) + topColorB * topBlend

      // --- Bottom area blending (slightly warmer) ---
      const bottomEdgeNoise = fbm(tu * 5 + 3.7, tv * 7 + 4.2) * 0.06
      const bottomBlend = Math.min(1, Math.max(0, bottomMix + bottomEdgeNoise))

      const botTransR = bodyR * 0.80 + bottomR * 0.20 + 8 * (n1 - 0.5)
      const botTransG = bodyG * 0.80 + bottomG * 0.20 + 6 * (n1 - 0.5)
      const botTransB = bodyB * 0.80 + bottomB * 0.20 + 4 * (n1 - 0.5)

      const botMid = smoothstep(0.82, 0.90, tv)
      r = r * (1 - botMid) + botTransR * botMid
      gg = gg * (1 - botMid) + botTransG * botMid
      b = b * (1 - botMid) + botTransB * botMid

      const botColorR = bottomR + 8 * (n1 - 0.5)
      const botColorG = bottomG + 6 * (n1 - 0.5)
      const botColorB = bottomB + 5 * (n1 - 0.5)
      r = r * (1 - bottomBlend) + botColorR * bottomBlend
      gg = gg * (1 - bottomBlend) + botColorG * bottomBlend
      b = b * (1 - bottomBlend) + botColorB * bottomBlend

      // --- Coarse fiber speckle (abundant for husk look) ---
      const speck = hash21(px + 17, py + 43)
      if (speck < 0.07) {
        r *= 0.88
        gg *= 0.89
        b *= 0.86
      }
      if (speck > 0.97) {
        r = Math.min(255, r + 12)
        gg = Math.min(255, gg + 8)
        b = Math.min(255, b + 5)
      }

      // --- Equatorial fiber band ---
      const eqBandDist = Math.abs(tv - 0.48)
      if (eqBandDist < 0.10) {
        const bandFactor = 1.0 - smoothstep(0.04, 0.10, eqBandDist)
        // Slightly lighter fiber band with more fiber detail
        r = r * (1 - bandFactor * 0.10) + lightR * bandFactor * 0.10
        gg = gg * (1 - bandFactor * 0.10) + lightG * bandFactor * 0.10
        b = b * (1 - bandFactor * 0.10) + lightB * bandFactor * 0.10
      }

      // --- Baked lighting (wiki-style: top-front light) ---
      const phi = tv * Math.PI
      const theta = tu * Math.PI * 2
      const nlx = Math.sin(phi) * Math.cos(theta)
      const nly = Math.cos(phi)
      const nlz = Math.sin(phi) * Math.sin(theta)
      let ndotl = nlx * Lx + nly * Ly + nlz * Lz
      ndotl = Math.max(0, ndotl)

      // Broad diffuse fill — wiki coconut has clear light/shadow sides
      const diffBoost = Math.pow(ndotl, 1.0) * 0.40
      // Warm ambient fill in shadow — wiki coconut shadow side is warm, not cold
      const shadowWarmth = (1.0 - ndotl) * 0.06
      // Specular — wiki coconut has a bright soft highlight
      const specRaw = Math.pow(ndotl, 2) * 0.10 + Math.pow(ndotl, 6) * 0.15
      const specFalloff = smoothstep(0.50, 0.10, tv)
      const specBoost = specRaw * specFalloff

      const lighting = 1.0 + diffBoost
      r *= lighting
      gg *= lighting
      b *= lighting

      // Warm shadow fill — subtle reddish warmth in shadow areas
      r += shadowWarmth * 255 * 0.06
      gg += shadowWarmth * 255 * 0.02
      b -= shadowWarmth * 10

      // Specular: bright warm-white highlight — soft but visible
      r += 255 * specBoost * 0.40
      gg += 255 * specBoost * 0.38
      b += 255 * specBoost * 0.30

      // Pole smoothing
      const sinV = Math.sin(tv * Math.PI)
      const poleFactor = 0.988 + 0.012 * sinV
      r *= poleFactor
      gg *= poleFactor
      b *= poleFactor

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
  tex.flipY = false
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 2
  tex.needsUpdate = true
  coconutSkinTex = tex
  return tex
}
