import { TILE } from '../levels'
import { TANK_SIZE, WORLD_H, WORLD_W } from './constants'
import type { RenderPalette } from './palette'
import type { GameState, Tank } from './types'

/** 32×32: Battle City–style eagle (black tile + grey eagle + red accents). */
function drawEagleBase(ctx: CanvasRenderingContext2D, x: number, y: number, alive: boolean) {
  // Extracted from the attached reference (cropped 34×34 → inner 32×32).
  // Legend: '.' = background, 'G' = eagle grey, 'R' = red accent.
  const EAGLE_BITMAP: string[] = [
    '................................',
    '................................',
    '................................',
    '..G..........................G..',
    '...G........................G...',
    '...GG.........GG...........GG...',
    '..GGGG..........RR........GGGG..',
    '..GGGGG.........RR.......GGGGG..',
    '...GGGG........G.........GGGG...',
    '...GGGG........GG........GGGG...',
    '..GGGGGG.......GG.......GGGGGG..',
    '....GG..GGG....GG....GGG..GG....',
    '......RR.GGG..GGGG..GGG.RR......',
    '......RR..GGGGGGGGGGGG..RR......',
    '....GG..RR.GGGGGGGGGG.RR..GG....',
    '....GGG.RR.G..GGGG..G.RR.GGG....',
    '.....GGG..G.RR.GG.RR.G..GGG.....',
    '.....GGGGGG.RR.GG.RR.GGGGGG.....',
    '.....GGGGGGG..GGGG..GGGGGGG.....',
    '......GGGGGG..GGGG..GGGGGG......',
    '.......GGGG....GG....GGGG.......',
    '...............GG...............',
    '...............GG...............',
    '...............GG...............',
    '..............GGGG..............',
    '.............GGGGGG.............',
    '............GGGGGGGG............',
    '.........GGG..GGGG..GGG.........',
    '.........GG....GG....GG.........',
    '................................',
    '................................',
    '................................',
  ]

  // Black tile background (matches the reference screenshot).
  ctx.fillStyle = '#0b0f17'
  ctx.fillRect(x, y, TILE * 2, TILE * 2)

  const grey = '#cbd5e1'
  const red = '#ef4444'
  const dimGrey = 'rgba(203,213,225,0.22)'
  // Keep only the head red accent (top-most, center-ish 2×2 cluster in the reference).
  const isHeadRed = (xx: number, yy: number) => (xx === 16 || xx === 17) && (yy === 6 || yy === 7)

  // Fill any enclosed '.' holes so the eagle body is solid (no see-through).
  const H = EAGLE_BITMAP.length
  const W = EAGLE_BITMAP[0]?.length ?? 0
  const bgReachable = new Set<number>()
  const q: Array<[number, number]> = []
  const pushBg = (xx: number, yy: number) => {
    if (xx < 0 || yy < 0 || xx >= W || yy >= H) return
    const row = EAGLE_BITMAP[yy]
    if (!row) return
    if (row[xx] !== '.') return
    const key = yy * 64 + xx
    if (bgReachable.has(key)) return
    bgReachable.add(key)
    q.push([xx, yy])
  }
  for (let xx = 0; xx < W; xx += 1) {
    pushBg(xx, 0)
    pushBg(xx, H - 1)
  }
  for (let yy = 0; yy < H; yy += 1) {
    pushBg(0, yy)
    pushBg(W - 1, yy)
  }
  while (q.length) {
    const [cx, cy] = q.shift()!
    pushBg(cx - 1, cy)
    pushBg(cx + 1, cy)
    pushBg(cx, cy - 1)
    pushBg(cx, cy + 1)
  }

  for (let yy = 0; yy < EAGLE_BITMAP.length; yy += 1) {
    const row = EAGLE_BITMAP[yy]
    if (!row) continue
    for (let xx = 0; xx < row.length; xx += 1) {
      const ch = row[xx]
      if (ch === '.') {
        // Only draw '.' if it's an enclosed hole (not connected to the border background).
        const key = yy * 64 + xx
        if (bgReachable.has(key)) continue
        ctx.fillStyle = alive ? grey : dimGrey
        ctx.fillRect(x + xx, y + yy, 1, 1)
        continue
      }
      if (!alive) {
        // Destroyed: only keep a faint grey silhouette; no red.
        ctx.fillStyle = dimGrey
        ctx.fillRect(x + xx, y + yy, 1, 1)
        continue
      }
      if (ch === 'R' && isHeadRed(xx, yy)) {
        ctx.fillStyle = red
        ctx.fillRect(x + xx, y + yy, 1, 1)
        continue
      }
      // Former wing/body reds: still eagle body — fill grey so no holes.
      ctx.fillStyle = grey
      ctx.fillRect(x + xx, y + yy, 1, 1)
    }
  }
}

