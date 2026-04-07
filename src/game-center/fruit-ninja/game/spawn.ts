export const SPAWN = {
  intervalMinMs: 680,
  intervalMaxMs: 1180,
  /**
   * Primary spawn: ray from camera through bottom of canvas into the play plane (see spawnPlane).
   * Horizontal span as fraction of canvas width (inset from left/right edges). Larger = more toward middle.
   */
  screenBottomHorizontalInset: 0.14,
  /** Pixels above the canvas bottom edge (CSS px) for the spawn ray origin */
  screenBottomInsetPxMin: 8,
  screenBottomInsetPxMax: 28,
  /**
   * Fallback when layout rect / ray hit is unavailable: offset from plane center toward screen-bottom.
   */
  spawnBelowMin: 3.2,
  spawnBelowMax: 5.4,
  spawnLateralRange: 3.15,
  /** Slight depth jitter along plane normal at spawn (position only; keep small) */
  spawnDepthJitter: 0.22,
  /** Main toss along screen-up on the play plane (paired with `PHYSICS.gravityY`) */
  upVelMin: 13.2,
  upVelMax: 15.4,
  /**
   * Occasional higher arc; peaks tuned with softer gravity so fewer escape the top edge.
   */
  peakArcChance: 0.2,
  upVelPeakMin: 15.2,
  upVelPeakMax: 17.4,
  /** Random lateral impulse (world units / s) */
  sideVelRange: 1.55,
  /**
   * Extra `right`-axis velocity per world-unit lateral offset from plane center (pulls trajectories inward).
   */
  sideTowardCenterPerWorldUnit: 0.68,
  /**
   * Random ± velocity along camera normal. Keep tiny so paths stay nearly parallel to the screen plane.
   */
  normalVelJitter: 0.38,
  angVelRange: 3.2,
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

/** How many whole fruits/bombs to spawn on one timer tick (capped by max entities elsewhere). */
export function sampleBurstSpawnCount(): number {
  const r = Math.random()
  if (r < 0.64) return 1
  if (r < 0.64 + 0.28) return 2
  return 3
}
