import * as THREE from 'three'

import { getAppleBodyMaterial } from './appleSkin'
import { getAppleBodyPolyGeometry, APPLE_TOP_POLE_Y_RATIO } from './applePolyGeometry'
import { getLemonBodyMaterial } from './lemonSkin'
import { getLemonBodyPolyGeometry } from './lemonPolyGeometry'
import { getLimeBodyMaterial } from './limeSkin'
import { getLimeBodyPolyGeometry } from './limePolyGeometry'
import { getMangoBodyMaterial } from './mangoSkin'
import { getMangoBodyPolyGeometry } from './mangoPolyGeometry'
import { createPineappleBodyGeometry } from './pineapplePolyGeometry'
import { getCoconutBodyMaterial } from './coconutSkin'
import { getCoconutBodyPolyGeometry } from './coconutPolyGeometry'
import { getStrawberryBodyMaterial } from './strawberrySkin'
import { getStrawberryBodyPolyGeometry } from './strawberryPolyGeometry'
import { getOrangeBodyMaterial } from './orangeSkin'
import { getOrangeBodyPolyGeometry, ORANGE_MAX_XZ } from './orangePolyGeometry'
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
import { getKiwiBodyMaterial } from './kiwiSkin'
import { getKiwiBodyPolyGeometry, KIWI_TOP_POLE_Y_RATIO } from './kiwiPolyGeometry'
import { getPassionfruitBodyMaterial } from './passionfruitSkin'
import { getPassionfruitBodyPolyGeometry } from './passionfruitPolyGeometry'
import { getPlumBodyMaterial } from './plumSkin'
import { getPlumBodyPolyGeometry, PLUM_TOP_POLE_Y_RATIO } from './plumPolyGeometry'
import { getPeachBodyMaterial } from './peachSkin'
import { getPeachBodyPolyGeometry, PEACH_TOP_POLE_Y_RATIO } from './peachPolyGeometry'
import { getPearBodyMaterial } from './pearSkin'
import { getPearBodyPolyGeometry, PEAR_TOP_POLE_Y_RATIO } from './pearPolyGeometry'
import { getCherryBodyMaterial } from './cherrySkin'
import { getCherryBodyPolyGeometry, CHERRY_TOP_POLE_Y_RATIO } from './cherryPolyGeometry'
import { getBombBodyMaterial } from './bombSkin'
import { getBombBodyPolyGeometry } from './bombPolyGeometry'
import { createPineappleReferenceMesh } from './pineappleReferenceModel'

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
  const sW = 512, sH = 512
  const c = document.createElement('canvas')
  c.width = sW; c.height = sH
  const ctx = c.getContext('2d')!

  // Dark brown border color — gaps between diamonds form scale grooves (wiki: dark brown ~#1F1508)
  ctx.fillStyle = '#1F1508'
  ctx.fillRect(0, 0, sW, sH)

  // Diamond scale pattern — wiki: clearly visible large diamond scales with dark grooves
  // Per-row coloring calibrated to wiki: uniform warm orange-gold throughout
  // Canvas y=0 → cylinder top (near leaves), y=sH → cylinder base
  const cellW = 32, cellH = 42
  const gap = 4
  for (let row = -1; row < sH / cellH + 2; row++) {
    const offsetX = (row % 2) * (cellW * 0.5)
    for (let col = -1; col < sW / cellW + 2; col++) {
      const cx = col * cellW + offsetX
      const cy = row * cellH
      // Vertical position ratio (0=top, 1=bottom)
      const t = Math.min(1, Math.max(0, cy / sH))
      // Wiki-calibrated: uniform warm orange-gold; very subtle top-to-bottom shift
      const r = Math.round(235 + 10 * t)
      const gr = Math.round(135 - 10 * t)
      const b = Math.round(15 + 5 * t)
      const grd = ctx.createRadialGradient(
        cx + cellW * 0.5, cy + cellH * 0.5, 0,
        cx + cellW * 0.5, cy + cellH * 0.5, cellW * 0.50,
      )
      grd.addColorStop(0, `rgb(${r},${gr},${b})`)
      grd.addColorStop(0.55, `rgb(${Math.round(r * 0.90)},${Math.round(gr * 0.87)},${Math.round(b * 0.72)})`)
      grd.addColorStop(1, `rgb(${Math.round(r * 0.58)},${Math.round(gr * 0.52)},${Math.round(b * 0.32)})`)
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.moveTo(cx + gap, cy + cellH * 0.5)
      ctx.lineTo(cx + cellW * 0.5, cy + gap)
      ctx.lineTo(cx + cellW - gap, cy + cellH * 0.5)
      ctx.lineTo(cx + cellW * 0.5, cy + cellH - gap)
      ctx.closePath()
      ctx.fill()

      // Central spine/barb on each scale — wiki: pointed dark bump at center of each diamond
      const centerX = cx + cellW * 0.5
      const centerY = cy + cellH * 0.5
      ctx.fillStyle = `rgb(${Math.round(r * 0.35)},${Math.round(gr * 0.30)},${Math.round(b * 0.20)})`
      ctx.beginPath()
      ctx.moveTo(centerX - 3, centerY + 2.5)
      ctx.lineTo(centerX, centerY - 5)
      ctx.lineTo(centerX + 3, centerY + 2.5)
      ctx.closePath()
      ctx.fill()
    }
  }

  // Green gradient overlay at both ends — wiki: top near crown and bottom tip show green tint
  // Top green fade (canvas y=0 is cylinder top near leaves)
  const topGrad = ctx.createLinearGradient(0, 0, 0, sH * 0.18)
  topGrad.addColorStop(0, 'rgba(50,100,20,0.45)')
  topGrad.addColorStop(1, 'rgba(50,100,20,0)')
  ctx.fillStyle = topGrad
  ctx.fillRect(0, 0, sW, sH * 0.18)
  // Bottom green fade
  const botGrad = ctx.createLinearGradient(0, sH * 0.82, 0, sH)
  botGrad.addColorStop(0, 'rgba(50,100,20,0)')
  botGrad.addColorStop(1, 'rgba(50,100,20,0.35)')
  ctx.fillStyle = botGrad
  ctx.fillRect(0, sH * 0.82, sW, sH * 0.18)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  pineappleSkinTex = tex
  return tex
}

