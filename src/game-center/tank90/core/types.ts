import type { Direction, EnemyArchetypeId, TerrainType } from '../levels'

export type GameStatus = 'ready' | 'running' | 'paused' | 'won' | 'lost'

export type PowerUpKind = 'grenade' | 'helmet' | 'shovel' | 'star' | 'tank' | 'timer'

export type SfxEventType = 'fire' | 'destroyed' | 'powerup'
export interface SfxEvent {
  type: SfxEventType
  atMs: number
}

export interface Tank {
  id: string
  x: number
  y: number
  dir: Direction
  speed: number
  reloadMs: number
  lastShotAt: number
  alive: boolean
  isEnemy: boolean
  aiTurnAt: number
  hp: number
  archetypeId?: EnemyArchetypeId
  bulletSpeed: number
  turnIntervalMs: number
  fireChance: number
  chaseBias: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  owner: 'player' | 'enemy'
  alive: boolean
}

export interface TileBlock {
  x: number
  y: number
  size: number
  hp: number
  type: TerrainType
}

export interface Base {
  x: number
  y: number
  size: number
  alive: boolean
}

export interface GameState {
  status: GameStatus
  level: number
  levelName: string
  levelIntent: string
  sfxQueue: SfxEvent[]
  player: Tank
  enemies: Tank[]
  bullets: Bullet[]
  terrain: TileBlock[]
  base: Base
  spawnCooldown: number
  enemiesSpawned: number
  enemiesDestroyed: number
  enemiesTotal: number
  levelBannerUntil: number
  elapsedMs: number
  playerLivesReserve: number
  playerInvincibleUntil: number
  playerPowerTier: 0 | 1 | 2 | 3
  freezeEnemiesUntilMs: number
  baseSteelUntilMs: number
  powerUp:
    | null
    | {
        kind: PowerUpKind
        x: number
        y: number
        spawnedAtMs: number
        despawnAtMs: number
      }
  nextPowerUpAtMs: number
  powerUpToastText: string
  powerUpToastUntilMs: number
  enemyQueue: EnemyArchetypeId[]
}

export interface InputState {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
  fire: boolean
}
