import * as THREE from 'three'

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

function getFleshMat(flesh: THREE.Color): THREE.MeshStandardMaterial {
  const h = flesh.getHex()
  let m = fleshMatCache.get(h)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: flesh.clone(),
      roughness: 0.52,
      metalness: 0,
      emissive: flesh.clone().multiplyScalar(0.05),
      side: THREE.DoubleSide,
    })
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
): THREE.Group {
  const g = new THREE.Group()
  const n = outwardNormal.clone().normalize()

  const curved = new THREE.Mesh(sharedHemisphere, getSkinMat(skinColor))
  curved.scale.setScalar(radius)
  curved.castShadow = false
  curved.receiveShadow = false
  curved.userData.sharedPool = true
  g.add(curved)

  const cap = new THREE.Mesh(sharedCap, getFleshMat(fleshColor))
  cap.scale.setScalar(radius)
  cap.rotation.x = -Math.PI / 2
  cap.position.y = -0.003
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
