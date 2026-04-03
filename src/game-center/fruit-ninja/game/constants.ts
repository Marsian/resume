/** Classic-arcade style tuning */
export const GAME = {
  livesStart: 3,
  missesPerLife: 3,
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
