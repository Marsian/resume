import * as THREE from 'three'

import { lemonSkinTexture } from './fruitSkinTextures'

let lemonBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Lemon material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getLemonBodyMaterial(): THREE.MeshBasicMaterial {
  if (!lemonBodyMat) {
    lemonBodyMat = new THREE.MeshBasicMaterial({
      map: lemonSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    lemonBodyMat.userData.sharedMaterial = true
  }
  return lemonBodyMat
}
