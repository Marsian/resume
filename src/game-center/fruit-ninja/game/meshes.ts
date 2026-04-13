import * as THREE from 'three'

import { getAppleBodyMaterial } from './appleSkin'
import { getAppleBodyPolyGeometry, APPLE_TOP_POLE_Y_RATIO } from './applePolyGeometry'
import { getLemonBodyMaterial } from './lemonSkin'
import { getLemonBodyPolyGeometry } from './lemonPolyGeometry'
import { getLimeBodyMaterial } from './limeSkin'
import { getLimeBodyPolyGeometry } from './limePolyGeometry'
import { getMangoBodyMaterial } from './mangoSkin'
import { getMangoBodyPolyGeometry } from './mangoPolyGeometry'
import { getCoconutBodyMaterial } from './coconutSkin'
import { getCoconutBodyPolyGeometry } from './coconutPolyGeometry'
import { getStrawberryBodyMaterial } from './strawberrySkin'
import { getStrawberryBodyPolyGeometry } from './strawberryPolyGeometry'
import { getBananaBodyMaterial } from './bananaSkin'
import {
  applyTubeRadiusProfile,
  bananaGirthScale,
  createBananaEndSeal,
  createBananaSpineCurve,
} from './bananaGeometry'
import type { FruitArchetype } from './spawn'
import { getWatermelonBodyMaterial } from './watermelonSkin'
import { getWatermelonBodyPolyGeometry, WATERMELON_AY } from './watermelonPolyGeometry'

