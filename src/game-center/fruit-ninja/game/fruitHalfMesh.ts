import * as THREE from 'three'

import type { FruitArchetype } from './spawn'
import { getAppleBodyMaterial } from './appleSkin'
import { getAppleSlicedHalfPolyGeometry, APPLE_MAX_XZ, APPLE_TOP_POLE_Y_RATIO } from './applePolyGeometry'
import { getKiwiSlicedHalfPolyGeometry, KIWI_MAX_XZ, KIWI_TOP_POLE_Y_RATIO } from './kiwiPolyGeometry'
import { getKiwiBodyMaterial } from './kiwiSkin'
import { getPlumSlicedHalfPolyGeometry, PLUM_MAX_XZ, PLUM_TOP_POLE_Y_RATIO } from './plumPolyGeometry'
import { getPlumBodyMaterial } from './plumSkin'
import { getCherryBodyPolyGeometry, CHERRY_TOP_POLE_Y_RATIO } from './cherryPolyGeometry'
import { getBananaBodyMaterial } from './bananaSkin'
import { createBananaSpineCurve, bananaGirthScale, applyTubeRadiusProfile } from './bananaGeometry'
import { getWatermelonBodyMaterial } from './watermelonSkin'
import {
  getWatermelonSlicedHalfPolyGeometry,
  WATERMELON_AX,
  WATERMELON_AY,
  WATERMELON_AZ,
} from './watermelonPolyGeometry'
import { getOrangeBodyMaterial } from './orangeSkin'
import { getOrangeSlicedHalfPolyGeometry, ORANGE_MAX_XZ } from './orangePolyGeometry'
import { getPeachBodyMaterial } from './peachSkin'
import { getPeachSlicedHalfPolyGeometry, PEACH_MAX_XZ, PEACH_TOP_POLE_Y_RATIO } from './peachPolyGeometry'
import { getCherryBodyMaterial } from './cherrySkin'
import {
  getPearBodyPolyGeometry,
  getPearSlicedHalfPolyGeometry,
  PEAR_MAX_XZ,
  PEAR_TOP_POLE_Y_RATIO,
} from './pearPolyGeometry'
import { getPearBodyMaterial } from './pearSkin'
import { getLemonSlicedHalfPolyGeometry, LEMON_MAX_XZ } from './lemonPolyGeometry'
import { getLemonBodyMaterial } from './lemonSkin'
import { getLimeSlicedHalfPolyGeometry, LIME_MAX_XZ } from './limePolyGeometry'
import { getLimeBodyMaterial } from './limeSkin'
import { getMangoSlicedHalfPolyGeometry, MANGO_MAX_XZ } from './mangoPolyGeometry'
import { getMangoBodyMaterial } from './mangoSkin'
import { getPineappleSlicedHalfPolyGeometry, PINEAPPLE_MAX_XZ } from './pineapplePolyGeometry'
import { getCoconutSlicedHalfPolyGeometry, COCONUT_MAX_XZ } from './coconutPolyGeometry'
import { getCoconutBodyMaterial } from './coconutSkin'
import { getStrawberrySlicedHalfPolyGeometry, STRAWBERRY_MAX_XZ } from './strawberryPolyGeometry'
import { getStrawberryBodyMaterial } from './strawberrySkin'
import { getPassionfruitSlicedHalfPolyGeometry, PASSIONFRUIT_MAX_XZ } from './passionfruitPolyGeometry'
import { getPassionfruitBodyMaterial } from './passionfruitSkin'
import { pineappleBodyMaterial } from './meshes'

/** Lighter "pulp" tone from skin color (fallback when spawn did not set flesh). */
export function fleshColorFromSkin(skin: THREE.Color): THREE.Color {
  return new THREE.Color().copy(skin).lerp(new THREE.Color(0xfff5e8), 0.55)
}

// --- Shared GPU resources for fruit halves (avoid per-slice alloc + shader compile) ---

const HEM_SEGMENTS = 16
const HEM_RINGS = 12
const sharedHemisphere = new THREE.SphereGeometry(1, HEM_SEGMENTS, HEM_RINGS, 0, Math.PI * 2, 0, Math.PI / 2)
const sharedCap = new THREE.CircleGeometry(0.997, 20)

const skinMatCache = new Map<string, THREE.MeshStandardMaterial>()
const fleshMatCache = new Map<number, THREE.MeshStandardMaterial>()

const fleshTexCache = new Map<string, THREE.CanvasTexture>()

