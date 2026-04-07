import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { GAME } from './game/constants'
import { type GameUiState, FruitNinjaGame } from './fruitNinjaGame'

const initialUi: GameUiState = {
  score: 0,
  paused: false,
  misses: 0,
  gameOver: false,
  phase: 'home',
}

const backBtnClass =
  'border-emerald-900/35 bg-white/50 text-[#14221a] hover:bg-white/75 dark:border-emerald-400/25 dark:bg-white/10 dark:text-[#d8ebe0] dark:hover:bg-white/15'

function StartRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="fnStartRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1aa0ff" />
          <stop offset="45%" stopColor="#166bdb" />
          <stop offset="100%" stopColor="#0b2e7a" />
        </linearGradient>
        <radialGradient id="fnStartRingGlow" cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </radialGradient>
        <path
          id="fnStartRingPath"
          d="M 160, 160 m -108, 0 a 108,108 0 1,1 216,0 a 108,108 0 1,1 -216,0"
        />
      </defs>
      <circle cx="160" cy="160" r="146" fill="rgba(0,0,0,0.18)" />
      <circle
        cx="160"
        cy="160"
        r="125"
        fill="url(#fnStartRing)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="10"
      />
      <circle cx="160" cy="160" r="125" fill="url(#fnStartRingGlow)" />
      <circle cx="160" cy="160" r="92" fill="rgba(0,0,0,0.40)" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
      <text
        fill="rgba(232,248,255,0.92)"
        fontSize="18"
        fontWeight="800"
        letterSpacing="2.4"
        style={{ textTransform: 'uppercase' }}
      >
        <textPath href="#fnStartRingPath" startOffset="4%">
          TAP HERE TO START • TAP HERE TO START • TAP HERE TO START •
        </textPath>
      </text>
    </svg>
  )
}

function SettingsRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="fnSettingsRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b051ff" />
          <stop offset="55%" stopColor="#6b2cff" />
          <stop offset="100%" stopColor="#3a0bb2" />
        </linearGradient>
        <path
          id="fnSettingsRingPath"
          d="M 120, 120 m -78, 0 a 78,78 0 1,1 156,0 a 78,78 0 1,1 -156,0"
        />
      </defs>
      <circle cx="120" cy="120" r="96" fill="rgba(0,0,0,0.14)" />
      <circle
        cx="120"
        cy="120"
        r="82"
        fill="url(#fnSettingsRing)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="10"
      />
      <circle cx="120" cy="120" r="58" fill="rgba(0,0,0,0.28)" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
      <text fill="rgba(245,236,255,0.88)" fontSize="16" fontWeight="800" letterSpacing="2">
        <textPath href="#fnSettingsRingPath" startOffset="10%">
          SETTINGS • SETTINGS • SETTINGS • SETTINGS •
        </textPath>
      </text>
    </svg>
  )
}

