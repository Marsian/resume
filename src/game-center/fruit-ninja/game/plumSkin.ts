import * as THREE from 'three'

import { plumSkinTexture } from './fruitSkinTextures'

let plumBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Plum material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getPlumBodyMaterial(): THREE.MeshBasicMaterial {
  if (!plumBodyMat) {
    plumBodyMat = new THREE.MeshBasicMaterial({
      map: plumSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    plumBodyMat.userData.sharedMaterial = true
  }
  return plumBodyMat
}
