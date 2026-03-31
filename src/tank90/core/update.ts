import { findDefaultPlayerSpawnPixels } from '../levelValidation'
import {
  BASE_BRICK_RING_CELLS,
  ENEMY_ARCHETYPES,
  getLevelConfig,
  terrainFromChar,
  TILE,
  type Direction,
  type TerrainType,
} from '../levels'
import {
  EARLY_GAME_SAFETY_MS,
  SPAWN_POINTS,
  STAGE1_EARLY_ACTIVE_ENEMY_CAP,
  STAGE1_EARLY_FIRE_CHANCE_SCALE,
  PLAYER_BULLET_SPEED,
  TANK_SIZE,
  WORLD_H,
  WORLD_W,
} from './constants'
import { directionForInput } from './state'
import type { Base, Bullet, GameState, InputState, PowerUpKind, Tank, TileBlock } from './types'

// Delay the first possible enemy shot after each spawn.
// Without it, early bullets can reach the player during the narrow spawn window.
const ENEMY_FIRST_FIRE_GRACE_MS = 1200

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function dirVector(dir: Direction) {
  if (dir === 'up') return { x: 0, y: -1 }
  if (dir === 'down') return { x: 0, y: 1 }
  if (dir === 'left') return { x: -1, y: 0 }
  return { x: 1, y: 0 }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

// Collision hitbox: slightly smaller than 16×16 tank render to reduce corner snagging
// against tile edges when moving at sub-tile increments.
const TANK_HITBOX_INSET = 1
const TANK_HITBOX_SIZE = TANK_SIZE - TANK_HITBOX_INSET * 2

function tankRect(tank: Tank) {
  return { x: tank.x + TANK_HITBOX_INSET, y: tank.y + TANK_HITBOX_INSET, w: TANK_HITBOX_SIZE, h: TANK_HITBOX_SIZE }
}

function blocksTank(type: TerrainType) {
  return type === 'brick' || type === 'steel' || type === 'water'
}

function applyMovement(
  tank: Tank,
  dt: number,
  dir: Direction,
  terrain: TileBlock[],
  otherTanks: Tank[],
  base: Base,
) {
  const v = dirVector(dir)
  const nx = clamp(tank.x + v.x * tank.speed * dt, 0, WORLD_W - TANK_SIZE)
  const ny = clamp(tank.y + v.y * tank.speed * dt, 0, WORLD_H - TANK_SIZE)
  const nextRect = { x: nx + TANK_HITBOX_INSET, y: ny + TANK_HITBOX_INSET, w: TANK_HITBOX_SIZE, h: TANK_HITBOX_SIZE }

  for (const tile of terrain) {
    if (!blocksTank(tile.type)) continue
    if (rectsOverlap(nextRect, { x: tile.x, y: tile.y, w: tile.size, h: tile.size })) return
  }

  if (tank.isEnemy && rectsOverlap(nextRect, { x: base.x, y: base.y, w: base.size, h: base.size })) return

  for (const other of otherTanks) {
    if (!other.alive || other.id === tank.id) continue
    if (rectsOverlap(nextRect, tankRect(other))) return
  }

  tank.x = nx
  tank.y = ny
  tank.dir = dir
}

function createBullet(tank: Tank): Bullet {
  const v = dirVector(tank.dir)
  return {
    x: tank.x + TANK_SIZE / 2,
    y: tank.y + TANK_SIZE / 2,
    vx: v.x * tank.bulletSpeed,
    vy: v.y * tank.bulletSpeed,
    radius: 2.5,
    owner: tank.isEnemy ? 'enemy' : 'player',
    alive: true,
  }
}

function circleBox(bullet: Bullet) {
  return {
    x: bullet.x - bullet.radius,
    y: bullet.y - bullet.radius,
    w: bullet.radius * 2,
    h: bullet.radius * 2,
  }
}

function isStage1EarlyWindow(state: GameState) {
  return state.level === 1 && state.elapsedMs < EARLY_GAME_SAFETY_MS
}

function getSpawnActiveEnemyCap(state: GameState) {
  return isStage1EarlyWindow(state) ? STAGE1_EARLY_ACTIVE_ENEMY_CAP : 4
}

function getEnemyFireChance(state: GameState, enemy: Tank) {
  if (!isStage1EarlyWindow(state)) return enemy.fireChance
  return enemy.fireChance * STAGE1_EARLY_FIRE_CHANCE_SCALE
}

function spawnRectBlockedByTerrain(state: GameState, x: number, y: number) {
  const config = getLevelConfig(state.level)
  const x0 = Math.floor(x / TILE)
  const x1 = Math.floor((x + TANK_SIZE - 1) / TILE)
  const y0 = Math.floor(y / TILE)
  const y1 = Math.floor((y + TANK_SIZE - 1) / TILE)
  for (let ty = y0; ty <= y1; ty += 1) {
    for (let tx = x0; tx <= x1; tx += 1) {
      const ch = config.terrainRows[ty]?.[tx]
      const t = terrainFromChar(ch ?? '.')
      if (blocksTank(t)) return true
    }
  }
  return false
}

function spawnRectBlockedByActors(state: GameState, x: number, y: number) {
  const rect = { x, y, w: TANK_SIZE, h: TANK_SIZE }
  if (state.player.alive && rectsOverlap(rect, tankRect(state.player))) return true
  for (const e of state.enemies) {
    if (e.alive && rectsOverlap(rect, tankRect(e))) return true
  }
  return false
}

function isSpawnFree(state: GameState, x: number, y: number) {
  return !spawnRectBlockedByTerrain(state, x, y) && !spawnRectBlockedByActors(state, x, y)
}

function maybeSpawnEnemy(state: GameState, now: number) {
  if (state.spawnCooldown > 0) return

  const aliveEnemies = state.enemies.filter((e) => e.alive).length
  if (aliveEnemies >= getSpawnActiveEnemyCap(state) || state.enemiesSpawned >= state.enemiesTotal) return

  let spawnX = -1
  let spawnY = -1
  for (let tryIdx = 0; tryIdx < SPAWN_POINTS.length; tryIdx += 1) {
    const sp = SPAWN_POINTS[(state.enemiesSpawned + tryIdx) % SPAWN_POINTS.length]
    if (isSpawnFree(state, sp.x, sp.y)) {
      spawnX = sp.x
      spawnY = sp.y
      break
    }
  }
  if (spawnX < 0) return

  const queueIndex = state.enemiesSpawned % state.enemyQueue.length
  const archetypeId = state.enemyQueue[queueIndex] ?? 'basic'
  const archetype = ENEMY_ARCHETYPES[archetypeId]
  state.enemies.push({
    id: `enemy-${state.level}-${state.enemiesSpawned}`,
    x: spawnX,
    y: spawnY,
    dir: 'down',
    speed: archetype.speed,
    reloadMs: archetype.reloadMs,
    lastShotAt: now - archetype.reloadMs + ENEMY_FIRST_FIRE_GRACE_MS,
    alive: true,
    isEnemy: true,
    aiTurnAt: now + archetype.turnIntervalMs,
    hp: archetype.hp,
    archetypeId,
    bulletSpeed: archetype.bulletSpeed,
    turnIntervalMs: archetype.turnIntervalMs,
    fireChance: archetype.fireChance,
    chaseBias: archetype.chaseBias,
  })
  state.enemiesSpawned += 1
  state.spawnCooldown = getLevelConfig(state.level).spawnDelaySec
}

function updateEnemyAiAndFire(state: GameState, dt: number, now: number) {
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    if (state.freezeEnemiesUntilMs > 0 && state.elapsedMs < state.freezeEnemiesUntilMs) continue
    if (now >= enemy.aiTurnAt) {
      const dx = state.player.x - enemy.x
      const dy = state.player.y - enemy.y
      const chaseHorizontal = Math.abs(dx) > Math.abs(dy)
      const chaseDir: Direction = chaseHorizontal ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
      const dirs: Direction[] = ['up', 'down', 'left', 'right']
      const randomDir = dirs[Math.floor(Math.random() * dirs.length)]
      enemy.dir = Math.random() < enemy.chaseBias ? chaseDir : randomDir
      enemy.aiTurnAt = now + enemy.turnIntervalMs + Math.random() * 260
    }
    applyMovement(enemy, dt, enemy.dir, state.terrain, [state.player, ...state.enemies], state.base)
    const fireChance = getEnemyFireChance(state, enemy)
    if (now - enemy.lastShotAt > enemy.reloadMs && Math.random() < fireChance) {
      enemy.lastShotAt = now
      state.bullets.push(createBullet(enemy))
    }
  }
}

