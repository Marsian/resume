/**
 * Cannon world gravity. Tuned together with `SPAWN.upVel*` so tosses read higher without only cranking speed.
 */
export const PHYSICS = {
  gravityY: -16.25,
} as const

export const GAME = {
  /** Total misses before game over. */
  missLimit: 3,
  bombSpawnChance: 0.16,
  maxWholeEntities: 8,
  comboWindowMs: 1400,
  comboCap: 12,
  scoreComboMultCap: 8,
  sliceScoreBase: 12,
  bombPenaltyScore: 25,
  cullY: -6.85,
  /** Fruits below this (uncut) count as a miss */
  missY: -5.15,
} as const

/**
 * Half-fruit impulses after a slice (world momentum units; v_delta ≈ impulse / mass).
 * Kept moderate so gravity (`PHYSICS.gravityY`) reads as a visible arc, especially with inherited fruit velocity.
 */
export const SLICE = {
  sepImpulseMin: 0.85,
  sepImpulseMax: 1.75,
  vertDiffImpulseMin: 0.28,
  vertDiffImpulseMax: 0.68,
  sharedUpImpulseMin: 0.38,
  sharedUpImpulseMax: 0.88,
  /** Extra random kick along screen-right on the play plane (per half) */
  planarRightJitter: 0.62,
  /** Tiny depth jitter along plane normal (mostly invisible, breaks symmetry) */
  planarDepthJitter: 0.12,
  /** Per-half scale on separation impulse */
  halfSepScaleMin: 0.72,
  halfSepScaleMax: 1.22,
  /** Random ± radians: rotate sep/cutTan in the play plane before applying impulses */
  sepAngleJitter: 0.55,
  /** Random per-half tweak on shared/diff vertical impulse */
  vertImpulseNoise: 0.22,
  cutAxisSpinMin: 4.5,
  cutAxisSpinMax: 9.5,
  angNoiseInPlane: 3.0,
  angNoiseDepth: 0.55,
} as const
