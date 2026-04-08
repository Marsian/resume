import type * as CANNON from 'cannon-es'
import type * as THREE from 'three'

import type { FruitArchetype } from './spawn'

export type WholeEntity = {
  id: number
  root: THREE.Group
  body: CANNON.Body
  radius: number
  color: THREE.Color
  /** Pulp color for sliced halves (may differ from skin, e.g. watermelon). */
  fleshColor: THREE.Color
  /** Only present for fruits (not bombs). */
  fruitType?: FruitArchetype
  kind: 'fruit' | 'bomb'
  /** True once we counted a “miss” for this fruit */
  missTracked: boolean
  /** Opening watermelon — slice once to leave `home` phase; never counts as a miss. */
  isStarter?: boolean
  /** Decorative fruit used only on the home screen (never counts as miss / score). */
  isHomeDecor?: boolean
  /** Decorative objects on the game-over screen (watermelon + bomb); not sliceable while overlay is up. */
  isGameOverDecor?: boolean
  /** Anchor in screen space (0..1) for home decor placement. */
  homeAnchor?: { u: number; v: number }
  /** Decor visibility is gated until anchor position stabilizes. */
  _anchorLastPos?: THREE.Vector3
  _anchorStableFrames?: number
}

export type FruitHalf = {
  root: THREE.Group
  body: CANNON.Body
  removeAt: number
}

export type ExplosionFx = {
  mesh: THREE.Mesh
  startAt: number
  endAt: number
  baseScale: number
}

