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
  // Brighter stripes so the starter watermelon reads like Classic menu.
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

let watermelonBodyMat: THREE.MeshStandardMaterial | null = null
function watermelonBodyMaterial(): THREE.MeshStandardMaterial {
  if (!watermelonBodyMat) {
    watermelonBodyMat = new THREE.MeshStandardMaterial({
      map: watermelonStripeTexture(),
      color: 0x4a8f55,
      roughness: 0.45,
      metalness: 0,
      emissive: new THREE.Color(0x1a5c2a),
      emissiveIntensity: 0.35,
    })
  }
  return watermelonBodyMat
}

let pineappleSkinTex: THREE.CanvasTexture | null = null
function pineappleSkinTexture(): THREE.CanvasTexture {
  if (pineappleSkinTex) return pineappleSkinTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#a67c1f'
  g.fillRect(0, 0, 64, 64)
  g.strokeStyle = '#5c4a18'
  g.lineWidth = 1
  for (let y = 0; y < 64; y += 6) {
    for (let x = (y % 12) / 2; x < 64; x += 12) {
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + 6, y + 8)
      g.stroke()
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

let pineappleBodyMat: THREE.MeshStandardMaterial | null = null
function pineappleBodyMaterial(): THREE.MeshStandardMaterial {
  if (!pineappleBodyMat) {
    pineappleBodyMat = new THREE.MeshStandardMaterial({
      map: pineappleSkinTexture(),
      color: 0xd4a84b,
      roughness: 0.55,
      metalness: 0,
    })
  }
  return pineappleBodyMat
}

let kiwiFuzzTex: THREE.CanvasTexture | null = null
function kiwiFuzzTexture(): THREE.CanvasTexture {
  if (kiwiFuzzTex) return kiwiFuzzTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#6b4f1e'
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 64
    const y = Math.random() * 64
    g.fillStyle = Math.random() > 0.5 ? '#4a3510' : '#8a7030'
    g.fillRect(x, y, 1, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  kiwiFuzzTex = tex
  return tex
}

let kiwiBodyMat: THREE.MeshStandardMaterial | null = null
function kiwiBodyMaterial(): THREE.MeshStandardMaterial {
  if (!kiwiBodyMat) {
    kiwiBodyMat = new THREE.MeshStandardMaterial({
      map: kiwiFuzzTexture(),
      color: 0x8b6914,
      roughness: 0.95,
      metalness: 0,
    })
  }
  return kiwiBodyMat
}

let orangePoreTex: THREE.CanvasTexture | null = null
function orangePoreTexture(): THREE.CanvasTexture {
  if (orangePoreTex) return orangePoreTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#ff8c1a'
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 64
    const y = Math.random() * 64
    g.fillStyle = `rgba(200,90,0,${0.15 + Math.random() * 0.25})`
    g.beginPath()
    g.arc(x, y, 0.6 + Math.random() * 1.2, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  orangePoreTex = tex
  return tex
}

let orangeBodyMat: THREE.MeshStandardMaterial | null = null
function orangeBodyMaterial(): THREE.MeshStandardMaterial {
  if (!orangeBodyMat) {
    orangeBodyMat = new THREE.MeshStandardMaterial({
      map: orangePoreTexture(),
      color: 0xff7700,
      roughness: 0.42,
      metalness: 0,
    })
  }
  return orangeBodyMat
}

let passionSpeckleTex: THREE.CanvasTexture | null = null
function passionSpeckleTexture(): THREE.CanvasTexture {
  if (passionSpeckleTex) return passionSpeckleTex
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#2d1f45'
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = '#e8e0f0'
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * 64
    const y = Math.random() * 64
    g.fillRect(x, y, 1 + (Math.random() * 2) | 0, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  passionSpeckleTex = tex
  return tex
}

let passionBodyMat: THREE.MeshStandardMaterial | null = null
function passionBodyMaterial(): THREE.MeshStandardMaterial {
  if (!passionBodyMat) {
    passionBodyMat = new THREE.MeshStandardMaterial({
      map: passionSpeckleTexture(),
      color: 0x4a3568,
      roughness: 0.5,
      metalness: 0,
    })
  }
  return passionBodyMat
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

function createLimeMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), fruitBodyMaterial(skinHex))
  body.scale.set(1.08, 0.88, 1.06)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const nub = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a6b28, roughness: 0.75 }),
  )
  nub.position.set(0, radius * 0.9, 0)
  nub.castShadow = true
  g.add(nub)
  return g
}

function createMangoMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), fruitBodyMaterial(skinHex))
  body.scale.set(1.18, 0.78, 0.95)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.08, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x5c4a20, roughness: 0.85 }),
  )
  tip.position.set(0, -radius * 0.82, radius * 0.12)
  g.add(tip)
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.05, radius * 0.08, radius * 0.22, 6),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 }),
  )
  stem.position.set(0, radius * 0.72, radius * 0.08)
  stem.rotation.z = 0.25
  g.add(stem)
  return g
}

function createPineappleMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.62, radius * 0.72, radius * 1.65, 18, 4),
    pineappleBodyMaterial(),
  )
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.22, radius * 0.55, 6),
      new THREE.MeshStandardMaterial({ color: 0x2d6b2d, roughness: 0.7, side: THREE.DoubleSide }),
    )
    leaf.position.set(Math.cos(a) * radius * 0.15, radius * 1.05, Math.sin(a) * radius * 0.15)
    leaf.rotation.set(0.35 + Math.random() * 0.2, a, 0.2)
    leaf.castShadow = true
    g.add(leaf)
  }
  return g
}

function createCoconutMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), fruitBodyMaterial(skinHex))
  body.scale.set(0.92, 0.88, 0.95)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1810, roughness: 0.95 })
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.2
    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.07, 8, 6), eyeMat)
    eye.position.set(Math.cos(a) * radius * 0.55, radius * 0.35, Math.sin(a) * radius * 0.52)
    g.add(eye)
  }
  return g
}

function createStrawberryMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.85, radius * 1.15, 14, 8), fruitBodyMaterial(skinHex))
  body.rotation.x = Math.PI
  body.position.y = -radius * 0.08
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const seedMat = new THREE.MeshStandardMaterial({ color: 0xf5e6b8, roughness: 0.6 })
  for (let i = 0; i < 28; i++) {
    const ry = -radius * 0.35 + Math.random() * radius * 0.75
    const rr = Math.max(0.05, (radius * 0.75 * (1 - Math.abs(ry) / (radius * 0.9))) * 0.95)
    const a = Math.random() * Math.PI * 2
    const seed = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.04, 6, 4), seedMat)
    seed.position.set(Math.cos(a) * rr, ry, Math.sin(a) * rr)
    g.add(seed)
  }
  const calyx = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.55, radius * 0.35, 7),
    new THREE.MeshStandardMaterial({ color: 0x2d7a3a, roughness: 0.65, side: THREE.DoubleSide }),
  )
  calyx.position.y = radius * 0.52
  calyx.rotation.x = Math.PI
  g.add(calyx)
  return g
}

function createKiwiMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), kiwiBodyMaterial())
  body.scale.set(1.05, 0.88, 1.02)
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const nub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.04, radius * 0.06, radius * 0.12, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a4a30, roughness: 0.9 }),
  )
  nub.position.set(0, radius * 0.88, 0)
  g.add(nub)
  return g
}

function createOrangeMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), orangeBodyMaterial())
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  return g
}

function createPlumMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), fruitBodyMaterial(skinHex))
  body.scale.set(0.92, 1.08, 0.94)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.04, radius * 0.06, radius * 0.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 }),
  )
  stem.position.y = radius * 0.95
  g.add(stem)
  return g
}

function createPearMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.92, 18, 14), fruitBodyMaterial(skinHex))
  bottom.scale.set(1.05, 0.92, 1.05)
  bottom.position.y = -radius * 0.22
  bottom.castShadow = true
  bottom.receiveShadow = true
  g.add(bottom)
  const top = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.52, 14, 10), fruitBodyMaterial(skinHex))
  top.position.y = radius * 0.48
  top.scale.set(0.95, 1.1, 0.95)
  top.castShadow = true
  top.receiveShadow = true
  g.add(top)
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.04, radius * 0.06, radius * 0.28, 6),
    new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 }),
  )
  stem.position.y = radius * 0.92
  g.add(stem)
  return g
}

function createPeachMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), fruitBodyMaterial(skinHex))
  body.scale.set(1.02, 0.95, 0.98)
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  const crease = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.42, radius * 0.04, 6, 16, Math.PI * 0.85),
    new THREE.MeshStandardMaterial({ color: 0xc87050, roughness: 0.55 }),
  )
  crease.rotation.x = Math.PI / 2
  crease.rotation.z = 0.15
  crease.position.set(0, radius * 0.12, radius * 0.72)
  g.add(crease)
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.035, radius * 0.05, radius * 0.18, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 }),
  )
  stem.position.y = radius * 0.88
  g.add(stem)
  return g
}

function createPassionfruitMesh(radius: number): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 16), passionBodyMaterial())
  body.scale.set(0.95, 0.88, 0.95)
  body.userData.sharedMaterial = true
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  return g
}

function createCherryMesh(radius: number, skinHex: number): THREE.Group {
  const g = new THREE.Group()
  const r1 = radius * 0.62
  const left = new THREE.Mesh(new THREE.SphereGeometry(r1, 16, 12), fruitBodyMaterial(skinHex))
  left.position.set(-radius * 0.38, -radius * 0.12, 0)
  left.castShadow = true
  g.add(left)
  const right = new THREE.Mesh(new THREE.SphereGeometry(r1 * 0.95, 16, 12), fruitBodyMaterial(skinHex))
  right.position.set(radius * 0.38, -radius * 0.08, radius * 0.06)
  right.castShadow = true
  g.add(right)
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3d2914, roughness: 0.9 })
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.025, radius * 0.04, radius * 0.85, 6),
    stemMat,
  )
  stem.position.set(0, radius * 0.55, 0)
  stem.rotation.z = 0.12
  stem.rotation.x = 0.25
  g.add(stem)
  const join = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.02, radius * 0.02, radius * 0.35, 6),
    stemMat,
  )
  join.position.set(0, radius * 0.12, 0)
  join.rotation.z = Math.PI / 2.2
  g.add(join)
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
      return createPlumMesh(radius, skinHex)
    case 'pear':
      return createPearMesh(radius, skinHex)
    case 'peach':
      return createPeachMesh(radius, skinHex)
    case 'passionfruit':
      return createPassionfruitMesh(radius)
    case 'cherry':
      return createCherryMesh(radius, skinHex)
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
