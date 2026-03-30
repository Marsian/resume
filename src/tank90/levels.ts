import {
  NES_STAGE_01_ROWS,
  NES_STAGE_02_ROWS,
  NES_STAGE_03_ROWS,
  NES_STAGE_04_ROWS,
  NES_STAGE_05_ROWS,
  NES_STAGE_06_ROWS,
  NES_STAGE_07_ROWS,
  NES_STAGE_08_ROWS,
  NES_STAGE_09_ROWS,
  NES_STAGE_10_ROWS,
} from './nesTerrainStrings'

export type Direction = 'up' | 'down' | 'left' | 'right'

export type TerrainType = 'empty' | 'brick' | 'steel' | 'grass' | 'water' | 'ice'

export type EnemyArchetypeId = 'grunt' | 'raider' | 'heavy' | 'sniper'

export interface EnemyArchetype {
  id: EnemyArchetypeId
  label: string
  speed: number
  reloadMs: number
  hp: number
  bulletSpeed: number
  turnIntervalMs: number
  fireChance: number
  chaseBias: number
}

export interface LevelConfig {
  id: number
  name: string
  intent: string
  enemiesTotal: number
  spawnDelaySec: number
  enemyQueue: EnemyArchetypeId[]
  terrainRows: string[]
}

export const TILE = 16
export const GRID = 26

/** 2×2 tile clearing for eagle hitbox (same as `state.terrainToBlocks` / `levelValidation`). */
const BASE_W_TILES = 2
export const BASE_TILE_COL_START = GRID / 2 - BASE_W_TILES / 2
/** Bottom two map rows — eagle hitbox is flush with `WORLD_H` (no extra margin row below). */
export const BASE_TILE_ROW_START = GRID - BASE_W_TILES
export const BASE_TILE_COL_END_EXCL = BASE_TILE_COL_START + BASE_W_TILES
export const BASE_TILE_ROW_END_EXCL = BASE_TILE_ROW_START + BASE_W_TILES

/**
 * One-tile brick wall on top + left + right of the eagle square only (bottom stays open toward the
 * player), matching NES Battle City layout.
 */
function buildBaseBrickRingCells(): { col: number; row: number }[] {
  const L = BASE_TILE_COL_START - 1
  const R = BASE_TILE_COL_END_EXCL
  const top = BASE_TILE_ROW_START - 1
  const out: { col: number; row: number }[] = []
  for (let c = L; c <= R; c += 1) {
    out.push({ col: c, row: top })
  }
  for (let r = BASE_TILE_ROW_START; r < BASE_TILE_ROW_END_EXCL; r += 1) {
    out.push({ col: L, row: r }, { col: R, row: r })
  }
  return out
}

export const BASE_BRICK_RING_CELLS = buildBaseBrickRingCells()

/** NES-import maps often gap the top wall; force brick on the U-shaped wall (not the bottom opening). */
export function ensureBaseBrickRingTerrain(rows: readonly string[]): string[] {
  const copy = rows.map((line) => line.split(''))
  for (const { col, row } of BASE_BRICK_RING_CELLS) {
    const line = copy[row]
    if (line && col >= 0 && col < line.length) line[col] = 'B'
  }
  return copy.map((chars) => chars.join(''))
}

export const ENEMY_ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetype> = {
  grunt: {
    id: 'grunt',
    label: 'Grunt',
    speed: 70,
    reloadMs: 1000,
    hp: 1,
    bulletSpeed: 210,
    turnIntervalMs: 880,
    fireChance: 0.018,
    chaseBias: 0.22,
  },
  raider: {
    id: 'raider',
    label: 'Raider',
    speed: 98,
    reloadMs: 900,
    hp: 1,
    bulletSpeed: 230,
    turnIntervalMs: 660,
    fireChance: 0.024,
    chaseBias: 0.35,
  },
  heavy: {
    id: 'heavy',
    label: 'Heavy',
    speed: 62,
    reloadMs: 840,
    hp: 2,
    bulletSpeed: 220,
    turnIntervalMs: 980,
    fireChance: 0.02,
    chaseBias: 0.28,
  },
  sniper: {
    id: 'sniper',
    label: 'Sniper',
    speed: 78,
    reloadMs: 670,
    hp: 1,
    bulletSpeed: 280,
    turnIntervalMs: 760,
    fireChance: 0.032,
    chaseBias: 0.44,
  },
}

// 26×26 terrain matches NES Battle City layouts from orn1983/battlecityjs (regenerate: npm run sync:tank90-maps).

