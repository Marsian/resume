import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TouchControls } from './TouchControls'
import { WORLD_H, WORLD_W } from './core/constants'
import { RENDER_PALETTE } from './core/palette'
import { draw } from './core/render'
import { createState } from './core/state'
import type { GameState, GameStatus, InputState, PowerUpKind } from './core/types'
import { updateState } from './core/update'
import { tank90DebugStore } from './debugStore'

type GameEvent = { t: number; type: 'info' | 'warn' | 'state' | 'combat'; msg: string }
const MOVEMENT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function useTouchPrimary() {
  const [touchPrimary, setTouchPrimary] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(pointer: coarse) and (hover: none)')
    const sync = () => setTouchPrimary(q.matches)
    sync()
    q.addEventListener('change', sync)
    return () => q.removeEventListener('change', sync)
  }, [])
  return touchPrimary
}

function TankBattle90View() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const spawnQueueCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const stateRef = useRef<GameState>(createState(1))
  const inputRef = useRef<InputState>({ up: false, down: false, left: false, right: false, fire: false })
  const frameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const eventsRef = useRef<GameEvent[]>([])
  const [ui, setUi] = useState({
    stage: 1,
    status: 'ready' as GameStatus,
    enemiesDestroyed: 0,
    enemiesTotal: stateRef.current.enemiesTotal,
    playerAlive: true,
    levelName: stateRef.current.levelName,
    levelIntent: stateRef.current.levelIntent,
  })
  const [debugTick, setDebugTick] = useState(0)
  const touchPrimary = useTouchPrimary()
  const debugEnabled = tank90DebugStore.enabled

  const e2eEnabled = useMemo(() => {
    if (typeof window === 'undefined') return false
    const sp = new URL(window.location.href).searchParams
    return sp.get('e2e') === '1' || sp.get('e2e') === 'true'
  }, [])

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  }, [])

  const syncUi = (state: GameState) =>
    setUi({
      stage: state.level,
      status: state.status,
      enemiesDestroyed: state.enemiesDestroyed,
      enemiesTotal: state.enemiesTotal,
      playerAlive: state.player.alive,
      levelName: state.levelName,
      levelIntent: state.levelIntent,
    })

  useEffect(() => {
    // Keep existing behavior: allow `?debug=1` only in dev builds.
    if (!import.meta.env.DEV) return
    if (typeof window === 'undefined') return
    const flag = new URL(window.location.href).searchParams.get('debug')
    if (flag === '1' || flag === 'true') tank90DebugStore.enable()
  }, [])

  useEffect(() => {
    if (!e2eEnabled) return
    if (typeof window === 'undefined') return
    const w = window as unknown as {
      __tank90_e2e?: {
        getSnapshot: () => unknown
        injectEnemyBulletOnPlayer: () => void
        placePowerUpOnPlayer: (kind: PowerUpKind) => void
        setPowerTier: (tier: 0 | 1 | 2 | 3) => void
        killAllEnemiesAndWin: () => void
      }
    }
    w.__tank90_e2e = {
      getSnapshot: () => {
        const st = stateRef.current
        return {
          status: st.status,
          level: st.level,
          enemiesDestroyed: st.enemiesDestroyed,
          enemiesTotal: st.enemiesTotal,
          enemiesAlive: st.enemies.filter((e) => e.alive).length,
          enemies: st.enemies.filter((e) => e.alive).map((e) => ({ id: e.id, x: e.x, y: e.y })),
          player: { alive: st.player.alive, x: st.player.x, y: st.player.y },
          livesReserve: st.playerLivesReserve,
          powerTier: st.playerPowerTier,
          powerUp: st.powerUp ? { kind: st.powerUp.kind, x: st.powerUp.x, y: st.powerUp.y } : null,
          freezeMsLeft: Math.max(0, st.freezeEnemiesUntilMs - st.elapsedMs),
          shovelMsLeft: Math.max(0, st.baseSteelUntilMs - st.elapsedMs),
        }
      },
      injectEnemyBulletOnPlayer: () => {
        const st = stateRef.current
        st.playerInvincibleUntil = 0
        st.bullets.push({
          x: st.player.x + 8,
          y: st.player.y + 8,
          vx: 0,
          vy: 0,
          radius: 3,
          owner: 'enemy',
          alive: true,
        })
      },
      placePowerUpOnPlayer: (kind: PowerUpKind) => {
        const st = stateRef.current
        const x = Math.max(0, Math.min(WORLD_W - 16, Math.floor(st.player.x / 16) * 16))
        const y = Math.max(0, Math.min(WORLD_H - 16, Math.floor(st.player.y / 16) * 16))
        st.powerUp = { kind, x, y, spawnedAtMs: st.elapsedMs, despawnAtMs: st.elapsedMs + 20000 }
      },
      setPowerTier: (tier: 0 | 1 | 2 | 3) => {
        const st = stateRef.current
        st.playerPowerTier = tier
      },
      killAllEnemiesAndWin: () => {
        const st = stateRef.current
        st.enemies.forEach((e) => (e.alive = false))
        st.enemiesDestroyed = st.enemiesTotal
        st.enemiesSpawned = st.enemiesTotal
        st.status = 'won'
      },
    }
    return () => {
      delete w.__tank90_e2e
    }
  }, [e2eEnabled])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const code = event.code

      // 1) Debug unlock: tap `D` three times quickly (global MobX state).
      if (code === 'KeyD' && !event.repeat) tank90DebugStore.onKeyD()

      const st = stateRef.current

      // 2) Before start: pressing FIRE (Space) starts the game.
      if (code === 'Space' && !event.repeat && st.status === 'ready') {
        if (!isInteractiveTarget(event.target)) event.preventDefault()
        startOrRestartFromStage1()
        // Do not `return`: allow `Space` to also set `input.fire = true` below.
      }

      // 3) Next stage: after finishing, pressing `Space` goes to next.
      const wantsFireAdvance = code === 'Space' && !event.repeat && st.status === 'won'
      if (wantsFireAdvance) {
        event.preventDefault()
        event.stopPropagation()
        if (st.level >= 10) playAgainAfterFinal()
        else nextStage()
        return
      }

      // 4) Never allow page scrolling from arrow keys.
      if (MOVEMENT_KEYS.has(code)) event.preventDefault()

      if (code === 'Space' && !isInteractiveTarget(event.target)) event.preventDefault()
      if (code === 'ArrowUp') inputRef.current.up = true
      if (code === 'ArrowDown') inputRef.current.down = true
      if (code === 'ArrowLeft') inputRef.current.left = true
      if (code === 'ArrowRight') inputRef.current.right = true
      if (code === 'Space') inputRef.current.fire = true
      if (code === 'KeyP') {
        const st = stateRef.current
        st.status = st.status === 'running' ? 'paused' : 'running'
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const code = event.code
      if (code === 'Space' && !isInteractiveTarget(event.target)) event.preventDefault()
      if (code === 'ArrowUp') inputRef.current.up = false
      if (code === 'ArrowDown') inputRef.current.down = false
      if (code === 'ArrowLeft') inputRef.current.left = false
      if (code === 'ArrowRight') inputRef.current.right = false
      if (code === 'Space') inputRef.current.fire = false
    }
    window.addEventListener('keydown', onKeyDown, { passive: false })
    window.addEventListener('keyup', onKeyUp, { passive: false })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const previewCtx = spawnQueueCanvasRef.current?.getContext('2d')
    const previewW = previewCtx?.canvas.width ?? WORLD_W
    const previewH = previewCtx?.canvas.height ?? 56

    const tick = (t: number) => {
      const state = stateRef.current
      const dt = Math.min((t - (lastTimeRef.current || t)) / 1000, 1 / 30)
      lastTimeRef.current = t
      if (state.levelBannerUntil > 0) state.levelBannerUntil -= dt * 1000
      if (state.status === 'running') updateState(state, dt, t, inputRef.current)

      // Draw enemy spawn queue preview (independent canvas).
      if (previewCtx) {
        previewCtx.imageSmoothingEnabled = false
        previewCtx.clearRect(0, 0, previewW, previewH)
        // Slightly lighter than main playfield to read as a UI panel.
        previewCtx.fillStyle = '#1f2937'
        previewCtx.fillRect(0, 0, previewW, previewH)

        const enemySlots = 14
        const remaining = Math.max(0, state.enemiesTotal - state.enemiesSpawned)
        const enemyIconsToDraw = Math.min(enemySlots, remaining)
        const livesTotal = Math.max(1, Math.max(0, state.playerLivesReserve) + 1)
        const totalIcons = enemySlots + livesTotal
        const cell = Math.max(1, Math.floor(previewW / totalIcons))
        const padX = Math.floor((previewW - totalIcons * cell) / 2)
        const iconSize = Math.max(6, Math.min(10, Math.floor(cell * 0.62)))
        const y = Math.floor((previewH - iconSize) / 2)

        const toColors = (archId: string) => {
          if (archId === 'armor') return RENDER_PALETTE.enemyHeavy
          if (archId === 'power') return RENDER_PALETTE.enemySniper
          if (archId === 'fast') return RENDER_PALETTE.enemyRaider
          return RENDER_PALETTE.enemyGrunt
        }

        for (let i = 0; i < enemyIconsToDraw; i += 1) {
          const idx = state.enemiesSpawned + i
          const arch = state.enemyQueue[idx] ?? state.enemyQueue[0] ?? 'basic'
          const [body, trim, barrel] = toColors(arch)
          const x = padX + i * cell + Math.floor((cell - iconSize) / 2)

          // Outer body
          previewCtx.fillStyle = body
          previewCtx.fillRect(x, y, iconSize, iconSize)
          if (arch === 'armor') {
            // Armor: extra outline so it's recognizable in the queue.
            previewCtx.strokeStyle = 'rgba(248,250,252,0.9)'
            previewCtx.lineWidth = 1
            previewCtx.strokeRect(x - 1, y - 1, iconSize + 2, iconSize + 2)
          }
          // Inner trim
          previewCtx.fillStyle = body
          previewCtx.fillStyle = trim
          previewCtx.fillRect(x + 2, y + 2, iconSize - 4, iconSize - 4)
          previewCtx.fillStyle = trim
          previewCtx.fillRect(x + Math.floor(iconSize / 2) - 1, y + Math.floor(iconSize * 0.35) + 2, 2, 5)
          // Barrel-ish accent (simple vertical line)
          previewCtx.fillStyle = barrel
          previewCtx.fillRect(x + Math.floor(iconSize / 2) - 1, y + Math.floor(iconSize * 0.35) + 2, 2, Math.max(3, Math.floor(iconSize * 0.45)))
        }

        // Lives (right side): draw N player mini-tanks (no "×4" text).
        const [pBody, pTrim, pBarrel] = RENDER_PALETTE.playerTank
        for (let i = 0; i < livesTotal; i += 1) {
          const slot = enemySlots + i
          const x = padX + slot * cell + Math.floor((cell - iconSize) / 2)
          previewCtx.fillStyle = pTrim
          previewCtx.fillRect(x, y, iconSize, iconSize)
          previewCtx.fillStyle = pBody
          previewCtx.fillRect(x + 2, y + 2, iconSize - 4, iconSize - 4)
          previewCtx.fillStyle = pTrim
          previewCtx.fillRect(x + Math.floor(iconSize / 2) - 1, y + Math.floor(iconSize * 0.45), 2, 2)
          previewCtx.fillStyle = pBarrel
          // Keep the barrel inside the icon box (no overhang).
          previewCtx.fillRect(x + Math.floor(iconSize / 2) - 1, y + 1, 2, Math.max(3, Math.floor(iconSize * 0.35)))
        }
      }

      draw(ctx, state, RENDER_PALETTE, { reducedMotion })
      syncUi(state)
      frameRef.current = window.requestAnimationFrame(tick)
    }
    frameRef.current = window.requestAnimationFrame(tick)
    return () => {
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current)
    }
  }, [reducedMotion])

  const beginRunFromLevel = (level: number) => {
    const next = createState(level)
    next.status = 'running'
    stateRef.current = next
    inputRef.current = { up: false, down: false, left: false, right: false, fire: false }
    syncUi(next)
    // Ensure keyboard focus follows gameplay, even in strict automation environments.
    window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }))
  }

  const startOrRestartFromStage1 = () => {
    const st = stateRef.current
    if (st.status === 'ready') {
      st.status = 'running'
      syncUi(st)
      window.requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }))
      return
    }
    beginRunFromLevel(1)
  }

  const retryCurrentStage = () => {
    if (stateRef.current.status !== 'lost') return
    beginRunFromLevel(stateRef.current.level)
  }

  const nextStage = () => {
    if (stateRef.current.status !== 'won') return
    if (stateRef.current.level >= 10) return
    beginRunFromLevel(stateRef.current.level + 1)
  }

  const playAgainAfterFinal = () => {
    if (stateRef.current.status !== 'won' || stateRef.current.level < 10) return
    beginRunFromLevel(1)
  }

  const controlsHint = touchPrimary
    ? 'TOUCH: DRAG JOYSTICK MOVE / HOLD FIRE SHOOT / PAUSE TOGGLE'
    : 'KEYBOARD: ARROWS MOVE / SPACE FIRE / P PAUSE'

  const showRetry = ui.status === 'lost'
  const showNext = ui.status === 'won' && ui.stage < 10
  const showPlayAgain = ui.status === 'won' && ui.stage >= 10

  const shellBtn =
    'font-mono text-[11px] border-amber-900/25 bg-white/45 text-[#2a2018] hover:bg-white/70 dark:border-amber-400/25 dark:bg-white/10 dark:text-[#f4ead8] dark:hover:bg-white/15'

  const backBtnClass =
    'font-mono text-[11px] border-amber-800/40 bg-white/40 text-[#2a2018] hover:bg-white/60 dark:border-amber-400/25 dark:bg-white/10 dark:text-[#f4ead8] dark:hover:bg-white/15'

  return (
    <main
      className={cn(
        'tank90-page relative min-h-screen px-4 py-8 pb-36 sm:px-6 sm:pb-12 sm:pl-24',
        'bg-gradient-to-b from-[#f0e8dc] via-[#e6dccf] to-[#d8cbb8]',
        'text-[#1a1410]',
        'dark:from-[#161018] dark:via-[#0f0c12] dark:to-[#08060a]',
        'dark:text-[#ebe4d6]',
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 bg-gradient-to-r from-transparent via-amber-500/55 to-transparent dark:via-amber-400/35"
        aria-hidden
      />
      <div className="relative z-[1] mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl tracking-[0.18em] text-[#3d2e18] sm:text-3xl dark:text-[#f0d9a8]">
              90 TANK BATTLE
            </h1>
            <p className="mt-2 font-mono text-xs tracking-[0.06em] text-[#5c4d3d] sm:text-sm dark:text-[#a89880]">
              {controlsHint}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/')}
            className={cn(backBtnClass)}
            aria-label="Back to home"
            title="Back to home"
          >
            Back
          </Button>
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-sm text-[#2a2018] dark:text-[#e8dcc8]">
              STAGE {ui.stage}
              <span className="sr-only">
                {ui.status.toUpperCase()} | PLAYER {ui.playerAlive ? 'ALIVE' : 'DEAD'}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                onClick={startOrRestartFromStage1}
                className="font-mono border-amber-800/35 bg-gradient-to-b from-amber-400/90 to-amber-600/90 text-amber-950 hover:from-amber-300 hover:to-amber-500 dark:from-amber-500/90 dark:to-amber-700/90 dark:text-amber-50"
              >
                {ui.status === 'ready' ? 'START' : 'RESTART'}
              </Button>
              {showRetry ? (
                <Button
                  type="button"
                  variant="secondary"
                  className={cn('font-mono', shellBtn)}
                  onClick={retryCurrentStage}
                >
                  RETRY
                </Button>
              ) : null}
              {showNext ? (
                <Button
                  type="button"
                  className="font-mono border-emerald-800/30 bg-emerald-800/15 text-emerald-950 hover:bg-emerald-800/25 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-100"
                  onClick={nextStage}
                >
                  NEXT STAGE
                </Button>
              ) : null}
              {showPlayAgain ? (
                <Button
                  type="button"
                  className="font-mono border-rose-800/30 bg-rose-900/15 text-rose-950 hover:bg-rose-900/25 dark:border-rose-400/35 dark:bg-rose-950/40 dark:text-rose-100"
                  onClick={playAgainAfterFinal}
                >
                  PLAY AGAIN
                </Button>
              ) : null}
            </div>
          </div>
          {debugEnabled ? (
            <div
              className={cn(
                'rounded-xl border px-3 py-2 shadow-lg ring-1 ring-black/5 sm:px-4',
                'border-black/10 bg-white/40 backdrop-blur-sm',
                'dark:border-white/10 dark:bg-black/25 dark:ring-white/10',
              )}
            >
              <div className="w-full">
                <div className="flex flex-nowrap gap-2 overflow-x-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    className={shellBtn}
                    onClick={() => {
                      const st = stateRef.current
                      st.enemies.forEach((e) => (e.alive = false))
                      st.enemiesDestroyed = st.enemiesTotal
                      st.enemiesSpawned = st.enemiesTotal
                      st.status = 'won'
                      syncUi(st)
                    }}
                  >
                    FORCE_WIN
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={shellBtn}
                    onClick={() => {
                      const st = stateRef.current
                      st.base.alive = false
                      st.player.alive = false
                      st.status = 'lost'
                      syncUi(st)
                    }}
                  >
                    FORCE_LOSE
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={shellBtn}
                    onClick={() => {
                      const st = stateRef.current
                      st.enemies.forEach((e) => (e.alive = false))
                      st.enemiesDestroyed = st.enemiesTotal
                      st.enemiesSpawned = st.enemiesTotal
                      st.status = 'won'
                      syncUi(st)
                    }}
                  >
                    CLEAR_ENEMIES
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={shellBtn}
                    onClick={() => {
                      const st = stateRef.current
                      st.status = st.status === 'paused' ? 'running' : 'paused'
                      syncUi(st)
                    }}
                  >
                    TOGGLE_PAUSE
                  </Button>
                </div>
                <div className="sr-only">
                  DEBUG {eventsRef.current.length} {debugTick}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div
          className={cn(
            'mt-4 rounded-xl border p-3 shadow-lg ring-1 ring-black/5 overflow-hidden',
            'border-black/10 bg-white/40 backdrop-blur-sm',
            'dark:border-white/10 dark:bg-black/25 dark:ring-white/10',
          )}
        >
          <div className="relative mx-auto w-full max-w-[640px]">
            <canvas
              ref={spawnQueueCanvasRef}
              width={WORLD_W}
              height={24}
              className="block w-full aspect-[416/24] rounded-none border border-[#3d3428]/80 border-b-0 bg-[#1f2937] [image-rendering:pixelated] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)] outline-none focus:outline-none focus-visible:outline-none dark:border-[#6b5a3e]/70"
              aria-label="Enemy spawn queue"
              role="img"
            />
            <div className="relative mt-0 aspect-square">
              <canvas
                ref={canvasRef}
                width={WORLD_W}
                height={WORLD_H}
                tabIndex={0}
                onPointerDown={() => canvasRef.current?.focus({ preventScroll: true })}
                className="block h-full w-full rounded-none border border-[#3d3428] border-t-0 bg-[#0d0e12] [image-rendering:pixelated] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] outline-none focus:outline-none focus-visible:outline-none dark:border-[#6b5a3e]"
                data-testid="tank90-canvas"
                aria-label="Tank battle playfield"
                role="img"
              />
            </div>
          </div>
        </div>
        {touchPrimary ? (
          <TouchControls
            className="max-w-[640px] mx-auto"
            onMoveChange={(next) => Object.assign(inputRef.current, next)}
            onFireChange={(fire) => {
              const st = stateRef.current
              // Before start: pressing Touch FIRE should behave like clicking START.
              if (fire && st.status === 'ready') {
                startOrRestartFromStage1()
              }
              // 1) Mobile: after finishing a stage (WON), pressing FIRE should go to next stage.
              if (fire && st.status === 'won') {
                if (st.level >= 10) playAgainAfterFinal()
                else nextStage()
                // Prevent lingering "fire" state while stage changes.
                inputRef.current.fire = false
                return
              }
              inputRef.current.fire = fire
            }}
            onPauseToggle={() => {
              const st = stateRef.current
              st.status = st.status === 'paused' ? 'running' : 'paused'
              syncUi(st)
            }}
          />
        ) : null}
      </div>
    </main>
  )
}

export default observer(TankBattle90View)