function scheduleNextPowerUp(state: GameState) {
  // Spawn roughly every 7–10 seconds with jitter (independent timer).
  state.nextPowerUpAtMs = state.elapsedMs + 7000 + Math.random() * 3000
}

function schedulePowerUpDespawn(state: GameState) {
  if (!state.powerUp) return
  // Power-up exists briefly, then disappears (independent of pickup).
  state.powerUp.despawnAtMs = state.elapsedMs + 6500 + Math.random() * 2500
}

function randomPowerUpKind(): PowerUpKind {
  const kinds: PowerUpKind[] = ['grenade', 'helmet', 'shovel', 'star', 'tank', 'timer']
  return kinds[Math.floor(Math.random() * kinds.length)] ?? 'star'
}

function powerUpRect(pu: { x: number; y: number }) {
  // Power-ups occupy a 2×2 tile area (32×32) like the original.
  return { x: pu.x, y: pu.y, w: TILE * 2, h: TILE * 2 }
}

function isPowerUpSpawnFree(state: GameState, x: number, y: number) {
  const rect = powerUpRect({ x, y })
  if (rectsOverlap(rect, { x: state.base.x - TILE, y: state.base.y - TILE, w: state.base.size + TILE * 2, h: state.base.size + TILE * 2 })) {
    return false
  }
  // In the original, power-ups can overlap terrain. We allow overlap, but avoid "too much" overlap
  // with solid tiles to keep pickups visually/physically reachable.
  let solidOverlaps = 0
  for (const tile of state.terrain) {
    if (tile.type !== 'brick' && tile.type !== 'steel' && tile.type !== 'water') continue
    if (rectsOverlap(rect, { x: tile.x, y: tile.y, w: tile.size, h: tile.size })) {
      solidOverlaps += 1
      if (solidOverlaps > 1) return false
    }
  }
  if (state.player.alive && rectsOverlap(rect, tankRect(state.player))) return false
  for (const e of state.enemies) {
    if (!e.alive) continue
    if (rectsOverlap(rect, tankRect(e))) return false
  }
  return true
}