// ---------------------------------------------------------------------------
// Cached body materials
// ---------------------------------------------------------------------------

let pineappleBodyMat: THREE.MeshBasicMaterial | null = null
export function pineappleBodyMaterial(): THREE.MeshBasicMaterial {
  if (!pineappleBodyMat) {
    pineappleBodyMat = new THREE.MeshBasicMaterial({
      map: pineappleSkinTexture(),
      color: 0xffffff,
      side: THREE.DoubleSide,
    })
  }
  return pineappleBodyMat
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

function createProceduralPineappleMesh(radius: number): THREE.Group {
  const g = new THREE.Group()

  // Wiki: near-cylinder with rounded ends, minimal mid-body bulge
  const bodyHeight = radius * 0.55 * 1.98
  const body = new THREE.Mesh(
    createPineappleBodyGeometry(radius),
    pineappleBodyMaterial(),
  )
  body.userData.sharedMaterial = true
  g.add(body)

  // Leaf crown — wiki: dense cluster of narrow dark green blades, relatively upright, narrow top
  const leafMat = new THREE.MeshBasicMaterial({
    color: 0x145a14,
    side: THREE.DoubleSide,
  })
  // Slightly lighter yellow-green for inner/base leaves that show through
  const leafMatLight = new THREE.MeshBasicMaterial({
    color: 0x2a8a20,
    side: THREE.DoubleSide,
  })

  // Two leaf sizes: taller inner leaves, shorter outer leaves
  // Wiki: leaves are narrow sword-like blades, forming a compact cluster
  const leafLenInner = bodyHeight * 0.78
  const leafLenOuter = bodyHeight * 0.62
  const leafW = radius * 0.30

  function makeLeafShape(len: number): THREE.Shape {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    // Broader at base, quickly tapering to narrow sword tip
    shape.bezierCurveTo(leafW * 0.9, len * 0.01, leafW * 0.30, len * 0.12, leafW * 0.02, len * 0.90)
    shape.lineTo(0, len)
    shape.lineTo(-leafW * 0.02, len * 0.90)
    shape.bezierCurveTo(-leafW * 0.30, len * 0.12, -leafW * 0.9, len * 0.01, 0, 0)
    return shape
  }
  const leafGeoInner = new THREE.ShapeGeometry(makeLeafShape(leafLenInner))
  const leafGeoOuter = new THREE.ShapeGeometry(makeLeafShape(leafLenOuter))

  const crownY = bodyHeight * 0.5

  // Dense, upright crown — wider leaf spacing to cover more of the top
  const leafConfigs = [
    // Center upright: 4 inner tall leaves (dense core)
    { angle: 0.0, tilt: 0.03, scale: 1.0, inner: true, light: true },
    { angle: 0.35, tilt: 0.05, scale: 0.97, inner: true, light: false },
    { angle: -0.30, tilt: 0.04, scale: 0.98, inner: true, light: true },
    { angle: 0.15, tilt: 0.02, scale: 0.96, inner: true, light: false },
    // Inner ring: 5 leaves slight tilt
    { angle: 0.80, tilt: 0.12, scale: 0.94, inner: true, light: true },
    { angle: -0.75, tilt: 0.10, scale: 0.95, inner: true, light: false },
    { angle: 1.50, tilt: 0.18, scale: 0.90, inner: true, light: true },
    { angle: -1.45, tilt: 0.16, scale: 0.91, inner: true, light: false },
    { angle: 1.15, tilt: 0.14, scale: 0.92, inner: true, light: true },
    // Mid ring: 5 shorter leaves with moderate tilt
    { angle: 1.05, tilt: 0.28, scale: 0.88, inner: false, light: false },
    { angle: -1.00, tilt: 0.25, scale: 0.89, inner: false, light: true },
    { angle: 2.00, tilt: 0.38, scale: 0.82, inner: false, light: false },
    { angle: -1.95, tilt: 0.35, scale: 0.83, inner: false, light: true },
    { angle: 1.55, tilt: 0.32, scale: 0.85, inner: false, light: false },
    // Outer ring: 3 shorter leaves with more outward flare
    { angle: 2.50, tilt: 0.60, scale: 0.78, inner: false, light: false },
    { angle: -2.45, tilt: 0.58, scale: 0.79, inner: false, light: false },
    { angle: 2.90, tilt: 0.72, scale: 0.76, inner: false, light: false },
    // Back center: 4 inner tall leaves (dense core)
    { angle: Math.PI, tilt: 0.03, scale: 1.0, inner: true, light: true },
    { angle: Math.PI + 0.35, tilt: 0.05, scale: 0.97, inner: true, light: false },
    { angle: Math.PI - 0.30, tilt: 0.04, scale: 0.98, inner: true, light: true },
    { angle: Math.PI + 0.15, tilt: 0.02, scale: 0.96, inner: true, light: false },
    // Back inner ring: 5 leaves
    { angle: Math.PI + 0.80, tilt: 0.14, scale: 0.93, inner: true, light: true },
    { angle: Math.PI - 0.75, tilt: 0.12, scale: 0.94, inner: true, light: false },
    { angle: Math.PI + 1.50, tilt: 0.20, scale: 0.89, inner: true, light: true },
    { angle: Math.PI - 1.45, tilt: 0.18, scale: 0.90, inner: true, light: false },
    { angle: Math.PI + 1.15, tilt: 0.16, scale: 0.91, inner: true, light: true },
    // Back mid: 5 shorter leaves
    { angle: Math.PI + 1.05, tilt: 0.30, scale: 0.87, inner: false, light: false },
    { angle: Math.PI - 1.00, tilt: 0.28, scale: 0.88, inner: false, light: true },
    { angle: Math.PI + 2.00, tilt: 0.40, scale: 0.81, inner: false, light: false },
    { angle: Math.PI - 1.95, tilt: 0.38, scale: 0.82, inner: false, light: true },
    { angle: Math.PI + 1.55, tilt: 0.35, scale: 0.84, inner: false, light: false },
    // Back outer: 3 leaves with more outward flare
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
    const mat = cfg.light ? leafMatLight : leafMat
    const leaf = new THREE.Mesh(cfg.inner ? leafGeoInner : leafGeoOuter, mat)
    leaf.scale.setScalar(cfg.scale)
    pivot.add(leaf)
    wrapper.add(pivot)
    g.add(wrapper)
  }

  return g
}

function createPineappleMesh(radius: number): THREE.Group {
  const imported = createPineappleReferenceMesh(radius)
  if (imported) return imported
  return createProceduralPineappleMesh(radius)
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
    getKiwiBodyPolyGeometry(radius),
    getKiwiBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)

  // Wiki kiwi has a small stem remnant with a slightly raised ring around it
  const topY = radius * KIWI_TOP_POLE_Y_RATIO

  // Stem nub — slightly larger than before for visibility
  const nub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.035, radius * 0.06, radius * 0.12, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3a20, roughness: 0.9 }),
  )
  nub.position.set(0, topY + radius * 0.04, 0)
  g.add(nub)

  // Slightly darker ring around the stem attachment (like wiki kiwi)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.08, radius * 0.015, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x5a4828, roughness: 0.95 }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.set(0, topY + radius * 0.01, 0)
  g.add(ring)

  return g
}

function createOrangeMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getOrangeBodyPolyGeometry(radius),
    getOrangeBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)

  // Small navel / nub at top (stem attachment point)
  const navel = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.06, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x5a8828 }),
  )
  navel.position.y = radius * 0.90
  navel.scale.set(1.2, 0.5, 1.2)
  g.add(navel)
  return g
}

function createPlumMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getPlumBodyPolyGeometry(radius),
    getPlumBodyMaterial(),
  )
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Long stem — wiki plum has a prominent long stem
  const topY = radius * PLUM_TOP_POLE_Y_RATIO
  const stemHeight = radius * 1.0
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.025, radius * 0.04, stemHeight, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.85 }),
  )
  stem.position.y = topY + stemHeight * 0.5
  stem.rotation.z = 0.08
  g.add(stem)
  return g
}

function createPearMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const bodyGeo = getPearBodyPolyGeometry(radius)
  const body = new THREE.Mesh(
    bodyGeo,
    getPearBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)

  // Get the actual top Y from the geometry for accurate stem placement
  const topY = (bodyGeo as any)._topY ?? (radius * PEAR_TOP_POLE_Y_RATIO)

  // Stem — woody brown, clearly visible and prominent, slightly tilted
  const stemH = radius * 0.50
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.035, radius * 0.07, stemH, 6),
    new THREE.MeshBasicMaterial({ color: 0x3d2914, toneMapped: false }),
  )
  stem.position.y = topY + stemH * 0.50
  stem.rotation.z = 0.12
  g.add(stem)

  return g
}

function createPeachMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getPeachBodyPolyGeometry(radius),
    getPeachBodyMaterial(),
  )
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)

  // Stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.03, radius * 0.05, radius * 0.18, 6),
    new THREE.MeshBasicMaterial({ color: 0x4a3520 }),
  )
  stem.position.y = radius * PEACH_TOP_POLE_Y_RATIO
  stem.rotation.z = 0.08
  g.add(stem)
  return g
}

function createPassionfruitMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    getPassionfruitBodyPolyGeometry(radius),
    getPassionfruitBodyMaterial(),
  )
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)

  // Calyx base at top
  const calyx = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.06, radius * 0.12, radius * 0.10, 8),
    new THREE.MeshStandardMaterial({ color: 0x4a3822, roughness: 0.85 }),
  )
  calyx.position.y = radius * 0.96
  g.add(calyx)

  // Three prominent dried sepals — wiki: clearly visible, curling outward
  for (let i = 0; i < 3; i++) {
    const sepal = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.035, radius * 0.25, radius * 0.10),
      new THREE.MeshStandardMaterial({ color: 0x5a4a28, roughness: 0.9 }),
    )
    const angle = (i / 3) * Math.PI * 2
    sepal.position.set(
      Math.cos(angle) * radius * 0.10,
      radius * 0.98,
      Math.sin(angle) * radius * 0.10,
    )
    sepal.rotation.y = -angle
    sepal.rotation.x = -0.6 // more outward curl
    g.add(sepal)
  }

  // Short stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.02, radius * 0.04, radius * 0.15, 5),
    new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.9 }),
  )
  stem.position.y = radius * 1.06
  g.add(stem)

  return g
}

