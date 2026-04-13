import * as THREE from 'three'

import { passionfruitSkinTexture } from './fruitSkinTextures'

let passionfruitBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Passionfruit material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getPassionfruitBodyMaterial(): THREE.MeshBasicMaterial {
  if (!passionfruitBodyMat) {
    passionfruitBodyMat = new THREE.MeshBasicMaterial({
      map: passionfruitSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    passionfruitBodyMat.userData.sharedMaterial = true
  }
  return passionfruitBodyMat
}
