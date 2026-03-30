import { TILE } from '../levels'
import { TANK_SIZE, WORLD_H, WORLD_W } from './constants'
import type { RenderPalette } from './palette'
import type { GameState, Tank } from './types'

function drawPixelTank(ctx: CanvasRenderingContext2D, tank: Tank, palette: [string, string, string]) {
  const [body, trim, barrel] = palette
  const x = Math.floor(tank.x)
  const y = Math.floor(tank.y)
  ctx.fillStyle = trim
  ctx.fillRect(x, y, TANK_SIZE, TANK_SIZE)
  ctx.fillStyle = body
  ctx.fillRect(x + 2, y + 2, TANK_SIZE - 4, TANK_SIZE - 4)
  ctx.fillStyle = trim
  ctx.fillRect(x + 6, y + 6, 4, 4)
  ctx.fillStyle = barrel
  if (tank.dir === 'up') ctx.fillRect(x + 6, y - 3, 4, 6)
  if (tank.dir === 'down') ctx.fillRect(x + 6, y + 13, 4, 6)
  if (tank.dir === 'left') ctx.fillRect(x - 3, y + 6, 6, 4)
  if (tank.dir === 'right') ctx.fillRect(x + 13, y + 6, 6, 4)
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
      ctx.fillStyle = palette.grass
      ctx.fillRect(tile.x + 1, tile.y + 1, tile.size - 2, tile.size - 2)
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

  if (state.base.alive) {
    ctx.fillStyle = palette.baseAliveOuter
    ctx.fillRect(state.base.x, state.base.y, state.base.size, state.base.size)
    ctx.fillStyle = palette.baseAliveInner
    ctx.fillRect(state.base.x + 5, state.base.y + 4, state.base.size - 10, state.base.size - 8)
    ctx.fillStyle = palette.baseAliveAccent
    ctx.fillRect(state.base.x + 12, state.base.y + 8, 8, 4)
  } else {
    ctx.fillStyle = palette.baseDead
    ctx.fillRect(state.base.x, state.base.y, state.base.size, state.base.size)
  }

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
    const trip =
      enemy.archetypeId === 'heavy'
        ? palette.enemyHeavy
        : enemy.archetypeId === 'sniper'
          ? palette.enemySniper
          : enemy.archetypeId === 'raider'
            ? palette.enemyRaider
            : palette.enemyGrunt
    drawPixelTank(ctx, enemy, trip)
    if (enemy.hp > 1) {
      ctx.fillStyle = palette.hpStrip
      ctx.fillRect(enemy.x + 6, enemy.y - 3, 4, 2)
    }
  }

  for (const bullet of state.bullets) {
    ctx.fillStyle = bullet.owner === 'player' ? palette.bulletPlayer : palette.bulletEnemy
    ctx.beginPath()
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  if (state.levelBannerUntil > 0) {
    ctx.fillStyle = palette.bannerBg
    ctx.fillRect(0, WORLD_H / 2 - 26, WORLD_W, 52)
    ctx.fillStyle = palette.bannerText
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`STAGE ${state.level}`, WORLD_W / 2, WORLD_H / 2 + 7)
  }

  if (state.playerInvincibleUntil > 0 && state.status === 'running') {
    ctx.fillStyle = palette.shieldText
    ctx.font = 'bold 12px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('SPAWN SHIELD', 8, 14)
  }

  if (state.status === 'paused') drawOverlay(ctx, 'PAUSED', palette)
  if (state.status === 'won') {
    const msg = state.level >= 10 ? 'ALL STAGES CLEAR' : 'STAGE CLEAR'
    drawOverlay(ctx, msg, palette)
  }
  if (state.status === 'lost') drawOverlay(ctx, 'GAME OVER', palette)
}
