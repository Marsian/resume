import * as THREE from 'three'

import type { FruitArchetype } from './spawn'
import { getAppleBodyMaterial } from './appleSkin'
import { getAppleHalfPolyGeometry, APPLE_MAX_XZ } from './applePolyGeometry'
import { getKiwiHalfPolyGeometry, KIWI_MAX_XZ } from './kiwiPolyGeometry'
import { getBananaBodyMaterial } from './bananaSkin'
import { getWatermelonBodyMaterial } from './watermelonSkin'
import {
  getWatermelonHalfPolyGeometry,
  WATERMELON_AX,
  WATERMELON_AZ,
} from './watermelonPolyGeometry'

/** Lighter "pulp" tone from skin color (fallback when spawn did not set flesh). */
export function fleshColorFromSkin(skin: THREE.Color): THREE.Color {
  return new THREE.Color().copy(skin).lerp(new THREE.Color(0xfff5e8), 0.55)
}

// --- Shared GPU resources for fruit halves (avoid per-slice alloc + shader compile) ---

const HEM_SEGMENTS = 16
const HEM_RINGS = 12
const sharedHemisphere = new THREE.SphereGeometry(1, HEM_SEGMENTS, HEM_RINGS, 0, Math.PI * 2, 0, Math.PI / 2)
const sharedCap = new THREE.CircleGeometry(0.997, 20)

const skinMatCache = new Map<number, THREE.MeshStandardMaterial>()
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
    // Lavender/pink flesh with stone outline
    g.strokeStyle = 'rgba(180,140,180,0.2)'
    g.lineWidth = 2
    g.beginPath()
    g.ellipse(s / 2, s / 2, 12, 18, 0, 0, Math.PI * 2)
    g.stroke()
    for (let i = 0; i < 30; i++) {
      g.fillStyle = 'rgba(220,200,220,0.08)'
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
  } else {
    // Generic: faint radial fibers
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

function getSkinMat(skin: THREE.Color): THREE.MeshStandardMaterial {
  const h = skin.getHex()
  let m = skinMatCache.get(h)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: skin.clone(),
      roughness: 0.38,
      metalness: 0.04,
      emissive: skin.clone().multiplyScalar(0.04),
    })
    skinMatCache.set(h, m)
  }
  return m
}

function getSkinMatForFruit(
  fruitType: FruitArchetype,
  skin: THREE.Color,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
  if (fruitType === 'watermelon') {
    return getWatermelonBodyMaterial()
  }
  if (fruitType === 'banana') {
    return getBananaBodyMaterial(skin.getHex())
  }
  if (fruitType === 'apple') {
    return getAppleBodyMaterial()
  }
  return getSkinMat(skin)
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
      side: THREE.DoubleSide,
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
      side: THREE.DoubleSide,
    })
    ;(m as any).__fleshKey = key
    fleshMatCache.set(h, m)
  }
  return m
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

  let curved: THREE.Mesh
  let capScale = radius
  if (fruitType === 'banana') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -radius * 0.95, 0),
      new THREE.Vector3(radius * 0.25, -radius * 0.45, radius * 0.12),
      new THREE.Vector3(radius * 0.7, radius * 0.15, radius * 0.06),
      new THREE.Vector3(radius * 1.0, radius * 0.65, -radius * 0.08),
      new THREE.Vector3(radius * 0.85, radius * 0.95, -radius * 0.18),
    ])
    const t0 = sideSign < 0 ? 0.0 : 0.52
    const t1 = sideSign < 0 ? 0.52 : 1.0
    const pts: THREE.Vector3[] = []
    const steps = 10
    for (let i = 0; i <= steps; i++) {
      const t = t0 + ((t1 - t0) * i) / steps
      pts.push(curve.getPoint(t))
    }
    const sub = new THREE.CatmullRomCurve3(pts)
    const tubeR = radius * 0.38
    const geo = new THREE.TubeGeometry(sub, 14, tubeR, 10, false)
    const cutT = 0.52
    const cutP = curve.getPoint(cutT)
    geo.translate(-cutP.x, -cutP.y, -cutP.z)
    curved = new THREE.Mesh(geo, getSkinMatForFruit('banana', skinColor))
    capScale = tubeR * 1.01
  } else if (fruitType === 'watermelon') {
    curved = new THREE.Mesh(getWatermelonHalfPolyGeometry(radius), getSkinMatForFruit(fruitType, skinColor))
    capScale = radius * Math.max(WATERMELON_AX, WATERMELON_AZ) * 1.01
  } else if (fruitType === 'apple') {
    curved = new THREE.Mesh(getAppleHalfPolyGeometry(radius), getSkinMatForFruit(fruitType, skinColor))
    capScale = radius * APPLE_MAX_XZ * 1.01
  } else if (fruitType === 'kiwi') {
    curved = new THREE.Mesh(getKiwiHalfPolyGeometry(radius), getSkinMatForFruit(fruitType, skinColor))
    capScale = radius * KIWI_MAX_XZ * 1.01
  } else {
    curved = new THREE.Mesh(sharedHemisphere, getSkinMatForFruit(fruitType, skinColor))
    curved.scale.setScalar(radius)
  }
  curved.castShadow = false
  curved.receiveShadow = false
  curved.userData.sharedPool = true
  g.add(curved)

  const cap = new THREE.Mesh(sharedCap, getFleshMatForFruit(fruitType, fleshColor))
  cap.scale.setScalar(capScale)
  cap.rotation.x = -Math.PI / 2
  cap.position.y = -0.0015
  cap.castShadow = false
  cap.receiveShadow = false
  cap.userData.sharedPool = true
  g.add(cap)

  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  return g
}

/** Detach half meshes without disposing pooled geometry/materials. */
export function disposeFruitHalfRoot(root: THREE.Group) {
  while (root.children.length > 0) {
    root.remove(root.children[0]!)
  }
}