function getPowerUpCandidatePoints(): { x: number; y: number }[] {
  // 4×4 grid of candidate top-left points, aligned to 2-tile cells.
  const cols = [2, 8, 14, 20]
  const rows = [3, 8, 13, 18]
  const out: { x: number; y: number }[] = []
  for (const r of rows) for (const c of cols) out.push({ x: c * TILE, y: r * TILE })
  return out
}

function maybeSpawnPowerUp(state: GameState) {
  if (state.powerUp) return
  if (state.elapsedMs < state.nextPowerUpAtMs) return
  const candidates = getPowerUpCandidatePoints()
  // Try up to N random picks; fallback to linear scan.
  for (let i = 0; i < candidates.length; i += 1) {
    const p = candidates[Math.floor(Math.random() * candidates.length)]
    if (!p) continue
    if (isPowerUpSpawnFree(state, p.x, p.y)) {
      state.powerUp = { kind: randomPowerUpKind(), x: p.x, y: p.y, spawnedAtMs: state.elapsedMs, despawnAtMs: state.elapsedMs }
      schedulePowerUpDespawn(state)
      scheduleNextPowerUp(state)
      return
    }
  }
  for (const p of candidates) {
    if (isPowerUpSpawnFree(state, p.x, p.y)) {
      state.powerUp = { kind: randomPowerUpKind(), x: p.x, y: p.y, spawnedAtMs: state.elapsedMs, despawnAtMs: state.elapsedMs }
      schedulePowerUpDespawn(state)
      scheduleNextPowerUp(state)
      return
    }
  }
  // If we couldn't place it, try again soon.
  state.nextPowerUpAtMs = state.elapsedMs + 1000
}

