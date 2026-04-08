import * as THREE from 'three'

import type { ExplosionFx } from '../types'

export function updateExplosions(scene: THREE.Scene, explosions: ExplosionFx[], now: number, reducedMotion: boolean) {
  if (!explosions.length) return
  for (let i = explosions.length - 1; i >= 0; i--) {
    const fx = explosions[i]!
    const life = (now - fx.startAt) / Math.max(1, fx.endAt - fx.startAt)
    if (life >= 1) {
      scene.remove(fx.mesh)
      fx.mesh.geometry.dispose()
      ;(fx.mesh.material as THREE.Material).dispose()
      explosions.splice(i, 1)
      continue
    }
    const s = fx.baseScale * (0.65 + 2.6 * life)
    fx.mesh.scale.setScalar(s)
    const m = fx.mesh.material as THREE.MeshBasicMaterial
    const flash = life < 0.12 ? 1 - life / 0.12 : Math.max(0, 1 - (life - 0.12) / 0.88)
    m.opacity = (reducedMotion ? 0.5 : 0.75) * flash
  }
}