function drawPowerUpIcon(
  ctx: CanvasRenderingContext2D,
  kind: GameState['powerUp'] extends null ? never : NonNullable<GameState['powerUp']>['kind'],
  x: number,
  y: number,
  tMs: number,
) {
  // 32×32 (2×2 tiles) NES-ish pixel icons (no text), closer to original silhouette.
  const bob = Math.round(Math.sin(tMs / 220) * 1.5)
  const oy = bob
  const px = (dx: number, dy: number, w = 1, h = 1) => ctx.fillRect(x + dx, y + dy + oy, w, h)

  ctx.save()
  // Soft shadow so it "floats" without fully covering terrain.
  ctx.globalAlpha = 0.22
  ctx.fillStyle = '#000000'
  px(6, 28, 20, 3)
  px(8, 27, 16, 1)
  ctx.globalAlpha = 0.58

  // Reference-style tile: white stroke with transparent center (no solid bottom color),
  // so terrain stays visible under the pickup.
  ctx.fillStyle = 'rgba(11,15,23,0.55)'
  px(0, 0, 32, 32)
  ctx.clearRect(x + 2, y + 2 + oy, 28, 28)
  ctx.fillStyle = '#f8fafc'
  px(2, 2, 28, 28)
  ctx.clearRect(x + 4, y + 4 + oy, 24, 24)
  // Very light blue tint as a subtle veil (still transparent enough to see terrain).
  ctx.fillStyle = 'rgba(30,58,138,0.12)'
  px(4, 4, 24, 24)

  // Slight inner highlight
  ctx.globalAlpha = 0.72
  ctx.fillStyle = 'rgba(255,255,255,0.10)'
  px(4, 4, 24, 2)
  px(4, 4, 2, 24)
  ctx.globalAlpha = 0.78

  if (kind === 'grenade') {
    // Bomb + fuse.
    ctx.fillStyle = '#0b0f17'
    px(14, 8, 4, 3) // cap
    ctx.fillStyle = '#e5e7eb'
    px(10, 11, 12, 14) // body
    ctx.fillStyle = '#9ca3af'
    px(12, 13, 8, 10)
    ctx.fillStyle = '#111827'
    px(13, 14, 6, 8)
    ctx.fillStyle = '#f59e0b'
    px(18, 6, 2, 2)
    px(20, 7, 2, 2)
    px(22, 8, 1, 1)
    ctx.restore()
    return
  }

  if (kind === 'helmet') {
    // Helmet: dome + rim + visor slit.
    ctx.fillStyle = '#f8fafc'
    px(8, 10, 16, 10) // dome
    px(6, 14, 20, 10) // sides
    ctx.fillStyle = '#cbd5e1'
    px(9, 14, 14, 8) // inner shade
    ctx.fillStyle = '#ffffff'
    px(9, 12, 14, 2) // shine
    ctx.fillStyle = '#0b0f17'
    px(12, 19, 8, 2) // visor
    ctx.restore()
    return
  }

  if (kind === 'shovel') {
    // Shovel: handle + spade.
    ctx.fillStyle = '#f8fafc'
    px(15, 8, 2, 12) // handle
    ctx.fillStyle = '#cbd5e1'
    px(14, 18, 4, 4) // grip
    ctx.fillStyle = '#f8fafc'
    px(11, 22, 10, 7) // spade
    ctx.fillStyle = '#94a3b8'
    px(12, 23, 8, 4)
    ctx.fillStyle = '#64748b'
    px(13, 25, 6, 1)
    ctx.restore()
    return
  }

  if (kind === 'star') {
    // Big star (chunky).
    ctx.fillStyle = '#f8fafc'
    px(15, 8, 2, 18)
    px(8, 15, 18, 2)
    px(11, 11, 10, 10)
    ctx.fillStyle = '#cbd5e1'
    px(15, 9, 2, 3)
    px(9, 15, 3, 2)
    ctx.fillStyle = '#94a3b8'
    px(11, 22, 10, 2)
    ctx.restore()
    return
  }

  if (kind === 'tank') {
    // Extra life tank icon.
    ctx.fillStyle = '#f8fafc'
    px(8, 16, 16, 8) // hull
    ctx.fillStyle = '#cbd5e1'
    px(10, 18, 12, 4)
    ctx.fillStyle = '#0b0f17'
    px(12, 19, 8, 2)
    ctx.fillStyle = '#f8fafc'
    px(13, 12, 6, 5) // turret
    ctx.fillStyle = '#ffffff'
    px(19, 14, 10, 2) // barrel
    ctx.fillStyle = '#0b0f17'
    px(8, 24, 16, 2) // track
    ctx.restore()
    return
  }

  // timer
  ctx.fillStyle = '#f8fafc'
  px(13, 8, 6, 3) // top knob
  ctx.fillStyle = '#e2e8f0'
  px(9, 12, 14, 14) // face
  ctx.fillStyle = '#94a3b8'
  px(10, 13, 12, 12)
  ctx.fillStyle = '#f8fafc'
  px(16, 13, 2, 8) // hands
  px(16, 19, 7, 2)
  ctx.restore()
}

