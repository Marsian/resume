import * as THREE from 'three'

import { orangeSkinTexture } from './fruitSkinTextures'

let orangeBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Orange material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getOrangeBodyMaterial(): THREE.MeshBasicMaterial {
  if (!orangeBodyMat) {
    orangeBodyMat = new THREE.MeshBasicMaterial({
      map: orangeSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    orangeBodyMat.userData.sharedMaterial = true
  }
  return orangeBodyMat
}
