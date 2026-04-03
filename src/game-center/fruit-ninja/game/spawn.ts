export const SPAWN = {
  intervalMinMs: 680,
  intervalMaxMs: 1180,
  /**
   * Spawn offset along the play plane: distance from PLAY_CENTER toward screen-bottom (below the board).
   * Smaller = closer to the visible area (still under the rim); tuned so arcs peak near the canvas top.
   */
  spawnBelowMin: 2.35,
  spawnBelowMax: 4.15,
  spawnLateralRange: 4.25,
  /** Slight depth jitter along plane normal */
  spawnDepthJitter: 0.55,
  /** Main toss along screen-up on the play plane */
  upVelMin: 11.5,
  upVelMax: 15.0,
  sideVelRange: 3.0,
  /** Extra shove toward the camera along the plane normal — helps clear the lower rim and reach upper screen */
  normalPopMin: 2.8,
  normalPopMax: 4.2,
  angVelRange: 4.5,
  radiusMin: 0.38,
  radiusMax: 0.58,
  cullY: -6.8,
} as const

export type FruitArchetype = 'watermelon' | 'apple' | 'banana' | 'lemon'

export type FruitSpawnKind = {
  kind: FruitArchetype
  /** Skin / outer color for mesh and juice */
  skin: number
  /** Cut-surface / pulp tint for halves */
  flesh: number
}

const FRUIT_KINDS: FruitSpawnKind[] = [
  { kind: 'watermelon', skin: 0x1e5c2e, flesh: 0xff3a5c },
  { kind: 'apple', skin: 0xc41e1e, flesh: 0xfff0ea },
  { kind: 'banana', skin: 0xe8c840, flesh: 0xfff8dc },
  { kind: 'lemon', skin: 0xf2e6a0, flesh: 0xfffacd },
]

export function pickFruitKind(): FruitSpawnKind {
  return FRUIT_KINDS[(Math.random() * FRUIT_KINDS.length) | 0]!
}

export function randomAngularImpulse() {
  const r = SPAWN.angVelRange
  return {
    ax: (Math.random() - 0.5) * 2 * r,
    ay: (Math.random() - 0.5) * 2 * r,
    az: (Math.random() - 0.5) * 2 * r,
  }
}
