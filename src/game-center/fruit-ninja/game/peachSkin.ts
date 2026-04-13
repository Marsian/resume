import * as THREE from 'three'

import { peachSkinTexture } from './fruitSkinTextures'

let peachBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Peach material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getPeachBodyMaterial(): THREE.MeshBasicMaterial {
  if (!peachBodyMat) {
    peachBodyMat = new THREE.MeshBasicMaterial({
      map: peachSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    peachBodyMat.userData.sharedMaterial = true
  }
  return peachBodyMat
}