function drawPixelTank(
  ctx: CanvasRenderingContext2D,
  tank: Tank,
  palette: [string, string, string],
  opts?: { skipCenter?: boolean },
) {
  const [body, trim, barrel] = palette
  const x = Math.floor(tank.x)
  const y = Math.floor(tank.y)
  ctx.fillStyle = trim
  ctx.fillRect(x, y, TANK_SIZE, TANK_SIZE)
  ctx.fillStyle = body
  ctx.fillRect(x + 2, y + 2, TANK_SIZE - 4, TANK_SIZE - 4)
  if (!opts?.skipCenter) {
    ctx.fillStyle = trim
    ctx.fillRect(x + 6, y + 6, 4, 4)
  }
  ctx.fillStyle = barrel
  // Keep the barrel fully inside the 16×16 tank footprint (no overhang).
  // Also inset by 1px so it reads as part of the turret rather than a protruding hitbox.
  if (tank.dir === 'up') ctx.fillRect(x + 6, y + 1, 4, 7)
  if (tank.dir === 'down') ctx.fillRect(x + 6, y + 8, 4, 7)
  if (tank.dir === 'left') ctx.fillRect(x + 1, y + 6, 7, 4)
  if (tank.dir === 'right') ctx.fillRect(x + 8, y + 6, 7, 4)
}