function fleshTextureForFruit(fruitType: FruitArchetype, flesh: THREE.Color): THREE.CanvasTexture {
  const key = `${fruitType}:${flesh.getHexString()}`
  const cached = fleshTexCache.get(key)
  if (cached) return cached

  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!

  const base = flesh.clone()
  const hi = base.clone().lerp(new THREE.Color(0xffffff), 0.25)
  const lo = base.clone().multiplyScalar(0.70)

  // Base gradient — radial light center to darker edge
  const radial = g.createRadialGradient(s / 2, s / 2, 6, s / 2, s / 2, s / 2 + 4)
  radial.addColorStop(0, `#${hi.getHexString()}`)
  radial.addColorStop(1, `#${lo.getHexString()}`)
  g.fillStyle = radial
  g.fillRect(0, 0, s, s)

  if (fruitType === 'watermelon') {
    // Wiki: green outside, vivid red inside with black seeds
    const hash = (i: number, j: number) => {
      const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453123
      return n - Math.floor(n)
    }
    // Pale rind ring → white inner ring (classic cross-section)
    g.strokeStyle = 'rgba(90,160,80,0.55)'
    g.lineWidth = 5
    g.beginPath()
    g.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = 'rgba(255,255,245,0.85)'
    g.lineWidth = 4
    g.beginPath()
    g.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = 'rgba(255,60,70,0.35)'
    g.lineWidth = 2
    g.beginPath()
    g.arc(s / 2, s / 2, s / 2 - 7, 0, Math.PI * 2)
    g.stroke()
    // Seeds: deterministic ovals (teardrop toward center like FN art)
    for (let i = 0; i < 52; i++) {
      const t = hash(i, 17)
      const t2 = hash(i, 91)
      const a = t * Math.PI * 2
      const r = 10 + t2 * 40
      const x = s / 2 + Math.cos(a) * r
      const y = s / 2 + Math.sin(a) * r
      const w = 1.8 + hash(i, 3) * 2.2
      const h = 3.5 + hash(i, 5) * 4
      g.save()
      g.translate(x, y)
      g.rotate(a + (hash(i, 7) - 0.5) * 0.5)
      g.fillStyle = `rgba(18,8,12,${0.5 + hash(i, 11) * 0.35})`
      g.beginPath()
      g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  } else if (fruitType === 'banana') {
    // Creamy flesh with visible fiber lines
    g.strokeStyle = 'rgba(255,255,255,0.16)'
    for (let i = 0; i < 80; i++) {
      const a = Math.random() * Math.PI * 2
      const r0 = 4 + Math.random() * 10
      const r1 = 35 + Math.random() * 28
      g.beginPath()
      g.moveTo(s / 2 + Math.cos(a) * r0, s / 2 + Math.sin(a) * r0)
      g.lineTo(s / 2 + Math.cos(a) * r1, s / 2 + Math.sin(a) * r1)
      g.stroke()
    }
  } else if (fruitType === 'orange') {
    // Orange flesh with visible segment lines
    g.strokeStyle = 'rgba(255,180,60,0.25)'
    g.lineWidth = 1.2
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2, s / 2)
      g.lineTo(s / 2 + Math.cos(a) * (s / 2), s / 2 + Math.sin(a) * (s / 2))
      g.stroke()
    }
    // Tiny juice vesicles
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,220,100,${0.08 + Math.random() * 0.1})`
      g.beginPath()
      g.arc(Math.random() * s, Math.random() * s, 0.8 + Math.random() * 1.5, 0, Math.PI * 2)
      g.fill()
    }
  } else if (fruitType === 'kiwi') {
    // Wiki-accurate kiwi flesh: bright green with radiating seed lines, white core, and many black seeds
    // Green flesh base — vibrant wiki green
    g.fillStyle = '#88C840'
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    g.fill()

    // Outer flesh ring — slightly darker green at edges
    const fleshGrad = g.createRadialGradient(s / 2, s / 2, s * 0.30, s / 2, s / 2, s * 0.48)
    fleshGrad.addColorStop(0, 'rgba(100,180,50,0)')
    fleshGrad.addColorStop(1, 'rgba(60,120,30,0.35)')
    g.fillStyle = fleshGrad
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    g.fill()

    // White core center — wiki kiwi has a prominent white center
    g.fillStyle = 'rgba(255,255,245,0.55)'
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.07, 0, Math.PI * 2)
    g.fill()
    // Softer halo around core
    const coreGrad = g.createRadialGradient(s / 2, s / 2, s * 0.04, s / 2, s / 2, s * 0.10)
    coreGrad.addColorStop(0, 'rgba(255,255,245,0.35)')
    coreGrad.addColorStop(1, 'rgba(255,255,245,0)')
    g.fillStyle = coreGrad
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.10, 0, Math.PI * 2)
    g.fill()

    // Radiating seed lines — wiki kiwi has ~20-24 distinct lines radiating from core
    g.strokeStyle = 'rgba(200,240,100,0.25)'
    g.lineWidth = 1.2
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2 + Math.cos(a) * s * 0.06, s / 2 + Math.sin(a) * s * 0.06)
      g.lineTo(s / 2 + Math.cos(a) * s * 0.44, s / 2 + Math.sin(a) * s * 0.44)
      g.stroke()
    }
    // Fainter secondary lines between main lines
    g.strokeStyle = 'rgba(180,220,80,0.12)'
    g.lineWidth = 0.6
    for (let i = 0; i < 24; i++) {
      const a = ((i + 0.5) / 24) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2 + Math.cos(a) * s * 0.08, s / 2 + Math.sin(a) * s * 0.08)
      g.lineTo(s / 2 + Math.cos(a) * s * 0.38, s / 2 + Math.sin(a) * s * 0.38)
      g.stroke()
    }

    // Tiny black seeds along radiating lines — wiki kiwi has many seeds in rows
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2
      const seedCount = 4 + Math.floor(Math.random() * 3)
      for (let j = 0; j < seedCount; j++) {
        const dist = s * 0.10 + (s * 0.32 * j / seedCount) + (Math.random() - 0.5) * 3
        const seedAngle = a + (Math.random() - 0.5) * 0.08
        g.fillStyle = `rgba(15,15,10,${0.5 + Math.random() * 0.3})`
        g.beginPath()
        g.arc(
          s / 2 + Math.cos(seedAngle) * dist,
          s / 2 + Math.sin(seedAngle) * dist,
          1.0 + Math.random() * 0.6,
          0, Math.PI * 2,
        )
        g.fill()
      }
    }
    // Scattered extra seeds between lines for density
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2
      const r = s * 0.08 + Math.random() * s * 0.36
      g.fillStyle = `rgba(15,15,10,${0.3 + Math.random() * 0.25})`
      g.beginPath()
      g.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, 0.7 + Math.random() * 0.5, 0, Math.PI * 2)
      g.fill()
    }
  } else if (fruitType === 'apple') {
    // White/cream flesh with faint core lines
    g.strokeStyle = 'rgba(220,200,180,0.2)'
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2 + Math.cos(a) * 5, s / 2 + Math.sin(a) * 5)
      g.lineTo(s / 2 + Math.cos(a) * 50, s / 2 + Math.sin(a) * 50)
      g.stroke()
    }
    // Small seed cavity dots
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 4 + Math.random() * 8
      g.fillStyle = 'rgba(180,150,100,0.2)'
      g.beginPath()
      g.ellipse(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, 2, 3, a, 0, Math.PI * 2)
      g.fill()
    }
  } else if (fruitType === 'strawberry') {
    // Pink/red flesh with seed cavities
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 6 + Math.random() * 48
      g.fillStyle = 'rgba(255,200,200,0.15)'
      g.beginPath()
      g.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, 2 + Math.random() * 2, 0, Math.PI * 2)
      g.fill()
    }
  } else if (fruitType === 'lemon' || fruitType === 'lime') {
    // Citrus segment pattern
    g.strokeStyle = 'rgba(255,255,200,0.2)'
    g.lineWidth = 1
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2, s / 2)
      g.lineTo(s / 2 + Math.cos(a) * 58, s / 2 + Math.sin(a) * 58)
      g.stroke()
    }
  } else if (fruitType === 'peach') {
    // Soft peach flesh with slight grain
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(255,200,160,0.1)'
      g.beginPath()
      g.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 0, Math.PI * 2)
      g.fill()
    }
    // Stone/pit outline in center
    g.strokeStyle = 'rgba(180,140,100,0.25)'
    g.lineWidth = 2
    g.beginPath()
    g.ellipse(s / 2, s / 2, 14, 20, 0, 0, Math.PI * 2)
    g.stroke()
  } else if (fruitType === 'plum') {
    // Wiki plum flesh: golden/amber with stone outline and fiber lines
    // Amber/golden flesh base
    g.fillStyle = '#E8C050'
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    g.fill()
    // Slightly darker ring at edge
    const fleshGrad = g.createRadialGradient(s / 2, s / 2, s * 0.30, s / 2, s / 2, s * 0.48)
    fleshGrad.addColorStop(0, 'rgba(232,192,80,0)')
    fleshGrad.addColorStop(1, 'rgba(180,130,40,0.30)')
    g.fillStyle = fleshGrad
    g.beginPath()
    g.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    g.fill()
    // Stone outline — elongated oval in center
    g.strokeStyle = 'rgba(160,120,40,0.25)'
    g.lineWidth = 1.5
    g.beginPath()
    g.ellipse(s / 2, s / 2, s * 0.08, s * 0.14, 0, 0, Math.PI * 2)
    g.stroke()
    // Stone fill
    g.fillStyle = 'rgba(140,110,50,0.15)'
    g.beginPath()
    g.ellipse(s / 2, s / 2, s * 0.07, s * 0.13, 0, 0, Math.PI * 2)
    g.fill()
    // Radiating fiber lines from stone
    g.strokeStyle = 'rgba(200,160,60,0.15)'
    g.lineWidth = 0.6
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2 + Math.cos(a) * s * 0.10, s / 2 + Math.sin(a) * s * 0.15)
      g.lineTo(s / 2 + Math.cos(a) * s * 0.42, s / 2 + Math.sin(a) * s * 0.42)
      g.stroke()
    }
    // Subtle flesh texture variation
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,220,100,${0.05 + Math.random() * 0.06})`
      g.beginPath()
      g.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 0, Math.PI * 2)
      g.fill()
    }
  } else if (fruitType === 'cherry') {
    // Bright red flesh with subtle lighter patches
    for (let i = 0; i < 20; i++) {
      g.fillStyle = 'rgba(255,150,150,0.12)'
      g.beginPath()
      g.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 4, 0, Math.PI * 2)
      g.fill()
    }
  } else if (fruitType === 'passionfruit') {
    // Golden flesh with dark seeds
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 8 + Math.random() * 48
      g.fillStyle = 'rgba(40,20,10,0.35)'
      g.beginPath()
      g.ellipse(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, 1.5, 2.5, a, 0, Math.PI * 2)
      g.fill()
    }
    // Juicy pulp patches
    for (let i = 0; i < 30; i++) {
      g.fillStyle = 'rgba(255,230,150,0.12)'
      g.beginPath()
      g.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 0, Math.PI * 2)
      g.fill()
    }
  } else if (fruitType === 'coconut') {
    // White coconut meat with brown shell edge
    g.strokeStyle = 'rgba(80,55,30,0.35)'
    g.lineWidth = 5
    g.beginPath()
    g.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2)
    g.stroke()
  } else if (fruitType === 'mango') {
    // Orange/yellow flesh with subtle fiber lines
    g.strokeStyle = 'rgba(255,220,100,0.15)'
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2 + Math.cos(a) * 5, s / 2 + Math.sin(a) * 5)
      g.lineTo(s / 2 + Math.cos(a) * 55, s / 2 + Math.sin(a) * 55)
      g.stroke()
    }
    // Stone outline
    g.strokeStyle = 'rgba(180,140,60,0.2)'
    g.lineWidth = 1.5
    g.beginPath()
    g.ellipse(s / 2, s / 2, 10, 18, 0.2, 0, Math.PI * 2)
    g.stroke()
  } else if (fruitType === 'pear') {
    // Creamy white flesh with faint grit cells
    for (let i = 0; i < 50; i++) {
      g.fillStyle = 'rgba(200,180,120,0.08)'
      g.beginPath()
      g.arc(Math.random() * s, Math.random() * s, 1 + Math.random(), 0, Math.PI * 2)
      g.fill()
    }
    // Core outline
    g.strokeStyle = 'rgba(180,170,130,0.18)'
    g.lineWidth = 1
    g.beginPath()
    g.ellipse(s / 2, s / 2, 10, 15, 0, 0, Math.PI * 2)
    g.stroke()
  } else if (fruitType === 'pineapple') {
    // Bright golden-yellow flesh with fibrous core and radiating fibers
    g.fillStyle = '#f0d060'
    g.beginPath()
    g.arc(s / 2, s / 2, s / 2 - 8, 0, Math.PI * 2)
    g.fill()
    // Dense core center
    g.fillStyle = 'rgba(220,180,60,0.5)'
    g.beginPath()
    g.arc(s / 2, s / 2, 14, 0, Math.PI * 2)
    g.fill()
    // Radiating fiber lines
    g.strokeStyle = 'rgba(200,160,40,0.25)'
    g.lineWidth = 0.8
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2 + Math.cos(a) * 16, s / 2 + Math.sin(a) * 16)
      g.lineTo(s / 2 + Math.cos(a) * 56, s / 2 + Math.sin(a) * 56)
      g.stroke()
    }
    // Small dark "eye" dots around the edge
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      g.fillStyle = 'rgba(160,120,30,0.3)'
      g.beginPath()
      g.arc(s / 2 + Math.cos(a) * 44, s / 2 + Math.sin(a) * 44, 2, 0, Math.PI * 2)
      g.fill()
    }
  } else {
    g.strokeStyle = 'rgba(255,255,255,0.14)'
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      g.beginPath()
      g.moveTo(s / 2, s / 2)
      g.lineTo(s / 2 + Math.cos(a) * 62, s / 2 + Math.sin(a) * 62)
      g.stroke()
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 4
  fleshTexCache.set(key, tex)
  return tex
}

