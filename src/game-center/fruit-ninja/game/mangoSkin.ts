import * as THREE from 'three'

import { mangoSkinTexture } from './fruitSkinTextures'

let mangoBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Mango material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getMangoBodyMaterial(): THREE.MeshBasicMaterial {
  if (!mangoBodyMat) {
    mangoBodyMat = new THREE.MeshBasicMaterial({
      map: mangoSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    mangoBodyMat.userData.sharedMaterial = true
  }
  return mangoBodyMat
}