function createCherryMesh(radius: number, _skinHex: number): THREE.Group {
  const g = new THREE.Group()

  const cherryRadius = radius * 0.50
  const cherryMat = getCherryBodyMaterial()

  // Left cherry body — custom poly geometry with top dimple
  const leftBody = new THREE.Mesh(
    getCherryBodyPolyGeometry(cherryRadius),
    cherryMat,
  )
  leftBody.userData.sharedMaterial = true
  leftBody.userData.sharedPool = true
  leftBody.castShadow = true
  leftBody.receiveShadow = true
  leftBody.position.set(-radius * 0.60, -radius * 0.02, 0)
  g.add(leftBody)

  // Right cherry body — custom poly geometry with top dimple
  const rightBody = new THREE.Mesh(
    getCherryBodyPolyGeometry(cherryRadius),
    cherryMat,
  )
  rightBody.userData.sharedMaterial = true
  rightBody.userData.sharedPool = true
  rightBody.castShadow = true
  rightBody.receiveShadow = true
  rightBody.position.set(radius * 0.60, -radius * 0.02, radius * 0.02)
  g.add(rightBody)

  // Y-shaped stem — two stems from each cherry joining, then a short vertical top stem
  const stemMat = new THREE.MeshBasicMaterial({ color: 0x3a5818, toneMapped: false })
  const stemRadius = radius * 0.024

  // Top of cherry bodies in world Y
  const leftTopY = -radius * 0.02 + cherryRadius * CHERRY_TOP_POLE_Y_RATIO
  const rightTopY = -radius * 0.02 + cherryRadius * CHERRY_TOP_POLE_Y_RATIO

  // Junction point where the two stems meet
  const junctionY = leftTopY + radius * 0.40

  // Left stem: starts INSIDE the left cherry body, emerges through the dimple, curves to junction
  const leftStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-radius * 0.60, leftTopY - cherryRadius * 0.35, 0), // deep inside cherry
    new THREE.Vector3(-radius * 0.58, leftTopY - cherryRadius * 0.05, 0), // just below surface
    new THREE.Vector3(-radius * 0.50, leftTopY + radius * 0.08, radius * 0.02), // emerged above dimple
    new THREE.Vector3(-radius * 0.30, junctionY * 0.65, radius * 0.01),
    new THREE.Vector3(0, junctionY, 0),
  ])
  const leftStem = new THREE.Mesh(
    new THREE.TubeGeometry(leftStemCurve, 16, stemRadius, 6, false),
    stemMat,
  )
  g.add(leftStem)

  // Right stem: starts INSIDE the right cherry body, emerges through the dimple, curves to junction
  const rightStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(radius * 0.60, rightTopY - cherryRadius * 0.35, radius * 0.02), // deep inside cherry
    new THREE.Vector3(radius * 0.58, rightTopY - cherryRadius * 0.05, radius * 0.02), // just below surface
    new THREE.Vector3(radius * 0.52, rightTopY + radius * 0.08, radius * 0.01), // emerged above dimple
    new THREE.Vector3(radius * 0.30, junctionY * 0.65, radius * 0.01),
    new THREE.Vector3(0, junctionY, 0),
  ])
  const rightStem = new THREE.Mesh(
    new THREE.TubeGeometry(rightStemCurve, 14, stemRadius, 6, false),
    stemMat,
  )
  g.add(rightStem)

  // Short vertical top stem continuing upward from junction
  const topStemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, junctionY, 0),
    new THREE.Vector3(radius * 0.01, junctionY + radius * 0.18, 0),
    new THREE.Vector3(-radius * 0.01, junctionY + radius * 0.35, 0),
  ])
  const topStem = new THREE.Mesh(
    new THREE.TubeGeometry(topStemCurve, 8, stemRadius * 0.85, 6, false),
    stemMat,
  )
  g.add(topStem)

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
      return createOrangeMesh(radius, skinHex)
    case 'plum':
      return createPlumMesh(radius)
    case 'pear':
      return createPearMesh(radius)
    case 'peach':
      return createPeachMesh(radius, skinHex)
    case 'passionfruit':
      return createPassionfruitMesh(radius)
    case 'cherry':
      return createCherryMesh(radius, skinHex) // skinHex unused, texture is procedural
    default:
      return createAppleMesh(radius, skinHex)
  }
}