export default function FruitNinjaView() {
  const navigate = useNavigate()
  const hostRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<FruitNinjaGame | null>(null)
  const [ui, setUi] = useState<GameUiState>(initialUi)

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
  }, [])

  const onUi = useCallback((s: GameUiState) => {
    setUi(s)
  }, [])

  useEffect(() => {
    const el = hostRef.current
    if (!el) return
    const game = new FruitNinjaGame(el, { onUi, reducedMotion })
    gameRef.current = game
    game.bootstrap()
    return () => {
      game.dispose()
      gameRef.current = null
    }
  }, [onUi, reducedMotion])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'KeyP') {
        e.preventDefault()
        if (!ui.gameOver && ui.phase === 'playing') gameRef.current?.setPaused(!ui.paused)
      }
      if (e.code === 'KeyR') {
        e.preventDefault()
        gameRef.current?.restart()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ui.paused, ui.gameOver, ui.phase])

  const { score, paused, misses, gameOver, phase, error } = ui

  return (
    <main
      className={cn(
        'fruit-ninja-page relative min-h-[100dvh] w-full',
        'bg-gradient-to-b from-[#e8f2ec] via-[#d4e4dc] to-[#c5d8ce]',
        'text-[#14221a]',
        'dark:from-[#0a1210] dark:via-[#060d0a] dark:to-[#050a08]',
        'dark:text-[#d8ebe0]',
        'px-4 py-8 pb-28 sm:px-6 sm:pb-12 sm:pl-24',
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-1 bg-gradient-to-r from-transparent via-emerald-600/45 to-transparent dark:via-teal-500/35"
        aria-hidden
      />

      <div className="relative z-[1] mx-auto max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-serif text-2xl font-bold uppercase tracking-[0.12em] sm:text-3xl">Fruit Ninja</h1>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/games')}
            className={cn(backBtnClass, 'shrink-0')}
            aria-label="Back to game center"
          >
            Back
          </Button>
        </div>

        <div
          className={cn(
            'relative mt-6 w-full overflow-hidden rounded-xl border border-emerald-900/40',
            'bg-[#0d0806] shadow-xl ring-1 ring-black/40',
            'dark:border-emerald-800/35',
          )}
        >
          <div className="relative aspect-[16/10] w-full min-h-[200px]">
            <div ref={hostRef} className="absolute inset-0" aria-label="Fruit Ninja playfield" />

            <div
              className={cn(
                'pointer-events-none absolute left-2 top-2 z-10 sm:left-3 sm:top-3 transition-opacity',
                phase === 'home' && !gameOver ? 'opacity-35' : 'opacity-100',
              )}
              aria-live="polite"
              aria-label={`Score: ${score}`}
            >
              <div
                className="font-mono text-2xl font-bold tabular-nums leading-tight text-white/95 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)] sm:text-3xl"
                data-testid="fruit-ninja-score"
              >
                {score}
              </div>
            </div>

            <div
              className={cn(
                'pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 sm:right-3 sm:top-3 transition-opacity',
                phase === 'home' && !gameOver ? 'opacity-35' : 'opacity-100',
              )}
              aria-label={`Misses: ${misses} of ${GAME.missLimit}`}
            >
              {Array.from({ length: GAME.missLimit }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'font-black leading-none text-2xl sm:text-3xl',
                    i < misses
                      ? 'text-red-500 drop-shadow-[0_0_4px_rgba(0,0,0,0.9)]'
                      : 'text-white/20 drop-shadow-[0_0_3px_rgba(0,0,0,0.7)]',
                  )}
                  aria-hidden="true"
                >
                  ✕
                </span>
              ))}
            </div>

            {phase === 'home' && !gameOver ? (
              <div className="pointer-events-none absolute inset-0 z-[12]">
                {/* Top logo */}
                <div className="absolute left-1/2 top-6 w-[min(92%,720px)] -translate-x-1/2 text-center sm:top-7">
                  <div className="inline-flex items-end gap-3">
                    <div
                      className={cn(
                        'select-none font-black tracking-[0.14em] drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]',
                        'text-4xl sm:text-5xl md:text-6xl',
                      )}
                      aria-hidden="true"
                    >
                      <span className="bg-gradient-to-b from-[#b85cff] via-[#7b45ff] to-[#3a18c9] bg-clip-text text-transparent">
                        F
                      </span>
                      <span className="bg-gradient-to-b from-[#ff4a4a] via-[#ff8a2a] to-[#b60d1b] bg-clip-text text-transparent">
                        R
                      </span>
                      <span className="bg-gradient-to-b from-[#ffd24a] via-[#ffb300] to-[#a36500] bg-clip-text text-transparent">
                        U
                      </span>
                      <span className="bg-gradient-to-b from-[#ffb31a] via-[#ff7a2a] to-[#9a3000] bg-clip-text text-transparent">
                        I
                      </span>
                      <span className="bg-gradient-to-b from-[#6dff5d] via-[#25c95a] to-[#0a6b3c] bg-clip-text text-transparent">
                        T
                      </span>
                    </div>
                    <div
                      className={cn(
                        'select-none font-black tracking-[0.18em]',
                        'text-3xl sm:text-4xl md:text-5xl',
                        'text-transparent bg-clip-text bg-gradient-to-b from-[#f8fbff] via-[#c8d3e0] to-[#6f7d8f]',
                        'drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]',
                      )}
                      aria-hidden="true"
                    >
                      NINJA
                    </div>
                  </div>
                </div>

                {/* Left wood sign */}
                <div className="absolute left-6 top-[34%] -translate-y-1/2 rotate-[-6deg] sm:left-8">
                  <div
                    className={cn(
                      'rounded-lg border border-[#3a250f]/80 bg-gradient-to-b from-[#e3c08c] via-[#c9975a] to-[#7a4e23]',
                      'px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)]',
                    )}
                  >
                    <div className="text-xs font-black tracking-[0.18em] text-[#2a1a09]/90 sm:text-sm">
                      TAP FRUIT
                    </div>
                    <div className="mt-1 text-xs font-black tracking-[0.18em] text-[#2a1a09]/90 sm:text-sm">
                      TO BEGIN
                    </div>
                  </div>
                </div>

                {/* Center start ring (watermelon rendered by 3D) */}
                <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2">
                  <div className="relative h-[min(58vw,360px)] w-[min(58vw,360px)]">
                    <StartRing className={cn('absolute inset-0', 'animate-[spin_18s_linear_infinite]')} />
                    <div className="absolute inset-0 rounded-full shadow-[0_30px_70px_rgba(0,0,0,0.55)]" />
                  </div>
                </div>

                {/* Right settings ring (decorative) */}
                <div className="absolute right-8 top-[54%] hidden -translate-y-1/2 sm:block">
                  <div className="relative h-[150px] w-[150px] opacity-95">
                    <SettingsRing className="absolute inset-0 animate-[spin_28s_linear_infinite_reverse]" />
                  </div>
                </div>

                {/* Bottom hint */}
                <div className="absolute inset-x-0 bottom-5 flex justify-center px-6">
                  <div className="rounded-full bg-black/35 px-4 py-2 text-xs font-semibold tracking-wide text-white/85 ring-1 ring-white/10 backdrop-blur-sm">
                    切开中央大西瓜开始游戏
                  </div>
                </div>
              </div>
            ) : null}

            {paused && !gameOver ? (
              <div
                className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/50 backdrop-blur-[2px]"
                onClick={() => gameRef.current?.setPaused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    gameRef.current?.setPaused(false)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Resume game"
              >
                <div
                  className={cn(
                    'pointer-events-none rounded-2xl border border-emerald-800/35 bg-black/70 px-10 py-6 text-center shadow-2xl',
                    'backdrop-blur-md ring-1 ring-emerald-700/15',
                  )}
                >
                  <div className="font-serif text-xl font-semibold tracking-wide text-emerald-50">Paused</div>
                </div>
              </div>
            ) : null}
            {gameOver ? (
              <div className="pointer-events-none absolute inset-0 z-[40] flex items-center justify-center">
                <div className="pointer-events-auto max-w-sm rounded-2xl border border-emerald-800/45 bg-gradient-to-b from-emerald-950/95 to-black/95 p-8 text-center shadow-2xl ring-2 ring-red-900/25">
                  <div className="font-serif text-2xl font-bold uppercase tracking-[0.15em] text-emerald-50">
                    Game Over
                  </div>
                  <p className="mt-3 text-sm text-emerald-200/75">Final score</p>
                  <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-white">{score}</p>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Button type="button" onClick={() => gameRef.current?.restart()}>
                      再玩一次
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => gameRef.current?.goToHomeScreen()}>
                      返回首页
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-6 sm:pl-24">
          <div className="max-w-md rounded-xl border border-red-500/30 bg-card p-6 text-center shadow-xl">
            <div className="text-lg font-semibold text-red-200">Could not start Fruit Ninja</div>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button type="button" className="mt-4" variant="secondary" onClick={() => navigate('/games')}>
              Return to Game Center
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  )
}