function getSkinMat(skin: THREE.Color, doubleSided = false): THREE.MeshStandardMaterial {
  const key = `${skin.getHexString()}:${doubleSided ? 'double' : 'front'}`
  let m = skinMatCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: skin.clone(),
      roughness: 0.38,
      metalness: 0.04,
      emissive: skin.clone().multiplyScalar(0.04),
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    })
    skinMatCache.set(key, m)
  }
  return m
}

function needsDoubleSidedGenericSkin(fruitType: FruitArchetype): boolean {
  return (
    fruitType === 'lemon' ||
    fruitType === 'lime' ||
    fruitType === 'mango' ||
    fruitType === 'coconut' ||
    fruitType === 'strawberry' ||
    fruitType === 'kiwi' ||
    fruitType === 'plum'
  )
}

function getSkinMatForFruit(
  fruitType: FruitArchetype,
  skin: THREE.Color,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  if (fruitType === 'watermelon') {
    return getWatermelonBodyMaterial()
  }
  if (fruitType === 'lemon') {
    return getLemonBodyMaterial()
  }
  if (fruitType === 'lime') {
    return getLimeBodyMaterial()
  }
  if (fruitType === 'mango') {
    return getMangoBodyMaterial()
  }
  if (fruitType === 'coconut') {
    return getCoconutBodyMaterial()
  }
  if (fruitType === 'strawberry') {
    return getStrawberryBodyMaterial()
  }
  if (fruitType === 'kiwi') {
    return getKiwiBodyMaterial()
  }
  if (fruitType === 'plum') {
    return getPlumBodyMaterial()
  }
  if (fruitType === 'banana') {
    return getBananaBodyMaterial(skin.getHex())
  }
  if (fruitType === 'apple') {
    return getAppleBodyMaterial()
  }
  if (fruitType === 'orange') {
    return getOrangeBodyMaterial()
  }
  if (fruitType === 'peach') {
    return getPeachBodyMaterial()
  }
  if (fruitType === 'pear') {
    return getPearBodyMaterial()
  }
  if (fruitType === 'cherry') {
    return getCherryBodyMaterial()
  }
  if (fruitType === 'pineapple') {
    return pineappleBodyMaterial()
  }
  if (fruitType === 'passionfruit') {
    return getPassionfruitBodyMaterial()
  }
  return getSkinMat(skin, needsDoubleSidedGenericSkin(fruitType))
}

