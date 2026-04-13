import * as THREE from 'three'

import { strawberrySkinTexture } from './fruitSkinTextures'

let strawberryBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Strawberry material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getStrawberryBodyMaterial(): THREE.MeshBasicMaterial {
  if (!strawberryBodyMat) {
    strawberryBodyMat = new THREE.MeshBasicMaterial({
      map: strawberrySkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    strawberryBodyMat.userData.sharedMaterial = true
  }
  return strawberryBodyMat
}
