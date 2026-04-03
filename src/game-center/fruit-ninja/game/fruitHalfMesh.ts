import * as THREE from 'three'

import { disposeObject3D } from './meshes'

/** Lighter “pulp” tone from skin color */
export function fleshColorFromSkin(skin: THREE.Color): THREE.Color {
  return new THREE.Color().copy(skin).lerp(new THREE.Color(0xfff5e8), 0.55)
}

/**
 * One hemisphere of a sliced fruit: curved skin + flat circular cut face (flesh).
 * Local +Y is the outward normal of the cut (into this half’s interior / visible pulp).
 */
export function createFruitHalfMesh(
  radius: number,
  outwardNormal: THREE.Vector3,
  skinColor: THREE.Color,
  fleshColor: THREE.Color,
): THREE.Group {
  const g = new THREE.Group()
  const n = outwardNormal.clone().normalize()

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: skinColor.clone(),
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    emissive: skinColor.clone().multiplyScalar(0.04),
  })

  // Upper spherical cap: north pole → equator; equator at y=0 is the cut ring
  const curved = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 30, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    skinMat,
  )
  curved.castShadow = true
  curved.receiveShadow = true
  g.add(curved)

  const fleshMat = new THREE.MeshStandardMaterial({
    color: fleshColor,
    roughness: 0.48,
    metalness: 0,
    emissive: fleshColor.clone().multiplyScalar(0.06),
    side: THREE.DoubleSide,
  })
  const cap = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.997, 40), fleshMat)
  cap.rotation.x = -Math.PI / 2
  cap.position.y = -0.003
  cap.receiveShadow = true
  cap.castShadow = false
  g.add(cap)

  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  return g
}

export function disposeFruitHalfRoot(root: THREE.Group) {
  disposeObject3D(root)
}
