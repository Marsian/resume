import { findDefaultPlayerSpawnPixels } from '../levelValidation'
import {
  BASE_TILE_COL_END_EXCL,
  BASE_TILE_COL_START,
  BASE_TILE_ROW_END_EXCL,
  BASE_TILE_ROW_START,
  getLevelConfig,
  terrainFromChar,
  TILE,
  type Direction,
  type TerrainType,
} from '../levels'
import { BASE_SIZE, BASE_TOP_Y, PLAYER_BULLET_SPEED, PLAYER_SPEED, TANK_SIZE, WORLD_H, WORLD_W } from './constants'
import type { GameState, Tank, TileBlock } from './types'

function spawnPlayer(level: number): Tank {
  const cfg = getLevelConfig(level)
  const { x, y } = findDefaultPlayerSpawnPixels(cfg)
  return {
    id: 'player',
    x,
    y,
    dir: 'up',
    speed: PLAYER_SPEED,
    reloadMs: 260,
    lastShotAt: 0,
    alive: true,
    isEnemy: false,
    aiTurnAt: 0,
    hp: 1,
    bulletSpeed: PLAYER_BULLET_SPEED,
    turnIntervalMs: 0,
    fireChance: 0,
    chaseBias: 0,
  }
}

function terrainToBlocks(level: number): TileBlock[] {
  const config = getLevelConfig(level)
  const result: TileBlock[] = []
  for (let y = 0; y < config.terrainRows.length; y += 1) {
    const row = config.terrainRows[y] || ''
    for (let x = 0; x < row.length; x += 1) {
      const t: TerrainType = terrainFromChar(row[x] ?? '.')
      if (t === 'empty') continue

      // Keep the base area empty for the dedicated `base` hitbox.
      if (x >= BASE_TILE_COL_START && x < BASE_TILE_COL_END_EXCL && y >= BASE_TILE_ROW_START && y < BASE_TILE_ROW_END_EXCL) {
        continue
      }
      result.push({
        x: x * TILE,
        y: y * TILE,
        size: TILE,
        hp: t === 'brick' ? 1 : t === 'steel' ? 99 : 1,
        type: t,
      })
    }
  }
  return result
}

export function createState(level: number): GameState {
  const config = getLevelConfig(level)
  return {
    status: 'ready',
    level,
    levelName: config.name,
    levelIntent: config.intent,
    player: spawnPlayer(level),
    enemies: [],
    bullets: [],
    terrain: terrainToBlocks(level),
    base: {
      x: WORLD_W / 2 - BASE_SIZE / 2,
      y: BASE_TOP_Y,
      size: BASE_SIZE,
      alive: true,
    },
    // Delay first enemy spawn to prevent "instant first bullets" from killing the player
    // before they can react / move.
    spawnCooldown: config.spawnDelaySec,
    enemiesSpawned: 0,
    enemiesDestroyed: 0,
    enemiesTotal: config.enemiesTotal,
    levelBannerUntil: 1000,
    elapsedMs: 0,
    // Spawn shield: long enough to guarantee the first enemy fire window doesn't cause
    // unavoidable early deaths.
    playerInvincibleUntil: 4000,
    enemyQueue: [...config.enemyQueue],
  }
}

export function directionForInput(input: {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}): Direction | null {
  if (input.up) return 'up'
  if (input.down) return 'down'
  if (input.left) return 'left'
  if (input.right) return 'right'
  return null
}
