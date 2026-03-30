import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TouchControls } from './TouchControls'
import { WORLD_H, WORLD_W } from './core/constants'
import { RENDER_PALETTE } from './core/palette'
import { draw } from './core/render'
import { createState } from './core/state'
import type { GameState, GameStatus, InputState } from './core/types'
import { updateState } from './core/update'

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

export default function TankBattle90View() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
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
    levelIntent: stateRef.current.levelIntent,
  })
  const [debugTick, setDebugTick] = useState(0)
  const touchPrimary = useTouchPrimary()

  const debugEnabled = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return false
    const flag = new URL(window.location.href).searchParams.get('debug')
    return flag === '1' || flag === 'true'
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
      levelIntent: state.levelIntent,
    })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const code = event.code
      if ((MOVEMENT_KEYS.has(code) || code === 'Space') && !isInteractiveTarget(event.target)) event.preventDefault()
      if (code === 'KeyW' || code === 'ArrowUp') inputRef.current.up = true
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = true
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = true
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = true
      if (code === 'Space') inputRef.current.fire = true
      if (code === 'KeyP') {
        const st = stateRef.current
        st.status = st.status === 'running' ? 'paused' : 'running'
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const code = event.code
      if ((MOVEMENT_KEYS.has(code) || code === 'Space') && !isInteractiveTarget(event.target)) event.preventDefault()
      if (code === 'KeyW' || code === 'ArrowUp') inputRef.current.up = false
      if (code === 'KeyS' || code === 'ArrowDown') inputRef.current.down = false
      if (code === 'KeyA' || code === 'ArrowLeft') inputRef.current.left = false
      if (code === 'KeyD' || code === 'ArrowRight') inputRef.current.right = false
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
    const tick = (t: number) => {
      const state = stateRef.current
      const dt = Math.min((t - (lastTimeRef.current || t)) / 1000, 1 / 30)
      lastTimeRef.current = t
      if (state.levelBannerUntil > 0) state.levelBannerUntil -= dt * 1000
      if (state.status === 'running') updateState(state, dt, t, inputRef.current)
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
  }

  const startOrRestartFromStage1 = () => {
    const st = stateRef.current
    if (st.status === 'ready') {
      st.status = 'running'
      syncUi(st)
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
    : 'KEYBOARD: WASD + ARROWS MOVE / SPACE FIRE / P PAUSE'

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
        <div
          className={cn(
            'mt-6 rounded-xl border px-3 py-3 shadow-md ring-1 ring-amber-900/10 sm:px-4',
            'border-black/10 bg-white/55 backdrop-blur-sm',
            'dark:border-white/10 dark:bg-white/[0.06] dark:ring-amber-400/15',
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-mono text-sm text-[#2a2018] dark:text-[#e8dcc8]">
              STAGE {ui.stage} | ENEMY {ui.enemiesDestroyed}/{ui.enemiesTotal} | {ui.status.toUpperCase()} | PLAYER{' '}
              {ui.playerAlive ? 'ALIVE' : 'DEAD'}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={startOrRestartFromStage1}
                className="font-mono border-amber-800/35 bg-gradient-to-b from-amber-400/90 to-amber-600/90 text-amber-950 hover:from-amber-300 hover:to-amber-500 dark:from-amber-500/90 dark:to-amber-700/90 dark:text-amber-50"
              >
                {ui.status === 'ready' ? 'START' : 'RESTART'}
              </Button>
              {showRetry ? (
                <Button type="button" variant="secondary" className={cn('font-mono', shellBtn)} onClick={retryCurrentStage}>
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
        </div>
        {debugEnabled ? (
          <div
            className={cn(
              'mt-4 rounded-xl border px-3 py-2 shadow-lg ring-1 ring-black/5 sm:px-4',
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
        <div
          className={cn(
            'mt-4 rounded-xl border p-3 shadow-lg ring-1 ring-black/5',
            'border-black/10 bg-white/40 backdrop-blur-sm',
            'dark:border-white/10 dark:bg-black/25 dark:ring-white/10',
          )}
        >
          <div className="relative mx-auto w-full max-w-[640px] aspect-square">
            <canvas
              ref={canvasRef}
              width={WORLD_W}
              height={WORLD_H}
              className="block h-full w-full rounded-md border-2 border-[#3d3428] bg-[#0d0e12] [image-rendering:pixelated] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] dark:border-[#6b5a3e]"
              data-testid="tank90-canvas"
              aria-label="Tank battle playfield"
              role="img"
            />
          </div>
        </div>
        {touchPrimary ? (
          <TouchControls className="max-w-[640px] mx-auto" onMoveChange={(next) => Object.assign(inputRef.current, next)} onFireChange={(fire) => { inputRef.current.fire = fire }} onPauseToggle={() => { const st = stateRef.current; st.status = st.status === 'paused' ? 'running' : 'paused'; syncUi(st) }} />
        ) : null}
        <p className="mt-4 font-mono text-xs leading-relaxed text-[#5c4d3d] dark:text-[#9a8b72]">{ui.levelIntent}</p>
      </div>
    </main>
  )
}