function getFleshMat(flesh: THREE.Color): THREE.MeshStandardMaterial {
  const h = flesh.getHex()
  let m = fleshMatCache.get(h)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: flesh.clone(),
      map: fleshTextureForFruit('apple', flesh),
      roughness: 0.52,
      metalness: 0,
      emissive: flesh.clone().multiplyScalar(0.05),
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    fleshMatCache.set(h, m)
  }
  return m
}

function getFleshMatForFruit(fruitType: FruitArchetype, flesh: THREE.Color): THREE.MeshStandardMaterial {
  const key = `${fruitType}:${flesh.getHexString()}`
  const h = (flesh.getHex() ^ (fruitType === 'watermelon' ? 0x11aa33 : fruitType === 'banana' ? 0x33aa11 : 0x7))
  let m = fleshMatCache.get(h)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: flesh.clone(),
      map: fleshTextureForFruit(fruitType, flesh),
      roughness: fruitType === 'watermelon' ? 0.55 : fruitType === 'banana' ? 0.62 : 0.58,
      metalness: 0,
      emissive: flesh.clone().multiplyScalar(0.05),
      emissiveIntensity: 1,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
    ;(m as any).__fleshKey = key
    fleshMatCache.set(h, m)
  }
  return m
}

function createSplitCherryFruitMesh(
  radius: number,
  outwardNormal: THREE.Vector3,
  sideSign: -1 | 1,
): THREE.Group {
  const g = new THREE.Group()
  const n = outwardNormal.clone().normalize()
  const cherryRadius = radius * 0.50
  const fruitSide = sideSign < 0 ? -1 : 1
  const inward = -fruitSide

  const body = new THREE.Mesh(
    getCherryBodyPolyGeometry(cherryRadius),
    getCherryBodyMaterial(),
  )
  body.position.y = -radius * 0.02
  body.userData.sharedMaterial = true
  body.userData.sharedPool = true
  body.renderOrder = 2
  g.add(body)

  const stemMat = new THREE.MeshBasicMaterial({ color: 0x3a5818, toneMapped: false })
  const stemRadius = radius * 0.024
  const topY = body.position.y + cherryRadius * CHERRY_TOP_POLE_Y_RATIO
  const cutY = topY + radius * 0.40

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, topY - cherryRadius * 0.35, fruitSide > 0 ? radius * 0.02 : 0),
    new THREE.Vector3(inward * radius * 0.02, topY - cherryRadius * 0.05, fruitSide > 0 ? radius * 0.02 : 0),
    new THREE.Vector3(inward * radius * 0.10, topY + radius * 0.08, fruitSide > 0 ? radius * 0.01 : radius * 0.02),
    new THREE.Vector3(inward * radius * 0.30, cutY * 0.65, radius * 0.01),
    new THREE.Vector3(inward * radius * 0.52, cutY, 0),
  ])
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 16, stemRadius, 6, false),
    stemMat,
  )
  stem.userData.sharedPool = true
  g.add(stem)

  const cutEnd = new THREE.Mesh(
    new THREE.SphereGeometry(stemRadius * 1.35, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0x7a5a28, toneMapped: false }),
  )
  cutEnd.position.copy(stemCurve.getPoint(1))
  cutEnd.userData.sharedPool = true
  g.add(cutEnd)

  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  return g
}

