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
  upVelMin: 15.0,
  upVelMax: 19.2,
  sideVelRange: 3.0,
  /** Extra shove toward the camera along the plane normal — helps clear the lower rim and reach upper screen */
  normalPopMin: 2.8,
  normalPopMax: 4.2,
  angVelRange: 4.5,
  radiusMin: 0.38,
  radiusMax: 0.58,
  cullY: -6.8,
} as const

export const FRUIT_PALETTE = [
  { color: 0xff3355, name: 'Berry' },
  { color: 0xff8c1a, name: 'Citrus' },
  { color: 0xffe066, name: 'Lemon' },
  { color: 0x5fe08a, name: 'Lime' },
  { color: 0xb56bff, name: 'Grape' },
] as const

export function pickFruitKind() {
  return FRUIT_PALETTE[(Math.random() * FRUIT_PALETTE.length) | 0]!
}

export function randomAngularImpulse() {
  const r = SPAWN.angVelRange
  return {
    ax: (Math.random() - 0.5) * 2 * r,
    ay: (Math.random() - 0.5) * 2 * r,
    az: (Math.random() - 0.5) * 2 * r,
  }
}
