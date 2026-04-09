import * as THREE from 'three'

import wikiWatermelonUrl from '@/game-center/fruit-ninja/assets/wiki/watermelon.png'

/**
 * Crop the fruit out of the wiki PNG (near-white / transparent background) and build a
 * square albedo texture for standard sphere UV mapping.
 */

function isBackgroundPixel(data: Uint8ClampedArray, i: number): boolean {
  const r = data[i]!
  const g = data[i + 1]!
  const b = data[i + 2]!
  const a = data[i + 3]!
  if (a < 8) return true
  // Wiki art sits on white / very light gray
  if (r > 245 && g > 245 && b > 245) return true
  return false
}

/** Pixels that are clearly fruit (greens) — exclude anti-aliased white fringe */
function boundsOfFruit(data: Uint8ClampedArray, w: number, h: number) {
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let any = false
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!isBackgroundPixel(data, i)) {
        any = true
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  return any ? { minX, minY, maxX, maxY } : null
}

export function buildExtractedWatermelonCanvas(source: CanvasImageSource, sw: number, sh: number): HTMLCanvasElement {
  const read = document.createElement('canvas')
  read.width = sw
  read.height = sh
  const rctx = read.getContext('2d')!
  rctx.drawImage(source, 0, 0, sw, sh)
  const imgData = rctx.getImageData(0, 0, sw, sh)
  const b = boundsOfFruit(imgData.data, sw, sh)
  const pad = 6
  if (!b) {
    const out = document.createElement('canvas')
    out.width = 512
    out.height = 512
    out.getContext('2d')!.drawImage(source, 0, 0, sw, sh, 0, 0, 512, 512)
    return out
  }
  const minX = Math.max(0, b.minX - pad)
  const minY = Math.max(0, b.minY - pad)
  const maxX = Math.min(sw - 1, b.maxX + pad)
  const maxY = Math.min(sh - 1, b.maxY + pad)
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const side = Math.max(cw, ch)
  const out = document.createElement('canvas')
  out.width = side
  out.height = side
  const g = out.getContext('2d')!
  // Letterbox pad with mid green so sphere poles don't show hard white
  g.fillStyle = '#4a9a52'
  g.fillRect(0, 0, side, side)
  const ox = (side - cw) / 2
  const oy = (side - ch) / 2
  g.drawImage(read, minX, minY, cw, ch, ox, oy, cw, ch)
  return out
}

let cachedTex: THREE.CanvasTexture | null = null
let loadPromise: Promise<THREE.CanvasTexture> | null = null

/** Albedo from cropped wiki art; safe to call multiple times. */
export function getWatermelonExtractedTextureAsync(): Promise<THREE.CanvasTexture> {
  if (cachedTex) return Promise.resolve(cachedTex)
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = buildExtractedWatermelonCanvas(img, img.naturalWidth, img.naturalHeight)
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.repeat.set(1, 1)
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.generateMipmaps = true
        tex.anisotropy = 8
        cachedTex = tex
        resolve(tex)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('watermelon wiki image load failed'))
    img.src = wikiWatermelonUrl
  })
  return loadPromise
}