function markHalfAccessory(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.userData.sharedPool = true
    }
  })
}

function addWatermelonTopStem(g: THREE.Group, radius: number) {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.065, radius * 0.095, radius * 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a5a22, roughness: 0.82, metalness: 0 }),
  )
  stem.position.y = radius * WATERMELON_AY * 0.9
  stem.rotation.z = 0.06
  markHalfAccessory(stem)
  g.add(stem)
}

function addPineappleTopCrown(g: THREE.Group, radius: number) {
  const bodyHeight = radius * 0.55 * 1.98
  const leafMat = new THREE.MeshBasicMaterial({ color: 0x145a14, side: THREE.DoubleSide })
  const leafMatLight = new THREE.MeshBasicMaterial({ color: 0x2a8a20, side: THREE.DoubleSide })
  const leafLenInner = bodyHeight * 0.78
  const leafLenOuter = bodyHeight * 0.62
  const leafW = radius * 0.30

  function makeLeafShape(len: number): THREE.Shape {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.bezierCurveTo(leafW * 0.9, len * 0.01, leafW * 0.30, len * 0.12, leafW * 0.02, len * 0.90)
    shape.lineTo(0, len)
    shape.lineTo(-leafW * 0.02, len * 0.90)
    shape.bezierCurveTo(-leafW * 0.30, len * 0.12, -leafW * 0.9, len * 0.01, 0, 0)
    return shape
  }

  const leafGeoInner = new THREE.ShapeGeometry(makeLeafShape(leafLenInner))
  const leafGeoOuter = new THREE.ShapeGeometry(makeLeafShape(leafLenOuter))
  const crownY = bodyHeight * 0.5
  const leafConfigs = [
    { angle: 0.0, tilt: 0.03, scale: 1.0, inner: true, light: true },
    { angle: 0.35, tilt: 0.05, scale: 0.97, inner: true, light: false },
    { angle: -0.30, tilt: 0.04, scale: 0.98, inner: true, light: true },
    { angle: 0.15, tilt: 0.02, scale: 0.96, inner: true, light: false },
    { angle: 0.80, tilt: 0.12, scale: 0.94, inner: true, light: true },
    { angle: -0.75, tilt: 0.10, scale: 0.95, inner: true, light: false },
    { angle: 1.50, tilt: 0.18, scale: 0.90, inner: true, light: true },
    { angle: -1.45, tilt: 0.16, scale: 0.91, inner: true, light: false },
    { angle: 1.15, tilt: 0.14, scale: 0.92, inner: true, light: true },
    { angle: 1.05, tilt: 0.28, scale: 0.88, inner: false, light: false },
    { angle: -1.00, tilt: 0.25, scale: 0.89, inner: false, light: true },
    { angle: 2.00, tilt: 0.38, scale: 0.82, inner: false, light: false },
    { angle: -1.95, tilt: 0.35, scale: 0.83, inner: false, light: true },
    { angle: 1.55, tilt: 0.32, scale: 0.85, inner: false, light: false },
    { angle: 2.50, tilt: 0.60, scale: 0.78, inner: false, light: false },
    { angle: -2.45, tilt: 0.58, scale: 0.79, inner: false, light: false },
    { angle: 2.90, tilt: 0.72, scale: 0.76, inner: false, light: false },
    { angle: Math.PI, tilt: 0.03, scale: 1.0, inner: true, light: true },
    { angle: Math.PI + 0.35, tilt: 0.05, scale: 0.97, inner: true, light: false },
    { angle: Math.PI - 0.30, tilt: 0.04, scale: 0.98, inner: true, light: true },
    { angle: Math.PI + 0.15, tilt: 0.02, scale: 0.96, inner: true, light: false },
    { angle: Math.PI + 0.80, tilt: 0.14, scale: 0.93, inner: true, light: true },
    { angle: Math.PI - 0.75, tilt: 0.12, scale: 0.94, inner: true, light: false },
    { angle: Math.PI + 1.50, tilt: 0.20, scale: 0.89, inner: true, light: true },
    { angle: Math.PI - 1.45, tilt: 0.18, scale: 0.90, inner: true, light: false },
    { angle: Math.PI + 1.15, tilt: 0.16, scale: 0.91, inner: true, light: true },
    { angle: Math.PI + 1.05, tilt: 0.30, scale: 0.87, inner: false, light: false },
    { angle: Math.PI - 1.00, tilt: 0.28, scale: 0.88, inner: false, light: true },
    { angle: Math.PI + 2.00, tilt: 0.40, scale: 0.81, inner: false, light: false },
    { angle: Math.PI - 1.95, tilt: 0.38, scale: 0.82, inner: false, light: true },
    { angle: Math.PI + 1.55, tilt: 0.35, scale: 0.84, inner: false, light: false },
    { angle: Math.PI + 2.50, tilt: 0.62, scale: 0.77, inner: false, light: false },
    { angle: Math.PI - 2.45, tilt: 0.60, scale: 0.78, inner: false, light: false },
    { angle: Math.PI + 2.90, tilt: 0.74, scale: 0.75, inner: false, light: false },
  ]

  for (const cfg of leafConfigs) {
    const wrapper = new THREE.Group()
    wrapper.position.y = crownY
    wrapper.rotation.y = cfg.angle
    const pivot = new THREE.Group()
    pivot.rotation.z = cfg.tilt
    const leaf = new THREE.Mesh(cfg.inner ? leafGeoInner : leafGeoOuter, cfg.light ? leafMatLight : leafMat)
    leaf.scale.setScalar(cfg.scale)
    pivot.add(leaf)
    wrapper.add(pivot)
    markHalfAccessory(wrapper)
    g.add(wrapper)
  }
}

