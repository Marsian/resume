import * as THREE from 'three'

import { cherrySkinTexture } from './fruitSkinTextures'

let cherryBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Cherry material using the procedural skin texture.
 * MeshBasicMaterial — lighting baked into the texture, no scene light dependency.
 */
export function getCherryBodyMaterial(): THREE.MeshBasicMaterial {
  if (!cherryBodyMat) {
    cherryBodyMat = new THREE.MeshBasicMaterial({
      map: cherrySkinTexture(),
      side: THREE.DoubleSide,
      transparent: false,
      opacity: 1,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    })
    cherryBodyMat.userData.sharedMaterial = true
  }
  return cherryBodyMat
}