export function disposeObject3D(root: THREE.Object3D) {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const ud = child.userData as { sharedPool?: boolean; sharedMaterial?: boolean } | undefined
      if (ud?.sharedPool) return
      child.geometry?.dispose()
      if (!ud?.sharedMaterial) {
        const m = child.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m?.dispose()
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Enhanced procedural texture generators (128×128 for richer detail)
// (Watermelon + banana skin canvases live in `fruitSkinTextures.ts`; materials in `*Skin.ts`.)
// ---------------------------------------------------------------------------

let pineappleSkinTex: THREE.CanvasTexture | null = null
function pineappleSkinTexture(): THREE.CanvasTexture {
  if (pineappleSkinTex) return pineappleSkinTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  // Golden-brown base
  g.fillStyle = '#c49420'
  g.fillRect(0, 0, s, s)
  // Hexagonal / diamond scale pattern
  const cellW = 14, cellH = 12
  for (let row = -1; row < s / cellH + 1; row++) {
    const offsetX = (row % 2) * (cellW / 2)
    for (let col = -1; col < s / cellW + 1; col++) {
      const cx = col * cellW + offsetX
      const cy = row * cellH
      // Dark outline
      g.strokeStyle = '#6a4a12'
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(cx, cy + cellH * 0.5)
      g.lineTo(cx + cellW * 0.5, cy)
      g.lineTo(cx + cellW, cy + cellH * 0.5)
      g.lineTo(cx + cellW * 0.5, cy + cellH)
      g.closePath()
      g.stroke()
      // Highlight dot at center
      g.fillStyle = 'rgba(255,220,120,0.25)'
      g.beginPath()
      g.arc(cx + cellW * 0.5, cy + cellH * 0.5, 2, 0, Math.PI * 2)
      g.fill()
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 4)
  pineappleSkinTex = tex
  return tex
}

let kiwiFuzzTex: THREE.CanvasTexture | null = null
function kiwiFuzzTexture(): THREE.CanvasTexture {
  if (kiwiFuzzTex) return kiwiFuzzTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = '#6a4f18'
  g.fillRect(0, 0, s, s)
  // Fuzz fibers — short strokes radiating from random points
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * s
    const y = Math.random() * s
    const angle = Math.random() * Math.PI * 2
    const len = 1.5 + Math.random() * 2.5
    g.strokeStyle = Math.random() > 0.5 ? 'rgba(90,65,20,0.5)' : 'rgba(130,100,40,0.4)'
    g.lineWidth = 0.6
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    g.stroke()
  }
  // Lighter patches for variation
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(120,95,35,${0.08 + Math.random() * 0.1})`
    g.beginPath()
    g.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 5, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  kiwiFuzzTex = tex
  return tex
}

let orangePoreTex: THREE.CanvasTexture | null = null
function orangePoreTexture(): THREE.CanvasTexture {
  if (orangePoreTex) return orangePoreTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  // Bright orange base
  g.fillStyle = '#ff9020'
  g.fillRect(0, 0, s, s)
  // Dimpled pores
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * s
    const y = Math.random() * s
    const r = 0.4 + Math.random() * 1.0
    g.fillStyle = `rgba(180,70,0,${0.12 + Math.random() * 0.2})`
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  // Subtle highlight specks
  for (let i = 0; i < 100; i++) {
    g.fillStyle = `rgba(255,200,100,${0.05 + Math.random() * 0.08})`
    g.beginPath()
    g.arc(Math.random() * s, Math.random() * s, 0.5 + Math.random(), 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  orangePoreTex = tex
  return tex
}

let passionSpeckleTex: THREE.CanvasTexture | null = null
function passionSpeckleTexture(): THREE.CanvasTexture {
  if (passionSpeckleTex) return passionSpeckleTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  // Dark purple base
  g.fillStyle = '#2a1840'
  g.fillRect(0, 0, s, s)
  // Speckles
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * s
    const y = Math.random() * s
    g.fillStyle = `rgba(200,180,220,${0.15 + Math.random() * 0.2})`
    g.fillRect(x, y, 1 + (Math.random() * 2) | 0, 1)
  }
  // Subtle wrinkle lines
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(50,30,70,${0.1 + Math.random() * 0.1})`
    g.lineWidth = 0.5
    g.beginPath()
    const sx = Math.random() * s
    const sy = Math.random() * s
    g.moveTo(sx, sy)
    g.lineTo(sx + (Math.random() - 0.5) * 12, sy + (Math.random() - 0.5) * 12)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  passionSpeckleTex = tex
  return tex
}



let plumBloomTex: THREE.CanvasTexture | null = null
function plumBloomTexture(): THREE.CanvasTexture {
  if (plumBloomTex) return plumBloomTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  // Deep purple base
  g.fillStyle = '#5a1868'
  g.fillRect(0, 0, s, s)
  // Dusty bloom overlay
  for (let i = 0; i < 800; i++) {
    g.fillStyle = `rgba(180,160,200,${0.02 + Math.random() * 0.05})`
    g.beginPath()
    g.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 2.5, 0, Math.PI * 2)
    g.fill()
  }
  // Subtle glossy highlight zone
  const grad = g.createRadialGradient(s * 0.35, s * 0.35, 0, s * 0.35, s * 0.35, s * 0.45)
  grad.addColorStop(0, 'rgba(200,180,220,0.12)')
  grad.addColorStop(1, 'rgba(200,180,220,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  plumBloomTex = tex
  return tex
}

let peachFuzzTex: THREE.CanvasTexture | null = null
function peachFuzzTexture(): THREE.CanvasTexture {
  if (peachFuzzTex) return peachFuzzTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  // Soft peach base
  g.fillStyle = '#ff9060'
  g.fillRect(0, 0, s, s)
  // Fuzz fibers
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * s
    const y = Math.random() * s
    g.strokeStyle = `rgba(255,200,160,${0.06 + Math.random() * 0.08})`
    g.lineWidth = 0.5
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (Math.random() - 0.5) * 2, y - 1 - Math.random() * 2)
    g.stroke()
  }
  // Rosy blush areas
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(220,80,60,${0.04 + Math.random() * 0.06})`
    g.beginPath()
    g.arc(Math.random() * s, Math.random() * s, 5 + Math.random() * 8, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  peachFuzzTex = tex
  return tex
}


let pearTex: THREE.CanvasTexture | null = null
function pearTexture(): THREE.CanvasTexture {
  if (pearTex) return pearTex
  const s = 128
  const c = document.createElement('canvas')
  c.width = s; c.height = s
  const g = c.getContext('2d')!
  // Yellow-green base
  g.fillStyle = '#b0c040'
  g.fillRect(0, 0, s, s)
  // Subtle speckle / lenticels
  for (let i = 0; i < 200; i++) {
    g.fillStyle = `rgba(160,140,50,${0.06 + Math.random() * 0.08})`
    g.beginPath()
    g.ellipse(Math.random() * s, Math.random() * s, 0.8 + Math.random() * 1.5, 0.5 + Math.random(), 0, 0, Math.PI * 2)
    g.fill()
  }
  // Slight blush
  const grad = g.createRadialGradient(s * 0.6, s * 0.3, 0, s * 0.6, s * 0.3, s * 0.4)
  grad.addColorStop(0, 'rgba(220,180,80,0.15)')
  grad.addColorStop(1, 'rgba(220,180,80,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  pearTex = tex
  return tex
}

// ---------------------------------------------------------------------------
// Cached body materials
// ---------------------------------------------------------------------------

let pineappleBodyMat: THREE.MeshStandardMaterial | null = null
function pineappleBodyMaterial(): THREE.MeshStandardMaterial {
  if (!pineappleBodyMat) {
    pineappleBodyMat = new THREE.MeshStandardMaterial({
      map: pineappleSkinTexture(),
      color: 0xd4a840,
      roughness: 0.50,
      metalness: 0,
      emissive: new THREE.Color(0x4a3a10),
      emissiveIntensity: 0.15,
    })
  }
  return pineappleBodyMat
}

let kiwiBodyMat: THREE.MeshStandardMaterial | null = null
function kiwiBodyMaterial(): THREE.MeshStandardMaterial {
  if (!kiwiBodyMat) {
    kiwiBodyMat = new THREE.MeshStandardMaterial({
      map: kiwiFuzzTexture(),
      color: 0x8a6a1e,
      roughness: 0.88,
      metalness: 0,
    })
  }
  return kiwiBodyMat
}

let orangeBodyMat: THREE.MeshStandardMaterial | null = null
function orangeBodyMaterial(): THREE.MeshStandardMaterial {
  if (!orangeBodyMat) {
    orangeBodyMat = new THREE.MeshStandardMaterial({
      map: orangePoreTexture(),
      color: 0xff8c00,
      roughness: 0.36,
      metalness: 0,
      emissive: new THREE.Color(0x604000),
      emissiveIntensity: 0.08,
    })
  }
  return orangeBodyMat
}

let passionBodyMat: THREE.MeshStandardMaterial | null = null
function passionBodyMaterial(): THREE.MeshStandardMaterial {
  if (!passionBodyMat) {
    passionBodyMat = new THREE.MeshStandardMaterial({
      map: passionSpeckleTexture(),
      color: 0x4a2868,
      roughness: 0.52,
      metalness: 0,
      emissive: new THREE.Color(0x1a0a28),
      emissiveIntensity: 0.2,
    })
  }
  return passionBodyMat
}



let plumBodyMat: THREE.MeshStandardMaterial | null = null
function plumBodyMaterial(): THREE.MeshStandardMaterial {
  if (!plumBodyMat) {
    plumBodyMat = new THREE.MeshStandardMaterial({
      map: plumBloomTexture(),
      color: 0x6a2078,
      roughness: 0.42,
      metalness: 0.02,
      emissive: new THREE.Color(0x280a30),
      emissiveIntensity: 0.15,
    })
  }
  return plumBodyMat
}

let peachBodyMat: THREE.MeshStandardMaterial | null = null
function peachBodyMaterial(): THREE.MeshStandardMaterial {
  if (!peachBodyMat) {
    peachBodyMat = new THREE.MeshStandardMaterial({
      map: peachFuzzTexture(),
      color: 0xff9a6a,
      roughness: 0.48,
      metalness: 0,
      emissive: new THREE.Color(0x603820),
      emissiveIntensity: 0.1,
    })
  }
  return peachBodyMat
}


let pearBodyMat: THREE.MeshStandardMaterial | null = null
function pearBodyMaterial(): THREE.MeshStandardMaterial {
  if (!pearBodyMat) {
    pearBodyMat = new THREE.MeshStandardMaterial({
      map: pearTexture(),
      color: 0xb8c840,
      roughness: 0.32,
      metalness: 0,
      emissive: new THREE.Color(0x404010),
      emissiveIntensity: 0.08,
    })
  }
  return pearBodyMat
}

function fruitBodyMaterial(hex: number) {
  const c = new THREE.Color(hex)
  return new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.28,
    metalness: 0.06,
    emissive: c.clone().multiplyScalar(0.05),
    emissiveIntensity: 1,
  })
}

// ---------------------------------------------------------------------------
// Decoration helpers
// ---------------------------------------------------------------------------

function addStem(g: THREE.Group, radius: number, stemColor = 0x5a3a1e) {
  const stemH = radius * 0.24
  const stemCenterY = radius * APPLE_TOP_POLE_Y_RATIO + stemH * 0.40
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.05, radius * 0.09, stemH, 8),
    new THREE.MeshBasicMaterial({ color: stemColor, toneMapped: false }),
  )
  stem.position.y = stemCenterY
  g.add(stem)
}

function addHighlightSphere(g: THREE.Group, radius: number) {
  // Small specular highlight on upper-left to simulate glossy surface
  const hl = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.18, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  )
  hl.position.set(-radius * 0.35, radius * 0.45, radius * 0.65)
  g.add(hl)
}

// ---------------------------------------------------------------------------
// Per-fruit mesh builders — enhanced for wiki-accurate visuals
// ---------------------------------------------------------------------------

function createWatermelonMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  // Subdivided icosahedron + longitudinal UV; ellipsoid baked in geometry (`watermelonPolyGeometry.ts`)
  const body = new THREE.Mesh(getWatermelonBodyPolyGeometry(radius), getWatermelonBodyMaterial())
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)
  // Short dark stem at the top pole (cartoony stub)
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.065, radius * 0.095, radius * 0.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a5a22, roughness: 0.82, metalness: 0 }),
  )
  stem.position.y = radius * WATERMELON_AY * 0.9
  stem.rotation.z = 0.06
  stem.castShadow = true
  g.add(stem)
  return g
}

function createAppleMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getAppleBodyPolyGeometry(radius),
    getAppleBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)

  addStem(g, radius)
  return g
}

function createBananaMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const curve = createBananaSpineCurve(radius)
  const baseR = radius * 0.36
  const tubularSegments = 56
  const radialSegments = 6
  const geo = new THREE.TubeGeometry(curve, tubularSegments, baseR, radialSegments, false)
  applyTubeRadiusProfile(geo, curve, baseR, bananaGirthScale)

  const skinMat = getBananaBodyMaterial(skinHex)
  const body = new THREE.Mesh(geo, skinMat)
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  const s0 = bananaGirthScale(0)
  const s1 = bananaGirthScale(1)

  const seal0 = createBananaEndSeal(curve, 'blossom', baseR, s0, skinMat)
  const seal1 = createBananaEndSeal(curve, 'stem', baseR, s1, skinMat)
  seal0.castShadow = true
  seal1.castShadow = true
  g.add(seal0, seal1)

  const tipMat = new THREE.MeshBasicMaterial({ color: 0x5c4428 })
  const tan0 = curve.getTangentAt(0).clone().normalize()
  const tan1 = curve.getTangentAt(1).clone().normalize()
  const nub0 = new THREE.Mesh(new THREE.SphereGeometry(baseR * s0 * 0.22, 8, 6), tipMat)
  nub0.position.copy(curve.getPointAt(0)).addScaledVector(tan0.clone().multiplyScalar(-1), baseR * s0 * 0.52)
  const nub1 = new THREE.Mesh(new THREE.SphereGeometry(baseR * s1 * 0.2, 8, 6), tipMat)
  nub1.position.copy(curve.getPointAt(1)).addScaledVector(tan1.clone(), baseR * s1 * 0.48)
  g.add(nub0, nub1)

  return g
}

function createLemonMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getLemonBodyPolyGeometry(radius),
    getLemonBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)
  return g
}

function createLimeMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getLimeBodyPolyGeometry(radius),
    getLimeBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)
  return g
}

function createMangoMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getMangoBodyPolyGeometry(radius),
    getMangoBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)
  return g
}

function createPineappleMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  // Rounder body shape — egg/ovoid instead of pure cylinder
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.85, 22, 18),
    pineappleBodyMaterial(),
  )
  // Squash into barrel shape
  body.scale.set(0.82, 1.0, 0.82)
  body.position.y = -radius * 0.08
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Elaborate leaf crown — multiple tiers of longer, thinner leaves
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2a8a2a,
    roughness: 0.60,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x0a2a0a),
    emissiveIntensity: 0.15,
  })
  // Inner crown — tall narrow leaves
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.12, radius * 0.75, 5),
      leafMat,
    )
    leaf.position.set(Math.cos(a) * radius * 0.08, radius * 0.65, Math.sin(a) * radius * 0.08)
    leaf.rotation.set(0.15, a, 0.08)
    leaf.castShadow = true
    g.add(leaf)
  }
  // Outer crown — wider shorter leaves spreading outward
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.18, radius * 0.50, 5),
      leafMat,
    )
    leaf.position.set(Math.cos(a) * radius * 0.18, radius * 0.48, Math.sin(a) * radius * 0.18)
    leaf.rotation.set(0.55 + Math.random() * 0.15, a, 0.15)
    leaf.castShadow = true
    g.add(leaf)
  }
  return g
}

function createCoconutMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getCoconutBodyPolyGeometry(radius),
    getCoconutBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)
  return g
}

function createStrawberryMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getStrawberryBodyPolyGeometry(radius),
    getStrawberryBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)

  // Green leaf calyx on top — wiki style
  // 5 long narrow sepals radiating from a small center ring, forming a
  // pentagonal outline when viewed from above. Each sepal is a narrow
  // leaf drawn in the XY plane with its base at origin, tip pointing +Y.
  const calyxMat = new THREE.MeshStandardMaterial({
    color: 0x1E7A2E,
    roughness: 0.55,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0x0A2A0A),
    emissiveIntensity: 0.12,
  })

  // Narrow elongated sepal shape — base at origin, tip at +Y
  const leafShape = new THREE.Shape()
  leafShape.moveTo(0, 0)
  leafShape.quadraticCurveTo(0.16, 0.06, 0.09, 0.32)
  leafShape.lineTo(0, 0.52)
  leafShape.lineTo(-0.09, 0.32)
  leafShape.quadraticCurveTo(-0.16, 0.06, 0, 0)
  const leafGeo = new THREE.ShapeGeometry(leafShape)

  // The body geometry top pole y
  const topY = radius * 0.92

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    // Wrapper: positioned at top center, rotated around Y to face outward
    const wrapper = new THREE.Group()
    wrapper.position.set(0, topY, 0)
    wrapper.rotation.y = a
    // Pivot: tilt the leaf outward — positive Z leans tip away from center
    const pivot = new THREE.Group()
    pivot.rotation.z = 1.45
    const sepal = new THREE.Mesh(leafGeo, calyxMat)
    sepal.scale.set(radius * 1.2, radius * 1.2, radius * 1.2)
    pivot.add(sepal)
    wrapper.add(pivot)
    g.add(wrapper)
  }

  // Small stem nub at center top
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x1A5A22,
    roughness: 0.8,
  })
  const stemNub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.05, radius * 0.08, radius * 0.12, 6),
    stemMat,
  )
  stemNub.position.y = topY + radius * 0.10
  g.add(stemNub)

  return g
}

function createKiwiMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 22, 16),
    kiwiBodyMaterial(),
  )
  // Slightly elongated oval
  body.scale.set(1.06, 0.86, 1.02)
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Small brown nub / stem remnant
  const nub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.04, radius * 0.07, radius * 0.14, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4a28, roughness: 0.9 }),
  )
  nub.position.set(0, radius * 0.86, 0)
  g.add(nub)
  return g
}

function createOrangeMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 18),
    orangeBodyMaterial(),
  )
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Small navel / nub at top
  const navel = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a8828, roughness: 0.7 }),
  )
  navel.position.y = radius * 0.92
  navel.scale.set(1.2, 0.6, 1.2)
  g.add(navel)
  return g
}

function createPlumMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 22, 16),
    plumBodyMaterial(),
  )
  // Slightly taller than wide
  body.scale.set(0.94, 1.06, 0.94)
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.035, radius * 0.055, radius * 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 }),
  )
  stem.position.y = radius * 0.98
  stem.rotation.z = 0.1
  g.add(stem)

  addHighlightSphere(g, radius)
  return g
}

function createPearMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  // Smoother pear shape — bottom sphere larger, top sphere smaller, with overlap
  const bottom = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.90, 22, 16),
    pearBodyMaterial(),
  )
  bottom.scale.set(1.08, 0.90, 1.08)
  bottom.position.y = -radius * 0.20
  bottom.userData.sharedMaterial = true
  bottom.castShadow = true
  bottom.receiveShadow = true
  g.add(bottom)

  const top = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.50, 18, 12),
    pearBodyMaterial(),
  )
  top.position.y = radius * 0.45
  top.scale.set(0.90, 1.12, 0.90)
  top.userData.sharedMaterial = true
  top.castShadow = true
  top.receiveShadow = true
  g.add(top)

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.035, radius * 0.06, radius * 0.30, 6),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 }),
  )
  stem.position.y = radius * 0.88
  stem.rotation.z = 0.08
  g.add(stem)

  // Small leaf near stem
  const leaf = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a8a3a, roughness: 0.65, side: THREE.DoubleSide }),
  )
  leaf.position.set(radius * 0.15, radius * 0.78, 0)
  leaf.rotation.set(0.5, 0.3, 0.4)
  leaf.scale.set(1, 0.5, 1)
  g.add(leaf)
  return g
}

function createPeachMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 18),
    peachBodyMaterial(),
  )
  body.scale.set(1.02, 0.96, 0.98)
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Softer, more defined crease / suture line
  const crease = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.46, radius * 0.035, 8, 24, Math.PI * 0.9),
    new THREE.MeshStandardMaterial({
      color: 0xc06040,
      roughness: 0.55,
      emissive: new THREE.Color(0x401510),
      emissiveIntensity: 0.1,
    }),
  )
  crease.rotation.x = Math.PI / 2
  crease.rotation.z = 0.12
  crease.position.set(0, radius * 0.08, radius * 0.72)
  g.add(crease)

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.03, radius * 0.05, radius * 0.20, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 }),
  )
  stem.position.y = radius * 0.88
  stem.rotation.z = 0.08
  g.add(stem)
  return g
}

function createPassionfruitMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 18),
    passionBodyMaterial(),
  )
  body.scale.set(0.96, 0.90, 0.96)
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Small stem / calyx remnant at top
  const calyx = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.06, radius * 0.10, radius * 0.10, 6),
    new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.8 }),
  )
  calyx.position.y = radius * 0.88
  g.add(calyx)
  return g
}

function createCherryMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()

  // Glossy cherry material with high specular
  const cherryMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    roughness: 0.15,
    metalness: 0.08,
    emissive: new THREE.Color(skinHex).multiplyScalar(0.08),
    emissiveIntensity: 1,
  })

  // Two cherry spheres — slightly heart-shaped (vertically stretched)
  const r1 = radius * 0.58
  const left = new THREE.Mesh(new THREE.SphereGeometry(r1, 18, 14), cherryMat)
  left.position.set(-radius * 0.35, -radius * 0.10, 0)
  left.scale.set(0.95, 1.08, 0.95) // slightly taller = heart-like
  left.castShadow = true
  g.add(left)

  const right = new THREE.Mesh(new THREE.SphereGeometry(r1 * 0.95, 18, 14), cherryMat)
  right.position.set(radius * 0.35, -radius * 0.06, radius * 0.05)
  right.scale.set(0.95, 1.08, 0.95)
  right.castShadow = true
  g.add(right)

  // Longer, more elegant curved stem
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a5818, roughness: 0.75, metalness: 0 })
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-radius * 0.20, radius * 0.15, 0),
    new THREE.Vector3(-radius * 0.05, radius * 0.55, radius * 0.04),
    new THREE.Vector3(radius * 0.08, radius * 0.90, -radius * 0.02),
    new THREE.Vector3(radius * 0.05, radius * 1.15, 0),
  ])
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 12, radius * 0.025, 6, false),
    stemMat,
  )
  g.add(stem)

  // Small highlight spheres for glossy look
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.1,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  })
  const hl1 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.10, 8, 6), hlMat)
  hl1.position.set(-radius * 0.50, radius * 0.08, radius * 0.42)
  g.add(hl1)
  const hl2 = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.08, 8, 6), hlMat)
  hl2.position.set(radius * 0.22, radius * 0.12, radius * 0.46)
  g.add(hl2)

  return g
}

// ---------------------------------------------------------------------------
// Factory & bomb
// ---------------------------------------------------------------------------

/** Whole fruit mesh by archetype — physics stays spherical in game. */
export function createFruitMesh(radius: number, archetype: FruitArchetype, skinHex: number): THREE.Group {
  switch (archetype) {
    case 'watermelon':
      return createWatermelonMesh(radius)
    case 'apple':
      return createAppleMesh(radius, skinHex)
    case 'banana':
      return createBananaMesh(radius, skinHex)
    case 'lemon':
      return createLemonMesh(radius, skinHex)
    case 'lime':
      return createLimeMesh(radius, skinHex)
    case 'mango':
      return createMangoMesh(radius, skinHex)
    case 'pineapple':
      return createPineappleMesh(radius)
    case 'coconut':
      return createCoconutMesh(radius, skinHex)
    case 'strawberry':
      return createStrawberryMesh(radius, skinHex)
    case 'kiwi':
      return createKiwiMesh(radius)
    case 'orange':
      return createOrangeMesh(radius)
    case 'plum':
      return createPlumMesh(radius)
    case 'pear':
      return createPearMesh(radius)
    case 'peach':
      return createPeachMesh(radius)
    case 'passionfruit':
      return createPassionfruitMesh(radius)
    case 'cherry':
      return createCherryMesh(radius, skinHex)
    default:
      return createAppleMesh(radius, skinHex)
  }
}

/** Classic "bomb": dark shell + fuse + ember */
export function createBombMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 22, 16),
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1f,
      roughness: 0.35,
      metalness: 0.65,
      emissive: new THREE.Color(0x220011),
      emissiveIntensity: 0.25,
    }),
  )
  shell.castShadow = true
  shell.receiveShadow = true
  g.add(shell)

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.88, radius * 0.06, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0x2a2a32, metalness: 0.8, roughness: 0.4 }),
  )
  band.rotation.x = Math.PI / 2
  band.castShadow = true
  g.add(band)

  const fuse = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.06, radius * 0.08, radius * 0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.95 }),
  )
  fuse.position.y = radius * 1.05
  fuse.castShadow = true
  g.add(fuse)

  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.14, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xffaa33,
      emissive: new THREE.Color(0xff6600),
      emissiveIntensity: 1.8,
      toneMapped: false,
    }),
  )
  ember.position.y = radius * 1.35
  g.add(ember)

  return g
}