function addStrawberryTopCalyx(g: THREE.Group, radius: number) {
  const calyxMat = new THREE.MeshStandardMaterial({
    color: 0x1E7A2E,
    roughness: 0.55,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x0A2A0A),
    emissiveIntensity: 0.12,
  })
  const leafShape = new THREE.Shape()
  leafShape.moveTo(0, 0)
  leafShape.quadraticCurveTo(0.16, 0.06, 0.09, 0.32)
  leafShape.lineTo(0, 0.52)
  leafShape.lineTo(-0.09, 0.32)
  leafShape.quadraticCurveTo(-0.16, 0.06, 0, 0)
  const leafGeo = new THREE.ShapeGeometry(leafShape)
  const topY = radius * 0.92

  for (let i = 0; i < 5; i++) {
    const wrapper = new THREE.Group()
    wrapper.position.set(0, topY, 0)
    wrapper.rotation.y = (i / 5) * Math.PI * 2
    const pivot = new THREE.Group()
    pivot.rotation.z = 1.45
    const sepal = new THREE.Mesh(leafGeo, calyxMat)
    sepal.scale.set(radius * 1.2, radius * 1.2, radius * 1.2)
    pivot.add(sepal)
    wrapper.add(pivot)
    markHalfAccessory(wrapper)
    g.add(wrapper)
  }

  const stemNub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.05, radius * 0.08, radius * 0.12, 6),
    new THREE.MeshStandardMaterial({ color: 0x1A5A22, roughness: 0.8 }),
  )
  stemNub.position.y = topY + radius * 0.10
  markHalfAccessory(stemNub)
  g.add(stemNub)
}

function addKiwiTopStem(g: THREE.Group, radius: number) {
  const topY = radius * KIWI_TOP_POLE_Y_RATIO
  const nub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.035, radius * 0.06, radius * 0.12, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3a20, roughness: 0.9 }),
  )
  nub.position.set(0, topY + radius * 0.04, 0)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.08, radius * 0.015, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x5a4828, roughness: 0.95 }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, topY + radius * 0.01, 0)
  markHalfAccessory(nub)
  markHalfAccessory(ring)
  g.add(nub, ring)
}

function addOrangeTopNavel(g: THREE.Group, radius: number) {
  const navel = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.06, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x5a8828 }),
  )
  navel.position.y = radius * 0.90
  navel.scale.set(1.2, 0.5, 1.2)
  markHalfAccessory(navel)
  g.add(navel)
}

function addPlumTopStem(g: THREE.Group, radius: number) {
  const topY = radius * PLUM_TOP_POLE_Y_RATIO
  const stemHeight = radius * 1.0
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.025, radius * 0.04, stemHeight, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.85 }),
  )
  stem.position.y = topY + stemHeight * 0.5
  stem.rotation.z = 0.08
  markHalfAccessory(stem)
  g.add(stem)
}

function addPearTopStem(g: THREE.Group, radius: number) {
  const bodyGeo = getPearBodyPolyGeometry(radius)
  const topY = (bodyGeo as any)._topY ?? (radius * PEAR_TOP_POLE_Y_RATIO)
  const stemH = radius * 0.50
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.035, radius * 0.07, stemH, 6),
    new THREE.MeshBasicMaterial({ color: 0x3d2914, toneMapped: false }),
  )
  stem.position.y = topY + stemH * 0.50
  stem.rotation.z = 0.12
  markHalfAccessory(stem)
  g.add(stem)
}

function addPeachTopStem(g: THREE.Group, radius: number) {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.03, radius * 0.05, radius * 0.18, 6),
    new THREE.MeshBasicMaterial({ color: 0x4a3520 }),
  )
  stem.position.y = radius * PEACH_TOP_POLE_Y_RATIO
  stem.rotation.z = 0.08
  markHalfAccessory(stem)
  g.add(stem)
}