const levels: LevelConfig[] = [
  {
    id: 1,
    name: 'Stage 1',
    intent: 'Classic intro layout with broad lanes and light center pressure.',
    enemiesTotal: 8,
    spawnDelaySec: 0.72,
    enemyQueue: ['grunt', 'grunt', 'raider', 'grunt', 'grunt', 'raider', 'grunt', 'heavy'],
    terrainRows: NES_STAGE_01_ROWS,
  },
  {
    id: 2,
    name: 'Stage 2',
    intent: 'Twin water channels with brick chokepoints and flank pivots.',
    enemiesTotal: 9,
    spawnDelaySec: 0.7,
    enemyQueue: ['grunt', 'raider', 'grunt', 'raider', 'heavy', 'grunt', 'raider', 'grunt', 'sniper'],
    terrainRows: NES_STAGE_02_ROWS,
  },
  {
    id: 3,
    name: 'Stage 3',
    intent: 'Cross-style fortress pattern with mixed steel anchors.',
    enemiesTotal: 10,
    spawnDelaySec: 0.68,
    enemyQueue: ['grunt', 'raider', 'sniper', 'grunt', 'heavy', 'raider', 'sniper', 'grunt', 'heavy', 'raider'],
    terrainRows: NES_STAGE_03_ROWS,
  },
  {
    id: 4,
    name: 'Stage 4',
    intent: 'River split map with narrow bridge fights and grass cover.',
    enemiesTotal: 10,
    spawnDelaySec: 0.66,
    enemyQueue: ['raider', 'grunt', 'raider', 'heavy', 'grunt', 'sniper', 'raider', 'heavy', 'sniper', 'grunt'],
    terrainRows: NES_STAGE_04_ROWS,
  },
  {
    id: 5,
    name: 'Stage 5',
    intent: 'Steel-heavy blocks create classic bunker lanes.',
    enemiesTotal: 11,
    spawnDelaySec: 0.64,
    enemyQueue: ['heavy', 'grunt', 'raider', 'heavy', 'sniper', 'grunt', 'heavy', 'raider', 'sniper', 'raider', 'heavy'],
    terrainRows: NES_STAGE_05_ROWS,
  },
  {
    id: 6,
    name: 'Stage 6',
    intent: 'Open split approach with alternating steel and river blocks.',
    enemiesTotal: 11,
    spawnDelaySec: 0.62,
    enemyQueue: ['raider', 'sniper', 'grunt', 'heavy', 'raider', 'sniper', 'heavy', 'raider', 'grunt', 'sniper', 'heavy'],
    terrainRows: NES_STAGE_06_ROWS,
  },
  {
    id: 7,
    name: 'Stage 7',
    intent: 'Dense steel corridors force disciplined peeking.',
    enemiesTotal: 12,
    spawnDelaySec: 0.6,
    enemyQueue: ['heavy', 'raider', 'sniper', 'heavy', 'raider', 'heavy', 'sniper', 'raider', 'grunt', 'sniper', 'heavy', 'raider'],
    terrainRows: NES_STAGE_07_ROWS,
  },
  {
    id: 8,
    name: 'Stage 8',
    intent: 'Needle lanes and river seams amplify long-range pressure.',
    enemiesTotal: 12,
    spawnDelaySec: 0.58,
    enemyQueue: ['sniper', 'raider', 'sniper', 'heavy', 'grunt', 'sniper', 'raider', 'heavy', 'sniper', 'raider', 'heavy', 'sniper'],
    terrainRows: NES_STAGE_08_ROWS,
  },
  {
    id: 9,
    name: 'Stage 9',
    intent: 'Fortress-style density with tight breaches and steel cores.',
    enemiesTotal: 13,
    spawnDelaySec: 0.56,
    enemyQueue: ['heavy', 'sniper', 'raider', 'heavy', 'sniper', 'raider', 'heavy', 'sniper', 'grunt', 'raider', 'heavy', 'sniper', 'heavy'],
    terrainRows: NES_STAGE_09_ROWS,
  },
  {
    id: 10,
    name: 'Stage 10',
    intent: 'Gauntlet mix of steel, brick and river close to original finale feel.',
    enemiesTotal: 14,
    spawnDelaySec: 0.54,
    enemyQueue: ['sniper', 'heavy', 'raider', 'sniper', 'heavy', 'raider', 'sniper', 'heavy', 'raider', 'sniper', 'heavy', 'raider', 'sniper', 'heavy'],
    terrainRows: NES_STAGE_10_ROWS,
  },
]

export const LEVELS = levels

export function getLevelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.min(level, LEVELS.length))
  const raw = LEVELS[n - 1]
  return { ...raw, terrainRows: ensureBaseBrickRingTerrain(raw.terrainRows) }
}

export function terrainFromChar(ch: string): TerrainType {
  if (ch === 'B') return 'brick'
  if (ch === 'S') return 'steel'
  if (ch === 'G') return 'grass'
  if (ch === 'W') return 'water'
  if (ch === 'I') return 'ice'
  return 'empty'
}
