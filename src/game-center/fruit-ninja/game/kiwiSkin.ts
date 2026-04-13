import * as THREE from 'three'

import { kiwiSkinTexture } from './fruitSkinTextures'

let kiwiBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Kiwi material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getKiwiBodyMaterial(): THREE.MeshBasicMaterial {
  if (!kiwiBodyMat) {
    kiwiBodyMat = new THREE.MeshBasicMaterial({
      map: kiwiSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    kiwiBodyMat.userData.sharedMaterial = true
  }
  return kiwiBodyMat
}
