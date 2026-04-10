import * as THREE from 'three'

import { appleSkinTexture } from './fruitSkinTextures'

let appleBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Apple material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getAppleBodyMaterial(): THREE.MeshBasicMaterial {
  if (!appleBodyMat) {
    appleBodyMat = new THREE.MeshBasicMaterial({
      map: appleSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    appleBodyMat.userData.sharedMaterial = true
  }
  return appleBodyMat
}
