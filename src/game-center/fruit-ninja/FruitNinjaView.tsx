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
        <mask id="fnStartRingMask">
          <rect x="0" y="0" width="320" height="320" fill="black" />
          {/* show outer disk */}
          <circle cx="160" cy="160" r="125" fill="white" />
          {/* cut inner hole */}
          <circle cx="160" cy="160" r="92" fill="black" />
        </mask>
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
        mask="url(#fnStartRingMask)"
      />
      <circle cx="160" cy="160" r="125" fill="url(#fnStartRingGlow)" mask="url(#fnStartRingMask)" />
      {/* Inner rim */}
      <circle cx="160" cy="160" r="92" fill="transparent" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
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

function FruitNinjaLogo({ className }: { className?: string }) {
  // Pixel-ish logo: colored FRUIT + metallic NINJA with heavy drop shadows
  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <div className="flex items-end gap-3">
        <div className="text-[56px] font-black tracking-[0.14em] drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)]">
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
        <div className="text-[48px] font-black tracking-[0.18em] drop-shadow-[0_12px_24px_rgba(0,0,0,0.55)]">
          <span className="bg-gradient-to-b from-[#f8fbff] via-[#c8d3e0] to-[#6f7d8f] bg-clip-text text-transparent">
            NINJA
          </span>
        </div>
      </div>
    </div>
  )
}

function WoodSign({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none select-none', className)} aria-hidden="true">
      <div
        className={cn(
          'rounded-[10px] border border-[#3a250f]/85',
          'bg-gradient-to-b from-[#f1d2a3] via-[#cc9a5f] to-[#7a4e23]',
          'px-6 py-5',
          'shadow-[0_18px_40px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className="text-[12px] font-black tracking-[0.2em] text-[#2a1a09]/90">TAP FRUIT</div>
        <div className="mt-1 text-[12px] font-black tracking-[0.2em] text-[#2a1a09]/90">TO BEGIN</div>
      </div>
    </div>
  )
}

function HomeOverlay() {
  // Strictly independent UI layer (no HUD). All pointer events go to the canvas below.
  return (
    <div className="pointer-events-none absolute inset-0 z-[30]">
      {/* top logo */}
      <div className="absolute left-[60px] top-[18px]">
        <FruitNinjaLogo />
      </div>

      {/* left sign */}
      <WoodSign className="absolute left-[64px] top-[132px] rotate-[-6deg]" />

      {/* center start ring */}
      <div className="absolute left-[370px] top-[238px] -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-[260px] w-[260px]">
          <StartRing className="absolute inset-0 animate-[spin_22s_linear_infinite]" />
          <div className="absolute inset-0 rounded-full shadow-[0_30px_70px_rgba(0,0,0,0.55)]" />
        </div>
      </div>

      {/* right settings ring */}
      <div className="absolute left-[590px] top-[205px] -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-[170px] w-[170px]">
          <SettingsRing className="absolute inset-0 animate-[spin_28s_linear_infinite_reverse]" />
        </div>
      </div>
    </div>
  )
}

function GameOverOverlay({
  score,
  onRetry,
  onQuit,
}: {
  score: number
  onRetry: () => void
  onQuit: () => void
}) {
  // Strict independent layer (no HUD). Click only on the two round buttons.
  return (
    <div className="absolute inset-0 z-[60]">
      {/* parchment board */}
      <div className="absolute left-1/2 top-[34px] w-[86%] -translate-x-1/2">
        <div className="relative rounded-[10px] border border-[#6a4a1d]/70 bg-gradient-to-b from-[#f3e3be] via-[#e7d1a4] to-[#d7b77f] shadow-[0_22px_60px_rgba(0,0,0,0.55)]">
          <div className="py-[28px] text-center">
            <div
              className="mx-auto text-[44px] font-black tracking-[0.12em] text-[#e4b54a]"
              style={{ WebkitTextStroke: '8px rgba(90,60,18,0.92)' }}
            >
              SCORE
            </div>
            <div
              className="mt-[-6px] text-[140px] font-black tabular-nums text-[#f2c24a]"
              style={{
                WebkitTextStroke: '12px rgba(90,60,18,0.92)',
                textShadow: '0 10px 0 rgba(0,0,0,0.20)',
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div
              className="mt-[-10px] text-[36px] font-black tracking-[0.08em] text-[#e36b2f]"
              style={{ WebkitTextStroke: '8px rgba(90,40,10,0.92)' }}
            >
              NEW BEST!
            </div>
          </div>
        </div>
      </div>

      {/* retry button */}
      <button
        type="button"
        aria-label="再玩一次"
        onClick={onRetry}
        className="absolute left-[36%] top-[78%] h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
      <div className="pointer-events-none absolute left-[36%] top-[78%] h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2">
        <StartRing className="absolute inset-0 opacity-95 [filter:drop-shadow(0_18px_22px_rgba(0,0,0,0.45))]" />
      </div>

      {/* quit button */}
      <button
        type="button"
        aria-label="返回首页"
        onClick={onQuit}
        className="absolute left-[64%] top-[78%] h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full"
      />
      <div className="pointer-events-none absolute left-[64%] top-[78%] h-[170px] w-[170px] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 320 320" className="absolute inset-0 opacity-95 [filter:drop-shadow(0_18px_22px_rgba(0,0,0,0.45))]" aria-hidden="true">
          <defs>
            <linearGradient id="fnQuitRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff2a2a" />
              <stop offset="55%" stopColor="#c01010" />
              <stop offset="100%" stopColor="#6a0000" />
            </linearGradient>
            <mask id="fnQuitMask">
              <rect x="0" y="0" width="320" height="320" fill="black" />
              <circle cx="160" cy="160" r="125" fill="white" />
              <circle cx="160" cy="160" r="92" fill="black" />
            </mask>
            <path id="fnQuitPath" d="M 160, 160 m -108, 0 a 108,108 0 1,1 216,0 a 108,108 0 1,1 -216,0" />
          </defs>
          <circle cx="160" cy="160" r="146" fill="rgba(0,0,0,0.18)" />
          <circle cx="160" cy="160" r="125" fill="url(#fnQuitRing)" stroke="rgba(255,255,255,0.18)" strokeWidth="10" mask="url(#fnQuitMask)" />
          <circle cx="160" cy="160" r="92" fill="transparent" stroke="rgba(255,255,255,0.10)" strokeWidth="6" />
          <text fill="rgba(255,240,240,0.92)" fontSize="18" fontWeight="900" letterSpacing="2.4" style={{ textTransform: 'uppercase' }}>
            <textPath href="#fnQuitPath" startOffset="10%">
              QUIT • QUIT • QUIT • QUIT • QUIT •
            </textPath>
          </text>
        </svg>
      </div>
    </div>
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
  const showHud = phase === 'playing' && !gameOver

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

            {showHud ? (
              <>
                <div
                  className="pointer-events-none absolute left-2 top-2 z-10 sm:left-3 sm:top-3"
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
                  className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1.5 sm:right-3 sm:top-3"
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
              </>
            ) : null}

            {phase === 'home' && !gameOver ? <HomeOverlay /> : null}

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
              <GameOverOverlay
                score={score}
                onRetry={() => gameRef.current?.restart()}
                onQuit={() => gameRef.current?.goToHomeScreen()}
              />
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