function drawOverlay(ctx: CanvasRenderingContext2D, text: string, p: RenderPalette) {
  ctx.fillStyle = p.overlayDim
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  ctx.fillStyle = p.overlayText
  ctx.font = 'bold 28px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(text, WORLD_W / 2, WORLD_H / 2)
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  palette: RenderPalette,
  opts?: { reducedMotion?: boolean },
) {
  const reducedMotion = opts?.reducedMotion ?? false
  ctx.clearRect(0, 0, WORLD_W, WORLD_H)
  ctx.fillStyle = palette.bg
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)

  ctx.fillStyle = palette.checker
  for (let y = 0; y < WORLD_H; y += TILE) {
    for (let x = 0; x < WORLD_W; x += TILE) {
      if ((x / TILE + y / TILE) % 2 === 0) ctx.fillRect(x, y, TILE, TILE)
    }
  }

  // Terrain pass 1: solids + floors (keep grass for overlay pass later).
  for (const tile of state.terrain) {
    if (tile.type === 'brick') {
      ctx.fillStyle = palette.brickOuter
      ctx.fillRect(tile.x, tile.y, tile.size, tile.size)
      ctx.fillStyle = palette.brickInner
      ctx.fillRect(tile.x + 2, tile.y + 2, tile.size - 4, tile.size - 4)
      continue
    }
    if (tile.type === 'steel') {
      ctx.fillStyle = palette.steelOuter
      ctx.fillRect(tile.x, tile.y, tile.size, tile.size)
      ctx.fillStyle = palette.steelInner
      ctx.fillRect(tile.x + 2, tile.y + 2, tile.size - 4, tile.size - 4)
      continue
    }
    if (tile.type === 'grass') {
      continue
    }
    if (tile.type === 'ice') {
      ctx.fillStyle = palette.ice
      ctx.fillRect(tile.x + 1, tile.y + 1, tile.size - 2, tile.size - 2)
      ctx.fillStyle = 'rgba(255,255,255,0.22)'
      ctx.fillRect(tile.x + 4, tile.y + 3, 6, 2)
      continue
    }
    if (tile.type === 'water') {
      ctx.fillStyle = palette.waterOuter
      ctx.fillRect(tile.x, tile.y, tile.size, tile.size)
      ctx.fillStyle = palette.waterInner
      ctx.fillRect(tile.x + 2, tile.y + 2, tile.size - 4, tile.size - 4)
    }
  }

  drawEagleBase(ctx, state.base.x, state.base.y, state.base.alive)

  if (state.player.alive) {
    if (state.playerInvincibleUntil > 0) {
      const alpha = reducedMotion
        ? 0.85
        : 0.74 + (Math.sin(state.playerInvincibleUntil / 120) + 1) * 0.13
      ctx.globalAlpha = alpha
    }
    drawPixelTank(ctx, state.player, palette.playerTank)
    ctx.globalAlpha = 1
    if (state.playerInvincibleUntil > 0) {
      ctx.strokeStyle = palette.shieldStroke
      ctx.lineWidth = 2
      ctx.strokeRect(state.player.x - 1, state.player.y - 1, TANK_SIZE + 2, TANK_SIZE + 2)
    }
  }

  for (const enemy of state.enemies) {
    if (!enemy.alive) continue
    const isArmor = enemy.archetypeId === 'armor'
    const trip =
      isArmor
        ? palette.enemyHeavy
        : enemy.archetypeId === 'power'
          ? palette.enemySniper
          : enemy.archetypeId === 'fast'
            ? palette.enemyRaider
            : palette.enemyGrunt
    drawPixelTank(ctx, enemy, trip, isArmor ? { skipCenter: true } : undefined)
    if (isArmor) {
      // Armor tank: extra outer frame instead of the center dot.
      ctx.strokeStyle = 'rgba(248,250,252,0.85)'
      ctx.lineWidth = 2
      ctx.strokeRect(enemy.x - 1, enemy.y - 1, TANK_SIZE + 2, TANK_SIZE + 2)
      ctx.strokeStyle = 'rgba(15,23,42,0.45)'
      ctx.lineWidth = 1
      ctx.strokeRect(enemy.x - 2, enemy.y - 2, TANK_SIZE + 4, TANK_SIZE + 4)
    }
  }

  for (const bullet of state.bullets) {
    ctx.fillStyle = bullet.owner === 'player' ? palette.bulletPlayer : palette.bulletEnemy
    ctx.beginPath()
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  // Terrain pass 2: grass overlay (must sit above pickups/tanks/bullets).
  for (const tile of state.terrain) {
    if (tile.type !== 'grass') continue
    ctx.fillStyle = palette.grass
    ctx.fillRect(tile.x + 1, tile.y + 1, tile.size - 2, tile.size - 2)
  }

  // Power-up: highest layer (above grass, tanks, bullets).
  if (state.powerUp) {
    const pu = state.powerUp
    const x = Math.floor(pu.x)
    const y = Math.floor(pu.y)
    drawPowerUpIcon(ctx, pu.kind, x, y, state.elapsedMs)
  }

  if (state.levelBannerUntil > 0) {
    // In READY mode we draw a dedicated overlay that includes stage info,
    // so the normal banner would be covered / duplicated.
    if (state.status === 'ready') {
      // Skip drawing the banner; ready overlay is rendered later.
    } else {
    ctx.fillStyle = palette.bannerBg
    ctx.fillRect(0, WORLD_H / 2 - 26, WORLD_W, 52)
    ctx.fillStyle = palette.bannerText
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`STAGE ${state.level}`, WORLD_W / 2, WORLD_H / 2 + 7)
    }
  }

  if (state.status === 'running') {
    if (state.playerInvincibleUntil > 0) {
    ctx.fillStyle = palette.shieldText
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('SPAWN SHIELD', 8, 14)
    }
    if (state.powerUpToastUntilMs > 0 && state.powerUpToastText) {
      const y = state.playerInvincibleUntil > 0 ? 28 : 14
      ctx.fillStyle = palette.shieldText
      ctx.font = 'bold 12px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(state.powerUpToastText, 8, y)
    }
  }

  if (state.status === 'ready') {
    ctx.fillStyle = palette.overlayDim
    ctx.fillRect(0, 0, WORLD_W, WORLD_H)
    ctx.fillStyle = palette.overlayText
    ctx.textAlign = 'center'
    ctx.font = 'bold 20px monospace'
    ctx.fillText(`STAGE ${state.level}`, WORLD_W / 2, WORLD_H / 2 - 6)
    ctx.font = 'bold 28px monospace'
    ctx.fillText('FIRE TO START', WORLD_W / 2, WORLD_H / 2 + 22)
  }
  if (state.status === 'paused') drawOverlay(ctx, 'PAUSED', palette)
  if (state.status === 'won') {
    if (state.level >= 10) {
      drawOverlay(ctx, 'ALL STAGES CLEAR', palette)
    } else {
      // Two-line overlay: clear message + actionable prompt.
      ctx.fillStyle = palette.overlayDim
      ctx.fillRect(0, 0, WORLD_W, WORLD_H)
      ctx.fillStyle = palette.overlayText

      ctx.font = 'bold 28px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('STAGE CLEAR', WORLD_W / 2, WORLD_H / 2 - 10)

      ctx.font = 'bold 18px monospace'
      ctx.fillText('FIRE TO NEXT STAGE', WORLD_W / 2, WORLD_H / 2 + 18)
    }
  }
  if (state.status === 'lost') drawOverlay(ctx, 'GAME OVER', palette)
}
