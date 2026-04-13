import * as THREE from 'three'

import { coconutSkinTexture } from './fruitSkinTextures'

let coconutBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Coconut material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getCoconutBodyMaterial(): THREE.MeshBasicMaterial {
  if (!coconutBodyMat) {
    coconutBodyMat = new THREE.MeshBasicMaterial({
      map: coconutSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    coconutBodyMat.userData.sharedMaterial = true
  }
  return coconutBodyMat
}