function addPassionfruitTopCalyx(g: THREE.Group, radius: number) {
  const calyx = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.06, radius * 0.12, radius * 0.10, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3822, roughness: 0.85 }),
  )
  calyx.position.y = radius * 0.96
  markHalfAccessory(calyx)
  g.add(calyx)

  for (let i = 0; i < 3; i++) {
    const sepal = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.035, radius * 0.25, radius * 0.10),
      new THREE.MeshStandardMaterial({ color: 0x5a4a28, roughness: 0.9 }),
    )
    const angle = (i / 3) * Math.PI * 2
    sepal.position.set(Math.cos(angle) * radius * 0.10, radius * 0.98, Math.sin(angle) * radius * 0.10)
    sepal.rotation.y = -angle
    sepal.rotation.x = -0.6
    markHalfAccessory(sepal)
    g.add(sepal)
  }

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.02, radius * 0.04, radius * 0.15, 5),
    new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.9 }),
  )
  stem.position.y = radius * 1.06
  markHalfAccessory(stem)
  g.add(stem)
}

function addSlicedTopAccessories(g: THREE.Group, fruitType: FruitArchetype, radius: number) {
  switch (fruitType) {
    case 'watermelon':
      addWatermelonTopStem(g, radius)
      break
    case 'pineapple':
      addPineappleTopCrown(g, radius)
      break
    case 'strawberry':
      addStrawberryTopCalyx(g, radius)
      break
    case 'kiwi':
      addKiwiTopStem(g, radius)
      break
    case 'orange':
      addOrangeTopNavel(g, radius)
      break
    case 'plum':
      addPlumTopStem(g, radius)
      break
    case 'pear':
      addPearTopStem(g, radius)
      break
    case 'peach':
      addPeachTopStem(g, radius)
      break
    case 'passionfruit':
      addPassionfruitTopCalyx(g, radius)
      break
  }
}

/**
 * One hemisphere of a sliced fruit: curved skin + flat circular cut face (flesh).
 * Local +Y is the outward normal of the cut (into this half's interior / visible pulp).
 * Geometries and materials are shared — do not dispose them in disposeFruitHalfRoot.
 */