function ensureBaseRingTile(state: GameState, col: number, row: number, type: 'brick' | 'steel') {
  const x = col * TILE
  const y = row * TILE
  const existing = state.terrain.find((t) => t.x === x && t.y === y)
  if (existing) {
    existing.type = type
    existing.hp = type === 'brick' ? 1 : 99
    return
  }
  state.terrain.push({ x, y, size: TILE, type, hp: type === 'brick' ? 1 : 99 })
}

function applyShovel(state: GameState, durationMs: number) {
  for (const cell of BASE_BRICK_RING_CELLS) ensureBaseRingTile(state, cell.col, cell.row, 'steel')
  state.baseSteelUntilMs = Math.max(state.baseSteelUntilMs, state.elapsedMs + durationMs)
}

function maybeExpireShovel(state: GameState) {
  if (state.baseSteelUntilMs <= 0) return
  if (state.elapsedMs < state.baseSteelUntilMs) return
  state.baseSteelUntilMs = 0
  for (const cell of BASE_BRICK_RING_CELLS) ensureBaseRingTile(state, cell.col, cell.row, 'brick')
}

function respawnPlayer(state: GameState) {
  const cfg = getLevelConfig(state.level)
  const { x, y } = findDefaultPlayerSpawnPixels(cfg)
  state.player.x = x
  state.player.y = y
  state.player.dir = 'up'
  state.player.alive = true
  state.player.lastShotAt = 0
  state.player.reloadMs = 260
  state.player.bulletSpeed = PLAYER_BULLET_SPEED
  state.playerInvincibleUntil = 3000
  state.playerPowerTier = 0
}

function killOrRespawnPlayer(state: GameState) {
  if (state.playerLivesReserve > 0) {
    state.playerLivesReserve -= 1
    respawnPlayer(state)
    return
  }
  state.player.alive = false
  state.status = 'lost'
}

function maybePickupPowerUp(state: GameState) {
  if (!state.powerUp) return
  if (!state.player.alive) return
  if (!rectsOverlap(tankRect(state.player), powerUpRect(state.powerUp))) return
  const kind = state.powerUp.kind
  state.powerUp = null
  state.powerUpToastUntilMs = state.elapsedMs + 1400
  if (kind === 'grenade') {
    state.powerUpToastText = 'CLEAR ENEMIES'
    for (const e of state.enemies) {
      if (!e.alive) continue
      e.alive = false
      state.enemiesDestroyed += 1
    }
    return
  }
  if (kind === 'helmet') {
    state.powerUpToastText = 'SPAWN SHIELD'
    state.playerInvincibleUntil = Math.max(state.playerInvincibleUntil, 0) + 6000
    return
  }
  if (kind === 'shovel') {
    state.powerUpToastText = 'BASE STEEL'
    applyShovel(state, 8000)
    return
  }
  if (kind === 'star') {
    state.powerUpToastText = 'POWER UP'
    state.playerPowerTier = Math.min(3, state.playerPowerTier + 1) as 0 | 1 | 2 | 3
    if (state.playerPowerTier >= 1) state.player.bulletSpeed = 270
    if (state.playerPowerTier >= 2) state.player.reloadMs = 220
    if (state.playerPowerTier >= 3) state.player.bulletSpeed = 300
    return
  }
  if (kind === 'tank') {
    state.powerUpToastText = 'EXTRA LIFE'
    state.playerLivesReserve += 1
    return
  }
  if (kind === 'timer') {
    state.powerUpToastText = 'FREEZE ENEMIES'
    state.freezeEnemiesUntilMs = Math.max(state.freezeEnemiesUntilMs, state.elapsedMs + 6000)
  }
}

