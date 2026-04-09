import * as THREE from 'three'

import { watermelonStripeTexture } from './fruitSkinTextures'

let watermelonBodyMat: THREE.MeshBasicMaterial | null = null

/**
 * Albedo map already bakes directional shading + stripes (wiki-style). MeshBasic avoids
 * multiplying by scene lights again, which was washing out / double-darkening Standard.
 */
export function getWatermelonBodyMaterial(): THREE.MeshBasicMaterial {
  if (!watermelonBodyMat) {
    const map = watermelonStripeTexture()
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.ClampToEdgeWrapping
    map.repeat.set(1, 1)

    watermelonBodyMat = new THREE.MeshBasicMaterial({
      map,
      color: 0xffffff,
    })
    watermelonBodyMat.userData.sharedMaterial = true
  }
  return watermelonBodyMat
}
