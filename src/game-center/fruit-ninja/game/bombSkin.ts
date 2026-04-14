import * as THREE from 'three'

import { bombSkinTexture } from './fruitSkinTextures'

let bombBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Bomb material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getBombBodyMaterial(): THREE.MeshBasicMaterial {
  if (!bombBodyMat) {
    bombBodyMat = new THREE.MeshBasicMaterial({
      map: bombSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    bombBodyMat.userData.sharedMaterial = true
  }
  return bombBodyMat
}