/** Classic "bomb": dark shell + fuse + ember */
export function createBombMesh(radius: number): THREE.Group {
  const g = new THREE.Group()

  // Outline: slightly larger solid-color meshes rendered BEHIND the real meshes.
  // Depth test hides the front face of the outline — only the rim peeks out as a silhouette.
  const outlineGap = radius * 0.05          // gap between body and outline
  const outlineThickness = radius * 0.04    // outline line thickness
  const outlineRadius = radius + outlineGap + outlineThickness

  // Bomb body — custom poly geometry with procedural texture
  const body = new THREE.Mesh(
    getBombBodyPolyGeometry(radius),
    getBombBodyMaterial(),
  )
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  body.renderOrder = 1
  g.add(body)

  // Body outline — slightly larger sphere rendered behind, depth test hides front face
  const bodyOutline = new THREE.Mesh(
    getBombBodyPolyGeometry(outlineRadius),
    new THREE.MeshBasicMaterial({ color: 0xdd2020, toneMapped: false }),
  )
  bodyOutline.renderOrder = 0
  g.add(bodyOutline)

  // Fuse — starts INSIDE the bomb body, emerges from top, slightly curved
  const fuseMat = new THREE.MeshBasicMaterial({ color: 0x5a4530, toneMapped: false })
  const fuseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, radius * 0.6, 0), // deep inside bomb body
    new THREE.Vector3(0, radius * 0.90, 0), // near top surface
    new THREE.Vector3(radius * 0.03, radius + radius * 0.15, 0), // emerged
    new THREE.Vector3(-radius * 0.02, radius + radius * 0.30, radius * 0.01),
    new THREE.Vector3(radius * 0.01, radius + radius * 0.42, 0),
  ])
  const fuseTubeRadius = radius * 0.06
  const fuse = new THREE.Mesh(
    new THREE.TubeGeometry(fuseCurve, 10, fuseTubeRadius, 6, false),
    fuseMat,
  )
  g.add(fuse)

  // Fuse outline — BackSide inverted hull works for thin tubes:
  // the front face is the normal fuse, BackSide shell only peeks out at silhouette edges
  const fuseOutline = new THREE.Mesh(
    new THREE.TubeGeometry(fuseCurve, 10, fuseTubeRadius + outlineGap + outlineThickness, 6, false),
    new THREE.MeshBasicMaterial({ color: 0xdd2020, toneMapped: false, side: THREE.BackSide }),
  )
  g.add(fuseOutline)

  // Ember / spark at fuse tip — glowing orange-yellow
  const emberTip = fuseCurve.getPoint(1.0)
  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.09, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffcc44,
      toneMapped: false,
    }),
  )
  ember.position.copy(emberTip)
  g.add(ember)

  // Inner glow around ember (additive-looking via bright transparent)
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.16, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.40,
      toneMapped: false,
      depthWrite: false,
    }),
  )
  glow.position.copy(emberTip)
  g.add(glow)

  return g
}
