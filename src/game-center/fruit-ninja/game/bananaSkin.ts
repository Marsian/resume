import * as THREE from 'three'

import { bananaSkinTexture } from './fruitSkinTextures'

const bananaBodyMatCache = new Map<number, THREE.MeshBasicMaterial>()

/**
 * Cartoon albedo (like watermelon): baked mild shading in map, MeshBasic avoids harsh scene shadows.
 * `skinHex` tints the shared texture for spawn parity.
 */
export function getBananaBodyMaterial(skinHex: number): THREE.MeshBasicMaterial {
  let m = bananaBodyMatCache.get(skinHex)
  if (!m) {
    const map = bananaSkinTexture()
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping
    map.repeat.set(1.15, 1)

    const tint = new THREE.Color(skinHex)
    tint.lerp(new THREE.Color(0xffffff), 0.28)
    m = new THREE.MeshBasicMaterial({
      map,
      color: tint,
    })
    m.userData.sharedMaterial = true
    bananaBodyMatCache.set(skinHex, m)
  }
  return m
}
