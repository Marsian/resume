import * as THREE from 'three'

import type { FruitArchetype } from './spawn'

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

let watermelonStripeTex: THREE.CanvasTexture | null = null
function watermelonStripeTexture(): THREE.CanvasTexture {
  if (watermelonStripeTex) return watermelonStripeTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#1a4d28'
  g.fillRect(0, 0, 64, 64)
  for (let x = 0; x < 64; x += 8) {
    g.fillStyle = x % 16 === 0 ? '#143d22' : '#2a6b38'
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

let watermelonBodyMat: THREE.MeshStandardMaterial | null = null
function watermelonBodyMaterial(): THREE.MeshStandardMaterial {
  if (!watermelonBodyMat) {
    watermelonBodyMat = new THREE.MeshStandardMaterial({
      map: watermelonStripeTexture(),
      color: 0x4a8f55,
      roughness: 0.45,
      metalness: 0,
    })
  }
  return watermelonBodyMat
}

function addStemLeaf(g: THREE.Group, radius: number) {
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.08, radius * 0.12, radius * 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9, metalness: 0 }),
  )
  stem.position.y = radius * 0.92
  stem.castShadow = true
  g.add(stem)

  const leaf = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.35, 12),
    new THREE.MeshStandardMaterial({
      color: 0x2d6b3a,
      roughness: 0.65,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
  )
  leaf.position.set(radius * 0.35, radius * 0.75, radius * 0.1)
  leaf.rotation.set(0.5, 0.4, 0.3)
  leaf.castShadow = true
  g.add(leaf)
}

function createWatermelonMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), watermelonBodyMaterial())
  body.scale.set(1.05, 0.88, 1.05)
  body.castShadow = true
  body.receiveShadow = true
  body.userData.sharedMaterial = true
  g.add(body)
  addStemLeaf(g, radius * 0.95)
  return g
}

function createAppleMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), fruitBodyMaterial(skinHex))
  body.scale.set(0.98, 1.04, 0.98)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  addStemLeaf(g, radius)
  return g
}

function createBananaMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -radius * 0.9, 0),
    new THREE.Vector3(radius * 0.35, -radius * 0.2, radius * 0.08),
    new THREE.Vector3(radius * 0.85, radius * 0.35, 0),
    new THREE.Vector3(radius * 1.05, radius * 0.75, -radius * 0.12),
  ])
  const tubeR = radius * 0.42
  const body = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, tubeR, 10, false),
    fruitBodyMaterial(skinHex),
  )
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  return g
}

function createLemonMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), fruitBodyMaterial(skinHex))
  body.scale.set(1.12, 0.82, 1.08)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const nub = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.12, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b8f3a, roughness: 0.75 }),
  )
  nub.position.set(0, radius * 0.88, 0)
  nub.castShadow = true
  g.add(nub)
  return g
}

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
    default:
      return createAppleMesh(radius, skinHex)
  }
}

/** Classic “bomb”: dark shell + fuse + ember */
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
