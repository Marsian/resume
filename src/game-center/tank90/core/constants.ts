import { TILE } from '../levels'

export const WORLD_W = TILE * 26
export const WORLD_H = TILE * 26
export const TANK_SIZE = TILE
export const PLAYER_SPEED = 112
export const PLAYER_BULLET_SPEED = 240
export const BASE_SIZE = TILE * 2
/** Pixel y of eagle hitbox top (same as `GameState.base.y`). Flush to world bottom: `base.y + BASE_SIZE === WORLD_H`. */
export const BASE_TOP_Y = WORLD_H - BASE_SIZE
export const EARLY_GAME_SAFETY_MS = 6500
export const STAGE1_EARLY_ACTIVE_ENEMY_CAP = 2
export const STAGE1_EARLY_FIRE_CHANCE_SCALE = 0.58

/**
 * Enemy spawn (map **top**, row 1 — not the player base at bottom).
 * NES / battlecityjs `createTank`: cx = W/26 + pos*(W/2 - W/26) → columns 1, 13, 25.
 */
export const SPAWN_POINTS = [
  { x: TILE * 1, y: TILE * 1 },
  { x: TILE * 13, y: TILE * 1 },
  { x: TILE * 25, y: TILE * 1 },
]
