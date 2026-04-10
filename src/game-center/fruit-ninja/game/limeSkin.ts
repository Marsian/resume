import * as THREE from 'three'

import { limeSkinTexture } from './fruitSkinTextures'

let limeBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Lime material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getLimeBodyMaterial(): THREE.MeshBasicMaterial {
  if (!limeBodyMat) {
    limeBodyMat = new THREE.MeshBasicMaterial({
      map: limeSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    limeBodyMat.userData.sharedMaterial = true
  }
  return limeBodyMat
}
