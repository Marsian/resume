import {
  BASE_BRICK_RING_CELLS,
  BASE_TILE_COL_END_EXCL,
  BASE_TILE_COL_START,
  BASE_TILE_ROW_END_EXCL,
  BASE_TILE_ROW_START,
  getLevelConfig,
  GRID,
  terrainFromChar,
  TILE,
  type LevelConfig,
} from './levels'
import { BASE_SIZE, BASE_TOP_Y, SPAWN_POINTS, TANK_SIZE, WORLD_H, WORLD_W } from './core/constants'

function blocksSpawn(ch: string) {
  const t = terrainFromChar(ch)
  return t === 'brick' || t === 'steel' || t === 'water'
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/** Tile coords for top-left of tank occupying spawn pixel position */
function spawnTileCoords(spawn: { x: number; y: number }) {
  return { col: Math.floor(spawn.x / TILE), row: Math.floor(spawn.y / TILE) }
}

export function assertLevelGridShape(config: LevelConfig) {
  if (config.terrainRows.length !== GRID) {
    throw new Error(`${config.name}: expected ${GRID} terrain rows, got ${config.terrainRows.length}`)
  }
  for (let i = 0; i < config.terrainRows.length; i += 1) {
    const row = config.terrainRows[i]
    if (row.length !== GRID) {
      throw new Error(`${config.name}: row ${i} length ${row.length}, expected ${GRID}`)
    }
  }
}

export function assertSpawnPointsClear(config: LevelConfig) {
  for (const spawn of SPAWN_POINTS) {
    const { col, row } = spawnTileCoords(spawn)
    const ch = config.terrainRows[row]?.[col]
    if (ch == null || blocksSpawn(ch)) {
      throw new Error(`${config.name}: spawn at tile (${col},${row}) blocked by '${ch ?? '?'}'`)
    }
  }
}

/** Any authored tile (brick, steel, water, grass, ice) must not overlap the player spawn rect. */
function cellHasTerrain(ch: string) {
  return terrainFromChar(ch) !== 'empty'
}

/** Bottom-up search: centered 16×16 tank clears every non-empty tile (same rule as gameplay terrain). */
export function findDefaultPlayerSpawnPixels(config: LevelConfig): { x: number; y: number } {
  const x = WORLD_W / 2 - TANK_SIZE / 2
  const prForY = (y: number) => ({ x, y, w: TANK_SIZE, h: TANK_SIZE })
  for (let row = Math.floor((WORLD_H - TANK_SIZE) / TILE); row >= 6; row -= 1) {
    const y = row * TILE
    const pr = prForY(y)
    // Entire tank must lie on or above the eagle hitbox — never the bottom "inside base" band.
    if (y + TANK_SIZE > BASE_TOP_Y) continue
    let hit = false
    for (let ty = 0; ty < config.terrainRows.length; ty += 1) {
      const rowStr = config.terrainRows[ty] ?? ''
      for (let tx = 0; tx < rowStr.length; tx += 1) {
        const ch = rowStr[tx] ?? '.'
        if (!cellHasTerrain(ch)) continue
        if (tx >= BASE_TILE_COL_START && tx < BASE_TILE_COL_END_EXCL && ty >= BASE_TILE_ROW_START && ty < BASE_TILE_ROW_END_EXCL) {
          continue
        }
        const tileRect = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE }
        if (rectsOverlap(pr, tileRect)) {
          hit = true
          break
        }
      }
      if (hit) break
    }
    if (!hit) return { x, y }
  }
  throw new Error(`${config.name}: no clear player spawn row found`)
}

export function assertDefaultPlayerSpawnClear(config: LevelConfig, terrainBlocks: { x: number; y: number; size: number; type: string }[]) {
  const { x: px, y: py } = findDefaultPlayerSpawnPixels(config)
  const pr = { x: px, y: py, w: TANK_SIZE, h: TANK_SIZE }
  for (const tile of terrainBlocks) {
    if (rectsOverlap(pr, { x: tile.x, y: tile.y, w: tile.size, h: tile.size })) {
      throw new Error(`${config.name}: resolved player spawn overlaps ${tile.type} at ${tile.x},${tile.y}`)
    }
  }
}

/** Eagle hitbox bottom flush with playfield; clearing occupies last two grid rows. */
export function assertBaseFlushBottomAndRows() {
  if (BASE_TOP_Y + BASE_SIZE !== WORLD_H) {
    throw new Error(`base must sit flush on world bottom: BASE_TOP_Y+BASE_SIZE=${BASE_TOP_Y + BASE_SIZE}, WORLD_H=${WORLD_H}`)
  }
  const baseH = BASE_TILE_ROW_END_EXCL - BASE_TILE_ROW_START
  if (baseH !== 2 || BASE_TILE_ROW_END_EXCL !== GRID) {
    throw new Error(`eagle must use bottom two rows: rows ${BASE_TILE_ROW_START}–${BASE_TILE_ROW_END_EXCL - 1}`)
  }
}

/** Eagle must have brick on top and both sides; bottom stays open (original design). */
export function assertBaseBrickRing(config: LevelConfig) {
  for (const { col, row } of BASE_BRICK_RING_CELLS) {
    const ch = config.terrainRows[row]?.[col]
    if (ch !== 'B') {
      throw new Error(`${config.name}: base brick ring missing at tile (${col},${row}), got '${ch ?? '?'}'`)
    }
  }
}

export function validateAllLevels(maxStage = 10) {
  assertBaseFlushBottomAndRows()
  for (let level = 1; level <= maxStage; level += 1) {
    const config = getLevelConfig(level)
    assertLevelGridShape(config)
    assertSpawnPointsClear(config)
    const blocks: { x: number; y: number; size: number; type: string }[] = []
    for (let y = 0; y < config.terrainRows.length; y += 1) {
      const row = config.terrainRows[y] ?? ''
      for (let x = 0; x < row.length; x += 1) {
        const t = terrainFromChar(row[x] ?? '.')
        if (t === 'empty') continue
        if (x >= BASE_TILE_COL_START && x < BASE_TILE_COL_END_EXCL && y >= BASE_TILE_ROW_START && y < BASE_TILE_ROW_END_EXCL) {
          continue
        }
        blocks.push({ x: x * TILE, y: y * TILE, size: TILE, type: t })
      }
    }
    assertDefaultPlayerSpawnClear(config, blocks)
    assertBaseBrickRing(config)
  }
}