export function updateState(state: GameState, dt: number, now: number, input: InputState) {
  state.elapsedMs += dt * 1000
  state.playerInvincibleUntil = Math.max(0, state.playerInvincibleUntil - dt * 1000)
  if (state.powerUpToastUntilMs > 0 && state.elapsedMs >= state.powerUpToastUntilMs) {
    state.powerUpToastUntilMs = 0
    state.powerUpToastText = ''
  }
  maybeExpireShovel(state)
  if (state.powerUp && state.elapsedMs >= state.powerUp.despawnAtMs) {
    state.powerUp = null
  }
  maybeSpawnPowerUp(state)
  maybePickupPowerUp(state)
  const player = state.player
  if (player.alive) {
    const dir = directionForInput(input)
    if (dir) applyMovement(player, dt, dir, state.terrain, state.enemies, state.base)
    const maxBullets = state.playerPowerTier >= 2 ? 2 : 1
    const alivePlayerBullets = state.bullets.filter((b) => b.alive && b.owner === 'player').length
    if (input.fire && alivePlayerBullets < maxBullets && now - player.lastShotAt > player.reloadMs) {
      player.lastShotAt = now
      state.bullets.push(createBullet(player))
    }
  }

  if (state.spawnCooldown > 0) {
    state.spawnCooldown -= dt
  }
  maybeSpawnEnemy(state, now)

  updateEnemyAiAndFire(state, dt, now)

  for (const bullet of state.bullets) {
    if (!bullet.alive) continue
    bullet.x += bullet.vx * dt
    bullet.y += bullet.vy * dt
    if (bullet.x < 0 || bullet.x > WORLD_W || bullet.y < 0 || bullet.y > WORLD_H) {
      bullet.alive = false
      continue
    }

    for (const tile of state.terrain) {
      if (!bullet.alive || !rectsOverlap(circleBox(bullet), { x: tile.x, y: tile.y, w: tile.size, h: tile.size })) {
        continue
      }
      if (tile.type === 'grass' || tile.type === 'ice') continue
      if (tile.type === 'brick') {
        tile.hp -= 1
        bullet.alive = false
      } else if (tile.type === 'steel') {
        if (bullet.owner === 'player' && state.playerPowerTier >= 3) {
          tile.hp = 0
        }
        bullet.alive = false
      }
    }

    if (bullet.alive && state.base.alive && rectsOverlap(circleBox(bullet), { x: state.base.x, y: state.base.y, w: state.base.size, h: state.base.size })) {
      state.base.alive = false
      bullet.alive = false
      state.status = 'lost'
    }

    if (!bullet.alive) continue
    if (bullet.owner === 'enemy') {
      if (state.player.alive && state.playerInvincibleUntil <= 0 && rectsOverlap(circleBox(bullet), tankRect(state.player))) {
        bullet.alive = false
        killOrRespawnPlayer(state)
      }
    } else {
      for (const enemy of state.enemies) {
        if (!enemy.alive || !bullet.alive) continue
        if (rectsOverlap(circleBox(bullet), tankRect(enemy))) {
          enemy.hp -= 1
          bullet.alive = false
          if (enemy.hp <= 0) {
            enemy.alive = false
            state.enemiesDestroyed += 1
          }
        }
      }
    }
  }

  state.terrain = state.terrain.filter((b) => {
    if (b.type === 'brick' || b.type === 'steel') return b.hp > 0
    return true
  })
  state.bullets = state.bullets.filter((b) => b.alive)
  state.enemies = state.enemies.filter((e) => e.alive || !e.isEnemy)

  if (state.status === 'running' && state.enemiesDestroyed >= state.enemiesTotal && state.enemies.filter((e) => e.alive).length === 0) {
    state.status = 'won'
  }
}
