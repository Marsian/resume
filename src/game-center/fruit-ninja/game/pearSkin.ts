import * as THREE from 'three'

import { pearSkinTexture } from './fruitSkinTextures'

let pearBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Pear material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getPearBodyMaterial(): THREE.MeshBasicMaterial {
  if (!pearBodyMat) {
    pearBodyMat = new THREE.MeshBasicMaterial({
      map: pearSkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    pearBodyMat.userData.sharedMaterial = true
  }
  return pearBodyMat
}
