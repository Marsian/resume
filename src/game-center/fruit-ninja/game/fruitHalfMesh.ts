import * as THREE from 'three'

import type { FruitArchetype } from './spawn'

/** Lighter “pulp” tone from skin color (fallback when spawn did not set flesh). */
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

let watermelonStripeTex: THREE.CanvasTexture | null = null
function watermelonStripeTexture(): THREE.CanvasTexture {
  if (watermelonStripeTex) return watermelonStripeTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#2f8c3f'
  g.fillRect(0, 0, 64, 64)
  for (let x = 0; x < 64; x += 8) {
    g.fillStyle = x % 16 === 0 ? '#1c6f2d' : '#4fbf5d'
    g.fillRect(x, 0, 4, 64)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 2)
  watermelonStripeTex = tex
  return tex
}

let bananaSpeckleTex: THREE.CanvasTexture | null = null
function bananaSpeckleTexture(): THREE.CanvasTexture {
  if (bananaSpeckleTex) return bananaSpeckleTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#f3d55a'
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 64
    const y = Math.random() * 64
    const a = 0.06 + Math.random() * 0.14
    g.fillStyle = `rgba(120,80,20,${a})`
    g.fillRect(x, y, 1, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2.4, 1.6)
  bananaSpeckleTex = tex
  return tex
}

function fleshTextureForFruit(fruitType: FruitArchetype, flesh: THREE.Color): THREE.CanvasTexture {
  const key = `${fruitType}:${flesh.getHexString()}`
  const cached = fleshTexCache.get(key)
  if (cached) return cached

  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!

  const base = flesh.clone()
  const hi = base.clone().lerp(new THREE.Color(0xffffff), 0.22)
  const lo = base.clone().multiplyScalar(0.75)

  // Base gradient (avoids "flat disk" look).
  const radial = g.createRadialGradient(64, 64, 8, 64, 64, 68)
  radial.addColorStop(0, `#${hi.getHexString()}`)
  radial.addColorStop(1, `#${lo.getHexString()}`)
  g.fillStyle = radial
  g.fillRect(0, 0, 128, 128)

  if (fruitType === 'watermelon') {
    // Seeds: dark ovals scattered toward center.
    g.fillStyle = 'rgba(30, 10, 10, 0.55)'
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 10 + Math.random() * 46
      const x = 64 + Math.cos(a) * r
      const y = 64 + Math.sin(a) * r
      const w = 2 + Math.random() * 2.6
      const h = 4 + Math.random() * 4.2
      g.save()
      g.translate(x, y)
      g.rotate(a + (Math.random() - 0.5) * 0.6)
      g.beginPath()
      g.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
  } else if (fruitType === 'banana') {
    // Fibers: subtle radial strokes.
    g.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2
      const r0 = 6 + Math.random() * 10
      const r1 = 40 + Math.random() * 24
      g.beginPath()
      g.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0)
      g.lineTo(64 + Math.cos(a) * r1, 64 + Math.sin(a) * r1)
      g.stroke()
    }
  } else {
    // Generic: faint fibers.
    g.strokeStyle = 'rgba(255,255,255,0.16)'
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      g.beginPath()
      g.moveTo(64, 64)
      g.lineTo(64 + Math.cos(a) * 64, 64 + Math.sin(a) * 64)
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

function getSkinMatForFruit(fruitType: FruitArchetype, skin: THREE.Color): THREE.MeshStandardMaterial {
  // Keep caching behavior: keyed by skin color, but certain fruits override map.
  if (fruitType === 'watermelon') {
    const h = skin.getHex() ^ 0x77aa33
    let m = skinMatCache.get(h)
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        map: watermelonStripeTexture(),
        color: skin.clone(),
        roughness: 0.45,
        metalness: 0,
        emissive: skin.clone().multiplyScalar(0.06),
        emissiveIntensity: 1,
      })
      m.userData = { sharedPool: true }
      skinMatCache.set(h, m)
    }
    return m
  }
  if (fruitType === 'banana') {
    const h = skin.getHex() ^ 0x33cc77
    let m = skinMatCache.get(h)
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        map: bananaSpeckleTexture(),
        color: skin.clone(),
        roughness: 0.55,
        metalness: 0,
        emissive: skin.clone().multiplyScalar(0.03),
        emissiveIntensity: 1,
      })
      m.userData = { sharedPool: true }
      skinMatCache.set(h, m)
    }
    return m
  }
  return getSkinMat(skin)
}

function getFleshMat(flesh: THREE.Color): THREE.MeshStandardMaterial {
  const h = flesh.getHex()
  let m = fleshMatCache.get(h)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: flesh.clone(),
      map: fleshTextureForFruit('apple', flesh), // default (overridden by per-fruit helper)
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
  // Cache per fruitType + flesh color to allow distinct maps.
  const key = `${fruitType}:${flesh.getHexString()}`
  const h = (flesh.getHex() ^ (fruitType === 'watermelon' ? 0x11aa33 : fruitType === 'banana' ? 0x33aa11 : 0x7))
  let m = fleshMatCache.get(h)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: flesh.clone(),
      map: fleshTextureForFruit(fruitType, flesh),
      roughness: fruitType === 'watermelon' ? 0.58 : fruitType === 'banana' ? 0.66 : 0.6,
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
 * Local +Y is the outward normal of the cut (into this half’s interior / visible pulp).
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
    // Two banana segments (not hemispheres): approximate by slicing the banana tube along its arc length.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -radius * 0.9, 0),
      new THREE.Vector3(radius * 0.35, -radius * 0.2, radius * 0.08),
      new THREE.Vector3(radius * 0.85, radius * 0.35, 0),
      new THREE.Vector3(radius * 1.05, radius * 0.75, -radius * 0.12),
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
    const tubeR = radius * 0.42
    const geo = new THREE.TubeGeometry(sub, 14, tubeR, 10, false)
    // Re-center so the cut surface is at the local origin, so the cap can be a simple disk.
    const cutT = 0.52
    const cutP = curve.getPoint(cutT)
    geo.translate(-cutP.x, -cutP.y, -cutP.z)
    curved = new THREE.Mesh(geo, getSkinMatForFruit('banana', skinColor))
    capScale = tubeR * 1.01
  } else {
    curved = new THREE.Mesh(sharedHemisphere, getSkinMatForFruit(fruitType, skinColor))
    curved.scale.setScalar(radius)
    if (fruitType === 'watermelon') {
      // Match the whole watermelon’s slightly squashed silhouette.
      curved.scale.multiply(new THREE.Vector3(1.05, 0.88, 1.05))
    }
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