export function createFruitHalfMesh(
  radius: number,
  outwardNormal: THREE.Vector3,
  skinColor: THREE.Color,
  fleshColor: THREE.Color,
  fruitType: FruitArchetype,
  sideSign: -1 | 1,
): THREE.Group {
  const g = new THREE.Group()
  const n = outwardNormal.clone().normalize()

  if (fruitType === 'cherry') {
    return createSplitCherryFruitMesh(radius, outwardNormal, sideSign)
  }

  let curved: THREE.Mesh
  let capScale = radius
  if (fruitType === 'banana') {
    const curve = createBananaSpineCurve(radius)
    const baseR = radius * 0.36
    const tubularSegments = 56
    const radialSegments = 10
    const geo = new THREE.TubeGeometry(curve, tubularSegments, baseR, radialSegments, false)
    applyTubeRadiusProfile(geo, curve, baseR, bananaGirthScale)

    // Find the spine point closest to y=0 — that is the cross-section centre
    let cutT = 0.5
    for (let i = 0; i <= 100; i++) {
      const t = i / 100
      if (curve.getPointAt(t).y >= 0) { cutT = t; break }
    }
    const cutPoint = curve.getPointAt(cutT)

    // Slice the tube horizontally: keep only the top half (y >= 0) or bottom half
    // (y <= 0) by clamping vertex Y to the equator plane.
    const pos = geo.attributes.position as THREE.BufferAttribute
    const isTop = sideSign < 0 // sideSign < 0 → top half
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (isTop && y < 0) pos.setY(i, 0)
      else if (!isTop && y > 0) pos.setY(i, 0)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()

    curved = new THREE.Mesh(geo, getSkinMatForFruit('banana', skinColor))
    // Cap scale: slightly smaller than cross-section to stay inside the peel
    capScale = baseR * bananaGirthScale(0.5) * 0.75
    // Store cutPoint for disc positioning later (after cap creation)
    ;(g as any).__bananaCutPoint = cutPoint
  } else if (fruitType === 'watermelon') {
    curved = new THREE.Mesh(
      getWatermelonSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * Math.max(WATERMELON_AX, WATERMELON_AZ) * 1.01
  } else if (fruitType === 'apple') {
    curved = new THREE.Mesh(
      getAppleSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * APPLE_MAX_XZ * 1.01
  } else if (fruitType === 'kiwi') {
    curved = new THREE.Mesh(
      getKiwiSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * KIWI_MAX_XZ * 1.01
  } else if (fruitType === 'plum') {
    curved = new THREE.Mesh(
      getPlumSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * PLUM_MAX_XZ * 1.01
  } else if (fruitType === 'orange') {
    curved = new THREE.Mesh(
      getOrangeSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * ORANGE_MAX_XZ * 1.01
  } else if (fruitType === 'peach') {
    curved = new THREE.Mesh(
      getPeachSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * PEACH_MAX_XZ * 1.01
  } else if (fruitType === 'pear') {
    curved = new THREE.Mesh(
      getPearSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * PEAR_MAX_XZ * 1.01
  } else if (fruitType === 'lemon') {
    curved = new THREE.Mesh(
      getLemonSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * LEMON_MAX_XZ * 1.01
  } else if (fruitType === 'lime') {
    curved = new THREE.Mesh(
      getLimeSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * LIME_MAX_XZ * 1.01
  } else if (fruitType === 'mango') {
    curved = new THREE.Mesh(
      getMangoSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * MANGO_MAX_XZ * 1.01
  } else if (fruitType === 'pineapple') {
    curved = new THREE.Mesh(
      getPineappleSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * PINEAPPLE_MAX_XZ * 1.01
  } else if (fruitType === 'coconut') {
    curved = new THREE.Mesh(
      getCoconutSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * COCONUT_MAX_XZ * 1.01
  } else if (fruitType === 'strawberry') {
    curved = new THREE.Mesh(
      getStrawberrySlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * STRAWBERRY_MAX_XZ * 1.01
  } else if (fruitType === 'passionfruit') {
    curved = new THREE.Mesh(
      getPassionfruitSlicedHalfPolyGeometry(radius, sideSign < 0 ? 'top' : 'bottom'),
      getSkinMatForFruit(fruitType, skinColor),
    )
    capScale = radius * PASSIONFRUIT_MAX_XZ * 1.01
  } else {
    curved = new THREE.Mesh(sharedHemisphere, getSkinMatForFruit(fruitType, skinColor))
    curved.scale.setScalar(radius)
  }
  curved.castShadow = false
  curved.receiveShadow = false
  curved.userData.sharedPool = true
  curved.renderOrder = 2
  g.add(curved)

  // The cap (flesh disc) sits at the equator cut.  It must face *inward* toward the
  // curved half-shell so the flesh texture is visible from outside the other half.
  //
  // For spherical fruits: before the group quaternion is applied the half-shell spans
  // y ∈ [0, +r] (upper hemisphere).  The cap faces -Y (visible from below).  The
  // bottom-half group is rotated 180° which flips both shell and cap, so the cap then
  // faces +Y (visible from above).
  //
  // For banana: no group rotation, so the top-half cap must face -Y (visible from
  // below) and the bottom-half cap must face +Y (visible from above).
  const isTopHalf = sideSign < 0
  if (fruitType === 'banana') {
    // Banana gets a dedicated flesh disc with its own texture — yellow skin ring,
    // white cream interior, fiber lines, and tiny seed spots.
    const discR = capScale * 1.10 // 10% larger
    const discGeo = new THREE.CircleGeometry(discR, 20)
    const texSize = 128
    const texC = document.createElement('canvas')
    texC.width = texSize; texC.height = texSize
    const tc = texC.getContext('2d')!
    const cx = texSize / 2, cy = texSize / 2, outerR = texSize / 2 - 2

    // Yellow skin ring (peel)
    const skinGrad = tc.createRadialGradient(cx, cy, outerR * 0.62, cx, cy, outerR)
    skinGrad.addColorStop(0, '#f0c830')
    skinGrad.addColorStop(0.4, '#dab028')
    skinGrad.addColorStop(1, '#b89018')
    tc.fillStyle = skinGrad
    tc.beginPath()
    tc.arc(cx, cy, outerR, 0, Math.PI * 2)
    tc.fill()

    // White/cream flesh interior
    const fleshR = outerR * 0.62
    const fleshGrad = tc.createRadialGradient(cx, cy, 3, cx, cy, fleshR)
    fleshGrad.addColorStop(0, '#fffff8')
    fleshGrad.addColorStop(1, '#fff5e0')
    tc.fillStyle = fleshGrad
    tc.beginPath()
    tc.arc(cx, cy, fleshR, 0, Math.PI * 2)
    tc.fill()

    // Fiber lines
    tc.strokeStyle = 'rgba(255,255,240,0.22)'
    tc.lineWidth = 0.8
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2
      const r0 = 3 + Math.random() * 6
      const r1 = fleshR * (0.7 + Math.random() * 0.25)
      tc.beginPath()
      tc.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      tc.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      tc.stroke()
    }

    // Tiny seed dots
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 2 + Math.random() * 8
      tc.fillStyle = 'rgba(80,60,30,0.18)'
      tc.beginPath()
      tc.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2, 2, a, 0, Math.PI * 2)
      tc.fill()
    }

    const discTex = new THREE.CanvasTexture(texC)
    discTex.colorSpace = THREE.SRGBColorSpace
    const discMat = new THREE.MeshStandardMaterial({
      map: discTex,
      roughness: 0.58,
      metalness: 0,
      side: THREE.FrontSide,
    })
    const disc = new THREE.Mesh(discGeo, discMat)
    disc.rotation.x = isTopHalf ? Math.PI / 2 : -Math.PI / 2
    // Position disc at the spine's cross-section centre, shifted 10% toward it
    const cutPt = (g as any).__bananaCutPoint as THREE.Vector3
    const shiftX = cutPt.x
    const shiftZ = cutPt.z
    disc.position.set(shiftX, isTopHalf ? -0.005 : 0.005, shiftZ)
    disc.castShadow = false
    disc.receiveShadow = false
    g.add(disc)
    delete (g as any).__bananaCutPoint
  } else {
    const cap = new THREE.Mesh(sharedCap, getFleshMatForFruit(fruitType, fleshColor))
    const capInset = Math.max(0.0025, radius * 0.02)
    cap.scale.setScalar(capScale)
    cap.rotation.x = Math.PI / 2
    cap.position.y = capInset
    cap.castShadow = false
    cap.receiveShadow = false
    cap.userData.sharedPool = true
    cap.renderOrder = 1
    g.add(cap)
  }

  // Apple stem on the top half
  if (fruitType === 'apple' && n.y > 0.5) {
    const stemH = radius * 0.24
    const stemCenterY = radius * APPLE_TOP_POLE_Y_RATIO + stemH * 0.40
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.05, radius * 0.09, stemH, 8),
      new THREE.MeshBasicMaterial({ color: 0x5a3a1e, toneMapped: false }),
    )
    stem.position.y = stemCenterY
    stem.userData.sharedPool = true
    g.add(stem)
  }
  if (fruitType !== 'apple' && n.y > 0.5) {
    addSlicedTopAccessories(g, fruitType, radius)
  }

  // For spherical fruits, rotating the group so local +Y aligns with the outward
  // normal correctly flips the bottom half.  For banana the tube is asymmetric —
  // rotating 180° would swap head/tail, so skip the group rotation entirely.
  if (fruitType !== 'banana') {
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  }
  return g
}

/** Detach half meshes without disposing pooled geometry/materials. */
export function disposeFruitHalfRoot(root: THREE.Group) {
  while (root.children.length > 0) {
    root.remove(root.children[0]!)
  }
}
